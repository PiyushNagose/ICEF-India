import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  TrendingUp, CheckCircle, Clock, Star,
  XCircle, AlertCircle, Ticket, BadgeCheck,
  Play, FileEdit, FileUp, CreditCard, Send,
  ChevronRight,
} from 'lucide-react'
import AdminLayout from '../../components/layouts/AdminLayout'
import KpiDateRangeFilter from '../../components/common/KpiDateRangeFilter'
import {
  DEFAULT_KPI_DATE_RANGE,
  getKpiDateRangeParams,
} from '../../components/common/kpiDateRange'
import { adminService } from '../../services/admin.service'

const Analytics = () => {
  const navigate = useNavigate()
  const [kpiDateRange, setKpiDateRange] = useState(DEFAULT_KPI_DATE_RANGE)
  const kpiDateParams = getKpiDateRangeParams(kpiDateRange)

  const { data: overviewData } = useQuery({ queryKey: ['admin-analytics-overview', kpiDateParams], queryFn: () => adminService.getAnalyticsOverview(kpiDateParams) })
  const { data: funnelData }   = useQuery({ queryKey: ['admin-analytics-funnel', kpiDateParams],   queryFn: () => adminService.getAnalyticsFunnel(kpiDateParams) })
  const { data: topJobsData }  = useQuery({ queryKey: ['admin-analytics-top-jobs', kpiDateParams], queryFn: () => adminService.getTopJobs({ limit: 5, ...kpiDateParams }) })
  const { data: supportData }  = useQuery({ queryKey: ['admin-support-stats', kpiDateParams],      queryFn: () => adminService.getSupportStats(kpiDateParams) })
  const { data: paymentData }  = useQuery({ queryKey: ['admin-payment-analytics', kpiDateParams],  queryFn: () => adminService.getPaymentAnalytics(kpiDateParams) })

  const overview       = overviewData?.overview || {}
  const appsByStatus   = overviewData?.applicationsByStatus || []
  const funnel         = funnelData?.funnel || {}
  const topJobs        = topJobsData?.topJobs || []
  const supportStats   = supportData?.statusStats || []
  const payStats       = paymentData?.paymentStats || []

  const countByStatus  = (s) => appsByStatus.find(x => x._id === s)?.count || 0
  const countSupport   = (s) => supportStats.find(x => x._id === s)?.count || 0
  const countPay       = (s) => payStats.find(x => x._id === s)?.count || 0

  const total      = overview.totalApplications || 0
  const completed  = countByStatus('approved') + countByStatus('verified')
  const pending    = countByStatus('submitted') + countByStatus('under_review')
  const dropped    = countByStatus('rejected')
  const payFailed  = countPay('failed')
  const paySuccess = countPay('paid') + countPay('success')
  const paySuccessRate = (paySuccess + payFailed) > 0
    ? ((paySuccess / (paySuccess + payFailed)) * 100).toFixed(1)
    : '—'

  const ticketsRaised   = supportStats.reduce((s, x) => s + (x.count || 0), 0)
  const ticketsResolved = countSupport('Resolved') || countSupport('resolved')
  const openTickets     = countSupport('Open') || countSupport('open')
  const pendingResponse = countSupport('In Progress') || countSupport('in_progress')

  // Funnel stages matching image
  const funnelStages = [
    { label: 'Started',   value: funnel.started,              icon: Play,     pctLabel: '100% of reach' },
    { label: 'Filled',    value: funnel.personalDetailsCompleted, icon: FileEdit, pctLabel: null },
    { label: 'Uploaded',  value: funnel.documentsUploaded,    icon: FileUp,   pctLabel: null },
    { label: 'Paid',      value: funnel.paymentCompleted,     icon: CreditCard,pctLabel: null },
    { label: 'Submitted', value: funnel.submitted,            icon: Send,     pctLabel: '82% Total ROI', highlight: true },
  ]
  const maxFunnel = Math.max(...funnelStages.map(f => f.value || 0), 1)

  const fmt = (n) => {
    if (!n && n !== 0) return '—'
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
    return Number(n).toLocaleString('en-IN')
  }

  return (
    <AdminLayout title="Analytics">
      <div className="min-h-full p-6 space-y-5">

        {/* Page title */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Analytics Overview</h1>
          </div>

          <KpiDateRangeFilter
            value={kpiDateRange}
            onChange={setKpiDateRange}
            className="lg:justify-end"
          />
        </div>

        {/* ── Row 1: 4 main stat cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

          {/* Total Applications */}
          <div className="bg-white rounded-2xl border border-gray-200 border-t-4 border-t-orange-500 p-5 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-normal mb-3">Total Applications</p>
            <div className="flex items-end justify-between">
              <p className="text-2xl font-bold text-gray-900">{fmt(total)}</p>
              <span className="flex items-center gap-1 whitespace-nowrap text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                <TrendingUp className="w-3 h-3" /> 12%
              </span>
            </div>
          </div>

          {/* Completed Applications */}
          <div className="bg-white rounded-2xl border border-gray-200 border-t-4 border-t-emerald-500 p-5 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-normal mb-3">Completed Applications</p>
            <div className="flex items-end justify-between">
              <p className="text-2xl font-bold text-gray-900">{fmt(completed)}</p>
              <span className="flex items-center gap-1 whitespace-nowrap text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                <CheckCircle className="w-3 h-3" /> 73%
              </span>
            </div>
          </div>

          {/* Pending Applications */}
          <div className="bg-white rounded-2xl border border-gray-200 border-t-4 border-t-amber-500 p-5 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-normal mb-3">Pending Applications</p>
            <div className="flex items-end justify-between">
              <p className="text-2xl font-bold text-gray-900">{fmt(pending)}</p>
              <span className="flex items-center gap-1 whitespace-nowrap text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                <Clock className="w-3 h-3" /> Processing...
              </span>
            </div>
          </div>

          {/* Payment Success Rate */}
          <div className="bg-white rounded-2xl border border-gray-200 border-t-4 border-t-blue-500 p-5 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-normal mb-3">Payment Success Rate</p>
            <div className="flex items-end justify-between">
              <p className="text-2xl font-bold text-gray-900">{paySuccessRate}{paySuccessRate !== '—' ? '%' : ''}</p>
              <span className="flex items-center gap-1 whitespace-nowrap text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                <Star className="w-3 h-3" /> High
              </span>
            </div>
          </div>
        </div>

        {/* ── Row 2: 4 secondary stat cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

          <div className="bg-white rounded-2xl border border-gray-200 border-t-4 border-t-red-400 p-5 shadow-sm flex items-center gap-4">
            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <XCircle className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-normal">Dropped</p>
              <p className="text-2xl font-bold text-gray-900">{Number(dropped).toLocaleString('en-IN')}</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 border-t-4 border-t-orange-400 p-5 shadow-sm flex items-center gap-4">
            <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-normal">Payment Failures</p>
              <p className="text-2xl font-bold text-gray-900">{Number(payFailed).toLocaleString('en-IN')}</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 border-t-4 border-t-amber-400 p-5 shadow-sm flex items-center gap-4">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Ticket className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-normal">Tickets Raised</p>
              <p className="text-2xl font-bold text-gray-900">{Number(ticketsRaised).toLocaleString('en-IN')}</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 border-t-4 border-t-emerald-400 p-5 shadow-sm flex items-center gap-4">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <BadgeCheck className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-normal">Tickets Resolved</p>
              <p className="text-2xl font-bold text-gray-900">{Number(ticketsResolved).toLocaleString('en-IN')}</p>
            </div>
          </div>
        </div>

        {/* ── Conversion Funnel ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-base font-semibold text-gray-900">Application Conversion Funnel</h3>
            <button className="text-sm text-orange-600 font-medium flex items-center gap-1 hover:underline" onClick={() => navigate('/admin/analytics/funnel')}>
              Detailed View <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Funnel steps */}
          <div className="flex items-start justify-between gap-2 mb-6">
            {funnelStages.map((stage, i) => {
              const Icon = stage.icon
              const pct = maxFunnel > 0 ? Math.round(((stage.value || 0) / maxFunnel) * 100) : 0
              const isLast = i === funnelStages.length - 1
              return (
                <div key={stage.label} className="flex items-center gap-2 flex-1">
                  <div className="flex flex-col items-center text-center flex-1">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${
                      isLast
                        ? 'border-2 border-dashed border-orange-400 bg-orange-50'
                        : 'bg-gray-100'
                    }`}>
                      <Icon className={`w-5 h-5 ${isLast ? 'text-orange-500' : 'text-gray-500'}`} />
                    </div>
                    <p className={`text-sm font-semibold mb-0.5 ${isLast ? 'text-orange-600' : 'text-gray-700'}`}>
                      {stage.label}
                    </p>
                    <p className={`text-xl font-bold ${isLast ? 'text-orange-600' : 'text-gray-900'}`}>
                      {fmt(stage.value)}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {stage.pctLabel || (pct > 0 ? `${pct}% conversion` : '—')}
                    </p>
                  </div>
                  {/* Arrow between steps */}
                  {i < funnelStages.length - 1 && (
                    <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0 mt-4" />
                  )}
                </div>
              )
            })}
          </div>

          {/* Progress bar */}
          <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 via-orange-500 to-orange-600"
              style={{ width: `${maxFunnel > 0 ? Math.round(((funnel.submitted || 0) / maxFunnel) * 100) : 0}%` }}
            />
          </div>
        </div>

        {/* ── Bottom Row: Top Jobs + Support Snapshot ── */}
        <div className="grid grid-cols-1 items-stretch lg:grid-cols-3 gap-5">

          {/* Top Jobs */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-5">Top Jobs by Applicants</h3>
            {topJobs.length === 0
              ? <p className="text-sm text-gray-400 text-center py-8">No data yet.</p>
              : (
                <div className="space-y-4">
                  {topJobs.map((job, i) => {
                    const maxApps = topJobs[0]?.totalApplications || 1
                    const pct = Math.round(((job.totalApplications || 0) / maxApps) * 100)
                    return (
                      <div key={job._id || i}>
                        <div className="flex justify-between items-center mb-1.5">
                          <p className="text-sm font-medium text-gray-800 truncate max-w-[70%]">
                            {job.jobTitle || job.title}
                          </p>
                          <p className="text-sm font-semibold text-gray-700 ml-2 flex-shrink-0">
                            {Number(job.totalApplications || 0).toLocaleString('en-IN')} applicants
                          </p>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div
                            className="h-2 rounded-full bg-orange-500"
                            style={{ width: `${pct}%`, opacity: 1 - i * 0.15 }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            }
          </div>

          {/* Support Snapshot */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-5">Support Snapshot</h3>
            <div className="space-y-3">

              <div className="flex items-center justify-between p-4 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Ticket className="w-4 h-4 text-red-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Open Tickets</p>
                    <p className="text-xs text-gray-400">Requires immediate attention</p>
                  </div>
                </div>
                <p className="text-2xl font-bold text-gray-900">{Number(openTickets).toLocaleString('en-IN')}</p>
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <BadgeCheck className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Resolved Today</p>
                    <p className="text-xs text-gray-400">Solved within 24 hours</p>
                  </div>
                </div>
                <p className="text-2xl font-bold text-gray-900">{Number(ticketsResolved).toLocaleString('en-IN')}</p>
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Clock className="w-4 h-4 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Pending Response</p>
                    <p className="text-xs text-gray-400">Awaiting user action</p>
                  </div>
                </div>
                <p className="text-2xl font-bold text-gray-900">{Number(pendingResponse).toLocaleString('en-IN')}</p>
              </div>

            </div>
          </div>
        </div>

      </div>
    </AdminLayout>
  )
}

export default Analytics





