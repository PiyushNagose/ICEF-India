import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'

import {
  Plus,
  Eye,
  Edit,
  Briefcase,
  Users,
  Clock,
  CreditCard,
  FolderOpen,
  IndianRupee,
  Trash2,
  Send,
  XCircle,
  Sparkles,
} from 'lucide-react'

import AdminLayout from '../../components/layouts/AdminLayout'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import ConfirmDeleteModal from '../../components/ui/ConfirmDeleteModal'
import ConfirmActionModal from '../../components/ui/ConfirmActionModal'
import AdminPagination from '../../components/ui/AdminPagination'
import { AdminTableShell, AdminTableStatusRow } from '../../components/ui/AdminTable'
import AdminKpiCard from '../../components/ui/AdminKpiCard'

import { hasPermission, useAuth, isSuperAdminUser } from '../../hooks/useAuth'
import { jobService } from '../../services/job.service'
import { adminService } from '../../services/admin.service'
import {
  getProjectLifecycleStatus,
  getProjectStatusBadgeClass,
} from '../../utils/projectLifecycle'
import { getEffectiveJobStatus } from '../../utils/jobAvailability'

const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-700',
  active: 'bg-green-100 text-green-700',
  closed: 'bg-red-100 text-red-700',
  published: 'bg-green-100 text-green-700',
}

const STORAGE_KEY = 'job_draft'

const isDraftJob = (job) =>
  String(job?.status || '').toLowerCase() === 'draft'

const isPublicJob = (job) =>
  ['active', 'published', 'closed'].includes(String(job?.status || '').toLowerCase())

const isDeadlinePassed = (value) => {
  if (!value) return false
  const deadline = new Date(value)
  if (Number.isNaN(deadline.getTime())) return false
  deadline.setHours(23, 59, 59, 999)
  return new Date() > deadline
}

const getDisplayStatus = (job) =>
  getEffectiveJobStatus(job)

const toDraftPayload = (job) => {
  const projectId = job.projectId?._id || job.projectId || ''
  return {
    _jobId: job._id,
    projectId,
    title: job.title || '',
    postCode: job.postCode || '',
    department: job.department || '',
    category: job.category || 'General',
    jobType: job.jobType || 'Permanent',
    description: job.description || '',
    totalPosts: job.totalPosts || '',
    posts: Array.isArray(job.posts) ? job.posts : [],
    postSelectionMode: job.postSelectionMode || 'single',
    reservedPosts: job.reservedPosts || {},
    applicationFee: job.applicationFee || {},
    applicationStartDate: job.applicationStartDate || '',
    applicationDeadline: job.applicationDeadline || '',
    correctionStartDate: job.correctionStartDate || '',
    correctionDeadline: job.correctionDeadline || '',
    admitCardReleaseDate: job.admitCardReleaseDate || '',
    examDate: job.examDate || '',
    resultDate: job.resultDate || '',
    ageLimit: job.ageLimit || {},
    education: job.education || {},
    experience: job.experience || {},
    physicalStandards: job.physicalStandards || {},
    medicalStandards: job.medicalStandards || {},
    otherRequirements: job.otherRequirements || [],
    formSections: job.formSections || [],
    documentRequirements: job.documentRequirements || [],
    paymentConfig: job.paymentConfig || {},
  }
}

const Jobs = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [showProjectSelector, setShowProjectSelector] =
    useState(false)

  const { user } = useAuth()
  const isPrivilegedDelete = isSuperAdminUser(user)
  const canCreate = hasPermission(user, 'jobs', 'create')
  const canEdit = hasPermission(user, 'jobs', 'edit')
  const canDelete = hasPermission(user, 'jobs', 'delete')
  const canPublish = hasPermission(user, 'jobs', 'publish')
  const [page, setPage] = useState(1)
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, job: null })
  const [jobActionModal, setJobActionModal] = useState({
    isOpen: false,
    type: '',
    job: null,
  })

  const { data: jobsData, isLoading } = useQuery({
    queryKey: ['admin-jobs', page],
    queryFn: () =>
      jobService.getAdminJobs({ page, limit: 10 }),
  })

  const { data: statsData } = useQuery({
    queryKey: ['admin-job-stats'],
    queryFn: jobService.getAdminJobStats,
  })

  const { data: projectsData } = useQuery({
    queryKey: ['admin-projects-for-job-create'],
    queryFn: () =>
      adminService.getProjects({ limit: 50 }),
  })

  const { mutate: publishJob } = useMutation({
    mutationFn: adminService.publishJob,

    onSuccess: () => {
      toast.success('Job published successfully')

      queryClient.invalidateQueries({
        queryKey: ['admin-jobs'],
      })

      queryClient.invalidateQueries({
        queryKey: ['admin-job-stats'],
      })
    },

    onError: (err) =>
      toast.error(
        err.message || 'Failed to publish job'
      ),
  })

  const { mutate: closeJob } = useMutation({
    mutationFn: adminService.closeJob,

    onSuccess: () => {
      toast.success('Job closed')

      queryClient.invalidateQueries({
        queryKey: ['admin-jobs'],
      })

      queryClient.invalidateQueries({
        queryKey: ['admin-job-stats'],
      })
    },

    onError: (err) =>
      toast.error(
        err.message || 'Failed to close job'
      ),
  })

  const { mutate: deleteJob } = useMutation({
    mutationFn: adminService.deleteJob,

    onSuccess: (result) => {
      toast.success(result?.message || 'Job deleted')

      queryClient.invalidateQueries({
        queryKey: ['admin-jobs'],
      })

      queryClient.invalidateQueries({
        queryKey: ['admin-job-stats'],
      })
    },

    onError: (err) =>
      toast.error(
        err.message || 'Failed to delete job'
      ),
  })

  const handleDelete = (job) => {
    setDeleteModal({ isOpen: true, job })
  }

  const confirmDelete = () => {
    if (deleteModal.job) {
      deleteJob(deleteModal.job._id)
      setDeleteModal({ isOpen: false, job: null })
    }
  }

  const handlePublish = (job) => {
    if (isDeadlinePassed(job.applicationDeadline)) {
      toast.error('Application deadline has passed. Update the deadline before publishing.')
      return
    }

    setJobActionModal({ isOpen: true, type: 'publish', job })
  }

  const handleClose = (job) => {
    setJobActionModal({ isOpen: true, type: 'close', job })
  }

  const confirmJobAction = () => {
    if (!jobActionModal.job) return
    if (jobActionModal.type === 'publish') publishJob(jobActionModal.job._id)
    if (jobActionModal.type === 'close') closeJob(jobActionModal.job._id)
    setJobActionModal({ isOpen: false, type: '', job: null })
  }

  const openDraftJob = async (job, step = 'review') => {
    try {
      const data = await adminService.getAdminJob(job._id)
      const fullJob = data?.job || data
      const draft = toDraftPayload(fullJob)
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft))
      const projectId = draft.projectId
      navigate(
        `/admin/jobs/create/${step}${projectId ? `?project=${projectId}&job=${job._id}` : `?job=${job._id}`}`
      )
    } catch (err) {
      toast.error(err.message || 'Unable to open draft job')
    }
  }

  const jobs = jobsData?.jobs || []
  const pagination = jobsData?.pagination || jobsData?.meta || {}
  const totalPages = pagination.totalPages || 1
  const totalItems = pagination.totalItems || pagination.total || jobs.length
  const projects = (projectsData?.projects || []).map((project) => ({
    ...project,
    status: getProjectLifecycleStatus(project),
  }))

  const statusStats =
    statsData?.statusStats || []

  const countByStatus = (status) =>
    statusStats.find(
      (item) => item._id === status
    )?.count || 0

  const applicationTotals = statsData?.applicationTotals || {}
  const totalApplicants = Number(applicationTotals.totalApplicants || 0)
  const paidApplicants = Number(applicationTotals.paidApplicants || 0)
  const revenue = Number(applicationTotals.revenue || 0)

  const stats = [
    {
      title: 'LIVE JOBS',
      value:
        countByStatus('active') ||
        countByStatus('published'),
      icon: Briefcase,
      tone: 'green',
    },
    {
      title: 'DRAFTS',
      value: countByStatus('draft'),
      icon: Edit,
      tone: 'blue',
    },
    {
      title: 'CLOSED',
      value: countByStatus('closed'),
      icon: XCircle,
      tone: 'red',
    },
    {
      title: 'APPLICANTS',
      value: totalApplicants,
      icon: Users,
      tone: 'orange',
    },
    {
      title: 'PAID',
      value: paidApplicants,
      icon: CreditCard,
      tone: 'green',
    },
    {
      title: 'REVENUE',
      value: `INR ${revenue.toLocaleString('en-IN')}`,
      icon: IndianRupee,
      tone: 'purple',
    },
  ]

  const handleProjectSelect = (projectId) => {
    setShowProjectSelector(false)

    navigate(
      `/admin/jobs/create/basic-info?project=${projectId}`
    )
  }

  return (
    <AdminLayout title="Jobs">

      <div className="
        min-h-full
        bg-[#f7f4ee]
        p-5 space-y-5
      ">

        {/* HEADER */}
        <div className="
          flex flex-col lg:flex-row
          lg:items-center
          lg:justify-between
          gap-4
        ">

          <div>

            <h1 className="
              text-2xl font-bold
              text-gray-900
            ">
              Jobs
            </h1>

            <p className="
              text-sm text-gray-500 mt-1
            ">
              Manage recruitment cycles and
              institutional vacancies across Bihar.
            </p>

          </div>

          {canCreate && (
            <Button
              onClick={() =>
                setShowProjectSelector(true)
              }
              className="
                bg-orange-600
                hover:bg-orange-700
                text-white
                rounded-2xl
                shadow-lg shadow-orange-200
                h-11 px-5
              "
            >
              <Plus className="
                w-4 h-4 mr-2
              " />

              Create Job
            </Button>
          )}

        </div>

        {/* STATS */}
        <div className="
          grid grid-cols-1
          sm:grid-cols-2
          xl:grid-cols-4
          gap-4
        ">

          {stats.map((stat) => (
            <AdminKpiCard key={stat.title} {...stat} />
          ))}
        </div>

        {/* TABLE */}
        <AdminTableShell
          className="rounded-[26px]"
          minHeight="min-h-[620px] xl:min-h-[calc(100vh_-_300px)]"
          footer={
            !isLoading && jobs.length > 0 ? (
              <AdminPagination
                page={page}
                totalPages={totalPages}
                totalItems={totalItems}
                pageSize={pagination.itemsPerPage || 10}
                itemsOnPage={jobs.length}
                itemLabel="jobs"
                onPageChange={setPage}
              />
            ) : null
          }
        >

            <table className="w-full min-w-[980px] table-fixed">
              <colgroup>
                <col className="w-[33%]" />
                <col className="w-[25%]" />
                <col className="w-[10%]" />
                <col className="w-[10%]" />
                <col className="w-[12%]" />
                <col className="w-[10%]" />
              </colgroup>

              <thead className="
                bg-gray-50
                border-b border-gray-100
              ">

                <tr>

                  {[
                    'Job Position',
                    'Project',
                    'Applicants',
                    'Status',
                    'Deadline',
                    'Actions',
                  ].map((head) => (
                    <th
                      key={head}
                      className={`
                        px-5 py-4
                        text-xs
                        font-semibold
                        tracking-normal
                        text-gray-500
                        uppercase
                        ${['Applicants', 'Status', 'Deadline', 'Actions'].includes(head) ? 'text-center' : 'text-left'}
                      `}
                    >
                      {head}
                    </th>
                  ))}

                </tr>
              </thead>

              <tbody className="
                divide-y divide-gray-100
              ">

                {isLoading && (
                  <AdminTableStatusRow colSpan={6} type="loading" title="Loading jobs..." />
                )}

                {!isLoading &&
                  jobs.length === 0 && (
                    <AdminTableStatusRow colSpan={6} icon={Briefcase} title="No jobs found" description="Create a job to start a recruitment cycle." />
                  )}

                {jobs.map((job) => (
                  <tr
                    key={job._id}
                    className="
                      hover:bg-orange-50/40
                      transition-all duration-200
                    "
                  >

                    {/* JOB */}
                    <td className="
                      px-5 py-5
                    ">

                      <div className="
                        flex items-center gap-3
                      ">

                        <div className="
                          w-11 h-11 rounded-2xl
                          bg-orange-100
                          flex items-center justify-center
                          shrink-0
                        ">
                          <Briefcase className="
                            w-5 h-5 text-orange-600
                          " />
                        </div>

                        <div className="min-w-0">

                          <h3 className="
                            font-bold
                            text-gray-900
                          ">
                            {job.title}
                          </h3>

                          <p className="
                            text-xs text-gray-500
                            font-mono mt-1
                          ">
                            {job.postCode}
                          </p>

                          {job.isSoftDeleted && (
                            <Badge className="mt-2 bg-amber-50 text-amber-700 border border-amber-200">
                              Removed by employee
                            </Badge>
                          )}

                        </div>
                      </div>
                    </td>

                    {/* PROJECT */}
                    <td className="
                      px-5 py-5
                    ">
                      <p className="
                        max-w-[260px]
                        text-sm text-gray-600
                        font-medium
                        leading-snug
                      ">
                        {job.projectId?.name ||
                          '—'}
                      </p>
                    </td>

                    {/* APPLICANTS */}
                    <td className="
                      px-5 py-5
                    ">

                      <div className="text-center">
                        <h3 className="
                          font-bold
                          text-gray-900
                        ">
                          {job.totalApplicants || 0}
                        </h3>

                        <p className="
                          text-xs
                          text-gray-400
                          font-semibold
                          tracking-normal
                        ">
                          APPLICANTS
                        </p>
                      </div>

                    </td>

                    {/* STATUS */}
                    <td className="
                      px-5 py-5 text-center
                    ">
                      <Badge
                        className={
                          STATUS_COLORS[
                            getDisplayStatus(job)
                          ] ||
                          'bg-gray-100 text-gray-700'
                        }
                      >
                        {getDisplayStatus(job).toUpperCase()}
                      </Badge>
                    </td>

                    {/* DEADLINE */}
                    <td className="
                      px-5 py-5 text-center
                    ">

                      <div className="
                        flex items-center justify-center gap-2
                      ">

                        <Clock className="
                          w-4 h-4 text-gray-400
                        " />

                        <span className="
                          text-sm text-gray-500
                        ">
                          {job.applicationDeadline
                            ? new Date(
                                job.applicationDeadline
                              ).toLocaleDateString(
                                'en-IN'
                              )
                            : '—'}
                        </span>

                      </div>
                    </td>

                    {/* ACTIONS */}
                    <td className="
                      px-5 py-5
                    ">

                      <div className="
                        flex items-center justify-center gap-2
                      ">

                        {/* VIEW / EDIT */}
                        <button
                          onClick={() => {
                            if (isDraftJob(job) && canEdit) {
                              openDraftJob(job, 'review')
                              return
                            }
                            if (isPublicJob(job)) {
                              navigate(`/jobs/${job._id}`)
                            }
                          }}
                          disabled={(isDraftJob(job) && !canEdit) || (!isDraftJob(job) && !isPublicJob(job))}
                          title={
                            isDraftJob(job) && canEdit
                              ? 'Edit draft job'
                              : isPublicJob(job)
                                ? 'View public job'
                                : 'Edit permission is required'
                          }
                          className="
                            w-9 h-9 rounded-xl
                            hover:bg-gray-100
                            text-gray-500
                            flex items-center justify-center
                            transition-all
                            disabled:cursor-not-allowed disabled:opacity-40
                          "
                        >
                          {isDraftJob(job) ? (
                            <Edit className="
                              w-4 h-4
                            " />
                          ) : (
                            <Eye className="
                              w-4 h-4
                            " />
                          )}
                        </button>

                        {/* PUBLISH */}
                        {isDraftJob(job) && canPublish && (
                          <button
                            onClick={() =>
                              handlePublish(job)
                            }
                            disabled={isDeadlinePassed(job.applicationDeadline)}
                            title={
                              isDeadlinePassed(job.applicationDeadline)
                                ? 'Application deadline has passed. Edit the job deadline before publishing.'
                                : 'Publish job'
                            }
                            className="
                              w-9 h-9 rounded-xl
                              hover:bg-green-50
                              text-green-600
                              flex items-center justify-center
                              transition-all
                              disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent
                            "
                          >
                            <Send className="
                              w-4 h-4
                            " />
                          </button>
                        )}

                        {/* CLOSE */}
                        {canEdit && (job.status ===
                          'active' ||
                          job.status ===
                            'published') && (
                          <button
                            onClick={() =>
                              handleClose(job)
                            }
                            className="
                              w-9 h-9 rounded-xl
                              hover:bg-yellow-50
                              text-yellow-600
                              flex items-center justify-center
                              transition-all
                            "
                          >
                            <XCircle className="
                              w-4 h-4
                            " />
                          </button>
                        )}

                        {/* DELETE */}
                        {canDelete && (
                          <button
                            onClick={() =>
                              handleDelete(job)
                            }
                            className="
                              w-9 h-9 rounded-xl
                              hover:bg-red-50
                              text-red-600
                              flex items-center justify-center
                              transition-all
                            "
                          >
                            <Trash2 className="
                              w-4 h-4
                            " />
                          </button>
                        )}

                      </div>
                    </td>

                  </tr>
                ))}
              </tbody>

            </table>
        </AdminTableShell>

        {/* MODAL */}
        {showProjectSelector && (
          <div className="
            fixed inset-0
            bg-black/50
            flex items-center justify-center
            z-50 p-4
            backdrop-blur-sm
          ">

            <div className="
              bg-white
              rounded-[28px]
              w-full max-w-2xl
              shadow-2xl
              overflow-hidden
            ">

              {/* HEADER */}
              <div className="
                p-6 border-b border-gray-100
                flex items-center justify-between
              ">

                <div>

                  <h3 className="
                    text-lg font-bold
                    text-gray-900
                  ">
                    Select Project
                  </h3>

                  <p className="
                    text-sm text-gray-500 mt-1
                  ">
                    Associate this job with a project.
                  </p>

                </div>

                <button
                  onClick={() =>
                    setShowProjectSelector(false)
                  }
                  className="
                    w-10 h-10 rounded-xl
                    hover:bg-gray-100
                    flex items-center justify-center
                  "
                >
                  <XCircle className="
                    w-5 h-5 text-gray-500
                  " />
                </button>

              </div>

              {/* BODY */}
              <div className="
                hover-scroll
                p-6 space-y-3
                max-h-[450px]
                overflow-y-auto
              ">

                {projects.length === 0 && (
                  <div className="
                    text-center py-10
                  ">

                    <div className="
                      w-16 h-16 rounded-3xl
                      bg-orange-100
                      flex items-center justify-center
                      mx-auto mb-4
                    ">
                      <Sparkles className="
                        w-7 h-7 text-orange-600
                      " />
                    </div>

                    <p className="
                      text-gray-500 mb-5
                    ">
                      No projects available.
                    </p>

                    <Button
                      onClick={() => {
                        setShowProjectSelector(
                          false
                        )

                        navigate(
                          '/admin/projects/create'
                        )
                      }}
                      className="
                        bg-orange-600
                        hover:bg-orange-700
                        text-white
                      "
                    >
                      Create Project
                    </Button>

                  </div>
                )}

                {projects.map((project) => (
                  <button
                    key={project._id}
                    onClick={() =>
                      handleProjectSelect(
                        project._id
                      )
                    }
                    className="
                      w-full text-left
                      rounded-2xl
                      border border-gray-100
                      p-4
                      hover:border-orange-200
                      hover:bg-orange-50/40
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
                        <FolderOpen className="
                          w-5 h-5 text-orange-600
                        " />
                      </div>

                      <div className="
                        flex-1
                      ">

                        <h4 className="
                          font-bold text-gray-900
                        ">
                          {project.name}
                        </h4>

                        <p className="
                          text-sm text-gray-500 mt-1
                        ">
                          {project.department}
                          {' • '}
                          {project.state}
                        </p>

                      </div>

                      <Badge
                        className={getProjectStatusBadgeClass(project.status)}
                      >
                        {project.status}
                      </Badge>

                    </div>
                  </button>
                ))}

              </div>
            </div>
          </div>
        )}
      </div>
      <ConfirmDeleteModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, job: null })}
        onConfirm={confirmDelete}
        title="Delete Job"
        message={
          isPrivilegedDelete
            ? `Are you sure you want to permanently delete "${deleteModal.job?.title}"? All related data will be removed.`
            : `Remove "${deleteModal.job?.title}" from the employee portal? Admin/superadmin will still see it and receive a notification.`
        }
        requireType={isPrivilegedDelete}
      />
      <ConfirmActionModal
        isOpen={jobActionModal.isOpen}
        onClose={() => setJobActionModal({ isOpen: false, type: '', job: null })}
        onConfirm={confirmJobAction}
        title={jobActionModal.type === 'close' ? 'Close Job' : 'Publish Job'}
        message={
          jobActionModal.type === 'close'
            ? `Close "${jobActionModal.job?.title}"? Candidates will no longer be able to start a new application.`
            : `Publish "${jobActionModal.job?.title}" on the public recruitment page?`
        }
        confirmLabel={jobActionModal.type === 'close' ? 'Close Job' : 'Publish Job'}
        tone={jobActionModal.type === 'close' ? 'red' : 'orange'}
      />
    </AdminLayout>
  )
}
export default Jobs
