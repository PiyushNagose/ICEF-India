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
