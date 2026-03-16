import { useState, type ReactNode } from 'react'
import { Button } from '../ui/button'
import { cn } from '../../lib/utils'

interface GtButtonGroupProps {
  /** Save handler — should throw on error */
  onSave?: () => Promise<void>
  /** Delete handler — should throw on error */
  onDelete?: () => Promise<void>
  /** Whether the form has unsaved changes */
  hasChanges?: boolean
  /** Label for the save button */
  saveLabel?: string
  /** Label for the delete button */
  deleteLabel?: string
  /** Confirm message shown before delete */
  deleteConfirmMessage?: string
  /** Whether to show the delete button */
  showDelete?: boolean
  /** Extra buttons (e.g. test button) */
  children?: ReactNode
}

export function GtButtonGroup({
  onSave,
  onDelete,
  hasChanges,
  saveLabel = 'Save changes',
  deleteLabel = 'Delete',
  deleteConfirmMessage = 'Are you sure you want to delete?',
  showDelete = false,
  children,
}: GtButtonGroupProps) {
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleSave() {
    if (!onSave) return
    setSaving(true)
    setSuccessMessage(null)
    setErrorMessage(null)
    try {
      await onSave()
      setSuccessMessage('Saved')
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : 'An error occurred')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!onDelete) return
    if (!window.confirm(deleteConfirmMessage)) return
    setDeleting(true)
    setSuccessMessage(null)
    setErrorMessage(null)
    try {
      await onDelete()
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : 'An error occurred')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex items-center gap-3 pt-4">
      {onSave && (
        <Button
          onClick={handleSave}
          loading={saving}
          disabled={hasChanges === false}
        >
          {saveLabel}
        </Button>
      )}
      {children}
      {showDelete && onDelete && (
        <Button
          variant="destructive"
          onClick={handleDelete}
          loading={deleting}
        >
          {deleteLabel}
        </Button>
      )}
      {successMessage && (
        <span className={cn('text-sm font-medium text-green-600')}>
          {successMessage}
        </span>
      )}
      {errorMessage && (
        <span className={cn('text-sm font-medium text-red-600')}>
          {errorMessage}
        </span>
      )}
    </div>
  )
}
