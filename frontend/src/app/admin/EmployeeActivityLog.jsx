import { useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft, Download, Mail, MapPin, Hash,
  FileText, Briefcase, Settings, Headphones, Users,
  ChevronLeft, ChevronRight, Clock, Activity,
  AlertTriangle, BarChart2, Monitor, Smartphone,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import AdminLayout from '../../components/layouts/AdminLayout'
import { adminService } from '../../services/admin.service'
import { API_BASE_URL, STORAGE_KEYS } from '../../api/config'
import { hasPermission, useAuth } from '../../hooks/useAuth'

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

const BAR_COLORS = ['#f97316','#fb923c','#fdba74','#fcd34d','#86efac','#67e8f9','#a78bfa']

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
        <button onClick={() => onPage(page - 1)} disabled={page <= 1}
          className="px-3 h-8 flex items-center gap-1 rounded-lg border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
          <ChevronLeft className="w-3.5 h-3.5" /> Previous
        </button>
        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`d${i}`} className="w-8 h-8 flex items-center justify-center text-gray-400 text-sm">...</span>
          ) : (
            <button key={p} onClick={() => onPage(p)}
              className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                p === page ? 'bg-orange-600 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}>{p}</button>
          )
        )}
        <button onClick={() => onPage(page + 1)} disabled={page >= totalPages}
          className="px-3 h-8 flex items-center gap-1 rounded-lg border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
          Next <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

const EmployeeActivityLog = () => {
  const { employeeId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const [page, setPage] = useState(1)
  const [moduleFilter, setModuleFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('')

  // Employee info passed via navigation state (from ActivityLogs list)
  const empFromState = location.state?.employee

  const { data, isLoading } = useQuery({
    queryKey: ['employee-activity-logs', employeeId, page, moduleFilter, actionFilter],
    queryFn: () => adminService.getEmployeeActivityLogs(employeeId, {
      page, limit: 10,
      ...(moduleFilter && { module: moduleFilter }),
      ...(actionFilter && { action: actionFilter }),
    }),
  })

  const logs      = data?.logs || []
  const stats     = data?.stats || []
  const meta      = data?.meta || {}
  const totalPages = meta.totalPages || 1
  const totalItems = meta.total || logs.length

  // Build last-7-days chart data from logs
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i))
    const label = d.toLocaleDateString('en-IN', { weekday: 'short' }).toUpperCase()
    const count = logs.filter(l => new Date(l.createdAt).toDateString() === d.toDateString()).length
    return { label, count, isToday: i === 6 }
  })
  const maxBar = Math.max(...last7.map(d => d.count), 1)

  // Stats from aggregation
  const totalChanges = stats.reduce((s, x) => s + (x.count || 0), 0)
  const criticals    = (stats.find(s => s._id === 'DELETE')?.count || 0) + (stats.find(s => s._id === 'REJECT')?.count || 0)
  const lastLog      = logs[0]
  const lastActivity = lastLog?.createdAt
    ? (() => {
        const diff = Math.floor((Date.now() - new Date(lastLog.createdAt)) / 60000)
        if (diff < 60) return `${diff} mins ago`
        if (diff < 1440) return `${Math.floor(diff / 60)} hrs ago`
        return `${Math.floor(diff / 1440)} days ago`
      })()
    : '-'

  const empName = empFromState?.fullName || 'Employee'
  const empEmpId = empFromState?.employeeId || '-'
  const empDept  = empFromState?.department || '-'
  const canDownload = hasPermission(user, 'employees', 'download')

  const initials = empName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()

  const handleExport = () => {
    const token = localStorage.getItem(STORAGE_KEYS.accessToken)
    const url = `${API_BASE_URL}/admin/activity-logs/export?employeeId=${employeeId}`
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob()).then(blob => {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `activity-${empEmpId}-${Date.now()}.csv`
        a.click()
      })
  }

  return (
    <AdminLayout title="Employee Activity & Details">
      <div className="p-5 space-y-5">

        {/* Employee Hero Card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <button onClick={() => navigate('/admin/activity-logs')}
                className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600 flex-shrink-0">
                <ArrowLeft className="w-4 h-4" />
              </button>
              {/* Avatar */}
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-2xl font-bold flex-shrink-0 shadow-md">
                {initials}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <h2 className="text-lg font-bold text-gray-900">{empName}</h2>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" /> ACTIVITY TRACKED
                  </span>
                </div>
                <p className="text-sm text-gray-500 mb-2">{empDept}</p>
                <div className="flex items-center gap-4 flex-wrap">
                  <span className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-lg">
                    <Hash className="w-3 h-3" /> {empEmpId}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-lg">
                    <MapPin className="w-3 h-3" /> Admin Portal
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button className="flex items-center gap-2 border border-gray-200 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors">
                <Mail className="w-4 h-4" /> Contact
              </button>
              {canDownload && (
                <button onClick={handleExport}
                  className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
                  <Download className="w-4 h-4" /> Export Activity Data
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: 'Changes Today', value: logs.filter(l => new Date(l.createdAt).toDateString() === new Date().toDateString()).length, sub: null, icon: Activity, border: 'border-t-orange-400' },
            { label: 'Total Changes', value: totalChanges, sub: null, icon: BarChart2, border: 'border-t-blue-400' },
            { label: 'Last Activity', value: lastActivity, sub: null, icon: Clock, border: 'border-t-amber-400' },
            { label: 'Projects Updated', value: stats.find(s => s._id === 'CREATE')?.count || 0, sub: null, icon: Briefcase, border: 'border-t-purple-400' },
            { label: 'Critical Changes', value: criticals, sub: 'in 7 days', subColor: 'text-red-500', icon: AlertTriangle, border: 'border-t-red-400' },
          ].map(({ label, value, sub, subColor, icon: Icon, border }) => (
            <div key={label} className={`bg-white rounded-2xl border border-gray-200 border-t-4 ${border} p-4 shadow-sm`}>
              <div className="flex items-start justify-between mb-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-normal leading-tight">{label}</p>
                <Icon className="w-4 h-4 text-gray-300 flex-shrink-0" />
              </div>
              <p className="text-3xl font-bold text-gray-900">{value}</p>
              {sub && <p className={`text-xs font-medium mt-0.5 ${subColor || 'text-gray-400'}`}>{sub}</p>}
            </div>
          ))}
        </div>

        {/* Activity Audit Log Table */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Table header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-orange-500" />
              <span className="font-semibold text-gray-900">Activity Audit Log</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <select value={moduleFilter} onChange={e => { setModuleFilter(e.target.value); setPage(1) }}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500">
                <option value="">All Modules</option>
                {['Jobs','Applications','Employees','Roles','Projects','Support','Payments','Settings'].map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <select value={actionFilter} onChange={e => { setActionFilter(e.target.value); setPage(1) }}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500">
                <option value="">Action Type</option>
                {['CREATE','UPDATE','DELETE','VIEW','DOWNLOAD','LOGIN','LOGOUT','PUBLISH','APPROVE','REJECT'].map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="admin-data-scroll hover-scroll overflow-auto">
            <table className="w-full min-w-[960px] table-fixed">
              <colgroup>
                <col className="w-[22%]" />
                <col className="w-[12%]" />
                <col className="w-[32%]" />
                <col className="w-[14%]" />
                <col className="w-[20%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-gray-100">
                  {['Module / Project','Action','Details','IP Address','Date & Time'].map(h => (
                    <th key={h} className={`py-3 px-5 text-xs font-semibold text-gray-500 uppercase tracking-normal ${['Action','IP Address','Date & Time'].includes(h) ? 'text-center' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {isLoading && (
                  <tr><td colSpan="5" className="py-16 text-center text-gray-400 text-sm">Loading...</td></tr>
                )}
                {!isLoading && logs.length === 0 && (
                  <tr><td colSpan="5" className="py-16 text-center text-gray-400 text-sm">No activity logs found.</td></tr>
                )}
                {logs.map(log => {
                  const ModuleIcon = MODULE_ICONS[log.module] || FileText
                  const actionKey  = log.action?.toUpperCase()
                  const acfg       = ACTION_CFG[actionKey] || { bg: 'bg-gray-400', text: 'text-white' }
                  const isDelete   = actionKey === 'DELETE'
                  return (
                    <tr key={log._id} className="hover:bg-orange-50/30 transition-colors">
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <ModuleIcon className="w-4 h-4 text-orange-600" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{log.module || '-'}</p>
                            {log.resourceId && <p className="text-xs text-gray-400">{log.resourceId}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-5 text-center">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold tracking-normal ${acfg.bg} ${acfg.text}`}>
                          {actionKey || '-'}
                        </span>
                      </td>
                      <td className="py-4 px-5">
                        <p className={`text-sm max-w-xs truncate ${isDelete ? 'text-red-500 font-medium' : 'text-gray-600'}`}
                          title={log.details}>
                          {log.details || '-'}
                        </p>
                      </td>
                      <td className="py-4 px-5 text-center">
                        <span className="text-xs font-mono text-gray-500">{log.ipAddress || '-'}</span>
                      </td>
                      <td className="py-4 px-5 text-center">
                        <p className="text-sm font-medium text-gray-900">
                          {log.createdAt ? new Date(log.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {log.createdAt ? new Date(log.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}
                        </p>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <Pagination page={page} totalPages={totalPages} total={totalItems} showing={logs.length} onPage={setPage} />
        </div>

        {/* Bottom Row: Activity Chart + Device Info */}
        <div className="grid grid-cols-1 items-stretch lg:grid-cols-2 gap-5">

          {/* Activity Intensity Chart */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Activity Intensity (Last 7 Days)</h3>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={last7} margin={{ top: 10, right: 0, left: -20, bottom: 0 }} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af', fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#d1d5db' }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(249,115,22,0.06)' }}
                  content={({ active, payload }) => active && payload?.length ? (
                    <div className="bg-gray-900 text-white rounded-lg px-3 py-2 text-xs shadow-xl">
                      <p className="font-bold">{payload[0].payload.label}</p>
                      <p>Actions: <span className="text-orange-300 font-semibold">{payload[0].value}</span></p>
                    </div>
                  ) : null}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={40}>
                  {last7.map((d, i) => (
                    <Cell key={i} fill={d.isToday ? '#f97316' : '#fed7aa'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Device & Network Integrity */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Device &amp; Network Integrity</h3>
            <div className="space-y-3">
              {/* Unique IPs from logs */}
              {[...new Set(logs.map(l => l.ipAddress).filter(Boolean))].slice(0, 4).map((ip, i) => (
                <div key={ip} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      {i % 2 === 0 ? <Monitor className="w-4 h-4 text-gray-500" /> : <Smartphone className="w-4 h-4 text-gray-500" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{i % 2 === 0 ? 'Desktop Device' : 'Mobile Device'}</p>
                      <p className="text-xs text-gray-400">Network - {ip}</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">SECURE</span>
                </div>
              ))}
              {logs.filter(l => l.ipAddress).length === 0 && (
                <p className="text-sm text-gray-400 text-center py-6">No device data available</p>
              )}
            </div>
          </div>
        </div>

      </div>
    </AdminLayout>
  )
}

export default EmployeeActivityLog





