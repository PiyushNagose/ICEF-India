import { cn } from '../../lib/utils'

const TONES = {
  orange: {
    accent: 'from-orange-500 to-orange-600',
    iconBg: 'bg-orange-50',
    iconText: 'text-orange-600',
  },
  green: {
    accent: 'from-emerald-500 to-emerald-600',
    iconBg: 'bg-emerald-50',
    iconText: 'text-emerald-600',
  },
  blue: {
    accent: 'from-blue-500 to-blue-600',
    iconBg: 'bg-blue-50',
    iconText: 'text-blue-600',
  },
  amber: {
    accent: 'from-amber-500 to-amber-600',
    iconBg: 'bg-amber-50',
    iconText: 'text-amber-600',
  },
  red: {
    accent: 'from-red-500 to-red-600',
    iconBg: 'bg-red-50',
    iconText: 'text-red-600',
  },
  purple: {
    accent: 'from-purple-500 to-purple-600',
    iconBg: 'bg-purple-50',
    iconText: 'text-purple-600',
  },
  slate: {
    accent: 'from-slate-500 to-slate-600',
    iconBg: 'bg-slate-50',
    iconText: 'text-slate-600',
  },
}

const formatValue = (value) =>
  typeof value === 'number' ? value.toLocaleString('en-IN') : value

const valueTextClass = (compact, isLongValue) =>
  compact
    ? 'text-[24px] leading-7'
    : isLongValue
      ? 'text-[22px] leading-7'
      : 'text-[28px] leading-8'

const AdminKpiCard = ({
  title,
  value,
  icon: Icon,
  tone = 'orange',
  helper,
  badge,
  compact = false,
  valueClassName,
  className,
}) => {
  const colors = TONES[tone] || TONES.orange
  const displayValue = formatValue(value ?? 0)
  const isLongValue = String(displayValue).length > 10

  return (
    <div
      className={cn(
        'relative min-w-0 overflow-hidden rounded-[22px] border border-gray-200 bg-white shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md',
        compact ? 'p-3' : 'p-5',
        className,
      )}
    >
      <div
        className={cn(
          'absolute left-0 top-0 h-1 w-full bg-gradient-to-r',
          colors.accent,
        )}
      />

      <div
        className={cn(
          compact
            ? 'flex min-h-[66px] min-w-0 items-start justify-between gap-3'
            : 'flex min-w-0 items-start justify-between gap-4',
        )}
      >
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              'truncate font-bold uppercase tracking-normal text-gray-400',
              compact ? 'mb-1 text-[11px] leading-4' : 'mb-2 text-xs',
            )}
            title={title}
          >
            {title}
          </p>

          <p
            className={cn(
              'min-w-0 break-words font-bold tabular-nums tracking-normal text-gray-900',
              valueTextClass(compact, isLongValue),
              valueClassName,
            )}
            title={String(displayValue)}
          >
            {displayValue}
          </p>

          {(helper || badge) && (
            <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
              {helper && (
                <p className="min-w-0 text-xs font-medium text-gray-500">
                  {helper}
                </p>
              )}
              {badge && (
                <span
                  className={cn(
                    'inline-flex whitespace-nowrap rounded-full px-2 py-0.5 font-bold uppercase tracking-normal',
                    compact ? 'text-[10px]' : 'text-[11px]',
                    badge.className || 'bg-orange-100 text-orange-700',
                  )}
                >
                  {badge.label}
                </span>
              )}
            </div>
          )}
        </div>

        {Icon && (
          <div
            className={cn(
              'flex shrink-0 items-center justify-center rounded-2xl',
              compact ? 'h-10 w-10' : 'h-12 w-12',
              colors.iconBg,
            )}
          >
            <Icon className={cn(compact ? 'h-4 w-4' : 'h-5 w-5', colors.iconText)} />
          </div>
        )}
      </div>
    </div>
  )
}

export default AdminKpiCard
