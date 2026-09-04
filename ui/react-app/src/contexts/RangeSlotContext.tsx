import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { ChartRange, ChartRangeActions } from '../hooks/useChartRange'

export interface RangeSlotValue {
  range: ChartRange
  actions: ChartRangeActions
}

interface RangeSlotContextValue {
  slot: RangeSlotValue | null
  setSlot: (slot: RangeSlotValue | null) => void
}

const RangeSlotContext = createContext<RangeSlotContextValue | null>(null)

export function RangeSlotProvider({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<RangeSlotValue | null>(null)
  const value = useMemo(() => ({ slot, setSlot }), [slot])
  return (
    <RangeSlotContext.Provider value={value}>{children}</RangeSlotContext.Provider>
  )
}

function useRangeSlotContext(): RangeSlotContextValue {
  const ctx = useContext(RangeSlotContext)
  if (!ctx) throw new Error('RangeSlot hooks require RangeSlotProvider')
  return ctx
}

export function useRangeSlot(): RangeSlotValue | null {
  return useRangeSlotContext().slot
}

/** Register this page/layout's chart range into the AppShell top bar. */
export function useRegisterRangeSlot(
  range: ChartRange,
  actions: ChartRangeActions
): void {
  const { setSlot } = useRangeSlotContext()
  const actionsRef = useRef(actions)
  actionsRef.current = actions

  useEffect(() => {
    setSlot({ range, actions: actionsRef.current })
    return () => setSlot(null)
  }, [range.chartFrom, range.chartTo, range.last, setSlot])
}
