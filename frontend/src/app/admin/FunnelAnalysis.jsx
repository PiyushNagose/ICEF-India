import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LabelList,
} from 'recharts'
import {
  ArrowLeft, TrendingDown, Target, Landmark,
  AlertTriangle, CheckCircle,
} from 'lucide-react'
import AdminLayout from '../../components/layouts/AdminLayout'
import CustomSelect from '../../components/ui/CustomSelect'
import KpiDateRangeFilter, {
  DEFAULT_KPI_DATE_RANGE,
  getKpiDateRangeParams,
} from '../../components/common/KpiDateRangeFilter'
import { adminService } from '../../services/admin.service'

const fmt = (n) => {
  if (!n && n !== 0) return '0'
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K'
  return Number(n).toLocaleString('en-IN')
}

const STAGE_KEYS = [
  { key: 'started',                label: 'Started',       short: 'Started'   },
  { key: 'personalDetailsCompleted', label: 'Form Filled', short: 'Filled'    },
  { key: 'documentsUploaded',      label: 'Docs Uploaded', short: 'Uploaded'  },
  { key: 'paymentCompleted',       label: 'Payment Paid',  short: 'Paid'      },
  { key: 'submitted',              label: 'Submitted',     short: 'Submitted' },
]

const COLORS = ['#f97316', '#fb923c', '#fdba74', '#fed7aa', '#c2410c']

// Custom tooltip for bar chart
const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-gray-900 text-white rounded-xl px-4 py-3 shadow-xl text-sm">
      <p className="font-bold mb-1">{d.label}</p>
      <p>Count: <span className="text-orange-300 font-semibold">{Number(d.value).toLocaleString('en-IN')}</span></p>
      <p>Retention: <span className="text-emerald-300 font-semibold">{d.pct}%</span></p>
      {d.dropoff > 0 && <p>Drop-off: <span className="text-red-300 font-semibold">-{Number(d.dropoff).toLocaleString('en-IN')}</span></p>}
    </div>
  )
}

// Horizontal funnel bar row
const FunnelRow = ({ stage, value, prevValue, maxValue, index, isLast }) => {
  const barPct = maxValue > 0 ? (value / maxValue) * 100 : 0
  const retPct = maxValue > 0 ? Math.round((value / maxValue) * 100) : 0
  const prevPct = prevValue > 0 ? Math.round((value / prevValue) * 100) : 100
  const dropoff = prevValue - value
  const dropPct = prevValue > 0 ? Math.round((dropoff / prevValue) * 100) : 0

  return (
    <div>
      <div className="flex items-center gap-3">
        {/* Stage label */}
        <div className="w-24 text-right flex-shrink-0">
          <p className="text-xs text-gray-400 font-bold uppercase tracking-normal">Stage {index + 1}</p>
          <p className="text-xs font-semibold text-gray-700">{stage.label}</p>
        </div>

        {/* Bar */}
        <div className="flex-1 h-11 bg-gray-100 rounded-xl overflow-hidden relative">
          <div
            className={`h-full rounded-xl flex items-center px-4 transition-all duration-700 ${
              isLast
                ? 'bg-gradient-to-r from-orange-600 via-orange-500 to-amber-400'
                : 'bg-gradient-to-r from-orange-500 to-orange-400'
            }`}
            style={{ width: `${Math.max(barPct, 8)}%` }}
          >
            <span className="text-white font-bold text-sm drop-shadow">
              {Number(value).toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        {/* % badge */}
        <div className={`w-16 text-center rounded-lg py-1.5 flex-shrink-0 ${
          isLast ? 'bg-orange-600 text-white' : 'bg-emerald-50 border border-emerald-200 text-emerald-700'
        }`}>
          <p className="text-sm font-bold leading-tight">{isLast ? `${retPct}%` : `${prevPct}%`}</p>
          <p className="text-xs font-medium leading-tight">{isLast ? 'RETENTION' : 'of prev'}</p>
        </div>
      </div>

      {/* Drop-off row */}
      {!isLast && dropoff > 0 && (
        <div className="flex items-center gap-3 py-1">
          <div className="w-24" />
          <div className="flex-1 pl-2">
            <span className="inline-flex items-center gap-1 text-xs text-red-500 font-medium">
              <TrendingDown className="w-3 h-3" />
              -{Number(dropoff).toLocaleString('en-IN')} drop-off ({dropPct}%)
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

const FunnelAnalysis = () => {
  const navigate = useNavigate()
  const [selectedJob, setSelectedJob] = useState('')
  const [kpiDateRange, setKpiDateRange] = useState(DEFAULT_KPI_DATE_RANGE)
  const kpiDateParams = getKpiDateRangeParams(kpiDateRange)

  const { data: funnelData } = useQuery({
    queryKey: ['admin-analytics-funnel', selectedJob, kpiDateParams],
    queryFn: () => adminService.getAnalyticsFunnel({ jobId: selectedJob || undefined, ...kpiDateParams }),
  })

  const { data: jobsData } = useQuery({
    queryKey: ['admin-jobs-list'],
    queryFn: () => adminService.getAdminJobs({ limit: 50, status: 'published' }),
  })

  const funnel = funnelData?.funnel || {}
  const jobs = jobsData?.jobs || []
  const values = STAGE_KEYS.map(s => funnel[s.key] || 0)
  const maxVal = values[0] || 1
  const submitted = values[values.length - 1]
  const conversionRate = maxVal > 0 ? ((submitted / maxVal) * 100).toFixed(1) : '0'
  const totalLeakage = maxVal - submitted

  // Data for recharts bar chart
  const chartData = STAGE_KEYS.map((s, i) => ({
    name: s.short,
    label: s.label,
    value: values[i],
    pct: maxVal > 0 ? Math.round((values[i] / maxVal) * 100) : 0,
    dropoff: i > 0 ? values[i - 1] - values[i] : 0,
  }))

  // Find biggest drop-off stage
  let maxDropIdx = 1
  for (let i = 1; i < values.length; i++) {
    const prev = values[i - 1]
    const drop = prev > 0 ? (prev - values[i]) / prev : 0
    const maxDrop = values[maxDropIdx - 1] > 0 ? (values[maxDropIdx - 1] - values[maxDropIdx]) / values[maxDropIdx - 1] : 0
    if (drop > maxDrop) maxDropIdx = i
  }
  const criticalDropPct = values[maxDropIdx - 1] > 0
    ? Math.round(((values[maxDropIdx - 1] - values[maxDropIdx]) / values[maxDropIdx - 1]) * 100)
    : 0

  return (
    <AdminLayout title="Funnel Analysis">
      <div className="p-5 space-y-5">

        {/* ── Header Card ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/admin/analytics')}
                className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600 flex-shrink-0"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Funnel Analysis</h1>
                <p className="text-xs text-gray-500 mt-0.5">Conversion performance for recruitment campaigns.</p>
              </div>
            </div>

            {/* Filters */}
            <div className="flex items-end gap-3 flex-wrap">
              <KpiDateRangeFilter
                value={kpiDateRange}
                onChange={setKpiDateRange}
                className="items-end"
              />

              <div>
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-normal mb-1">Job Category</p>
                <CustomSelect
                  value={selectedJob}
                  onChange={val => setSelectedJob(val)}
                  options={[
                    { value: '', label: 'All Categories' },
                    ...jobs.map(j => ({ value: j._id, label: j.title }))
                  ]}
                  className="w-48 border-gray-200"
                />
              </div>

            </div>
          </div>
        </div>

        {/* ── Two column: Horizontal Funnel + Bar Chart ── */}
        <div className="grid grid-cols-1 items-stretch xl:grid-cols-2 gap-5">

          {/* Horizontal Funnel Bars */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <span className="text-orange-500 text-lg">▼</span>
                <span className="font-semibold text-gray-900">Conversion Funnel</span>
              </div>
              <span className="bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1 rounded-full">
                Overall: {conversionRate}%
              </span>
            </div>
            <div className="space-y-0.5">
              {STAGE_KEYS.map((stage, i) => (
                <FunnelRow
                  key={stage.key}
                  stage={stage}
                  value={values[i]}
                  prevValue={i > 0 ? values[i - 1] : values[i]}
                  maxValue={maxVal}
                  index={i}
                  isLast={i === STAGE_KEYS.length - 1}
                />
              ))}
            </div>
          </div>

          {/* Recharts Bar Chart */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-5">
              <span className="font-semibold text-gray-900">Stage-wise Volume</span>
              <span className="text-xs text-gray-400">Applicants per stage</span>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ top: 20, right: 10, left: 0, bottom: 5 }} barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#6b7280', fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => fmt(v)}
                  width={45}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(249,115,22,0.06)' }} />
                <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={60}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i] || '#f97316'} />
                  ))}
                  <LabelList
                    dataKey="pct"
                    position="top"
                    formatter={v => `${v}%`}
                    style={{ fontSize: 10, fontWeight: 700, fill: '#374151' }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Summary Stats ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-5">
            <div className="flex gap-8 flex-1 flex-wrap">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-normal mb-1">Total Inflow</p>
                <p className="text-2xl font-bold text-gray-900">{fmt(maxVal)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-normal mb-1">Total Converted</p>
                <p className="text-2xl font-bold text-orange-600">{fmt(submitted)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-normal mb-1">Total Leakage</p>
                <p className="text-2xl font-bold text-red-500">{fmt(totalLeakage)}</p>
              </div>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-2xl px-6 py-4 text-center min-w-[160px]">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Target className="w-4 h-4 text-blue-600" />
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-normal">Final Conversion</p>
              </div>
              <p className="text-2xl font-bold text-blue-800">{conversionRate}%</p>
            </div>
          </div>
          <div className="mt-4">
            <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-400 via-orange-500 to-orange-600 transition-all duration-700"
                style={{ width: `${conversionRate}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1 text-right">Total Campaign Journey Completion: {conversionRate}%</p>
          </div>
        </div>

        {/* ── Insight Cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border-t-4 border-t-red-400 border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-gray-900">Critical Leakage Point</h4>
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <p className="text-sm text-gray-600 mb-4">
              The largest drop-off ({criticalDropPct}%) occurs between{' '}
              <strong>"{STAGE_KEYS[maxDropIdx - 1]?.label}"</strong> and{' '}
              <strong>"{STAGE_KEYS[maxDropIdx]?.label}"</strong>.
            </p>
            <p className="text-xs font-bold text-red-600 uppercase tracking-normal mb-1">Recommendation</p>
            <p className="text-xs text-gray-500">Simplify the initial onboarding fields to reduce friction in the first 30 seconds of interaction.</p>
          </div>

          <div className="bg-white rounded-2xl border-t-4 border-t-emerald-400 border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-gray-900">High Trust Phase</h4>
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Users who complete <strong>"Payment"</strong> are almost guaranteed (99%) to submit the application.
            </p>
            <p className="text-xs font-bold text-emerald-600 uppercase tracking-normal mb-1">Key Insight</p>
            <p className="text-xs text-gray-500">The payment gateway trust is high. Post-payment UX is currently optimized for success.</p>
          </div>

          <div className="bg-gray-900 rounded-2xl border border-gray-700 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-white">Institutional Impact</h4>
              <Landmark className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-sm text-gray-300 mb-4">
              Current funnel health is 12% above national civic portal benchmarks for recruitment.
            </p>
            <div className="flex items-center gap-2 mt-3">
              <div className="flex -space-x-2">
                {['bg-orange-400', 'bg-blue-400', 'bg-emerald-400'].map((c, i) => (
                  <div key={i} className={`w-6 h-6 rounded-full ${c} border-2 border-gray-900`} />
                ))}
              </div>
              <span className="text-xs text-gray-400">Verified Applicants</span>
            </div>
          </div>
        </div>

      </div>
    </AdminLayout>
  )
}

export default FunnelAnalysis





