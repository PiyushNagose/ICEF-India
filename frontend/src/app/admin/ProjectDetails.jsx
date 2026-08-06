import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import {
  Plus,
  Eye,
  Edit,
  BarChart3,
  HeadphonesIcon,
  FileText,
  Loader2,
  Briefcase,
  Users,
  IndianRupee,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react'

import AdminLayout from '../../components/layouts/AdminLayout'
import {
  Card,
  CardContent,
  CardHeader,
} from '../../components/ui/Card'

import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import { adminService } from '../../services/admin.service'

const ProjectDetails = () => {
  const { id } = useParams()
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['admin-project', id],
    queryFn: () => adminService.getProject(id),
  })

  const project = data?.project || data

  if (isLoading) {
    return (
      <AdminLayout title="Project Details">
        <div className="
          min-h-full
          flex items-center justify-center
          bg-[#f7f4ee]
        ">
          <Loader2 className="
            w-8 h-8 animate-spin text-orange-600
          " />
        </div>
      </AdminLayout>
    )
  }

  if (!project) {
    return (
      <AdminLayout title="Project Details">
        <div className="p-6">
          <p className="text-gray-600">
            Project not found.
          </p>

          <Button
            variant="outline"
            onClick={() =>
              navigate('/admin/projects')
            }
            className="mt-4"
          >
            Back to Projects
          </Button>
        </div>
      </AdminLayout>
    )
  }

  const jobs = project.jobs || []

  const statCards = [
    {
      title: 'TOTAL JOBS',
      value:
        project.totalJobs || jobs.length,
      icon: Briefcase,
      bg: 'bg-orange-50',
      color: 'text-orange-600',
    },
    {
      title: 'TOTAL APPLICANTS',
      value: (
        project.totalApplicants || 0
      ).toLocaleString('en-IN'),
      icon: Users,
      bg: 'bg-green-50',
      color: 'text-green-600',
    },
    {
      title: 'PAID APPLICANTS',
      value: (
        project.paidApplicants || 0
      ).toLocaleString('en-IN'),
      icon: CheckCircle2,
      bg: 'bg-blue-50',
      color: 'text-blue-600',
    },
    {
      title: 'REVENUE',
      value: `₹${(
        project.totalRevenue || 0
      ).toLocaleString('en-IN')}`,
      icon: IndianRupee,
      bg: 'bg-purple-50',
      color: 'text-purple-600',
    },
  ]

  const quickActions = [
    {
      title: 'CREATE JOB',
      icon: Plus,
      color:
        'bg-orange-100 text-orange-600',
      action: () =>
        navigate(
          `/admin/jobs/create?project=${id}`
        ),
    },
    {
      title: 'VIEW APPS',
      icon: Eye,
      color:
        'bg-blue-100 text-blue-600',
      action: () =>
        navigate('/admin/applications'),
    },
    {
      title: 'ANALYTICS',
      icon: BarChart3,
      color:
        'bg-green-100 text-green-600',
      action: () =>
        navigate('/admin/analytics'),
    },
    {
      title: 'SUPPORT',
      icon: HeadphonesIcon,
      color:
        'bg-purple-100 text-purple-600',
      action: () =>
        navigate('/admin/support'),
    },
  ]

  return (
    <AdminLayout title="Project Details">

      <div className="
        min-h-full
        bg-[#f7f4ee]
        p-5 space-y-5
      ">

        {/* HERO */}
        <div className="
          rounded-[26px]
          bg-white
          border border-gray-200
          shadow-sm
          p-6 relative overflow-hidden
        ">

          <div className="
            absolute top-0 left-0
            w-full h-1
            bg-gradient-to-r
            from-orange-500
            via-orange-400
            to-orange-500
          " />

          <div className="
            flex flex-col xl:flex-row
            xl:items-start
            xl:justify-between
            gap-5
          ">

            <div>

              <div className="
                flex flex-wrap items-center
                gap-3 mb-3
              ">

                <Badge
                  className={
                    project.status === 'Active'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-700'
                  }
                >
                  {project.status}
                </Badge>

                {project.startDate &&
                  project.endDate && (
                    <p className="
                      text-sm text-gray-500
                    ">
                      Duration:
                      {' '}
                      {new Date(
                        project.startDate
                      ).toLocaleDateString('en-IN')}
                      {' '}
                      –
                      {' '}
                      {new Date(
                        project.endDate
                      ).toLocaleDateString('en-IN')}
                    </p>
                  )}
              </div>

              <h1 className="
                text-2xl font-bold
                text-gray-900
              ">
                {project.name}
              </h1>

              <p className="
                text-sm text-gray-500 mt-2
              ">
                State:
                {' '}
                {project.state}
                {' '}
                |
                {' '}
                Department:
                {' '}
                {project.department}
              </p>

              {project.description && (
                <p className="
                  text-sm text-gray-500
                  mt-3 max-w-3xl
                ">
                  {project.description}
                </p>
              )}
            </div>

            <div className="
              flex items-center gap-3
            ">

              <Button
                variant="outline"
                onClick={() =>
                  navigate('/admin/projects')
                }
                className="
                  rounded-2xl
                  h-11 px-5
                "
              >
                Back
              </Button>

              <Button
                onClick={() =>
                  navigate(`/admin/projects/${id}/edit`)
                }
                className="
                  bg-orange-600
                  hover:bg-orange-700
                  text-white
                  rounded-2xl
                  h-11 px-5
                  shadow-lg shadow-orange-200
                "
              >
                <Edit className="
                  w-4 h-4 mr-2
                " />
                Edit Project
              </Button>

            </div>
          </div>
        </div>

        {/* STATS */}
        <div className="
          grid grid-cols-1
          sm:grid-cols-2
          xl:grid-cols-4
          gap-4
        ">

          {statCards.map((s) => (
            <div
              key={s.title}
              className="
                rounded-[22px]
                bg-white
                border border-gray-200
                shadow-sm
                p-5
              "
            >

              <div className="
                flex items-center
                justify-between
              ">

                <div>
                  <p className="
                    text-xs
                    font-bold
                    tracking-normal
                    text-gray-400 mb-2
                  ">
                    {s.title}
                  </p>

                  <h2 className="
                    text-3xl font-bold
                    text-gray-900
                  ">
                    {s.value}
                  </h2>
                </div>

                <div className={`
                  w-12 h-12 rounded-2xl
                  flex items-center justify-center
                  ${s.bg}
                `}>
                  <s.icon
                    className={`
                      w-5 h-5 ${s.color}
                    `}
                  />
                </div>

              </div>
            </div>
          ))}
        </div>

        {/* MAIN GRID */}
        <div className="
          grid grid-cols-1
          items-stretch
          xl:grid-cols-3
          gap-5
        ">

          {/* LEFT */}
          <div className="
            xl:col-span-2
            flex min-h-[420px]
          ">

            <Card className="
              flex w-full flex-col
              rounded-[24px]
              bg-white
              border border-gray-200
              shadow-sm
            ">

              <CardHeader className="shrink-0">
                <div className="
                  flex items-center
                  justify-between
                ">

                  <div>
                    <h3 className="
                      text-lg font-bold
                      text-gray-900
                    ">
                      Active Job Positions
                    </h3>

                    <p className="
                      text-xs text-gray-500 mt-1
                    ">
                      {jobs.length}
                      {' '}
                      active openings
                    </p>
                  </div>

                  <Button
                    size="sm"
                    className="
                      bg-orange-600
                      hover:bg-orange-700
                      text-white
                      rounded-xl
                    "
                    onClick={() =>
                      navigate(
                        `/admin/jobs/create?project=${id}`
                      )
                    }
                  >
                    <Plus className="
                      w-4 h-4 mr-1
                    " />
                    Add Job
                  </Button>

                </div>
              </CardHeader>

              <CardContent className="min-h-0 flex-1 p-0">

                {jobs.length === 0 ? (
                  <div className="
                    flex h-full min-h-[260px] flex-col items-center justify-center p-10 text-center
                  ">

                    <div className="
                      w-16 h-16 rounded-3xl
                      bg-orange-100
                      flex items-center justify-center
                      mx-auto mb-4
                    ">
                      <FileText className="
                        w-7 h-7 text-orange-600
                      " />
                    </div>

                    <h3 className="
                      text-lg font-bold
                      text-gray-900
                    ">
                      No Jobs Added
                    </h3>

                    <p className="
                      text-sm text-gray-500 mt-1
                    ">
                      Create the first job
                      under this project.
                    </p>

                    <Button
                      className="
                        mt-5 bg-orange-600
                        hover:bg-orange-700
                        text-white rounded-2xl
                      "
                      onClick={() =>
                        navigate(
                          `/admin/jobs/create?project=${id}`
                        )
                      }
                    >
                      Create First Job
                    </Button>

                  </div>
                ) : (
                  <div className="
                    hover-scroll max-h-[520px] overflow-y-auto
                    divide-y divide-gray-100
                  ">

                    {jobs.map((job) => (
                      <div
                        key={job._id}
                        className="
                          flex items-center
                          justify-between
                          p-5
                          hover:bg-orange-50/30
                          transition-all
                        "
                      >

                        <div className="
                          flex items-center gap-4
                        ">

                          <div className="
                            w-11 h-11 rounded-2xl
                            bg-orange-100
                            flex items-center justify-center
                          ">
                            <FileText className="
                              w-5 h-5 text-orange-600
                            " />
                          </div>

                          <div>

                            <h4 className="
                              font-bold text-gray-900
                            ">
                              {job.title}
                            </h4>

                            <p className="
                              text-xs text-gray-500 mt-1
                            ">
                              {job.postCode}
                            </p>

                          </div>
                        </div>

                        <div className="
                          flex items-center gap-4
                        ">

                          <div className="
                            text-right
                          ">
                            <h4 className="
                              font-bold text-gray-900
                            ">
                              {job.totalApplicants || 0}
                            </h4>

                            <p className="
                              text-xs
                              text-gray-400
                              font-semibold
                            ">
                              APPLICANTS
                            </p>
                          </div>

                          <Badge
                            className={
                              job.status === 'active'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-700'
                            }
                          >
                            {job.status}
                          </Badge>

                          <button
                            onClick={() =>
                              navigate(
                                `/jobs/${job._id}`
                              )
                            }
                            className="
                              w-10 h-10 rounded-xl
                              hover:bg-gray-100
                              flex items-center justify-center
                              text-gray-500
                            "
                          >
                            <ArrowRight className="
                              w-4 h-4
                            " />
                          </button>

                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* RIGHT */}
          <div className="flex h-full min-h-[420px] flex-col gap-5">

            {/* QUICK ACTIONS */}
            <Card className="
              shrink-0
              rounded-[24px]
              bg-white
              border border-gray-200
              shadow-sm
            ">

              <CardHeader>
                <h3 className="
                  text-lg font-bold
                  text-gray-900
                ">
                  Quick Actions
                </h3>
              </CardHeader>

              <CardContent>

                <div className="
                  grid grid-cols-2 gap-3
                ">

                  {quickActions.map((action) => (
                    <button
                      key={action.title}
                      onClick={action.action}
                      className="
                        rounded-2xl
                        border border-gray-100
                        p-4 text-center
                        hover:bg-orange-50/40
                        hover:border-orange-200
                        transition-all
                      "
                    >

                      <div className={`
                        w-10 h-10 rounded-xl
                        flex items-center justify-center
                        mx-auto mb-3
                        ${action.color}
                      `}>
                        <action.icon className="
                          w-5 h-5
                        " />
                      </div>

                      <p className="
                        text-xs font-bold
                        text-gray-900
                      ">
                        {action.title}
                      </p>

                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* PROJECT INFO */}
            <Card className="
              flex min-h-[220px] flex-1 flex-col
              rounded-[24px]
              bg-white
              border border-gray-200
              shadow-sm
            ">

              <CardHeader className="shrink-0">
                <h3 className="
                  text-lg font-bold
                  text-gray-900
                ">
                  Project Information
                </h3>
              </CardHeader>

              <CardContent className="
                hover-scroll min-h-0 flex-1 space-y-4 overflow-y-auto text-sm
              ">

                {[
                  ['State', project.state],
                  ['Department', project.department],
                  ['Status', project.status],
                  [
                    'Created By',
                    project.createdBy?.fullName || '—',
                  ],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="
                      flex items-center
                      justify-between
                    "
                  >

                    <span className="
                      text-gray-500
                    ">
                      {label}
                    </span>

                    <span className="
                      font-semibold text-gray-900
                    ">
                      {value}
                    </span>

                  </div>
                ))}

              </CardContent>
            </Card>

          </div>
        </div>
      </div>
    </AdminLayout>
  )
}

export default ProjectDetails





