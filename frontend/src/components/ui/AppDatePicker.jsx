import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '../../lib/utils'

/**
 * AppDatePicker — fully custom portal-based date picker.
 * Never clipped by parent overflow. No external library dependency.
 *
 * Props:
 *   value        — ISO date string "YYYY-MM-DD" (or "" / null)
 *   onChange     — (isoString: string) => void
 *   placeholder  — string
 *   className    — extra wrapper classes
 *   error        — boolean
 *   disabled     — boolean
 *   minDate      — Date object (optional)
 *   maxDate      — Date object (optional)
 */

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]
const DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa']

// Format Date → "DD/MM/YYYY"
const formatDisplay = (d) => {
  if (!d) return ''
  const day = String(d.getDate()).padStart(2, '0')
  const mon = String(d.getMonth() + 1).padStart(2, '0')
  return `${day}/${mon}/${d.getFullYear()}`
}

// Parse "YYYY-MM-DD" → Date (local midnight)
const parseISO = (s) => {
  if (!s) return null
  const [y, m, d] = s.split('-').map(Number)
  if (!y || !m || !d) return null
  const dt = new Date(y, m - 1, d)
  return isNaN(dt.getTime()) ? null : dt
}

// Date → "YYYY-MM-DD"
const toISO = (d) => {
  if (!d) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Build calendar grid for a given month/year
const buildCalendar = (year, month) => {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrev = new Date(year, month, 0).getDate()
  const cells = []

  // Previous month tail
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ date: new Date(year, month - 1, daysInPrev - i), outside: true })
  }
  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month, d), outside: false })
  }
  // Next month head — fill to complete last row
  const remaining = 42 - cells.length
  for (let d = 1; d <= remaining; d++) {
    cells.push({ date: new Date(year, month + 1, d), outside: true })
  }
  return cells
}

const isSameDay = (a, b) =>
  a && b &&
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()

const AppDatePicker = ({
  value,
  onChange,
  placeholder = 'Select date',
  className = '',
  error = false,
  disabled = false,
  minDate,
  maxDate,
}) => {
  const selected = parseISO(value)
  const today = new Date()

  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear] = useState((selected || today).getFullYear())
  const [viewMonth, setViewMonth] = useState((selected || today).getMonth())
  const [pickerStyle, setPickerStyle] = useState({})
  const [mode, setMode] = useState('day') // 'day' | 'month' | 'year'

  const triggerRef = useRef(null)
  const pickerRef = useRef(null)

  // Year range for year picker (±10 from view year)
  const yearStart = viewYear - 6
  const years = Array.from({ length: 13 }, (_, i) => yearStart + i)

  const calcPosition = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const pickerH = 340
    const spaceBelow = window.innerHeight - rect.bottom
    const openUp = spaceBelow < pickerH + 8 && rect.top > pickerH

    setPickerStyle({
      position: 'fixed',
      left: Math.min(rect.left, window.innerWidth - 300),
      width: Math.max(rect.width, 280),
      zIndex: 99999,
      ...(openUp
        ? { bottom: window.innerHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
    })
  }, [])

  const handleOpen = () => {
    if (disabled) return
    // Sync view to selected date when opening
    if (selected) {
      setViewYear(selected.getFullYear())
      setViewMonth(selected.getMonth())
    }
    setMode('day')
    calcPosition()
    setOpen(true)
  }

  // Reposition on scroll/resize
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
        pickerRef.current && !pickerRef.current.contains(e.target)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const selectDate = (date) => {
    onChange(toISO(date))
    setOpen(false)
  }

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  const isDisabled = (date) => {
    if (minDate && date < minDate) return true
    if (maxDate && date > maxDate) return true
    return false
  }

  const cells = buildCalendar(viewYear, viewMonth)

  // ── Calendar popup ──────────────────────────────────────────────────────────
  const picker = open ? (
    <div
      ref={pickerRef}
      style={pickerStyle}
      className="bg-white rounded-2xl border border-gray-200 shadow-2xl overflow-hidden select-none"
      onMouseDown={(e) => e.preventDefault()} // prevent trigger blur
    >
      {/* Header */}
      <div className="bg-orange-600 px-4 py-3 flex items-center justify-between">
        <button
          type="button"
          onClick={prevMonth}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-orange-500 text-white transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2">
          {/* Month selector */}
          <button
            type="button"
            onClick={() => setMode(mode === 'month' ? 'day' : 'month')}
            className="text-white font-bold text-sm hover:bg-orange-500 px-2 py-1 rounded-lg transition-colors"
          >
            {MONTHS[viewMonth]}
          </button>
          {/* Year selector */}
          <button
            type="button"
            onClick={() => setMode(mode === 'year' ? 'day' : 'year')}
            className="text-white font-bold text-sm hover:bg-orange-500 px-2 py-1 rounded-lg transition-colors"
          >
            {viewYear}
          </button>
        </div>

        <button
          type="button"
          onClick={nextMonth}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-orange-500 text-white transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Month picker overlay */}
      {mode === 'month' && (
        <div className="p-3 grid grid-cols-3 gap-2">
          {MONTHS.map((m, i) => (
            <button
              key={m}
              type="button"
              onClick={() => { setViewMonth(i); setMode('day') }}
              className={cn(
                'py-2 rounded-lg text-sm font-medium transition-colors',
                i === viewMonth
                  ? 'bg-orange-600 text-white'
                  : 'hover:bg-orange-50 text-gray-700',
              )}
            >
              {m.slice(0, 3)}
            </button>
          ))}
        </div>
      )}

      {/* Year picker overlay */}
      {mode === 'year' && (
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => setViewYear(y => y - 13)}
              className="text-gray-500 hover:text-orange-600 p-1"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs text-gray-500 font-medium">
              {yearStart} – {yearStart + 12}
            </span>
            <button
              type="button"
              onClick={() => setViewYear(y => y + 13)}
              className="text-gray-500 hover:text-orange-600 p-1"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {years.map((y) => (
              <button
                key={y}
                type="button"
                onClick={() => { setViewYear(y); setMode('day') }}
                className={cn(
                  'py-1.5 rounded-lg text-sm font-medium transition-colors',
                  y === viewYear
                    ? 'bg-orange-600 text-white'
                    : 'hover:bg-orange-50 text-gray-700',
                )}
              >
                {y}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Day grid */}
      {mode === 'day' && (
        <div className="p-3">
          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map((d) => (
              <div key={d} className="text-center text-[11px] font-bold text-gray-400 py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Date cells */}
          <div className="grid grid-cols-7 gap-y-0.5">
            {cells.map(({ date, outside }, idx) => {
              const isToday = isSameDay(date, today)
              const isSelected = isSameDay(date, selected)
              const disabled = isDisabled(date)

              return (
                <button
                  key={idx}
                  type="button"
                  disabled={disabled}
                  onClick={() => !outside && !disabled && selectDate(date)}
                  className={cn(
                    'h-8 w-full flex items-center justify-center rounded-full text-sm transition-colors',
                    outside && 'text-gray-300',
                    !outside && !isSelected && !disabled && 'hover:bg-orange-100 text-gray-700',
                    isToday && !isSelected && 'font-bold text-orange-600',
                    isSelected && 'bg-orange-600 text-white font-bold',
                    disabled && 'opacity-30 cursor-not-allowed',
                  )}
                >
                  {date.getDate()}
                </button>
              )
            })}
          </div>

          {/* Today shortcut */}
          <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between items-center">
            <button
              type="button"
              onClick={() => selectDate(today)}
              className="text-xs font-semibold text-orange-600 hover:text-orange-700 transition-colors"
            >
              Today
            </button>
            {selected && (
              <button
                type="button"
                onClick={() => { onChange(''); setOpen(false) }}
                className="text-xs font-semibold text-gray-400 hover:text-red-500 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  ) : null

  return (
    <>
      {/* Trigger button */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={handleOpen}
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
          {selected ? formatDisplay(selected) : placeholder}
        </span>
        <Calendar className="w-4 h-4 flex-shrink-0 text-orange-500" />
      </button>

      {/* Portal — renders outside all overflow containers */}
      {typeof document !== 'undefined' && createPortal(picker, document.body)}
    </>
  )
}

export default AppDatePicker
