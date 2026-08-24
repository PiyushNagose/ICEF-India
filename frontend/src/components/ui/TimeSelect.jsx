import { useMemo, useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Clock3 } from 'lucide-react'
import { cn } from '../../lib/utils'

const pad = (value) => String(value).padStart(2, '0')

const formatLabel = (value) => {
  if (!value) return ''
  const [hoursText, minutesText] = String(value).split(':')
  const hours = Number(hoursText)
  const minutes = Number(minutesText)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return value
  const suffix = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours % 12 || 12
  return `${pad(displayHours)}:${pad(minutes)} ${suffix}`
}

const buildOptions = () =>
  Array.from({ length: 24 * 12 }, (_, index) => {
    const totalMinutes = index * 5
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    const value = `${pad(hours)}:${pad(minutes)}`
    return { value, label: formatLabel(value) }
  })

const TimeSelect = ({
  value,
  onChange,
  placeholder = 'Select time',
  className = '',
  error = false,
  disabled = false,
  id,
}) => {
  const options = useMemo(() => buildOptions(), [])
  const [open, setOpen] = useState(false)
  const [dropdownStyle, setDropdownStyle] = useState({})
  const triggerRef = useRef(null)
  const dropdownRef = useRef(null)

  const selected = options.find((opt) => opt.value === value)

  const calcPosition = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const viewportHeight = window.innerHeight
    const dropdownHeight = 280
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

  useEffect(() => {
    if (!open) return
    const handler = (event) => {
      if (
        triggerRef.current && !triggerRef.current.contains(event.target) &&
        dropdownRef.current && !dropdownRef.current.contains(event.target)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const dropdown = open ? (
    <div
      ref={dropdownRef}
      role="listbox"
      style={dropdownStyle}
      className="max-h-72 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-2xl"
    >
      {options.map((opt) => {
        const isSelected = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            role="option"
            aria-selected={isSelected}
            onMouseDown={(event) => {
              event.preventDefault()
              onChange(opt.value)
              setOpen(false)
            }}
            className={cn(
              'flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors duration-200 ease-out',
              isSelected
                ? 'bg-orange-50 font-semibold text-orange-700'
                : 'text-gray-700 hover:bg-orange-50 hover:text-orange-700',
            )}
          >
            <span>{opt.label}</span>
            {isSelected && <Check className="h-4 w-4 shrink-0 text-orange-500" />}
          </button>
        )
      })}
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
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-xl border px-4 py-3 text-left text-sm transition-all duration-200 ease-out outline-none',
          'focus:border-orange-500 focus:ring-2 focus:ring-orange-100',
          disabled
            ? 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400'
            : error
              ? 'border-red-400 bg-red-50 text-gray-800 hover:border-red-500'
              : open
                ? 'border-orange-500 bg-white text-gray-800 ring-2 ring-orange-100'
                : 'border-gray-200 bg-white text-gray-800 hover:border-orange-400',
          className,
        )}
      >
        <span className={cn('truncate', !selected && 'text-gray-400')}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <Clock3 className="h-4 w-4 text-orange-500" />
          <ChevronDown
            className={cn(
              'h-4 w-4 text-orange-500 transition-transform duration-200 ease-out',
              open && 'rotate-180',
            )}
          />
        </span>
      </button>

      {typeof document !== 'undefined' && createPortal(dropdown, document.body)}
    </>
  )
}

export default TimeSelect
