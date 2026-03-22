/*
 * TimeSeriesChart — D3-based SVG time-series chart replacing jQuery Flot.
 *
 * Supports:
 * - Stacked area charts (transaction average breakdown)
 * - Non-stacked line charts (percentiles)
 * - Ctrl+scroll zoom
 * - Drag-select time range (brush)
 * - Hover tooltips
 * - Deployment markers
 * - Auto-resize
 */

import {
  useEffect,
  useRef,
  useCallback,
  useState,
  type CSSProperties,
} from 'react'
import * as d3 from 'd3'
import type { DataSeries, DeploymentMarking } from '../../hooks/useChartData'
import { createKeyedColorPool, type KeyedColorPool } from '../../lib/color-pool'

export interface SeriesLabel {
  color: string
  text: string
  name: string
}

export interface TimeSeriesChartProps {
  dataSeries: DataSeries[]
  chartFrom: number
  chartTo: number
  dataPointIntervalMillis: number
  markings?: DeploymentMarking[]
  /** Whether to stack area series (default: true) */
  stacked?: boolean
  /** Y-axis label (default: "milliseconds") */
  yAxisLabel?: string
  /** Y-axis tick formatter */
  yAxisFormatter?: (value: number) => string
  /** Tooltip content formatter — receives (from, to, dataIndex, seriesIndex, allSeries) */
  tooltipContent?: (
    from: number,
    to: number | null,
    dataIndex: number,
    seriesIndex: number,
    allSeries: PlotSeries[]
  ) => string
  /** Chart height (default: 300) */
  height?: number
  /** Called on zoom */
  onZoom?: (from: number, to: number, zoomingOut: boolean) => void
  /** Called on selection (brush) */
  onSelection?: (from: number, to: number) => void
  /** External color pool (for preserving colors across refreshes) */
  colorPool?: KeyedColorPool
  /** Container style override */
  style?: CSSProperties
}

export interface PlotSeries {
  name: string
  shortLabel?: string
  color: string
  data: Array<[number, number | null] | null>
}

const MARGIN = { top: 10, right: 20, bottom: 30, left: 60 }

export function TimeSeriesChart({
  dataSeries,
  chartFrom,
  chartTo,
  dataPointIntervalMillis,
  markings,
  stacked = true,
  yAxisLabel = 'milliseconds',
  yAxisFormatter,
  tooltipContent,
  height = 300,
  onZoom,
  onSelection,
  colorPool: externalColorPool,
  style,
}: TimeSeriesChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const colorPoolRef = useRef<KeyedColorPool>(
    externalColorPool || createKeyedColorPool()
  )
  const [seriesLabels, setSeriesLabels] = useState<SeriesLabel[]>([])
  const [containerWidth, setContainerWidth] = useState(0)

  // Track container width
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width)
      }
    })
    obs.observe(el)
    setContainerWidth(el.clientWidth)
    return () => obs.disconnect()
  }, [])

  // Assign colors to series
  const plotSeries: PlotSeries[] = (() => {
    const pool = colorPoolRef.current
    const labels = dataSeries.map((s) => s.name || 'Other')
    pool.reset(labels)
    return dataSeries.map((s, i) => ({
      name: s.name,
      shortLabel: s.shortLabel,
      color: pool.get(labels[i]),
      data: s.data,
    }))
  })()

  // Update legend
  useEffect(() => {
    setSeriesLabels(
      plotSeries.map((s) => ({
        color: s.color,
        text: s.shortLabel || s.name || 'Other',
        name: s.name,
      }))
    )
  }, [dataSeries]) // eslint-disable-line react-hooks/exhaustive-deps

  // Main D3 render
  const renderChart = useCallback(() => {
    const svg = svgRef.current
    if (!svg || containerWidth === 0) return

    const width = containerWidth - MARGIN.left - MARGIN.right
    const chartHeight = height - MARGIN.top - MARGIN.bottom
    if (width <= 0 || chartHeight <= 0) return

    // Clear previous render
    d3.select(svg).selectAll('*').remove()

    const g = d3
      .select(svg)
      .attr('width', containerWidth)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`)

    // Scales
    const xScale = d3.scaleTime().domain([chartFrom, chartTo]).range([0, width])

    // Compute y domain (only consider points within visible x-range)
    let yMax = 10 // default for empty chart
    if (stacked && plotSeries.length > 0) {
      // For stacked, sum all series at each data index
      const firstData = plotSeries[0]?.data || []
      for (let i = 0; i < firstData.length; i++) {
        const firstPoint = firstData[i]
        if (!firstPoint || firstPoint[0] < chartFrom || firstPoint[0] > chartTo) continue
        let sum = 0
        for (const series of plotSeries) {
          const val = series.data[i]?.[1]
          if (val != null) sum += val
        }
        if (sum > yMax) yMax = sum
      }
    } else {
      for (const series of plotSeries) {
        for (const point of series.data) {
          if (point && point[0] >= chartFrom && point[0] <= chartTo && point[1] != null && point[1] > yMax) yMax = point[1]
        }
      }
    }
    yMax *= 1.1 // 10% padding

    const yScale = d3.scaleLinear().domain([0, yMax]).nice().range([chartHeight, 0])

    const defaultFormatter = (val: number) =>
      val.toLocaleString(undefined, { maximumSignificantDigits: 15 })
    const tickFormatter = yAxisFormatter || defaultFormatter

    // Axes
    const xAxis = d3
      .axisBottom(xScale)
      .ticks(Math.max(2, Math.floor(width / 120)))
      .tickSizeOuter(0)

    const yAxis = d3
      .axisLeft(yScale)
      .ticks(Math.max(2, Math.floor(chartHeight / 40)))
      .tickFormat((d) => tickFormatter(d as number))
      .tickSizeOuter(0)

    g.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${chartHeight})`)
      .call(xAxis)
      .selectAll('text')
      .style('font-size', '11px')

    g.append('g')
      .attr('class', 'y-axis')
      .call(yAxis)
      .selectAll('text')
      .style('font-size', '11px')

    // Y-axis label
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -MARGIN.left + 12)
      .attr('x', -chartHeight / 2)
      .attr('text-anchor', 'middle')
      .style('font-size', '11px')
      .style('fill', '#666')
      .text(yAxisLabel)

    // Grid lines
    g.append('g')
      .attr('class', 'grid')
      .selectAll('line')
      .data(yScale.ticks(Math.max(2, Math.floor(chartHeight / 40))))
      .enter()
      .append('line')
      .attr('x1', 0)
      .attr('x2', width)
      .attr('y1', (d) => yScale(d))
      .attr('y2', (d) => yScale(d))
      .attr('stroke', '#e8e8e8')
      .attr('stroke-dasharray', '2,2')

    // Deployment markers
    if (markings && markings.length > 0) {
      const minWidth = Math.max((chartTo - chartFrom) / 200, 2000)
      for (const marking of markings) {
        let from = marking.from
        let to = marking.to
        const padding = minWidth - (to - from)
        if (padding > 0) {
          from -= padding / 2
          to += padding / 2
        }
        g.append('rect')
          .attr('x', xScale(from))
          .attr('width', Math.max(1, xScale(to) - xScale(from)))
          .attr('y', 0)
          .attr('height', chartHeight)
          .attr('fill', '#ffcccc')
          .attr('opacity', 0.5)
      }
    }

    // Clip path
    g.append('defs')
      .append('clipPath')
      .attr('id', 'chart-clip')
      .append('rect')
      .attr('width', width)
      .attr('height', chartHeight)

    const chartArea = g.append('g').attr('clip-path', 'url(#chart-clip)')

    // Draw series
    if (stacked && plotSeries.length > 0) {
      // Build stack data
      const stackData: Array<Record<string, number>> = []
      const firstData = plotSeries[0]?.data || []
      for (let i = 0; i < firstData.length; i++) {
        const firstPoint = firstData[i]
        if (!firstPoint) continue
        const entry: Record<string, number> = { x: firstPoint[0] }
        for (const series of plotSeries) {
          const pt = series.data[i]
          entry[series.name || 'Other'] = pt?.[1] ?? 0
        }
        stackData.push(entry)
      }

      const stackKeys = plotSeries.map((s) => s.name || 'Other')
      const stack = d3
        .stack<Record<string, number>>()
        .keys(stackKeys)
        .order(d3.stackOrderNone)
        .offset(d3.stackOffsetNone)

      const stackedData = stack(stackData)

      const area = d3
        .area<d3.SeriesPoint<Record<string, number>>>()
        .x((d) => xScale(d.data.x))
        .y0((d) => yScale(d[0]))
        .y1((d) => yScale(d[1]))
        .curve(d3.curveLinear)

      chartArea
        .selectAll('.series-area')
        .data(stackedData)
        .enter()
        .append('path')
        .attr('class', 'series-area')
        .attr('d', area)
        .attr('fill', (_d, i) => plotSeries[i].color)
        .attr('fill-opacity', 0.6)
        .attr('stroke', (_d, i) => plotSeries[i].color)
        .attr('stroke-width', 1)
    } else {
      // Non-stacked line chart
      const line = d3
        .line<[number, number | null]>()
        .defined((d) => d != null && d[1] != null)
        .x((d) => xScale(d[0]))
        .y((d) => yScale(d[1]!))
        .curve(d3.curveLinear)

      for (const series of plotSeries) {
        // Filter out null entries for the line generator
        const validData = series.data.filter((d): d is [number, number | null] => d != null)
        chartArea
          .append('path')
          .datum(validData)
          .attr('fill', 'none')
          .attr('stroke', series.color)
          .attr('stroke-width', 1.5)
          .attr('d', line)
      }
    }

    // Tooltip overlay
    const overlay = g
      .append('rect')
      .attr('width', width)
      .attr('height', chartHeight)
      .attr('fill', 'none')
      .attr('pointer-events', 'all')

    // Vertical hover line
    const hoverLine = g
      .append('line')
      .attr('y1', 0)
      .attr('y2', chartHeight)
      .attr('stroke', '#666')
      .attr('stroke-dasharray', '3,3')
      .attr('opacity', 0)

    const tooltip = tooltipRef.current

    // Pre-filter valid (non-null) points from first series for hover bisection
    const validFirstData = (plotSeries[0]?.data || []).filter(
      (d): d is [number, number | null] => d != null
    )

    overlay.on('mousemove', function (event: MouseEvent) {
      const [mx] = d3.pointer(event)
      const xTime = xScale.invert(mx).getTime()

      // Find closest data point
      if (validFirstData.length === 0) return
      const bisect = d3.bisector<[number, number | null], number>((d) => d[0]).left
      let idx = bisect(validFirstData, xTime)
      if (idx > 0) {
        const d0 = validFirstData[idx - 1]
        const d1 = validFirstData[idx]
        if (d1 && Math.abs(xTime - d0[0]) < Math.abs(xTime - d1[0])) {
          idx = idx - 1
        }
      }
      if (idx >= validFirstData.length) {
        idx = validFirstData.length - 1
      }

      const hoverPoint = validFirstData[idx]
      if (!hoverPoint) return
      const dataX = hoverPoint[0]

      // Find corresponding dataIndex in the original (unfiltered) array for tooltip
      const dataIndex = plotSeries[0].data.findIndex(
        (d) => d != null && d[0] === dataX
      )

      hoverLine.attr('x1', xScale(dataX)).attr('x2', xScale(dataX)).attr('opacity', 1)

      if (tooltip) {
        const from = dataX
        const to = dataX + dataPointIntervalMillis
        // Find which series the mouse is closest to
        let closestSeries = 0
        if (!stacked) {
          let minDist = Infinity
          for (let si = 0; si < plotSeries.length; si++) {
            const val = plotSeries[si].data[dataIndex]?.[1]
            if (val != null) {
              const dist = Math.abs(yScale(val) - d3.pointer(event)[1])
              if (dist < minDist) {
                minDist = dist
                closestSeries = si
              }
            }
          }
        }

        if (tooltipContent) {
          tooltip.innerHTML = tooltipContent(from, to, dataIndex, closestSeries, plotSeries)
        } else {
          tooltip.innerHTML = defaultTooltipContent(from, to, dataIndex, closestSeries, plotSeries, stacked)
        }
        tooltip.style.display = 'block'

        // Position tooltip
        const svgRect = svg.getBoundingClientRect()
        const tipX = svgRect.left + MARGIN.left + xScale(dataX)
        const tipY = event.clientY
        tooltip.style.left = `${tipX + 15}px`
        tooltip.style.top = `${tipY - 10}px`

        // Flip if near right edge
        if (tipX + tooltip.offsetWidth + 20 > window.innerWidth) {
          tooltip.style.left = `${tipX - tooltip.offsetWidth - 15}px`
        }
      }
    })

    overlay.on('mouseleave', function () {
      hoverLine.attr('opacity', 0)
      if (tooltip) tooltip.style.display = 'none'
    })

    // Brush for selection
    const brush = d3
      .brushX()
      .extent([
        [0, 0],
        [width, chartHeight],
      ])
      .on('end', (event: d3.D3BrushEvent<unknown>) => {
        if (!event.selection) return
        const [x0, x1] = event.selection as [number, number]
        const from = xScale.invert(x0).getTime()
        const to = xScale.invert(x1).getTime()
        // Clear brush visual
        g.select<SVGGElement>('.brush').call(brush.move, null)
        onSelection?.(from, to)
      })

    g.append('g').attr('class', 'brush').call(brush)

    // Ctrl+scroll zoom
    overlay.on('wheel', function (event: WheelEvent) {
      if (!event.ctrlKey) return
      event.preventDefault()
      const zoomingOut = event.deltaY > 0
      const [mx] = d3.pointer(event)
      const xTime = xScale.invert(mx).getTime()
      const factor = zoomingOut ? 2 : 0.5
      const newFrom = xTime - (xTime - chartFrom) * factor
      const newTo = xTime + (chartTo - xTime) * factor
      onZoom?.(newFrom, newTo, zoomingOut)
    })

    // Double-click to zoom in
    overlay.on('dblclick', function (event: MouseEvent) {
      event.preventDefault()
      const [mx] = d3.pointer(event)
      const xTime = xScale.invert(mx).getTime()
      const range = chartTo - chartFrom
      onZoom?.(xTime - range / 4, xTime + range / 4, false)
    })
  }, [
    containerWidth,
    height,
    plotSeries,
    chartFrom,
    chartTo,
    dataPointIntervalMillis,
    markings,
    stacked,
    yAxisLabel,
    yAxisFormatter,
    tooltipContent,
    onZoom,
    onSelection,
  ])

  useEffect(() => {
    renderChart()
  }, [renderChart])

  return (
    <div style={style}>
      <div ref={containerRef} className="relative w-full">
        <svg ref={svgRef} />
        <div
          ref={tooltipRef}
          className="fixed z-50 pointer-events-none rounded border border-gray-300 bg-white px-2 py-1 shadow-md text-xs"
          style={{ display: 'none' }}
        />
      </div>
      {/* Legend */}
      {seriesLabels.length > 1 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 px-2">
          {seriesLabels.map((label) => (
            <div key={label.name} className="flex items-center gap-1 text-xs">
              <span
                className="inline-block w-3 h-3 border border-gray-300"
                style={{ backgroundColor: label.color }}
              />
              <span className="text-gray-700">{label.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Default tooltip HTML matching the Flot tooltip style.
 */
function defaultTooltipContent(
  from: number,
  to: number | null,
  dataIndex: number,
  highlightSeriesIndex: number,
  allSeries: PlotSeries[],
  stacked: boolean
): string {
  function smartFormat(ms: number): string {
    const d = new Date(ms)
    if (ms % 60000 === 0) {
      return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    }
    return d.toLocaleTimeString()
  }

  let html = `<div style="font-weight:600;margin-bottom:2px">${smartFormat(from)}`
  if (to) html += ` to ${smartFormat(to)}`
  html += '</div><table style="border-spacing:4px 1px">'

  for (let si = 0; si < allSeries.length; si++) {
    const series = allSeries[si]
    const val = series.data[dataIndex]?.[1]
    const display =
      val != null
        ? val.toLocaleString(undefined, { maximumFractionDigits: 1 })
        : 'no data'
    const label = series.shortLabel || series.name || 'Other'
    const bg = si === highlightSeriesIndex && !stacked ? '#eee' : 'transparent'
    html += `<tr style="background:${bg}">`
    html += `<td><span style="display:inline-block;width:10px;height:10px;background:${series.color};border:1px solid #ccc"></span></td>`
    html += `<td>${label}</td>`
    html += `<td style="font-weight:600">${display}</td>`
    html += '</tr>'
  }
  html += '</table>'
  return html
}
