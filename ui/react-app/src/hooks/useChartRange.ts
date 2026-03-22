/*
 * useChartRange — manages chart time range state.
 *
 * Stores chartFrom, chartTo, last (for "last N" mode) and provides
 * update functions. Replaces the $scope.range object from chart-range.js.
 */

import { useCallback, useRef, useState } from 'react'
import { useLayout } from '../contexts/LayoutContext'
import {
  applyLast,
  updateRange as computeRange,
  RANGE_SELECTIONS,
} from '../lib/chart-utils'

export interface ChartRange {
  chartFrom: number
  chartTo: number
  last: number
}

export interface ChartRangeActions {
  /** Set to a specific "last N ms" preset */
  setLast(last: number): void
  /** Set to a custom date range (exits "last" mode) */
  setCustomRange(from: number, to: number): void
  /** Handle zoom (from chart interaction) */
  handleZoom(from: number, to: number, zoomingOut: boolean): void
  /** Handle selection (from chart brush) */
  handleSelection(from: number, to: number): void
  /** Zoom out by 2x */
  zoomOut(): void
  /** Force refresh (re-apply "last" or increment refresh counter) */
  refresh(): void
}

export function useChartRange(
  initialLast?: number,
  options?: {
    useGaugeViewThresholdMultiplier?: boolean
    tracePoints?: boolean
  }
): [ChartRange, ChartRangeActions, number] {
  const { layout } = useLayout()
  const { rollupConfigs, rollupExpirationMillis } = layout
  const useGauge = options?.useGaugeViewThresholdMultiplier
  const tracePoints = options?.tracePoints

  // Default to the first default range if the user's agent has one configured
  const defaultLast = initialLast ?? RANGE_SELECTIONS[5] // 24 hours

  const initialApplied = applyLast(
    defaultLast,
    rollupConfigs,
    rollupExpirationMillis,
    useGauge
  )

  const [range, setRange] = useState<ChartRange>({
    chartFrom: initialApplied.chartFrom,
    chartTo: initialApplied.chartTo,
    last: defaultLast,
  })

  // Refresh counter — incremented on any change to trigger data re-fetch
  const [refreshCounter, setRefreshCounter] = useState(0)
  const rangeRef = useRef(range)
  rangeRef.current = range

  const setLast = useCallback(
    (last: number) => {
      const applied = applyLast(
        last,
        rollupConfigs,
        rollupExpirationMillis,
        useGauge
      )
      setRange({ ...applied, last })
      setRefreshCounter((c) => c + 1)
    },
    [rollupConfigs, rollupExpirationMillis, useGauge]
  )

  const setCustomRange = useCallback(
    (from: number, to: number) => {
      setRange({ chartFrom: from, chartTo: to, last: 0 })
      setRefreshCounter((c) => c + 1)
    },
    []
  )

  const handleZoom = useCallback(
    (from: number, to: number, zoomingOut: boolean) => {
      const result = computeRange(
        from,
        to,
        rangeRef.current.last,
        rollupConfigs,
        rollupExpirationMillis,
        zoomingOut,
        false,
        useGauge,
        tracePoints
      )
      setRange(result)
      setRefreshCounter((c) => c + 1)
    },
    [rollupConfigs, rollupExpirationMillis, useGauge, tracePoints]
  )

  const handleSelection = useCallback(
    (from: number, to: number) => {
      const result = computeRange(
        from,
        to,
        rangeRef.current.last,
        rollupConfigs,
        rollupExpirationMillis,
        false,
        true,
        useGauge,
        tracePoints
      )
      setRange(result)
      setRefreshCounter((c) => c + 1)
    },
    [rollupConfigs, rollupExpirationMillis, useGauge, tracePoints]
  )

  const zoomOut = useCallback(() => {
    const { chartFrom, chartTo } = rangeRef.current
    const currRange = chartTo - chartFrom
    const result = computeRange(
      chartFrom - currRange / 2,
      chartTo + currRange / 2,
      rangeRef.current.last,
      rollupConfigs,
      rollupExpirationMillis,
      true,
      false,
      useGauge,
      tracePoints
    )
    setRange(result)
    setRefreshCounter((c) => c + 1)
  }, [rollupConfigs, rollupExpirationMillis, useGauge, tracePoints])

  const refresh = useCallback(() => {
    const r = rangeRef.current
    if (r.last) {
      const applied = applyLast(
        r.last,
        rollupConfigs,
        rollupExpirationMillis,
        useGauge
      )
      setRange({ ...applied, last: r.last })
    }
    setRefreshCounter((c) => c + 1)
  }, [rollupConfigs, rollupExpirationMillis, useGauge])

  const actions: ChartRangeActions = {
    setLast,
    setCustomRange,
    handleZoom,
    handleSelection,
    zoomOut,
    refresh,
  }

  return [range, actions, refreshCounter]
}
