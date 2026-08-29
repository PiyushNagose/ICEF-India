import { Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'

export const AdminTableShell = ({
  children,
  footer,
  className,
  scrollClassName,
  minHeight = 'min-h-[420px]',
}) => (
  <div
    className={cn(
      'flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm',
      minHeight,
      className,
    )}
  >
    <div
      className={cn(
        'admin-data-scroll hover-scroll min-h-0 flex-1 overflow-auto [&_td]:align-middle [&_th]:whitespace-nowrap [&_td_.rounded-full]:whitespace-nowrap [&_td_.rounded-md]:whitespace-nowrap',
        scrollClassName,
      )}
    >
      {children}
    </div>
    {footer}
  </div>
)

export const AdminTableStatusRow = ({
  colSpan,
  type = 'empty',
  title,
  description,
  icon: Icon,
}) => (
  <tr>
    <td colSpan={colSpan} className="px-6 py-16 text-center">
      <div className="flex flex-col items-center justify-center gap-3 text-gray-400">
        {type === 'loading' ? (
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        ) : Icon ? (
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100">
            <Icon className="h-7 w-7 text-gray-300" />
          </div>
        ) : null}
        <div>
          <p className="text-sm font-semibold text-gray-600">{title}</p>
          {description ? (
            <p className="mt-1 text-xs text-gray-400">{description}</p>
          ) : null}
        </div>
      </div>
    </td>
  </tr>
)

export default AdminTableShell
