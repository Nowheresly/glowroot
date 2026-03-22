/*
 * JVM Gauges page — time-series chart of selected JVM gauges.
 *
 * Replaces gauge-values.js. First chart-bearing page wired to Phase 5 infrastructure.
 */

import { useCallback, useMemo, useState } from 'react'
import { useAgent } from '../../contexts/AgentContext'
import { TimeSeriesChart, type PlotSeries } from '../../components/chart'
import { ChartRangeSelector } from '../../components/chart/ChartRangeSelector'
import { useChartRange } from '../../hooks/useChartRange'
import { useChartData } from '../../hooks/useChartData'
import { Input } from '../../components/ui/input'
import { PageSpinner } from '../../components/shared/Spinner'
import { HttpError } from '../../components/shared/HttpError'
import { formatGaugeValue } from '../../lib/formatting'

interface Gauge {
  name: string
  display: string
  displayParts: string[]
  shortDisplay?: string
  unit?: string
  grouping?: string
  counter: boolean
}

interface GaugeExtra {
  allGauges: Gauge[]
}

export function JvmGaugesPage() {
  const { agentRollup } = useAgent()
  const defaultGaugeNames = agentRollup?.defaultGaugeNames ?? []

  const [selectedGauges, setSelectedGauges] = useState<string[]>(defaultGaugeNames)
  const [gaugeFilter, setGaugeFilter] = useState('')

  const [range, rangeActions, refreshCounter] = useChartRange(
    4 * 60 * 60 * 1000, // default 4 hours for gauges
    { useGaugeViewThresholdMultiplier: true }
  )

  const addToQuery = useCallback(
    (query: Record<string, string | string[] | number | undefined>) => {
      query['gauge-name'] = selectedGauges.length > 0 ? selectedGauges : undefined
    },
    [selectedGauges]
  )

  const extractExtra = useCallback(
    (data: Record<string, unknown>): GaugeExtra => ({
      allGauges: (data.allGauges as Gauge[]) || [],
    }),
    []
  )

  const { chartData, loading, noData, error } = useChartData<GaugeExtra>({
    url: '/backend/jvm/gauges',
    range,
    refreshCounter,
    addToQuery,
    extractExtra,
    useGaugeViewThresholdMultiplier: true,
  })

  const allGauges = chartData?.extra.allGauges ?? []

  // Build short display names for gauges
  const shortDisplayMap = useMemo(() => {
    const map: Record<string, string> = {}
    if (allGauges.length === 0) return map
    createShortDisplayNames(allGauges)
    for (const gauge of allGauges) {
      if (gauge.shortDisplay) {
        map[gauge.name] = gauge.shortDisplay
      }
    }
    return map
  }, [allGauges])

  const gaugeUnits = useMemo(() => {
    const units: Record<string, string> = {}
    for (const gauge of allGauges) {
      units[gauge.name] = gauge.unit ? ` ${gauge.unit}` : ''
    }
    return units
  }, [allGauges])

  // Filter the gauge list
  const filteredGauges = useMemo(() => {
    if (!gaugeFilter) return allGauges
    const lower = gaugeFilter.toLowerCase()
    return allGauges.filter((g) => g.display.toLowerCase().includes(lower))
  }, [allGauges, gaugeFilter])

  function toggleGauge(name: string) {
    setSelectedGauges((prev) => {
      if (prev.includes(name)) {
        return prev.filter((n) => n !== name)
      }
      // Insert in server order
      const ordering = new Map(allGauges.map((g, i) => [g.name, i]))
      const next = [...prev, name]
      next.sort((a, b) => (ordering.get(a) ?? 0) - (ordering.get(b) ?? 0))
      return next
    })
  }

  // Build Y-axis label from selected gauge units
  const yAxisLabel = useMemo(() => {
    if (!chartData?.dataSeries.length) return ''
    let label = ''
    for (let i = 0; i < chartData.dataSeries.length; i++) {
      const unit = gaugeUnits[chartData.dataSeries[i].name] || ''
      if (i === 0) {
        label = unit
      } else if (unit !== label) {
        return ''
      }
    }
    if (label === ' bytes') return 'MB'
    return label.trim()
  }, [chartData, gaugeUnits])

  // Custom tooltip
  const tooltipContent = useCallback(
    (
      from: number,
      to: number | null,
      dataIndex: number,
      seriesIndex: number,
      allSeries: PlotSeries[]
    ) => {
      function timeStr(ms: number): string {
        return new Date(ms).toLocaleTimeString(undefined, {
          hour: 'numeric',
          minute: '2-digit',
        })
      }
      let html = `<div style="font-weight:600;margin-bottom:2px">${timeStr(from)}`
      if (to) html += ` to ${timeStr(to)}`
      html += '</div><table style="border-spacing:4px 1px">'
      for (let si = 0; si < allSeries.length; si++) {
        const s = allSeries[si]
        const val = s.data[dataIndex]?.[1]
        const display =
          val != null
            ? formatGaugeValue(val) + (gaugeUnits[s.name] || '')
            : 'no data'
        const label = shortDisplayMap[s.name] || s.name || 'Other'
        html += `<tr${si === seriesIndex ? ' style="background:#eee"' : ''}>`
        html += `<td><span style="display:inline-block;width:10px;height:10px;background:${s.color};border:1px solid #ccc"></span></td>`
        html += `<td>${label}</td>`
        html += `<td style="font-weight:600">${display}</td>`
        html += '</tr>'
      }
      html += '</table>'
      return html
    },
    [shortDisplayMap, gaugeUnits]
  )

  if (loading && !chartData) return <PageSpinner />
  if (error && !chartData) return <HttpError error={error} />

  return (
    <div className="space-y-4">
      <ChartRangeSelector range={range} actions={rangeActions} />

      {/* Chart */}
      <div className="rounded-lg border bg-white p-4">
        {chartData && chartData.dataSeries.length > 0 ? (
          <TimeSeriesChart
            dataSeries={chartData.dataSeries}
            chartFrom={range.chartFrom}
            chartTo={range.chartTo}
            dataPointIntervalMillis={chartData.dataPointIntervalMillis}
            markings={chartData.markings}
            stacked={false}
            yAxisLabel={yAxisLabel}
            tooltipContent={tooltipContent}
            onZoom={rangeActions.handleZoom}
            onSelection={rangeActions.handleSelection}
          />
        ) : (
          <div className="flex items-center justify-center h-[300px] text-sm text-gray-500">
            {selectedGauges.length === 0
              ? 'Select one or more gauges below'
              : noData
                ? 'No data for selected time range'
                : 'Loading...'}
          </div>
        )}
      </div>

      {/* Gauge selector */}
      <div className="rounded-lg border bg-white p-4">
        <div className="flex items-center gap-2 mb-3">
          <Input
            placeholder="Filter gauges..."
            value={gaugeFilter}
            onChange={(e) => setGaugeFilter(e.target.value)}
            className="max-w-xs"
          />
          <button
            className="text-xs text-blue-600 hover:underline"
            onClick={() =>
              setSelectedGauges(filteredGauges.map((g) => g.name))
            }
          >
            Select all
          </button>
          <button
            className="text-xs text-blue-600 hover:underline"
            onClick={() => {
              const filtered = new Set(filteredGauges.map((g) => g.name))
              setSelectedGauges((prev) => prev.filter((n) => !filtered.has(n)))
            }}
          >
            Deselect all
          </button>
        </div>
        <div className="space-y-0.5 max-h-80 overflow-y-auto">
          {filteredGauges.map((gauge) => {
            const selected = selectedGauges.includes(gauge.name)
            return (
              <div
                key={gauge.name}
                className="flex items-center gap-2 py-0.5 px-1 rounded hover:bg-gray-50 cursor-pointer text-sm"
                onClick={() => toggleGauge(gauge.name)}
              >
                <span
                  className={selected ? 'font-bold' : 'font-normal'}
                >
                  {gauge.display}
                </span>
              </div>
            )
          })}
          {filteredGauges.length === 0 && (
            <p className="text-sm text-gray-500 py-2">No gauges found.</p>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Create short display names for gauges (matching the AngularJS logic).
 */
function createShortDisplayNames(gauges: Gauge[]) {
  const SEPARATOR = ' / '
  const splitNames = gauges.map((g) => g.displayParts)

  for (let i = 0; i < gauges.length; i++) {
    const parts = splitNames[i]
    const name = gauges[i].name
    const separator = name.lastIndexOf(SEPARATOR)
    let minRequired =
      name.substring(separator + 1).split(SEPARATOR).length + 1

    for (let j = 0; j < gauges.length; j++) {
      if (j === i) continue
      minRequired = Math.max(
        minRequired,
        numSamePartsFromEnd(parts, splitNames[j]) + 1
      )
    }
    gauges[i].shortDisplay = parts.slice(-minRequired).join(SEPARATOR)
  }
}

function numSamePartsFromEnd(a: string[], b: string[]): number {
  let k = 0
  while (
    k < Math.min(a.length, b.length) &&
    a[a.length - 1 - k] === b[b.length - 1 - k]
  ) {
    k++
  }
  return k
}
