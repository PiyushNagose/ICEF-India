import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  FileText, Briefcase, Settings, Headphones, Users,
  ChevronLeft, ChevronRight, Download, Filter,
  Clock, UserCheck, Briefcase as BriefcaseIcon, AlertCircle,
} from 'lucide-react'
import AdminLayout from '../../components/layouts/AdminLayout'
import { adminService } from '../../services/admin.service'
import { API_BASE_URL, STORAGE_KEYS } from '../../api/config'
import { hasPermission, useAuth } from '../../hooks/useAuth'

// ── Action badge config ───────────────────────────────────
const ACTION_CFG = {
  CREATE:   { bg: 'bg-emerald-500', text: 'text-white' },
  UPDATE:   { bg: 'bg-amber-400',   text: 'text-white' },
  DELETE:   { bg: 'bg-red-500',     text: 'text-white' },
  VIEW:     { bg: 'bg-blue-500',    text: 'text-white' },
  DOWNLOAD: { bg: 'bg-purple-500',  text: 'text-white' },
  LOGIN:    { bg: 'bg-orange-500',  text: 'text-white' },
  LOGOUT:   { bg: 'bg-gray-400',    text: 'text-white' },
  PUBLISH:  { bg: 'bg-teal-500',    text: 'text-white' },
  APPROVE:  { bg: 'bg-emerald-600', text: 'text-white' },
  REJECT:   { bg: 'bg-red-600',     text: 'text-white' },
}

const MODULE_ICONS = {
  Jobs: Briefcase, Applications: FileText,
  Employees: Users, Settings: Settings, Support: Headphones,
}

// Avatar with initials
const Avatar = ({ name }) => {
  const initials = (name || '?').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
  const colors = ['bg-orange-500','bg-blue-500','bg-purple-500','bg-teal-500','bg-rose-500']
  const color = colors[(initials.charCodeAt(0) || 0) % colors.length]
  return (
    <div className={`w-8 h-8 rounded-full ${color} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
      {initials}
    </div>
  )
}

// Numbered pagination
const Pagination = ({ page, totalPages, total, showing, onPage }) => {
  const pages = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (page > 3) pages.push('...')
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i)
    if (page < totalPages - 2) pages.push('...')
    pages.push(totalPages)
  }

  return (
    <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100">
      <p className="text-sm text-gray-500">
        Showing <span className="font-medium text-gray-700">{showing}</span> of{' '}
        <span className="font-medium text-gray-700">{Number(total).toLocaleString('en-IN')}</span> entries
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`dot-${i}`} className="w-8 h-8 flex items-center justify-center text-gray-400 text-sm">...</span>
          ) : (
            <button
              key={p}
              onClick={() => onPage(p)}
              className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                p === page
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onPage(page + 1)}
          disabled={page >= totalPages}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

const ActivityLogs = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({ module: '', action: '', employee: '', dateRange: '30' })

  const { data, isLoading } = useQuery({
    queryKey: ['admin-activity-logs', page, filters],
    queryFn: () => adminService.getActivityLogs({
      page, limit: 10,
      ...(filters.module   && { module: filters.module }),
      ...(filters.action   && { action: filters.action }),
      ...(filters.employee && { search: filters.employee }),
      ...(filters.dateRange && { days: filters.dateRange }),
    }),
  })

  const logs       = data?.logs || []
  const meta       = data?.meta || {}
  const totalPages = meta.totalPages || 1
  const totalItems = meta.total || logs.length

  const set = (key, val) => { setFilters(f => ({ ...f, [key]: val })); setPage(1) }
  const clearAll = () => { setFilters({ module: '', action: '', employee: '', dateRange: '30' }); setPage(1) }
  const hasFilters = filters.module || filters.action || filters.employee
  const canDownload = hasPermission(user, 'employees', 'download')

  const handleExport = () => {
    const token = localStorage.getItem(STORAGE_KEYS.accessToken)
    const params = new URLSearchParams({
      ...(filters.module && { module: filters.module }),
      ...(filters.action && { action: filters.action }),
    })
    const url = `${API_BASE_URL}/admin/activity-logs/export?${params}`
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob()).then(blob => {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `activity-logs-${Date.now()}.csv`
        a.click()
      }).catch(() => window.open(url, '_blank'))
  }

  // Quick stats from logs (approximate from current page)
  const todayCount  = logs.filter(l => new Date(l.createdAt).toDateString() === new Date().toDateString()).length
  const uniqueEmps  = new Set(logs.map(l => l.employeeId?._id)).size
  const jobLogs     = logs.filter(l => l.module === 'Jobs').length
  const criticals   = logs.filter(l => ['DELETE','REJECT'].includes(l.action?.toUpperCase())).length

  return (
    <AdminLayout title="Activity Logs">
      <div className="p-5 space-y-5">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Activity Logs</h1>
            <p className="text-sm text-gray-500 mt-0.5">System Audit &amp; Compliance Tracking for Recruitment Modules</p>
          </div>
          <div className="flex items-center gap-3">
            {canDownload && (
              <button
                onClick={handleExport}
                className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" /> Download CSV
              </button>
            )}
            <div className="relative">
              <select
                value={filters.dateRange}
                onChange={e => set('dateRange', e.target.value)}
                className="appearance-none border border-gray-200 rounded-lg pl-3 pr-8 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
              >
                <option value="7">Last 7 Days</option>
                <option value="30">Last 30 Days</option>
                <option value="90">Last 90 Days</option>
                <option value="365">Last 1 Year</option>
              </select>
              <ChevronRight className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none rotate-90" />
            </div>
          </div>
        </div>

        {/* ── Stat Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex items-center gap-4">
            <div className="w-11 h-11 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Clock className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-normal">Changes Today</p>
              <p className="text-3xl font-bold text-gray-900">{Number(totalItems).toLocaleString('en-IN')}</p>
              <p className="text-xs text-emerald-600 font-medium mt-0.5">↑ 12% vs avg</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex items-center gap-4">
            <div className="w-11 h-11 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <UserCheck className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-normal">Active Employees</p>
              <p className="text-3xl font-bold text-gray-900">{uniqueEmps}</p>
              <p className="text-xs text-gray-400 mt-0.5">Currently session active</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex items-center gap-4">
            <div className="w-11 h-11 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <BriefcaseIcon className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-normal">Jobs Updated</p>
              <p className="text-3xl font-bold text-gray-900">{jobLogs}</p>
              <p className="text-xs text-amber-600 font-medium mt-0.5">Pending validation</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex items-center gap-4">
            <div className="w-11 h-11 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-normal">Critical Alerts</p>
              <p className="text-3xl font-bold text-red-600">{String(criticals).padStart(2, '0')}</p>
              <p className="text-xs text-red-500 font-medium mt-0.5">Requires immediate review</p>
            </div>
          </div>
        </div>

        {/* ── Filters Bar ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-600 flex-shrink-0">
              <Filter className="w-4 h-4" /> Filters:
            </div>
            <select
              value={filters.employee}
              onChange={e => set('employee', e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="">All Employees</option>
            </select>
            <select
              value={filters.module}
              onChange={e => set('module', e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="">All Modules</option>
              {['Jobs','Applications','Employees','Roles','Projects','Support','Payments','Settings'].map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <select
              value={filters.action}
              onChange={e => set('action', e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="">All Action Types</option>
              {['CREATE','UPDATE','DELETE','VIEW','DOWNLOAD','LOGIN','LOGOUT','PUBLISH','APPROVE','REJECT'].map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
            {hasFilters && (
              <button onClick={clearAll} className="ml-auto text-sm font-semibold text-orange-600 hover:underline">
                Clear All
              </button>
            )}
          </div>
        </div>

        {/* ── Table ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="admin-data-scroll hover-scroll overflow-auto">
            <table className="w-full min-w-[960px] table-fixed">
              <colgroup>
                <col className="w-[14%]" />
                <col className="w-[20%]" />
                <col className="w-[13%]" />
                <col className="w-[16%]" />
                <col className="w-[37%]" />
              </colgroup>
              <thead className="bg-white shadow-sm">
                <tr>
                  {['Date & Time','Employee','Action','Module','Details'].map(h => (
                    <th key={h} className={`bg-white py-3 px-5 text-xs font-semibold text-gray-500 uppercase tracking-normal ${['Date & Time','Action'].includes(h) ? 'text-center' : 'text-left'}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {isLoading && (
                  <tr><td colSpan="5" className="py-16 text-center text-gray-400 text-sm">Loading activity logs...</td></tr>
                )}
                {!isLoading && logs.length === 0 && (
                  <tr><td colSpan="5" className="py-16 text-center text-gray-400 text-sm">No activity logs found.</td></tr>
                )}
                {logs.map((log) => {
                  const ModuleIcon = MODULE_ICONS[log.module] || FileText
                  const actionKey  = log.action?.toUpperCase()
                  const acfg       = ACTION_CFG[actionKey] || { bg: 'bg-gray-400', text: 'text-white' }
                  const name       = log.employeeId?.fullName || 'System'
                  return (
                    <tr key={log._id} className="hover:bg-orange-50/40 transition-colors cursor-pointer" onClick={() => log.employeeId?._id && navigate(`/admin/activity-logs/${log.employeeId._id}`, { state: { employee: log.employeeId } })}>
                      <td className="py-4 px-5 align-middle">
                        <p className="text-sm font-semibold text-gray-900">
                          {log.createdAt ? new Date(log.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                        </p>
                        <p className="text-xs text-orange-500 font-mono mt-0.5">
                          {log.createdAt ? new Date(log.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''}
                        </p>
                      </td>
                      <td className="py-4 px-5 align-middle">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={name} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-gray-900">{name}</p>
                            <p className="truncate text-xs text-gray-400">{log.employeeId?.employeeId || log.employeeId?.department || ''}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-5 align-middle text-center">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold tracking-normal ${acfg.bg} ${acfg.text}`}>
                          {actionKey || '-'}
                        </span>
                      </td>
                      <td className="py-4 px-5 align-middle">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <ModuleIcon className="w-3 h-3 text-orange-600" />
                          </div>
                          <span className="truncate text-sm text-gray-900">{log.module || '-'}</span>
                        </div>
                      </td>
                      <td className="py-4 px-5 align-middle">
                        <p className="truncate text-sm text-gray-600" title={log.details || log.description}>
                          {log.details || log.description || '-'}
                        </p>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <Pagination
            page={page}
            totalPages={totalPages}
            total={totalItems}
            showing={logs.length}
            onPage={setPage}
          />
        </div>

      </div>
    </AdminLayout>
  )
}

export default ActivityLogs






