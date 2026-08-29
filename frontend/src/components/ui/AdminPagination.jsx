import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '../../lib/utils'

const buildPages = (page, totalPages) => {
  const pages = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i += 1) pages.push(i)
    return pages
  }

  pages.push(1)
  if (page > 3) pages.push('...')
  for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i += 1) {
    pages.push(i)
  }
  if (page < totalPages - 2) pages.push('...')
  pages.push(totalPages)
  return pages
}

const AdminPagination = ({
  page = 1,
  totalPages = 1,
  totalItems = 0,
  pageSize = 0,
  itemsOnPage,
  itemLabel = 'records',
  onPageChange,
  className,
}) => {
  const safeTotalPages = Math.max(1, Number(totalPages) || 1)
  const safePage = Math.min(Math.max(1, Number(page) || 1), safeTotalPages)
  const safeTotalItems = Math.max(0, Number(totalItems) || 0)
  const safePageSize = Math.max(0, Number(pageSize) || 0)
  const safeItemsOnPage = Math.max(0, Number(itemsOnPage ?? pageSize) || 0)
  const showingFrom = safeTotalItems > 0 ? (safePage - 1) * safePageSize + 1 : 0
  const showingTo =
    safeTotalItems > 0
      ? Math.min(showingFrom + Math.max(safeItemsOnPage, 1) - 1, safeTotalItems)
      : 0
  const pages = buildPages(safePage, safeTotalPages)

  return (
    <div
      className={cn(
        'flex flex-col gap-3 border-t border-gray-100 bg-gray-50/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <p className="text-sm text-gray-500">
        Showing{' '}
        <span className="font-semibold text-gray-700">
          {showingFrom}-{showingTo}
        </span>{' '}
        of{' '}
        <span className="font-semibold text-gray-700">
          {Number(totalItems || 0).toLocaleString('en-IN')}
        </span>{' '}
        {itemLabel}
      </p>

      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange?.(safePage - 1)}
          disabled={safePage <= 1}
          className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg border border-gray-200 bg-white px-2 text-gray-500 transition-colors hover:bg-orange-50 hover:text-orange-700 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {pages.map((p, index) =>
          p === '...' ? (
            <span
              key={`ellipsis-${index}`}
              className="flex h-8 w-8 items-center justify-center text-sm text-gray-400"
            >
              ...
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange?.(p)}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-lg text-sm font-semibold transition-colors',
                p === safePage
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'border border-gray-200 bg-white text-gray-600 hover:bg-orange-50 hover:text-orange-700',
              )}
            >
              {p}
            </button>
          ),
        )}

        <button
          type="button"
          onClick={() => onPageChange?.(safePage + 1)}
          disabled={safePage >= safeTotalPages}
          className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg border border-gray-200 bg-white px-2 text-gray-500 transition-colors hover:bg-orange-50 hover:text-orange-700 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

export default AdminPagination
