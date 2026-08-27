import { Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  AlertTriangle,
  BarChart3,
  Briefcase,
  CheckCircle,
  FileText,
  FolderOpen,
  Plus,
  Users,
  Bell,
  Clock3,
  Sparkles,
  XCircle,
} from 'lucide-react'

import AdminLayout from '../../components/layouts/AdminLayout'
import { Card, CardContent } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import KpiDateRangeFilter from '../../components/common/KpiDateRangeFilter'
import {
  DEFAULT_KPI_DATE_RANGE,
  getKpiDateRangeParams,
} from '../../components/common/kpiDateRange'
import { dashboardService } from '../../services/dashboard.service'
import { adminService } from '../../services/admin.service'
import {
  getProjectLifecycleStatus,
  getProjectStatusBadgeClass,
} from '../../utils/projectLifecycle'

const Dashboard = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showProjectSelector, setShowProjectSelector] = useState(false)
  const [kpiDateRange, setKpiDateRange] = useState(DEFAULT_KPI_DATE_RANGE)
  const kpiDateParams = getKpiDateRangeParams(kpiDateRange)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-dashboard', kpiDateParams],
    queryFn: () => dashboardService.adminDashboard(kpiDateParams),
  })

  const { data: projectsData } = useQuery({
    queryKey: ['admin-projects-for-job-create'],
    queryFn: () => adminService.getProjects({ limit: 50 }),
    enabled: showProjectSelector,
  })

  const overview = data?.overview?.overview || data?.overview || {}
  const applicationsByStatus = data?.overview?.applicationsByStatus || []
  const funnel = data?.funnel?.funnel || data?.funnel || {}
  const topJobs = data?.topJobs || []
  const adminNotifications = data?.notifications?.notifications || []
  const unreadAdminCount = data?.notifications?.unreadCount || adminNotifications.length

  const rawSupport = data?.support?.data || data?.support || {}
  const supportStatusStats = rawSupport.statusStats || []

  const countSupportByStatus = (name) =>
    supportStatusStats.find((s) => s._id === name)?.count || 0

  const support = {
    open: countSupportByStatus('Open'),
    pending: countSupportByStatus('In Progress'),
    resolved: countSupportByStatus('Resolved'),
  }

  const submitted =
    applicationsByStatus.find((item) => item._id === 'submitted')?.count || 0

  const stats = [
    {
      title: 'ACTIVE JOBS',
      value: overview.totalJobs || 0,
      icon: Briefcase,
      color: 'from-orange-500 to-orange-600',
    },
    {
      title: 'APPLICATIONS',
      value: overview.totalApplications || 0,
      icon: FileText,
      color: 'from-blue-500 to-blue-600',
    },
    {
      title: 'CANDIDATES',
      value: overview.totalCandidates || 0,
      icon: Users,
      color: 'from-emerald-500 to-emerald-600',
    },
    {
      title: 'SUBMITTED',
      value: submitted,
      icon: CheckCircle,
      color: 'from-violet-500 to-violet-600',
    },
  ]

  const funnelItems = [
    ['STARTED', funnel.started],
    ['PERSONAL', funnel.personalDetailsCompleted],
    ['EDUCATION', funnel.educationCompleted],
    ['DOCUMENTS', funnel.documentsUploaded],
    ['PAID', funnel.paymentCompleted],
    ['SUBMITTED', funnel.submitted],
  ]

  const projects = (projectsData?.projects || []).map((project) => ({
    ...project,
    status: getProjectLifecycleStatus(project),
  }))

  const notificationTypeStyles = {
    payment_success: { icon: CheckCircle, border: 'border-emerald-100', bg: 'bg-emerald-50', iconColor: 'text-emerald-600', titleColor: 'text-emerald-700', bodyColor: 'text-emerald-600' },
    payment_failed: { icon: XCircle, border: 'border-red-100', bg: 'bg-red-50', iconColor: 'text-red-500', titleColor: 'text-red-700', bodyColor: 'text-red-600' },
    document_rejected: { icon: AlertTriangle, border: 'border-red-100', bg: 'bg-red-50', iconColor: 'text-red-500', titleColor: 'text-red-700', bodyColor: 'text-red-600' },
    document_verified: { icon: CheckCircle, border: 'border-emerald-100', bg: 'bg-emerald-50', iconColor: 'text-emerald-600', titleColor: 'text-emerald-700', bodyColor: 'text-emerald-600' },
    application_submitted: { icon: FileText, border: 'border-blue-100', bg: 'bg-blue-50', iconColor: 'text-blue-500', titleColor: 'text-blue-700', bodyColor: 'text-blue-600' },
    application_update: { icon: FileText, border: 'border-blue-100', bg: 'bg-blue-50', iconColor: 'text-blue-500', titleColor: 'text-blue-700', bodyColor: 'text-blue-600' },
    new_job_posted: { icon: Briefcase, border: 'border-orange-100', bg: 'bg-orange-50', iconColor: 'text-orange-500', titleColor: 'text-orange-700', bodyColor: 'text-orange-600' },
    general: { icon: Bell, border: 'border-gray-100', bg: 'bg-gray-50', iconColor: 'text-gray-500', titleColor: 'text-gray-700', bodyColor: 'text-gray-600' },
  }

  const { mutateAsync: markNotificationRead } = useMutation({
    mutationFn: (id) => adminService.markAdminNotificationRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] })
      queryClient.invalidateQueries({ queryKey: ['admin-notifications-count'] })
    },
  })

  const handleProjectSelect = (projectId) => {
    setShowProjectSelector(false)
    navigate(`/admin/jobs/create/basic-info?project=${projectId}`)
  }

  const handleNotificationClick = async (notification) => {
    if (!notification) return
    if (!notification.isRead) {
      try {
        await markNotificationRead(notification._id)
      } catch (err) { console.error(err) }
    }
    navigate(notification.link || '/admin/notifications')
  }

  return (
    <AdminLayout title="Dashboard Overview">
      <div className="min-h-full bg-[#f7f4ee] px-4 py-4 md:px-5 md:py-4">

        {/* HEADER */}
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 mb-5">

          <div>
            <p className="text-xs font-bold text-orange-500 tracking-normal mb-1">
              ADMIN CONTROL CENTER
            </p>

            <h1 className="text-2xl font-bold tracking-normal text-gray-900 leading-none">
              Recruitment Dashboard
            </h1>

            <p className="text-xs text-gray-500 mt-2">
              Real-time recruitment analytics and monitoring system.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <KpiDateRangeFilter
              value={kpiDateRange}
              onChange={setKpiDateRange}
              className="order-last w-full sm:order-none sm:w-auto"
            />

            <Button
              onClick={() => setShowProjectSelector(true)}
              className="
                bg-gradient-to-r from-orange-500 to-orange-600
                hover:from-orange-600 hover:to-orange-700
                shadow-lg shadow-orange-200
                rounded-2xl px-4 py-2 text-sm
                border-0 h-10
              "
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Job
            </Button>

            <Button
              asChild
              variant="outline"
              className="
                rounded-2xl bg-white
                border-gray-200
                shadow-sm h-10 px-4 text-sm
              "
            >
              <Link to="/admin/applications">
                View Applications
              </Link>
            </Button>
          </div>
        </div>

        {/* LOADING */}
        {isLoading && (
          <Card className="rounded-[22px] border-0 shadow-lg">
            <CardContent className="p-4">
              Loading dashboard...
            </CardContent>
          </Card>
        )}

        {/* KPI */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">

          {stats.map((stat) => (
            <div
              key={stat.title}
              className="
                relative overflow-hidden
                rounded-[22px]
                bg-white
                border border-gray-200
                shadow-sm
                hover:shadow-sm
                transition-all duration-200 ease-out
                hover:-translate-y-0.5
                p-4
              "
            >

              <div className={`
                absolute top-0 left-0 h-1 w-full
                bg-gradient-to-r ${stat.color}
              `} />

              <div className="flex items-start justify-between">

                <div>
                  <p className="text-xs font-bold tracking-normal text-gray-400 mb-2">
                    {stat.title}
                  </p>

                  <h2 className="text-3xl font-bold text-gray-900 tracking-normal">
                    {stat.value.toLocaleString('en-IN')}
                  </h2>

                  <div className="flex items-center gap-2 mt-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />

                    <p className="text-xs font-medium text-gray-500">
                      Live updated
                    </p>
                  </div>
                </div>

                <div className="
                  w-11 h-11 rounded-2xl
                  bg-gradient-to-br from-orange-50 to-orange-100
                  flex items-center justify-center
                ">
                  <stat.icon className="w-5 h-5 text-orange-600" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* MAIN GRID */}
        <div className="grid grid-cols-1 items-stretch xl:grid-cols-3 gap-5 xl:h-[800px]">

          {/* LEFT */}
          <div className="xl:col-span-2 flex h-full min-h-0 flex-col gap-5">

            {/* FUNNEL */}
            <div className="
              flex flex-col shrink-0
              rounded-[22px]
              bg-white
              border border-gray-200
              shadow-sm
              p-5
            ">

              <div className="flex shrink-0 items-center justify-between mb-5">

                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    Candidate Conversion Funnel
                  </h3>

                  <p className="text-xs text-gray-500 mt-1">
                    Application stage performance
                  </p>
                </div>

                <div className="
                  w-10 h-10 rounded-2xl
                  bg-orange-50
                  flex items-center justify-center
                ">
                  <BarChart3 className="w-4 h-4 text-orange-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">

                {funnelItems.map(([label, value], index) => (
                  <div
                    key={label}
                    className={`
                      rounded-2xl p-4 text-center transition-all duration-200 ease-out
                      ${index === funnelItems.length - 1
                        ? 'bg-[#111827] text-white shadow-xl'
                        : 'bg-gray-50 border border-gray-100 hover:border-orange-200'
                      }
                    `}
                  >
                    <h3 className="text-3xl font-bold">
                      {(value || 0).toLocaleString('en-IN')}
                    </h3>

                    <p className={`
                      text-xs mt-2 font-bold tracking-normal
                      ${index === funnelItems.length - 1
                        ? 'text-gray-300'
                        : 'text-gray-500'
                      }
                    `}>
                      {label}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* TOP JOBS */}
            <div className="
              flex flex-1 min-h-0 flex-col
              rounded-[22px]
              bg-white
              border border-gray-200
              shadow-sm
              p-5
            ">

              <div className="flex items-center justify-between mb-5">

                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    Top Job Performance
                  </h3>

                  <p className="text-xs text-gray-500 mt-1">
                    Highest application receiving jobs
                  </p>
                </div>

                <Badge variant="primary">
                  LIVE DATA
                </Badge>
              </div>

              <div className="hover-scroll min-h-0 flex-1 flex flex-col gap-3 overflow-y-auto pr-1">

                {topJobs.map((job, index) => (
                  <div
                    key={job._id || job.postCode}
                    className="
                      flex-1
                      rounded-2xl border border-gray-100
                      p-3 flex items-center justify-between
                      hover:border-orange-200
                      hover:bg-orange-50/30
                      transition-all duration-200 ease-out
                    "
                  >
                    <div className="flex items-center gap-3">

                      <div className="
                        w-10 h-10 rounded-xl
                        bg-gradient-to-br from-orange-100 to-orange-200
                        flex items-center justify-center
                        font-bold text-sm text-orange-700
                      ">
                        #{index + 1}
                      </div>

                      <div>
                        <h4 className="font-bold text-sm text-gray-900">
                          {job.jobTitle}
                        </h4>

                        <p className="text-xs text-gray-500 mt-1">
                          {job.department} • {job.postCode}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <h3 className="text-3xl font-bold text-gray-900">
                        {job.totalApplications || 0}
                      </h3>

                      <p className="text-xs font-bold tracking-normal text-gray-400">
                        APPLICATIONS
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* RIGHT */}
          <div className="flex h-full min-h-0 flex-col gap-5">

            {/* SUPPORT */}
            <div className="
              shrink-0
              rounded-[22px]
              bg-[#111827]
              text-white
              p-5
              shadow-sm
            ">

              <div className="flex items-center justify-between mb-5">

                <div>
                  <h3 className="text-lg font-bold">
                    Support Snapshot
                  </h3>

                  <p className="text-xs text-gray-400 mt-1">
                    Ticket monitoring system
                  </p>
                </div>

                <Badge className="bg-orange-500 text-white border-0">
                  ACTIVE
                </Badge>
              </div>

              <div className="space-y-3">

                <div className="
                  rounded-2xl bg-white/5 border border-white/10
                  p-3 flex items-center justify-between
                ">
                  <div>
                    <p className="text-xs text-gray-400">
                      Open Tickets
                    </p>

                    <h3 className="text-3xl font-bold mt-1">
                      {support.open || 0}
                    </h3>
                  </div>

                  <div className="
                    w-10 h-10 rounded-xl bg-red-500/20
                    flex items-center justify-center
                  ">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                  </div>
                </div>

                <div className="
                  rounded-2xl bg-white/5 border border-white/10
                  p-3 flex items-center justify-between
                ">
                  <div>
                    <p className="text-xs text-gray-400">
                      Pending
                    </p>

                    <h3 className="text-3xl font-bold mt-1">
                      {support.pending || 0}
                    </h3>
                  </div>

                  <div className="
                    w-10 h-10 rounded-xl bg-yellow-500/20
                    flex items-center justify-center
                  ">
                    <Clock3 className="w-4 h-4 text-yellow-400" />
                  </div>
                </div>

                <div className="
                  rounded-2xl bg-white/5 border border-white/10
                  p-3 flex items-center justify-between
                ">
                  <div>
                    <p className="text-xs text-gray-400">
                      Resolved
                    </p>

                    <h3 className="text-3xl font-bold mt-1">
                      {support.resolved || 0}
                    </h3>
                  </div>

                  <div className="
                    w-10 h-10 rounded-xl bg-emerald-500/20
                    flex items-center justify-center
                  ">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                  </div>
                </div>
              </div>

              <Button
                asChild
                className="
                  w-full mt-5 rounded-2xl
                  bg-white text-black hover:bg-gray-100
                  h-10 text-sm
                "
              >
                <Link to="/admin/support">
                  Open Support Center
                </Link>
              </Button>
            </div>

            {/* NOTIFICATIONS */}
            <div className="
              flex flex-1 min-h-0 flex-col
              rounded-[22px]
              bg-white
              border border-gray-200
              shadow-sm
              p-5
            ">

              <div className="flex shrink-0 items-center justify-between mb-5">

                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    Notifications
                  </h3>

                  <p className="text-xs text-gray-500 mt-1">
                    Unread updates
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant="error">
                    {unreadAdminCount} NEW
                  </Badge>
                  <Link to="/admin/notifications" className="text-xs text-orange-600 font-semibold hover:underline">
                    View All
                  </Link>
                </div>
              </div>

              <div className="hover-scroll min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                {adminNotifications.length === 0 && (
                  <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-500">
                    No unread notifications.
                  </div>
                )}
                {adminNotifications.map((notification) => {
                  const style = notificationTypeStyles[notification.type] || notificationTypeStyles.general
                  const Icon = style.icon
                  return (
                    <button
                      key={notification._id}
                      type="button"
                      onClick={() => handleNotificationClick(notification)}
                      className={`w-full text-left rounded-2xl border ${style.border} ${style.bg} p-3 hover:shadow-sm transition-all`}
                    >
                      <div className="flex gap-3">
                        <Icon className={`w-4 h-4 mt-1 ${style.iconColor}`} />
                        <div className="min-w-0">
                          <h4 className={`font-bold text-sm truncate ${style.titleColor}`}>
                            {notification.title}
                          </h4>
                          <p className={`text-xs mt-1 line-clamp-2 ${style.bodyColor}`}>
                            {notification.message}
                          </p>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* PROJECT SELECTOR MODAL */}
      {showProjectSelector && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[28px] w-full max-w-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Select Project</h3>
                <p className="text-sm text-gray-500 mt-1">Associate this job with a project.</p>
              </div>
              <button
                onClick={() => setShowProjectSelector(false)}
                className="w-10 h-10 rounded-xl hover:bg-gray-100 flex items-center justify-center"
              >
                <XCircle className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            {/* Body */}
            <div className="hover-scroll p-6 space-y-3 max-h-[450px] overflow-y-auto">
              {projects.length === 0 && (
                <div className="text-center py-10">
                  <div className="w-16 h-16 rounded-3xl bg-orange-100 flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="w-7 h-7 text-orange-600" />
                  </div>
                  <p className="text-gray-500 mb-5">No projects available.</p>
                  <Button
                    onClick={() => { setShowProjectSelector(false); navigate('/admin/projects/create') }}
                    className="bg-orange-600 hover:bg-orange-700 text-white"
                  >
                    Create Project
                  </Button>
                </div>
              )}
              {projects.map((project) => (
                <button
                  key={project._id}
                  onClick={() => handleProjectSelect(project._id)}
                  className="w-full text-left rounded-2xl border border-gray-100 p-4 hover:border-orange-200 hover:bg-orange-50/40 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-2xl bg-orange-100 flex items-center justify-center">
                      <FolderOpen className="w-5 h-5 text-orange-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-900">{project.name}</h4>
                      <p className="text-sm text-gray-500 mt-1">
                        {project.department}{' • '}{project.state}
                      </p>
                    </div>
                    <Badge className={getProjectStatusBadgeClass(project.status)}>
                      {project.status}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}

export default Dashboard
