// ===============================
// Badge.jsx
// ===============================

import { cn } from '../../lib/utils'

const Badge = ({
  className,
  variant = 'default',
  children,
  ...props
}) => {
  const variants = {
    default: 'bg-stone-100 text-stone-700',
    primary: 'bg-orange-100 text-orange-700',
    secondary: 'bg-slate-100 text-slate-700',
    success: 'bg-emerald-100 text-emerald-700',
    warning: 'bg-amber-100 text-amber-700',
    error: 'bg-red-100 text-red-700',
    info: 'bg-orange-100 text-orange-700',
  }

  return (
    <span
      className={cn(
        `
        inline-flex items-center
        px-3 py-1
        rounded-full
        text-[11px]
        font-semibold
        tracking-wide
        `,
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}

export default Badge
