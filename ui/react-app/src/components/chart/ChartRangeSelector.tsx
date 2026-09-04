/*
 * ChartRangeSelector — time range buttons and custom date range picker.
 *
 * Replaces ChartRangeCtrl from chart-range.js.
 */

import { useState } from 'react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { RANGE_SELECTIONS, formatLast, formatTimeRange } from '../../lib/chart-utils'
import type { ChartRange, ChartRangeActions } from '../../hooks/useChartRange'

interface ChartRangeSelectorProps {
  range: ChartRange
  actions: ChartRangeActions
}

export function ChartRangeSelector({
  range,
  actions,
}: ChartRangeSelectorProps) {
  const [showCustom, setShowCustom] = useState(false)
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const display = range.last
    ? formatLast(range.last)
    : formatTimeRange(range.chartFrom, range.chartTo)

  function handleRangeClick(last: number) {
    if (last === range.last) {
      actions.refresh()
    } else {
      actions.setLast(last)
    }
  }

  function openCustomRange() {
    const fromDate = new Date(range.chartFrom)
    const toDate = new Date(range.chartTo)
    setCustomFrom(formatDateTimeLocal(fromDate))
    setCustomTo(formatDateTimeLocal(toDate))
    setShowCustom(true)
  }

  function applyCustomRange() {
    const from = new Date(customFrom).getTime()
    const to = new Date(customTo).getTime()
    if (!isNaN(from) && !isNaN(to) && to > from) {
      actions.setCustomRange(from, to)
      setShowCustom(false)
    }
  }

  return (
    <div className="space-y-2">
      {/* Range display + controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium text-[var(--gr-text)]">{display}</span>
        <Button variant="outline" size="sm" onClick={actions.zoomOut}>
          Zoom out
        </Button>
        <Button variant="outline" size="sm" onClick={actions.refresh}>
          Refresh
        </Button>
      </div>

      {/* Range buttons */}
      <div className="flex items-center gap-1 flex-wrap">
        {RANGE_SELECTIONS.map((last) => (
          <Button
            key={last}
            variant={range.last === last ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleRangeClick(last)}
          >
            {formatRangeButton(last)}
          </Button>
        ))}
        <Button
          variant={!range.last ? 'default' : 'outline'}
          size="sm"
          onClick={openCustomRange}
        >
          Custom
        </Button>
      </div>

      {/* Custom date range modal */}
      {showCustom && (
        <div className="flex items-end gap-2 rounded-md border border-[var(--gr-border)] bg-[var(--gr-surface-2)] p-3">
          <div>
            <label className="mb-1 block text-xs text-[var(--gr-muted)]">From</label>
            <Input
              type="datetime-local"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="w-52 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--gr-muted)]">To</label>
            <Input
              type="datetime-local"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="w-52 text-sm"
            />
          </div>
          <Button size="sm" onClick={applyCustomRange}>
            Apply
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCustom(false)}
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  )
}

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

function formatRangeButton(ms: number): string {
  if (ms < HOUR) return `${ms / MINUTE}m`
  if (ms < DAY) return `${ms / HOUR}h`
  return `${ms / DAY}d`
}

function formatDateTimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
