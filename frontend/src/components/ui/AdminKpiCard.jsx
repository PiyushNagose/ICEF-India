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

const AdminKpiCard = ({
  title,
  value,
  icon: Icon,
  tone = 'orange',
  helper,
  badge,
  valueClassName,
  className,
}) => {
  const colors = TONES[tone] || TONES.orange

  return (
    <div
      className={cn(
        'relative min-w-0 overflow-hidden rounded-[22px] border border-gray-200 bg-white p-5 shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md',
        className,
      )}
    >
      <div
        className={cn(
          'absolute left-0 top-0 h-1 w-full bg-gradient-to-r',
          colors.accent,
        )}
      />

      <div className="flex min-w-0 items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="mb-2 text-xs font-bold uppercase tracking-normal text-gray-400">
            {title}
          </p>

          <p
            className={cn(
              'truncate text-3xl font-bold tracking-normal text-gray-900',
              valueClassName,
            )}
          >
            {formatValue(value ?? 0)}
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
                    'inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-normal',
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
              'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl',
              colors.iconBg,
            )}
          >
            <Icon className={cn('h-5 w-5', colors.iconText)} />
          </div>
        )}
      </div>
    </div>
  )
}

export default AdminKpiCard
