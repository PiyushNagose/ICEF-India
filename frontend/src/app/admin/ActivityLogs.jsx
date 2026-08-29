import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  FileText, Briefcase, Settings, Headphones, Users,
  Download, Filter,
  Clock, UserCheck, Briefcase as BriefcaseIcon, AlertCircle,
} from 'lucide-react'
import AdminLayout from '../../components/layouts/AdminLayout'
import { adminService } from '../../services/admin.service'
import { API_BASE_URL, STORAGE_KEYS } from '../../api/config'
import { hasPermission, useAuth } from '../../hooks/useAuth'
import CustomSelect from '../../components/ui/CustomSelect'
import AdminPagination from '../../components/ui/AdminPagination'
import { AdminTableShell, AdminTableStatusRow } from '../../components/ui/AdminTable'

// ── Action badge config ───────────────────────────────────
const ACTION_CFG = {
  CREATE:   { bg: 'bg-emerald-500', text: 'text-white' },
  UPDATE:   { bg: 'bg-amber-400',   text: 'text-white' },
  DELETE:   { bg: 'bg-red-500',     text: 'text-white' },
  VIEW:     { bg: 'bg-orange-500',  text: 'text-white' },
  DOWNLOAD: { bg: 'bg-orange-600',  text: 'text-white' },
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

  const { data: employeesData } = useQuery({
    queryKey: ['admin-activity-filter-employees'],
    queryFn: () => adminService.getEmployees({ limit: 100 }),
  })

  const logs       = data?.logs || []
  const employees  = employeesData?.employees || employeesData?.data?.employees || []
  const meta       = data?.meta || {}
  const totalPages = meta.totalPages || 1
  const totalItems = meta.total || logs.length

  const set = (key, val) => { setFilters(f => ({ ...f, [key]: val })); setPage(1) }
  const clearAll = () => { setFilters({ module: '', action: '', employee: '', dateRange: '30' }); setPage(1) }
  const hasFilters = filters.module || filters.action || filters.employee || filters.dateRange !== '30'
  const canDownload = hasPermission(user, 'employees', 'download')

  const handleExport = () => {
    const token = localStorage.getItem(STORAGE_KEYS.accessToken)
    const params = new URLSearchParams({
      ...(filters.module && { module: filters.module }),
      ...(filters.action && { action: filters.action }),
      ...(filters.employee && { search: filters.employee }),
      ...(filters.dateRange && { days: filters.dateRange }),
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
              <p className="text-xs text-emerald-600 font-medium mt-0.5">Live audit trail</p>
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
            <CustomSelect
              value={filters.employee}
              onChange={val => set('employee', val)}
              className="w-52 border-gray-200"
              options={[
                { value: '', label: 'All Employees' },
                ...employees.map(emp => ({
                  value: emp.fullName || emp.employeeId || emp.email || emp._id,
                  label: emp.fullName
                    ? `${emp.fullName}${emp.employeeId ? ` (${emp.employeeId})` : ''}`
                    : emp.employeeId || emp.email || 'Employee',
                })),
              ]}
            />
            <CustomSelect
              value={filters.module}
              onChange={val => set('module', val)}
              className="w-44 border-gray-200"
              options={[
                { value: '', label: 'All Modules' },
                ...['Jobs','Applications','Employees','Roles','Projects','Support','Payments','Settings'].map(m => ({ value: m, label: m }))
              ]}
            />
            <CustomSelect
              value={filters.action}
              onChange={val => set('action', val)}
              className="w-44 border-gray-200"
              options={[
                { value: '', label: 'All Action Types' },
                ...['CREATE','UPDATE','DELETE','VIEW','DOWNLOAD','LOGIN','LOGOUT','PUBLISH','APPROVE','REJECT'].map(a => ({ value: a, label: a }))
              ]}
            />
            <CustomSelect
              value={filters.dateRange}
              onChange={val => set('dateRange', val)}
              className="w-40 border-gray-200"
              options={[
                { value: '7', label: 'Last 7 Days' },
                { value: '30', label: 'Last 30 Days' },
                { value: '90', label: 'Last 90 Days' },
                { value: '365', label: 'Last 1 Year' },
              ]}
            />
            {hasFilters && (
              <button onClick={clearAll} className="ml-auto text-sm font-semibold text-orange-600 hover:underline">
                Clear All
              </button>
            )}
          </div>
        </div>

        {/* ── Table ── */}
        <AdminTableShell
          footer={
            !isLoading && logs.length > 0 ? (
              <AdminPagination
                page={page}
                totalPages={totalPages}
                totalItems={totalItems}
                pageSize={meta.itemsPerPage || 10}
                itemsOnPage={logs.length}
                itemLabel="entries"
                onPageChange={setPage}
              />
            ) : null
          }
        >
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
                  <AdminTableStatusRow colSpan={5} type="loading" title="Loading activity logs..." />
                )}
                {!isLoading && logs.length === 0 && (
                  <AdminTableStatusRow colSpan={5} icon={Clock} title="No activity logs found" description="Audit entries will appear as admins work." />
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
                        <span className={`inline-flex items-center whitespace-nowrap px-2.5 py-1 rounded-md text-xs font-bold tracking-normal ${acfg.bg} ${acfg.text}`}>
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
        </AdminTableShell>

      </div>
    </AdminLayout>
  )
}

export default ActivityLogs






