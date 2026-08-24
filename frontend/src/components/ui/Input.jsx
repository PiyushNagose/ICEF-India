import { forwardRef } from 'react'
import { cn } from '../../lib/utils'

const Input = forwardRef(({ 
  className, 
  type = 'text', 
  error,
  label,
  placeholder,
  ...props 
}, ref) => {
  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-text-primary">
          {label}
        </label>
      )}
      <input
        type={type}
        className={cn(
          'w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-500 transition-colors',
          error ? 'border-error' : 'border-border',
          className
        )}
        ref={ref}
        placeholder={placeholder}
        {...props}
      />
      {error && (
        <p className="text-sm text-error">{error}</p>
      )}
    </div>
  )
})

Input.displayName = 'Input'

export default Input
