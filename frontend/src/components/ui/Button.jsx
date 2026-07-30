// ===============================
// Button.jsx
// ===============================

import { forwardRef, cloneElement } from 'react'
import { cn } from '../../lib/utils'

const Button = forwardRef(
  (
    {
      className,
      variant = 'primary',
      size = 'default',
      children,
      disabled,
      asChild = false,
      ...props
    },
    ref
  ) => {
    const variants = {
      primary:
        'bg-[#f97316] hover:bg-[#ea580c] text-white shadow-[0_8px_20px_rgba(249,115,22,0.25)] hover:shadow-[0_10px_28px_rgba(249,115,22,0.35)]',

      secondary:
        'bg-[#111827] hover:bg-[#1f2937] text-white shadow-sm',

      outline:
        'border border-[#d6d3d1] hover:bg-[#f5f5f4] text-[#44403c] bg-white',

      ghost:
        'hover:bg-[#f5f5f4] text-[#44403c]',

      danger:
        'bg-red-600 hover:bg-red-700 text-white shadow-sm',

      success:
        'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm',

      warning:
        'bg-amber-500 hover:bg-amber-600 text-white shadow-sm',
    }

    const sizes = {
      sm: 'px-3 py-2 text-sm',
      default: 'px-5 py-2.5 text-sm',
      lg: 'px-6 py-3 text-base',
    }

    const baseClasses = cn(
      `
      inline-flex items-center justify-center
      rounded-xl font-semibold
      transition-all duration-200 ease-out
      focus:outline-none
      disabled:opacity-50
      disabled:pointer-events-none
      active:scale-[0.98]
      `,
      variants[variant],
      sizes[size],
      className
    )

    if (asChild && children) {
      return cloneElement(children, {
        className: cn(baseClasses, children.props.className),
        ref,
        ...props,
      })
    }

    return (
      <button
        className={baseClasses}
        ref={ref}
        disabled={disabled}
        {...props}
      >
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'

export default Button
