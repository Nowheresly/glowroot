/**
 * Copyright 2012-2013 the original author or authors.
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
package io.informant.trace.model;

import io.informant.api.MetricName;

import checkers.nullness.quals.Nullable;

import com.google.common.base.Ticker;

/**
 * @author Trask Stalnaker
 * @since 0.5
 */
public class MetricNameImpl implements MetricName {

    private final String name;
    private final Ticker ticker;

    private final ThreadLocal<Metric> metricHolder = new ThreadLocal<Metric>();

    public MetricNameImpl(String name, Ticker ticker) {
        this.name = name;
        this.ticker = ticker;
    }

    @Nullable
    public Metric get() {
        return metricHolder.get();
    }

    Metric create() {
        Metric metric = new Metric(name, ticker);
        metricHolder.set(metric);
        return metric;
    }

    void clear() {
        metricHolder.remove();
    }
}
