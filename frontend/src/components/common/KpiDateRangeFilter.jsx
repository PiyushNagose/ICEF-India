import AppDatePicker from '../ui/AppDatePicker'
import { cn } from '../../lib/utils'
import {
  DEFAULT_KPI_DATE_RANGE,
  KPI_DATE_RANGE_PRESETS,
} from './kpiDateRange'

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
