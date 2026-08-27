import AppDatePicker from '../ui/AppDatePicker'
import { cn } from '../../lib/utils'

export const KPI_DATE_RANGE_PRESETS = [
  { value: '7', label: '7 Days' },
  { value: '30', label: '30 Days' },
  { value: 'custom', label: 'Custom' },
]

export const DEFAULT_KPI_DATE_RANGE = {
  preset: '30',
  startDate: '',
  endDate: '',
}

const toISODate = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const getKpiDateRangeParams = (range = DEFAULT_KPI_DATE_RANGE) => {
  if (range.preset === 'custom') {
    return range.startDate && range.endDate
      ? { startDate: range.startDate, endDate: range.endDate }
      : {}
  }

  const days = Number(range.preset || DEFAULT_KPI_DATE_RANGE.preset)
  if (!Number.isFinite(days) || days <= 0) return {}

  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - (days - 1))

  return {
    startDate: toISODate(start),
    endDate: toISODate(end),
  }
}

const KpiDateRangeFilter = ({
  value,
  onChange,
  className = '',
}) => {
  const range = value || DEFAULT_KPI_DATE_RANGE
  const isCustom = range.preset === 'custom'
  const today = new Date()

  const update = (patch) => onChange({ ...range, ...patch })

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex h-11 rounded-xl border border-orange-100 bg-white p-1 shadow-sm">
          {KPI_DATE_RANGE_PRESETS.map((preset) => {
            const active = range.preset === preset.value
            return (
              <button
                key={preset.value}
                type="button"
                onClick={() => update({ preset: preset.value })}
                className={cn(
                  'h-9 rounded-lg px-3 text-sm font-semibold transition-all sm:px-4',
                  active
                    ? 'bg-orange-600 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-orange-50 hover:text-orange-700',
                )}
              >
                {preset.label}
              </button>
            )
          })}
        </div>

        {isCustom && (
          <div className="flex flex-wrap items-center gap-2">
            <AppDatePicker
              value={range.startDate}
              onChange={(startDate) => update({ startDate })}
              placeholder="Start date"
              maxDate={range.endDate ? new Date(range.endDate) : today}
              className="h-11 w-36 px-3 py-2"
            />
            <AppDatePicker
              value={range.endDate}
              onChange={(endDate) => update({ endDate })}
              placeholder="End date"
              minDate={range.startDate ? new Date(range.startDate) : undefined}
              maxDate={today}
              className="h-11 w-36 px-3 py-2"
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default KpiDateRangeFilter
