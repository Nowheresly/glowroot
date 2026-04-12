/*
 * Copyright 2013-2023 the original author or authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package org.glowroot.ui;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletionStage;

import com.google.common.annotations.VisibleForTesting;
import com.google.common.base.Strings;
import com.google.common.base.Supplier;
import com.google.common.collect.ImmutableList;
import com.google.common.net.MediaType;
import io.netty.buffer.ByteBuf;
import io.netty.buffer.Unpooled;
import io.netty.channel.Channel;
import io.netty.channel.ChannelFuture;
import io.netty.channel.ChannelFutureListener;
import io.netty.channel.ChannelHandler.Sharable;
import io.netty.channel.ChannelHandlerContext;
import io.netty.channel.ChannelInboundHandlerAdapter;
import io.netty.channel.group.ChannelGroup;
import io.netty.channel.group.DefaultChannelGroup;
import io.netty.handler.codec.http.DefaultFullHttpResponse;
import io.netty.handler.codec.http.DefaultHttpResponse;
import io.netty.handler.codec.http.EmptyHttpHeaders;
import io.netty.handler.codec.http.FullHttpRequest;
import io.netty.handler.codec.http.FullHttpResponse;
import io.netty.handler.codec.http.HttpContent;
import io.netty.handler.codec.http.HttpHeaderNames;
import io.netty.handler.codec.http.HttpHeaderValues;
import io.netty.handler.codec.http.HttpResponse;
import io.netty.handler.codec.http.HttpUtil;
import io.netty.handler.codec.http.QueryStringDecoder;
import io.netty.handler.stream.ChunkedInput;
import io.netty.util.AttributeKey;
import io.netty.util.concurrent.GlobalEventExecutor;
import org.checkerframework.checker.nullness.qual.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.glowroot.ui.CommonHandler.CommonRequest;
import org.glowroot.ui.CommonHandler.CommonResponse;

import static com.google.common.base.Charsets.UTF_8;
import static io.netty.handler.codec.http.HttpResponseStatus.BAD_REQUEST;
import static io.netty.handler.codec.http.HttpResponseStatus.FOUND;
import static io.netty.handler.codec.http.HttpResponseStatus.INTERNAL_SERVER_ERROR;
import static io.netty.handler.codec.http.HttpResponseStatus.OK;
import static io.netty.handler.codec.http.HttpVersion.HTTP_1_1;

@Sharable
class HttpServerHandler extends ChannelInboundHandlerAdapter {

    private static final Logger logger = LoggerFactory.getLogger(HttpServerHandler.class);

    private static final AttributeKey<Boolean> PROCESSING_REQUEST =
            AttributeKey.valueOf("glowroot.processingRequest");

    private final ChannelGroup allChannels;

    private final Supplier<String> contextPathSupplier;

    private final CommonHandler commonHandler;

    HttpServerHandler(Supplier<String> contextPathSupplier, CommonHandler commonHandler) {
        this.contextPathSupplier = contextPathSupplier;
        this.commonHandler = commonHandler;
        allChannels = new DefaultChannelGroup(GlobalEventExecutor.INSTANCE);
    }

    @Override
    public void channelActive(ChannelHandlerContext ctx) throws Exception {
        allChannels.add(ctx.channel());
        super.channelActive(ctx);
    }

    void closeAllButCurrent() throws Exception {
        for (Channel channel : allChannels) {
            if (channel.attr(PROCESSING_REQUEST).get() != Boolean.TRUE) {
                channel.close().await().get();
            }
        }
    }

    @Override
    public void channelReadComplete(ChannelHandlerContext ctx) {
        ctx.flush();
    }

    @Override
    public void channelRead(ChannelHandlerContext ctx, Object msg) throws Exception {
        FullHttpRequest request = (FullHttpRequest) msg;
        if (request.decoderResult().isFailure()) {
            CommonResponse response = new CommonResponse(BAD_REQUEST, MediaType.PLAIN_TEXT_UTF_8,
                    Strings.nullToEmpty(request.decoderResult().cause().getMessage()));
            sendResponseAndFlush(ctx, request, response, false);
            request.release();
            return;
        }
        String uri = request.uri();
        logger.debug("channelRead(): request.uri={}", uri);
        Channel channel = ctx.channel();
        String contextPath = contextPathSupplier.get();
        boolean keepAlive = HttpUtil.isKeepAlive(request);
        if (!uri.startsWith(contextPath)) {
            DefaultFullHttpResponse response = new DefaultFullHttpResponse(HTTP_1_1, FOUND);
            response.headers().set(HttpHeaderNames.LOCATION, contextPath);
            sendFullResponseAndFlush(ctx, request, response, keepAlive);
            request.release();
            return;
        }
        QueryStringDecoder decoder = new QueryStringDecoder(stripContextPath(uri, contextPath));
        CommonRequest commonRequest = new NettyRequest(request, contextPath, decoder);

        // retain request so it survives beyond this method for async processing
        request.retain();
        channel.attr(PROCESSING_REQUEST).set(Boolean.TRUE);

        CompletionStage<CommonResponse> responseFuture;
        try {
            responseFuture = commonHandler.handle(commonRequest);
        } catch (Exception e) {
            logger.error("error handling request {}: {}", uri, e.getMessage(), e);
            CommonResponse response =
                    CommonHandler.newHttpResponseWithStackTrace(e, INTERNAL_SERVER_ERROR, null);
            sendResponseAndFlush(ctx, request, response, false);
            channel.attr(PROCESSING_REQUEST).set(null);
            request.release();
            // release the extra retain() above
            request.release();
            return;
        }

        responseFuture.whenComplete((response, throwable) -> {
            try {
                if (throwable != null) {
                    logger.error("error handling request {}: {}", uri,
                            throwable.getMessage(), throwable);
                    CommonResponse errorResponse = CommonHandler.newHttpResponseWithStackTrace(
                            throwable, INTERNAL_SERVER_ERROR, null);
                    writeResponseOnEventLoop(ctx, request, errorResponse, false);
                } else {
                    boolean effectiveKeepAlive = keepAlive;
                    if (response.isCloseConnectionAfterPortChange()) {
                        response.setHeader("Connection", "close");
                        effectiveKeepAlive = false;
                    }
                    writeResponseOnEventLoop(ctx, request, response, effectiveKeepAlive);
                }
            } catch (Exception e) {
                logger.error("error sending response for {}: {}", uri, e.getMessage(), e);
                ctx.close();
            } finally {
                channel.attr(PROCESSING_REQUEST).set(null);
                // release the extra retain() from above
                request.release();
            }
        });
        // release the original ref count (from HttpObjectAggregator)
        request.release();
    }

    private static void sendResponse(ChannelHandlerContext ctx, FullHttpRequest request,
            CommonResponse response, boolean keepAlive) throws IOException {
        Object content = response.getContent();
        if (content instanceof String) {
            FullHttpResponse resp = new DefaultFullHttpResponse(HTTP_1_1, response.getStatus(),
                    Unpooled.copiedBuffer((String) content, UTF_8), response.getHeaders(),
                    EmptyHttpHeaders.INSTANCE);
            sendFullResponse(ctx, request, resp, keepAlive);
        } else if (content instanceof ByteBuf) {
            FullHttpResponse resp = new DefaultFullHttpResponse(HTTP_1_1, response.getStatus(),
                    (ByteBuf) content, response.getHeaders(), EmptyHttpHeaders.INSTANCE);
            sendFullResponse(ctx, request, resp, keepAlive);
        } else if (content instanceof ChunkSource) {
            HttpResponse resp = new DefaultHttpResponse(HTTP_1_1, OK, response.getHeaders());
            resp.headers().set(HttpHeaderNames.TRANSFER_ENCODING, HttpHeaderValues.CHUNKED);
            ChannelFuture future = ctx.write(resp);
            HttpServices.addErrorListener(future);
            ChunkSource chunkSource = (ChunkSource) content;
            ChunkedInput<HttpContent> chunkedInput;
            String zipFileName = response.getZipFileName();
            if (zipFileName == null) {
                chunkedInput = ChunkedInputs.create(chunkSource);
            } else {
                chunkedInput = ChunkedInputs.createZipFileDownload(chunkSource, zipFileName);
            }
            future = ctx.write(chunkedInput);
            HttpServices.addErrorListener(future);
            if (!keepAlive) {
                HttpServices.addCloseListener(future);
            }
        } else {
            throw new IllegalStateException("Unexpected content: " + content.getClass().getName());
        }
    }

    @SuppressWarnings("argument.type.incompatible")
    private static void sendFullResponse(ChannelHandlerContext ctx, FullHttpRequest request,
            FullHttpResponse response, boolean keepAlive) {
        response.headers().add(HttpHeaderNames.CONTENT_LENGTH, response.content().readableBytes());
        if (keepAlive && !request.protocolVersion().isKeepAliveDefault()) {
            response.headers().set(HttpHeaderNames.CONNECTION, HttpHeaderValues.KEEP_ALIVE);
        }
        ChannelFuture future = ctx.write(response);
        HttpServices.addErrorListener(future);
        if (!keepAlive) {
            future.addListener(ChannelFutureListener.CLOSE);
        }
    }

    // used by async callback path where channelReadComplete() has already fired
    private static void writeResponseOnEventLoop(ChannelHandlerContext ctx,
            FullHttpRequest request, CommonResponse response, boolean keepAlive) {
        if (ctx.executor().inEventLoop()) {
            try {
                sendResponseAndFlush(ctx, request, response, keepAlive);
            } catch (Exception e) {
                logger.error("error sending response: {}", e.getMessage(), e);
                ctx.close();
            }
        } else {
            ctx.executor().execute(() -> {
                try {
                    sendResponseAndFlush(ctx, request, response, keepAlive);
                } catch (Exception e) {
                    logger.error("error sending response: {}", e.getMessage(), e);
                    ctx.close();
                }
            });
        }
    }

    private static void sendResponseAndFlush(ChannelHandlerContext ctx, FullHttpRequest request,
            CommonResponse response, boolean keepAlive) throws IOException {
        sendResponse(ctx, request, response, keepAlive);
        ctx.flush();
    }

    private static void sendFullResponseAndFlush(ChannelHandlerContext ctx,
            FullHttpRequest request, FullHttpResponse response, boolean keepAlive) {
        sendFullResponse(ctx, request, response, keepAlive);
        ctx.flush();
    }

    @Override
    public void exceptionCaught(ChannelHandlerContext ctx, Throwable cause) {
        if (HttpServices.shouldLogException(cause)) {
            logger.warn(cause.getMessage(), cause);
        }
        ctx.close();
    }

    @VisibleForTesting
    static String stripContextPath(String path, String contextPath) {
        if (contextPath.equals("/")) {
            return path;
        }
        if (path.equals(contextPath)) {
            return "/";
        }
        return path.substring(contextPath.length());
    }

    private static class NettyRequest implements CommonRequest {

        private final FullHttpRequest request;
        private final String contextPath;
        private final QueryStringDecoder decoder;

        NettyRequest(FullHttpRequest request, String contextPath, QueryStringDecoder decoder) {
            this.request = request;
            this.contextPath = contextPath;
            this.decoder = decoder;
        }

        @Override
        public String getMethod() {
            return request.method().name();
        }

        // includes context path
        @Override
        public String getUri() {
            return request.uri();
        }

        @Override
        public String getContextPath() {
            return contextPath;
        }

        // does not include context path
        @Override
        public String getPath() {
            return decoder.path();
        }

        @Override
        public @Nullable String getHeader(CharSequence name) {
            return request.headers().getAsString(name);
        }

        @Override
        public Map<String, List<String>> getParameters() {
            return decoder.parameters();
        }

        @Override
        public List<String> getParameters(String name) {
            List<String> params = decoder.parameters().get(name);
            if (params == null) {
                return ImmutableList.of();
            } else {
                return params;
            }
        }

        @Override
        public String getContent() {
            return request.content().toString(UTF_8);
        }
    }
}
