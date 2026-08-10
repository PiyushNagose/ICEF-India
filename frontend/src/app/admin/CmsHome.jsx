import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  Layers, Plus, Eye, Pencil, Trash2,
  Globe, FileText, Archive, Clock,
  Filter, Download, Loader2, AlertCircle,
  Megaphone,
} from 'lucide-react'
import AdminLayout from '../../components/layouts/AdminLayout'
import { adminService } from '../../services/admin.service'

const STATUS_CFG = {
  published: { label: 'Published', bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  draft:     { label: 'Draft',     bg: 'bg-amber-100',   text: 'text-amber-700',   dot: 'bg-amber-500'   },
  archived:  { label: 'Archived',  bg: 'bg-gray-100',    text: 'text-gray-600',    dot: 'bg-gray-400'    },
}

const StateInitial = ({ state }) => {
  const words = state.trim().split(' ')
  const initials = words.length >= 2
    ? (words[0][0] + words[1][0]).toUpperCase()
    : state.slice(0, 2).toUpperCase()
  const colors = [
    'bg-orange-500','bg-blue-500','bg-purple-500','bg-teal-500',
    'bg-rose-500','bg-indigo-500','bg-emerald-500','bg-amber-500',
  ]
  const color = colors[state.charCodeAt(0) % colors.length]
  return (
    <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
      {initials}
    </div>
  )
}

const StatCard = ({ icon: Icon, label, value, color, sub }) => (
  <div className="bg-white rounded-xl border border-gray-200 p-5">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-normal mb-1">{label}</p>
        <p className="text-3xl font-bold text-gray-900">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
      </div>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
    </div>
  </div>
)

const RECENT_ACTIVITY = [] // removed — now dynamic

// Time-ago helper
const timeAgo = (date) => {
  if (!date) return '—'
  const diff = Date.now() - new Date(date).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 1)   return 'Just now'
  if (mins < 60)  return `${mins} minute${mins === 1 ? '' : 's'} ago`
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  if (days === 1) return 'Yesterday'
  return `${days} days ago`
}

// Icon + colour per activity type
const ACTIVITY_CFG = {
  edit:         { Icon: Pencil,   bg: 'bg-orange-100',  color: 'text-orange-600' },
  publish:      { Icon: Globe,    bg: 'bg-emerald-100', color: 'text-emerald-600' },
  archive:      { Icon: Archive,  bg: 'bg-gray-100',    color: 'text-gray-600' },
  create:       { Icon: Plus,     bg: 'bg-blue-100',    color: 'text-blue-600' },
  announcement: { Icon: Megaphone,bg: 'bg-amber-100',   color: 'text-amber-600' },
  draft:        { Icon: FileText, bg: 'bg-orange-100',  color: 'text-orange-600' },
  system:       { Icon: Layers,   bg: 'bg-orange-100',  color: 'text-orange-600' },
}

const CmsHome = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['admin-cms-pages'],
    queryFn: () => adminService.getCmsPages(),
  })

  const { data: activityData, isLoading: activityLoading } = useQuery({
    queryKey: ['admin-cms-activity'],
    queryFn: () => adminService.getCmsActivity(8),
    refetchInterval: 30000, // auto-refresh every 30s
  })

  const { mutate: deletePage, isPending: deleting } = useMutation({
    mutationFn: (state) => adminService.deleteCmsPage(state),
    onSuccess: () => {
      toast.success('State page deleted')
      queryClient.invalidateQueries({ queryKey: ['admin-cms-pages'] })
    },
    onError: (err) => toast.error(err.message || 'Failed to delete'),
  })

  const pages = data?.pages || []
  const stats = data?.stats || {}

  const filtered = statusFilter
    ? pages.filter((p) => p.status === statusFilter)
    : pages

  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

  const lastUpdated = stats.lastUpdated
    ? (() => {
        const diff = Date.now() - new Date(stats.lastUpdated).getTime()
        const h = Math.floor(diff / 3600000)
        if (h < 1) return 'Just now'
        if (h < 24) return `${h}h ago`
        return `${Math.floor(h / 24)}d ago`
      })()
    : '—'

  return (
    <AdminLayout title="CMS">
      <div className="p-6 space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-normal text-orange-500 uppercase mb-1">Admin Panel</p>
            <h1 className="text-2xl font-bold text-gray-900">Content Management</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Manage state-specific landing pages, official announcements, and portal banners for
              nationwide recruitment synchronization.
            </p>
          </div>
          <button
            onClick={() => navigate('/admin/cms/create')}
            className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm shrink-0"
          >
            <Plus className="w-4 h-4" />
            Create State Page
          </button>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Layers}   label="Total State Pages" value={stats.total     ?? 0} color="bg-orange-500" sub={stats.total > 0 ? '+2 New' : '—'} />
          <StatCard icon={Globe}    label="Published"         value={stats.published  ?? 0} color="bg-emerald-500" />
          <StatCard icon={FileText} label="Draft"             value={stats.draft      ?? 0} color="bg-amber-500" />
          <StatCard icon={Clock}    label="Last Updated"      value={lastUpdated}            color="bg-blue-500" />
        </div>

        {/* Pages table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">State Pages Overview</h2>
            <div className="flex items-center gap-2">
              {/* Filter */}
              <div className="flex items-center gap-1">
                <Filter className="w-4 h-4 text-gray-400" />
                {['', 'published', 'draft', 'archived'].map((s) => (
                  <button
                    key={s || 'all'}
                    onClick={() => setStatusFilter(s)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                      statusFilter === s
                        ? 'bg-gray-900 text-white border-transparent'
                        : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All'}
                  </button>
                ))}
              </div>
              <button className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg transition-colors">
                <Download className="w-3.5 h-3.5" /> Export
              </button>
            </div>
          </div>

          {isLoading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
          )}

          {!isLoading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
              <AlertCircle className="w-10 h-10" />
              <p className="text-sm font-medium">No state pages found</p>
              <button
                onClick={() => navigate('/admin/cms/create')}
                className="mt-1 text-sm text-orange-500 font-semibold hover:text-orange-600"
              >
                Create your first state page →
              </button>
            </div>
          )}

          {!isLoading && filtered.length > 0 && (
            <div className="admin-data-scroll hover-scroll overflow-auto">
              <table className="w-full min-w-[920px] table-fixed">
                <colgroup>
                  <col className="w-[24%]" />
                  <col className="w-[13%]" />
                  <col className="w-[18%]" />
                  <col className="w-[17%]" />
                  <col className="w-[14%]" />
                  <col className="w-[14%]" />
                </colgroup>
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {['State', 'Status', 'Featured Projects', 'Last Updated', 'Updated By', 'Actions'].map((h) => (
                      <th key={h} className={`py-3 px-5 text-xs font-semibold text-gray-500 uppercase tracking-normal ${['Status', 'Featured Projects', 'Last Updated', 'Updated By', 'Actions'].includes(h) ? 'text-center' : 'text-left'}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((page) => {
                    const cfg = STATUS_CFG[page.status] || STATUS_CFG.draft
                    return (
                      <tr key={page._id} className="hover:bg-gray-50/60 transition-colors group">
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-3">
                            <StateInitial state={page.state} />
                            <span className="font-semibold text-gray-900 text-sm">{page.state}</span>
                          </div>
                        </td>
                        <td className="py-4 px-5 text-center">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                            {cfg.label}
                          </span>
                        </td>
                        <td className="py-4 px-5 text-center text-sm text-gray-600">
                          {page.featuredJobs?.length ?? 0} Projects
                        </td>
                        <td className="py-4 px-5 text-center text-sm text-gray-600">
                          {formatDate(page.updatedAt)}
                        </td>
                        <td className="py-4 px-5 text-center text-sm text-gray-500">
                          Admin
                        </td>
                        <td className="py-4 px-5 text-center">
                          <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => navigate(`/admin/cms/edit/${encodeURIComponent(page.state)}`)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-orange-600 hover:bg-orange-50 transition-colors"
                              title="Edit"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => navigate(`/admin/cms/edit/${encodeURIComponent(page.state)}`)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                              title="Preview"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                if (window.confirm(`Delete page for "${page.state}"?`)) {
                                  deletePage(page.state)
                                }
                              }}
                              disabled={deleting}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 max-w-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Recent Activity</h2>
            <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 uppercase tracking-normal">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </span>
          </div>

          {activityLoading && (
            <div className="space-y-3">
              {[1,2,3,4].map(i => (
                <div key={i} className="flex items-start gap-3 animate-pulse">
                  <div className="w-7 h-7 rounded-full bg-gray-100 shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-gray-100 rounded w-3/4" />
                    <div className="h-2.5 bg-gray-100 rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!activityLoading && (!activityData?.activities?.length) && (
            <div className="text-center py-8 text-gray-400">
              <Layers className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No activity yet. Create your first state page.</p>
            </div>
          )}

          {!activityLoading && activityData?.activities?.length > 0 && (
            <div className="space-y-4">
              {activityData.activities.map((a) => {
                const cfg = ACTIVITY_CFG[a.type] || ACTIVITY_CFG.edit
                const { Icon } = cfg
                return (
                  <div key={a.id} className="flex items-start gap-3">
                    <div className={`w-7 h-7 rounded-full ${cfg.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                      <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">{a.text}</p>
                      <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {timeAgo(a.time)}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <p className="text-center text-xs text-gray-400 mt-5 pt-4 border-t border-gray-100 tracking-normal uppercase">
            Real-time update stream active · refreshes every 30s
          </p>
        </div>

      </div>
    </AdminLayout>
  )
}

export default CmsHome





