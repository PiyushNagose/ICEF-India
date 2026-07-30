import { cn } from '../../lib/utils'

const Card = ({ className, children, ...props }) => {
  return (
    <div
      className={cn(
        'card bg-surface rounded-2xl shadow-soft border border-border min-w-0 overflow-hidden',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

const CardHeader = ({ className, children, ...props }) => {
  return (
    <div
      className={cn('p-6 pb-0', className)}
      {...props}
    >
      {children}
    </div>
  )
}

const CardContent = ({ className, children, ...props }) => {
  return (
    <div
      className={cn('p-6 min-w-0', className)}
      {...props}
    >
      {children}
    </div>
  )
}

const CardFooter = ({ className, children, ...props }) => {
  return (
    <div
      className={cn('p-6 pt-0', className)}
      {...props}
    >
      {children}
    </div>
  )
}

export { Card, CardHeader, CardContent, CardFooter }
