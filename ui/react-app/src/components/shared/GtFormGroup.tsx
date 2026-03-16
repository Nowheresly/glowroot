import type { ReactNode } from 'react'
import { Label } from '../ui/label'

interface GtFormGroupProps {
  label: string
  htmlFor?: string
  helpText?: string
  children: ReactNode
}

export function GtFormGroup({ label, htmlFor, helpText, children }: GtFormGroupProps) {
  return (
    <div className="grid grid-cols-3 gap-4 items-start py-2">
      <Label htmlFor={htmlFor} className="pt-2 text-right text-gray-700">
        {label}
      </Label>
      <div className="col-span-2">
        {children}
        {helpText && (
          <p className="mt-1 text-xs text-gray-500">{helpText}</p>
        )}
      </div>
    </div>
  )
}
