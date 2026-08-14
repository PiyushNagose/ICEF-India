import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '../../lib/utils'

/**
 * CustomSelect — portal-based dropdown that is never clipped by parent overflow.
 *
 * Props:
 *   value        — current selected value (string)
 *   onChange     — (value: string) => void
 *   options      — [{ value, label }] or [string]
 *   placeholder  — text shown when nothing is selected
 *   className    — extra classes on the trigger button
 *   error        — boolean
 *   disabled     — boolean
 *   id           — for label association
 */
const CustomSelect = ({
  value,
  onChange,
  options = [],
  placeholder = 'Select...',
  className = '',
  error = false,
  disabled = false,
  id,
}) => {
  const [open, setOpen] = useState(false)
  const [dropdownStyle, setDropdownStyle] = useState({})
  const triggerRef = useRef(null)
  const dropdownRef = useRef(null)

  // Normalise options to { value, label }
  const normalised = options.map((o) =>
    typeof o === 'string' ? { value: o, label: o } : o,
  )
  const selected = normalised.find((o) => o.value === value)

  // Calculate dropdown position relative to viewport
  const calcPosition = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const viewportHeight = window.innerHeight
    const dropdownHeight = 240 // max-h-60 = 240px
    const spaceBelow = viewportHeight - rect.bottom
    const openUpward = spaceBelow < dropdownHeight + 8 && rect.top > dropdownHeight

    setDropdownStyle({
      position: 'fixed',
      left: rect.left,
      width: rect.width,
      zIndex: 99999,
      ...(openUpward
        ? { bottom: viewportHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
    })
  }, [])

  const handleOpen = () => {
    if (disabled) return
    calcPosition()
    setOpen((prev) => !prev)
  }

  // Recalculate on scroll/resize while open
  useEffect(() => {
    if (!open) return
    const update = () => calcPosition()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [open, calcPosition])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (disabled) return
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleOpen() }
    if (e.key === 'Escape') setOpen(false)
    if (open && e.key === 'ArrowDown') {
      e.preventDefault()
      const idx = normalised.findIndex((o) => o.value === value)
      const next = normalised[Math.min(idx + 1, normalised.length - 1)]
      if (next) onChange(next.value)
    }
    if (open && e.key === 'ArrowUp') {
      e.preventDefault()
      const idx = normalised.findIndex((o) => o.value === value)
      const prev = normalised[Math.max(idx - 1, 0)]
      if (prev) onChange(prev.value)
    }
  }

  const dropdown = open ? (
    <div
      ref={dropdownRef}
      role="listbox"
      style={dropdownStyle}
      className="bg-white border border-gray-200 rounded-xl shadow-2xl max-h-60 overflow-y-auto"
    >
      {normalised.length === 0 ? (
        <div className="px-4 py-3 text-sm text-gray-400 text-center">No options</div>
      ) : (
        normalised.map((opt) => {
          const isSelected = opt.value === value
          return (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={isSelected}
              onMouseDown={(e) => {
                // Use mousedown so it fires before the outside-click handler
                e.preventDefault()
                onChange(opt.value)
                setOpen(false)
              }}
              className={cn(
                'w-full flex items-center justify-between px-4 py-2.5 text-sm text-left',
                'transition-colors duration-200 ease-out',
                isSelected
                  ? 'bg-orange-50 text-orange-700 font-semibold'
                  : 'text-gray-700 hover:bg-orange-50 hover:text-orange-700',
              )}
            >
              <span>{opt.label}</span>
              {isSelected && <Check className="w-4 h-4 text-orange-500 flex-shrink-0" />}
            </button>
          )
        })
      )}
    </div>
  ) : null

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        onClick={handleOpen}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          'w-full flex items-center justify-between gap-2',
          'px-4 py-3 rounded-xl border text-sm text-left',
          'transition-all duration-200 ease-out outline-none',
          'focus:ring-2 focus:ring-orange-500 focus:border-orange-500',
          disabled
            ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
            : error
              ? 'bg-red-50 border-red-400 text-gray-800 hover:border-red-500'
              : open
                ? 'bg-white border-orange-500 ring-2 ring-orange-500 text-gray-800'
                : 'bg-white border-gray-200 text-gray-800 hover:border-orange-400',
          className,
        )}
      >
        <span className={cn('truncate', !selected && 'text-gray-400')}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          className={cn(
            'mr-1 w-4 h-4 flex-shrink-0 text-orange-500 transition-transform duration-200 ease-out',
            open && 'rotate-180',
          )}
        />
      </button>

      {/* Render dropdown via portal so it's never clipped by parent overflow */}
      {typeof document !== 'undefined' && createPortal(dropdown, document.body)}
    </>
  )
}

export default CustomSelect
