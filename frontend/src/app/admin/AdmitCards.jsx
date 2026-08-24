import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Building2, CalendarClock, CheckCircle2, Download, FileBadge,
  Eye, Loader2, Lock, Play, Plus, Search, Send, Trash2, Users,
  X,
} from 'lucide-react'
import AdminLayout from '../../components/layouts/AdminLayout'
import { Card, CardContent, CardHeader } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import CustomSelect from '../../components/ui/CustomSelect'
import AppDatePicker from '../../components/ui/AppDatePicker'
import TimeSelect from '../../components/ui/TimeSelect'
import DocumentPreviewFrame from '../../components/common/DocumentPreviewFrame'
import ProjectFlowNav from '../../components/admin/ProjectFlowNav'
import { adminService } from '../../services/admin.service'

const emptyCenter = {
  centerCode: '',
  name: '',
  addressLine1: '',
  city: '',
  district: '',
  state: '',
  pincode: '',
}

const emptyRoom = {
  centerId: '',
  roomCode: '',
  roomName: '',
  block: '',
  floor: '',
  capacity: '',
  usableCapacity: '',
  seatPrefix: '',
}

const emptyPaper = {
  name: '',
  numberOfQuestions: '',
  order: 1,
}

const emptyInstruction = {
  text: '',
  order: 1,
}

const emptySchedule = {
  jobId: '',
  examName: '',
  examCode: '',
  advertisementNo: '',
  shiftName: '',
  examDate: '',
  reportingTime: '',
  gateClosingTime: '',
  examStartTime: '',
  examEndTime: '',
  provisionalNote: '',
  selectedCenterIds: [],
  papers: [{ ...emptyPaper }],
  instructions: [{ ...emptyInstruction }],
}

const toTimeInputValue = (value) => {
  const text = String(value || '').trim()
  if (!text) return ''
  const twentyFourHour = text.match(/^(\d{1,2}):(\d{2})$/)
  if (twentyFourHour) {
    const hours = Math.min(23, Math.max(0, Number(twentyFourHour[1]) || 0))
    const minutes = Math.min(59, Math.max(0, Number(twentyFourHour[2]) || 0))
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
  }
  const twelveHour = text.toUpperCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/)
  if (!twelveHour) return ''
  let hours = Number(twelveHour[1])
  const minutes = Number(twelveHour[2] || 0)
  if (twelveHour[3] === 'PM' && hours < 12) hours += 12
  if (twelveHour[3] === 'AM' && hours === 12) hours = 0
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

const formatTimeForDisplay = (value) => {
  const inputValue = toTimeInputValue(value)
  if (!inputValue) return ''
  const [hoursText, minutes] = inputValue.split(':')
  const hours = Number(hoursText)
  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours % 12 || 12
  return `${String(displayHours).padStart(2, '0')}:${minutes} ${period}`
}

const toDateInputValue = (value) => {
  if (!value) return ''
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

const normalizeJobRef = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')

const isJobAdvertisementConfigured = (job) => {
  if (!job?._id) return false
  const posts = Array.isArray(job.posts) ? job.posts : []
  const hasVacancies =
    Number(job.totalPosts || 0) > 0 ||
    posts.some((post) => Number(post.vacancies || 0) > 0)

  return Boolean(
    job.title &&
      job.postCode &&
      job.department &&
      hasVacancies &&
      job.applicationStartDate &&
      job.applicationDeadline,
  )
}

const statusTone = {
  draft: 'bg-gray-100 text-gray-700',
  allocated: 'bg-blue-50 text-blue-700',
  locked: 'bg-amber-50 text-amber-700',
  published: 'bg-green-50 text-green-700',
  cancelled: 'bg-red-50 text-red-700',
}

const mergeCenterIntoList = (items = [], center) => {
  if (!center?._id) return items
  const exists = items.some((item) => item._id === center._id)
  return exists
    ? items.map((item) => (item._id === center._id ? { ...item, ...center } : item))
    : [center, ...items]
}

const updateCenterWithRoom = (items = [], centerId, room) =>
  items.map((center) => {
    if (center._id !== centerId) return center
    const currentRooms = Array.isArray(center.rooms) ? center.rooms : []
    const roomExists = room?._id && currentRooms.some((item) => item._id === room._id)
    const rooms = room?._id
      ? roomExists
        ? currentRooms.map((item) => (item._id === room._id ? { ...item, ...room } : item))
        : [...currentRooms, room]
      : currentRooms
    const roomCapacity = roomExists ? 0 : Number(room?.usableCapacity || room?.capacity || 0)
    return {
      ...center,
      rooms,
      totalCapacity: Number(center.totalCapacity || 0) + roomCapacity,
      totalRooms: Number(center.totalRooms || currentRooms.length || 0) + (roomExists || !room?._id ? 0 : 1),
    }
  })

const Stat = ({ icon: Icon, label, value }) => (
  <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
    <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center">
      <Icon className="w-4 h-4 text-orange-600" />
    </div>
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value ?? 0}</p>
    </div>
  </div>
)

const AdmitCards = () => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const projectId = searchParams.get('project')
  const focus = searchParams.get('focus')
  const jobParam = searchParams.get('job') || ''
  const [centerForm, setCenterForm] = useState(emptyCenter)
  const [roomForm, setRoomForm] = useState(emptyRoom)
  const [scheduleForm, setScheduleForm] = useState(emptySchedule)
  const [selectedJobId, setSelectedJobId] = useState(jobParam)
  const [selectedScheduleId, setSelectedScheduleId] = useState('')
  const [selectedAttendanceCenterId, setSelectedAttendanceCenterId] = useState('')
  const [activeBulkJobId, setActiveBulkJobId] = useState('')
  const [previewAdmitCard, setPreviewAdmitCard] = useState(null)
  const [previewAttendance, setPreviewAttendance] = useState(null)
  const [search, setSearch] = useState('')

  const { data: centers = [], isLoading: centersLoading } = useQuery({
    queryKey: ['exam-centers'],
    queryFn: () => adminService.getExamCenters({ limit: 100 }),
  })

  const { data: projectData } = useQuery({
    queryKey: ['admin-project-flow', projectId],
    queryFn: () => adminService.getProject(projectId),
    enabled: Boolean(projectId),
    staleTime: 30000,
  })

  const { data: jobsData } = useQuery({
    queryKey: ['admin-jobs-for-exams', projectId],
    queryFn: () => adminService.getAdminJobs({ limit: 100, ...(projectId ? { projectId } : {}) }),
  })
  const { data: selectedJobData } = useQuery({
    queryKey: ['admin-job-for-exams', selectedJobId],
    queryFn: () => adminService.getAdminJob(selectedJobId),
    enabled: Boolean(selectedJobId),
    staleTime: 30000,
  })

  const { data: schedules = [], isLoading: schedulesLoading } = useQuery({
    queryKey: ['exam-schedules', projectId],
    queryFn: () => adminService.getExamSchedules({ limit: 100, ...(projectId ? { projectId } : {}) }),
  })

  const project = projectData?.project || projectData
  const jobs = useMemo(() => {
    const rawJobs = jobsData?.jobs || jobsData || []
    return projectId
      ? rawJobs.filter((job) => String(job.projectId?._id || job.projectId || '') === String(projectId))
      : rawJobs
  }, [jobsData, projectId])
  const selectedJob = useMemo(() => {
    const listedJob = jobs.find((job) => String(job._id) === String(selectedJobId))
    if (listedJob) return listedJob
    const hydratedJob = selectedJobData?.job || selectedJobData || null
    if (hydratedJob?._id) {
      if (!projectId) return hydratedJob
      const hydratedProjectId = String(hydratedJob.projectId?._id || hydratedJob.projectId || '')
      if (hydratedProjectId === String(projectId)) return hydratedJob
    }
    if (jobs.length > 0) return jobs[0]
    return hydratedJob
  }, [jobs, selectedJobData, selectedJobId, projectId])
  const matchedJobFromDraft = useMemo(() => {
    const draftJobCode = normalizeJobRef(scheduleForm.examCode || scheduleForm.advertisementNo)
    const draftJobName = normalizeJobRef(scheduleForm.examName)

    return jobs.find((job) => {
      const jobCode = normalizeJobRef(job.postCode)
      const jobName = normalizeJobRef(job.title)
      return (
        (draftJobCode && jobCode === draftJobCode) ||
        (draftJobName && jobName === draftJobName)
      )
    }) || null
  }, [jobs, scheduleForm.advertisementNo, scheduleForm.examCode, scheduleForm.examName])
  const jobOptions = useMemo(() => {
    const options = jobs.map((job) => ({
      value: job._id,
      label: `${job.title}${job.postCode ? ` (${job.postCode})` : ''}${job.status ? ` - ${job.status}` : ''}`,
    }))
    if (
      selectedJob?._id &&
      !options.some((option) => String(option.value) === String(selectedJob._id))
    ) {
      options.unshift({
        value: selectedJob._id,
        label: `${selectedJob.title}${selectedJob.postCode ? ` (${selectedJob.postCode})` : ''}${selectedJob.status ? ` - ${selectedJob.status}` : ''}`,
      })
    }
    return options
  }, [jobs, selectedJob])
  const selectedJobSchedules = useMemo(() => {
    const list = Array.isArray(schedules) ? schedules : []
    if (!projectId) return list
    if (!selectedJob?._id) return []
    return list.filter((schedule) => String(schedule.jobId?._id || schedule.jobId || '') === String(selectedJob._id))
  }, [schedules, projectId, selectedJob])

  useEffect(() => {
    if (!projectId) return

    const jobParamInCurrentJobs = jobParam && jobs.some((job) => String(job._id) === String(jobParam))
      ? jobParam
      : ''
    const formJobInCurrentJobs = scheduleForm.jobId && jobs.some((job) => String(job._id) === String(scheduleForm.jobId))
      ? scheduleForm.jobId
      : ''
    const nextJobId =
      jobParamInCurrentJobs ||
      (jobs.some((job) => String(job._id) === String(selectedJobId))
        ? selectedJobId
        : '') ||
          formJobInCurrentJobs ||
          matchedJobFromDraft?._id ||
          jobs[0]?._id ||
          ''

    if (nextJobId && nextJobId !== selectedJobId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedJobId(nextJobId)
    }

    const nextParams = new URLSearchParams(searchParams)
    if (nextJobId) nextParams.set('job', nextJobId)
    else nextParams.delete('job')
    if (nextParams.toString() !== searchParams.toString()) {
      navigate(
        {
          pathname: '/admin/admit-cards',
          search: nextParams.toString(),
        },
        { replace: true },
      )
    }
  }, [jobParam, jobs, matchedJobFromDraft, navigate, projectId, scheduleForm.jobId, searchParams, selectedJobId])

  useEffect(() => {
    if (!selectedJob?._id) return

    const sameJob = String(scheduleForm.jobId || '') === String(selectedJob._id)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setScheduleForm((prev) => ({
      ...prev,
      jobId: selectedJob._id || '',
      examName: sameJob ? prev.examName || selectedJob.title || '' : selectedJob.title || '',
      examCode: sameJob ? prev.examCode || selectedJob.postCode || '' : selectedJob.postCode || '',
      advertisementNo: sameJob ? prev.advertisementNo || selectedJob.postCode || '' : selectedJob.postCode || '',
      examDate: sameJob ? prev.examDate || toDateInputValue(selectedJob.examDate) : toDateInputValue(selectedJob.examDate),
      provisionalNote:
        prev.provisionalNote ||
        'Admit-card access depends on eligibility checks.',
      instructions:
        prev.instructions?.some((instruction) => instruction.text)
          ? prev.instructions
          : [
              { text: 'Carry a printed admit card and valid photo ID.', order: 1 },
              { text: 'Report before gate closing time.', order: 2 },
              { text: 'Follow all exam-center instructions.', order: 3 },
            ],
    }))
  }, [selectedJob, scheduleForm.jobId])

  useEffect(() => {
    if (!selectedJob?._id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedScheduleId('')
      return
    }

    const selectedScheduleExists = selectedJobSchedules.some((schedule) => schedule._id === selectedScheduleId)
    if (!selectedScheduleExists) {
      setSelectedScheduleId(selectedJobSchedules[0]?._id || '')
    }
  }, [selectedJobSchedules, selectedJob, selectedScheduleId])

  const selectedSchedule = useMemo(
    () => selectedJobSchedules.find((item) => item._id === selectedScheduleId) || selectedJobSchedules[0],
    [selectedJobSchedules, selectedScheduleId],
  )
  const admitWorkflowProject = useMemo(() => {
    if (!project) return project

    const landingComplete = Boolean(project?.workflowReadiness?.checks?.find((check) => check.key === 'landing')?.complete || project?.isPublished)
    const jobComplete = isJobAdvertisementConfigured(selectedJob)
    const admitFormatComplete = Boolean(
      selectedSchedule?.examName &&
      selectedSchedule?.examDate &&
      Array.isArray(selectedSchedule?.instructions) &&
      selectedSchedule.instructions.length > 0,
    )
    const centersComplete = Boolean(selectedSchedule?.selectedCenterIds?.length)
    const publishComplete = Boolean(
      selectedJob?._id &&
        String(selectedJob.status || '').toLowerCase() === 'active' &&
        project?.isPublished,
    )
    const reviewComplete = publishComplete
    const checks = [
      { key: 'landing', label: 'Landing CMS', complete: landingComplete },
      { key: 'job', label: 'Job Advertisement', complete: jobComplete },
      { key: 'admit-format', label: 'Admit Format', complete: admitFormatComplete, optional: true },
      { key: 'centers', label: 'Centers', complete: centersComplete, optional: true },
      { key: 'review', label: 'Final Review', complete: reviewComplete },
    ]

    return {
      ...project,
      isPublished: publishComplete,
      workflowReadiness: {
        complete: checks.every((check) => check.complete),
        checks,
      },
    }
  }, [project, selectedJob, selectedSchedule])

  const activeScheduleId = selectedSchedule?._id

  const { data: statsData } = useQuery({
    queryKey: ['exam-schedule-stats', activeScheduleId],
    queryFn: () => adminService.getExamScheduleStats(activeScheduleId),
    enabled: Boolean(activeScheduleId),
  })

  const { data: admitCards = [] } = useQuery({
    queryKey: ['schedule-admit-cards', activeScheduleId],
    queryFn: () => adminService.getScheduleAdmitCards(activeScheduleId, { limit: 20, search }),
    enabled: Boolean(activeScheduleId),
  })

  const { data: bulkJobData } = useQuery({
    queryKey: ['exam-bulk-job', activeBulkJobId],
    queryFn: () => adminService.getBulkExamJob(activeBulkJobId),
    enabled: Boolean(activeBulkJobId),
    refetchInterval: (query) => {
      const status = query.state.data?.job?.status
      return status === 'queued' || status === 'running' ? 2500 : false
    },
  })

  const createCenter = useMutation({
    mutationFn: adminService.createExamCenter,
    onSuccess: (data) => {
      const center = data?.center || data
      toast.success('Exam center added')
      setCenterForm(emptyCenter)
      if (center?._id) {
        queryClient.setQueryData(['exam-centers'], (old = []) => mergeCenterIntoList(old, center))
        setRoomForm((prev) => ({ ...prev, centerId: center._id }))
      }
      queryClient.invalidateQueries({ queryKey: ['exam-centers'] })
    },
    onError: (err) => toast.error(err.message || 'Failed to add center'),
  })

  const createRoom = useMutation({
    mutationFn: ({ centerId, payload }) => adminService.createExamRoom(centerId, payload),
    onSuccess: (data, vars) => {
      const room = data?.room || data
      toast.success('Exam room added')
      if (vars?.centerId && room?._id) {
        queryClient.setQueryData(['exam-centers'], (old = []) => updateCenterWithRoom(old, vars.centerId, room))
      }
      setRoomForm((prev) => ({
        ...emptyRoom,
        centerId: prev.centerId,
      }))
      queryClient.invalidateQueries({ queryKey: ['exam-centers'] })
      queryClient.invalidateQueries({ queryKey: ['exam-schedule-stats'] })
    },
    onError: (err) => toast.error(err.message || 'Failed to add room'),
  })

  const createSchedule = useMutation({
    mutationFn: adminService.createExamSchedule,
    onSuccess: (data) => {
      toast.success('Exam schedule created')
      setScheduleForm(emptySchedule)
      queryClient.invalidateQueries({ queryKey: ['exam-schedules'] })
      setSelectedScheduleId(data?.schedule?._id || '')
      if (projectId) {
        navigate(`/admin/admit-cards?project=${projectId}&focus=centers${selectedJob?._id ? `&job=${selectedJob._id}` : ''}`)
      }
    },
    onError: (err) => toast.error(err.message || 'Failed to create schedule'),
  })

  const actionMutation = useMutation({
    mutationFn: async ({ type, id }) => {
      if (type === 'preview') return adminService.previewExamAllocation(id)
      if (type === 'allocate') return adminService.queueExamAllocation(id)
      if (type === 'lock') return adminService.lockExamAllocation(id)
      if (type === 'generate') return adminService.queueAdmitCardGeneration(id)
      if (type === 'publish') return adminService.publishAdmitCards(id)
      if (type === 'unpublish') return adminService.unpublishAdmitCards(id, 'Unpublished from admin admit card screen')
      if (type === 'regenerate') return adminService.regenerateAdmitCards(id, 'Regenerated from admin admit card screen')
      return null
    },
    onSuccess: (data, vars) => {
      if (data?.job?._id) {
        setActiveBulkJobId(data.job._id)
      }
      const messages = {
        preview: `Preview: ${data?.summary?.allocatedCandidates || 0} candidates can be allocated`,
        allocate: data?.job ? 'Allocation job queued' : 'Candidates allocated',
        lock: 'Allocation locked',
        generate: data?.job ? 'Admit card generation job queued' : 'Admit cards generated',
        publish: data?.alreadyPublished ? 'Already published' : 'Admit-card window published',
        unpublish: 'Admit cards unpublished',
        regenerate: 'Admit cards regenerated',
      }
      toast.success(messages[vars.type])
      queryClient.invalidateQueries({ queryKey: ['exam-schedules'] })
      queryClient.invalidateQueries({ queryKey: ['exam-schedule-stats', vars.id] })
      queryClient.invalidateQueries({ queryKey: ['schedule-admit-cards', vars.id] })
      if (projectId && vars.type === 'publish') {
        navigate(`/admin/projects/${projectId}?review=1${selectedJob?._id ? `&job=${selectedJob._id}` : ''}`)
      }
    },
    onError: (err) => toast.error(err.message || 'Action failed'),
  })

  const bulkMutation = useMutation({
    mutationFn: ({ type, id, centerId }) => {
      if (type === 'admit_zip') return adminService.queueBulkAdmitCards(id, centerId ? { centerId } : {})
      if (type === 'attendance_zip') return adminService.queueBulkAttendance(id, centerId ? { centerId } : {})
      if (type === 'retry') return adminService.retryBulkExamJob(id)
      return null
    },
    onSuccess: (data, vars) => {
      if (data?.job?._id) setActiveBulkJobId(data.job._id)
      toast.success(vars.type === 'retry' ? 'Retry queued' : 'Bulk job queued')
    },
    onError: (err) => toast.error(err.message || 'Bulk job failed'),
  })

  const stats = statsData?.stats || {}
  const admitCardCounts = (stats.admitCards || []).reduce(
    (acc, item) => ({ ...acc, [item._id || 'unknown']: item.count }),
    {},
  )
  const scheduleCapacity = Number(stats.totalCapacity || 0)
  const scheduleAllocated = Number(stats.allocatedCandidates || 0)
  const opsCards = [
    { label: 'Released Windows', value: selectedSchedule?.status === 'published' ? 1 : 0, icon: Send },
    {
      label: 'On-demand Cards',
      value: Number(admitCardCounts.published || 0) + Number(admitCardCounts.generated || 0),
      icon: FileBadge,
    },
    { label: 'Seats Remaining', value: Math.max(0, scheduleCapacity - scheduleAllocated), icon: Users },
    { label: 'Pending Corrections', value: stats.pendingCorrections || 0, icon: CalendarClock },
  ]
  const activeCenters = centers.filter((center) => center.active !== false)
  const selectedCenterIds = scheduleForm.selectedCenterIds || []
  const selectedCenters = activeCenters.filter((center) => selectedCenterIds.includes(center._id))
  const selectedCapacity = selectedCenters.reduce((sum, center) => sum + (Number(center.totalCapacity) || 0), 0)
  const selectedScheduleCenterIds = selectedSchedule?.selectedCenterIds?.map((id) => String(id?._id || id)) || []
  const selectedScheduleCenterCount = selectedScheduleCenterIds.length
  const selectedScheduleCapacity = selectedScheduleCenterIds.length
    ? activeCenters
      .filter((center) => selectedScheduleCenterIds.includes(center._id))
      .reduce((sum, center) => sum + (Number(center.totalCapacity) || 0), 0)
    : 0
  const managedCenters = activeCenters.filter((center) =>
    selectedScheduleCenterIds.length
      ? selectedScheduleCenterIds.includes(center._id)
      : true,
  )
  const selectedAttendanceCenter = managedCenters.find((center) => center._id === selectedAttendanceCenterId)
  const bulkJob = bulkJobData?.job
  const bulkProgress = bulkJob?.progress || {}
  const bulkProgressTotal = Number(bulkProgress.total || 0)
  const bulkProgressProcessed = Number(bulkProgress.processed || 0)
  const bulkProgressFailed = Number(bulkProgress.failed || 0)
  const bulkProgressPercent = bulkProgressTotal
    ? Math.min(100, Math.round((bulkProgressProcessed / Number(bulkProgressTotal || 1)) * 100))
    : bulkJob?.status === 'completed'
      ? 100
      : bulkJob?.status === 'failed'
        ? 100
        : 0
  const bulkProgressBarClass = bulkJob?.status === 'failed'
    ? 'bg-red-500'
    : bulkJob?.status === 'completed'
      ? 'bg-green-500'
      : 'bg-orange-600'
  const allocationSteps = [
    { type: 'preview', label: 'Preview Capacity', helper: 'Check eligible candidates and available seats.', icon: Search },
    { type: 'allocate', label: 'Bulk Allocate', helper: 'Allocate eligible candidates.', icon: Play },
    { type: 'lock', label: 'Lock List', helper: 'Freeze the allocation list.', icon: Lock },
    { type: 'generate', label: 'Bulk Generate', helper: 'Generate cards for the locked list.', icon: FileBadge },
    { type: 'publish', label: 'Publish Window', helper: 'Open on-demand admit cards.', icon: Send, primary: true },
  ]

  const handleJobChange = (jobId) => {
    setSelectedJobId(jobId)
    setSelectedScheduleId('')
    setSelectedAttendanceCenterId('')
    setScheduleForm((prev) => {
      const job = jobs.find((item) => item._id === jobId)
      return {
        ...prev,
        jobId,
        examName: jobId === selectedJob?._id ? prev.examName : job?.title || prev.examName,
        examCode: jobId === selectedJob?._id ? prev.examCode : job?.postCode || prev.examCode,
        advertisementNo:
          jobId === selectedJob?._id ? prev.advertisementNo : job?.postCode || prev.advertisementNo,
      }
    })

    const nextParams = new URLSearchParams(searchParams)
    if (jobId) nextParams.set('job', jobId)
    else nextParams.delete('job')
    navigate(
      {
        pathname: '/admin/admit-cards',
        search: nextParams.toString(),
      },
      { replace: true },
    )
  }

  const toggleScheduleCenter = (centerId) => {
    setScheduleForm((prev) => {
      const ids = prev.selectedCenterIds || []
      return {
        ...prev,
        selectedCenterIds: ids.includes(centerId)
          ? ids.filter((id) => id !== centerId)
          : [...ids, centerId],
      }
    })
  }

  const submitCenter = (event) => {
    event.preventDefault()
    createCenter.mutate(centerForm)
  }

  const submitRoom = (event) => {
    event.preventDefault()
    if (!roomForm.centerId) {
      toast.error('Select an exam center first')
      return
    }
    createRoom.mutate({
      centerId: roomForm.centerId,
      payload: {
        roomCode: roomForm.roomCode,
        roomName: roomForm.roomName,
        block: roomForm.block || undefined,
        floor: roomForm.floor || undefined,
        capacity: Number(roomForm.capacity),
        usableCapacity: Number(roomForm.usableCapacity || roomForm.capacity),
        seatPrefix: roomForm.seatPrefix || roomForm.roomCode,
        active: true,
      },
    })
  }

  const submitSchedule = (event) => {
    event.preventDefault()
    const papers = scheduleForm.papers
      .map((paper, index) => ({
        ...paper,
        name: paper.name.trim(),
        numberOfQuestions: Number(paper.numberOfQuestions),
        order: index + 1,
      }))
      .filter((paper) => paper.name || paper.numberOfQuestions)
    const instructions = scheduleForm.instructions
      .map((instruction, index) => ({
        text: instruction.text.trim(),
        order: index + 1,
      }))
      .filter((instruction) => instruction.text)

    if (papers.length === 0 || papers.some((paper) => !paper.name || !paper.numberOfQuestions)) {
      toast.error('Add complete paper details before creating the schedule')
      return
    }

    if (instructions.length === 0) {
      toast.error('Add admit card instructions before creating the schedule')
      return
    }

    if (!scheduleForm.provisionalNote.trim()) {
      toast.error('Add the official provisional note before creating the schedule')
      return
    }
    if (!scheduleForm.selectedCenterIds?.length) {
      toast.error('Select at least one center for this exam schedule')
      return
    }
    const scheduleJobId = scheduleForm.jobId || selectedJob?._id
    if (!scheduleJobId) {
      toast.error('Select a job before creating the schedule')
      return
    }

    createSchedule.mutate({
      ...scheduleForm,
      jobId: scheduleJobId,
      examDate: new Date(scheduleForm.examDate).toISOString(),
      reportingTime: formatTimeForDisplay(scheduleForm.reportingTime),
      gateClosingTime: formatTimeForDisplay(scheduleForm.gateClosingTime) || undefined,
      examStartTime: formatTimeForDisplay(scheduleForm.examStartTime),
      examEndTime: formatTimeForDisplay(scheduleForm.examEndTime) || undefined,
      provisionalNote: scheduleForm.provisionalNote.trim() || undefined,
      selectedCenterIds: scheduleForm.selectedCenterIds,
      papers,
      instructions,
    })
  }

  const runAction = (type) => {
    if (!activeScheduleId) return toast.error('Select an exam schedule first')
    if (type === 'publish' && selectedSchedule?.status === 'published') {
      toast('Already published')
      return
    }
    if (type === 'unpublish' && !window.confirm('Unpublish released admit cards for this schedule?')) return
    if (type === 'regenerate' && !window.confirm('Regenerate admit cards for this schedule? Published cards will be unpublished first.')) return
    actionMutation.mutate({ type, id: activeScheduleId })
  }

  const printAttendanceCenter = () => {
    if (!activeScheduleId) {
      toast.error('Select an exam schedule first')
      return
    }
    if (!selectedAttendanceCenterId) {
      toast.error('Select a center to print attendance')
      return
    }
    window.open(
      adminService.getCenterAttendanceSheetPdfUrl(activeScheduleId, selectedAttendanceCenterId),
      '_blank',
      'noopener,noreferrer',
    )
  }

  const previewAttendanceCenter = () => {
    if (!activeScheduleId) {
      toast.error('Select an exam schedule first')
      return
    }
    if (!selectedAttendanceCenterId) {
      toast.error('Select a center to preview attendance')
      return
    }
    setPreviewAttendance({
      scheduleId: activeScheduleId,
      centerId: selectedAttendanceCenterId,
      center: selectedAttendanceCenter,
    })
  }

  const queueBulkJob = (type) => {
    if (!activeScheduleId) {
      toast.error('Select an exam schedule first')
      return
    }
    bulkMutation.mutate({ type, id: activeScheduleId, centerId: selectedAttendanceCenterId || undefined })
  }

  useEffect(() => {
    if (bulkJob?.status !== 'completed') return
    queryClient.invalidateQueries({ queryKey: ['exam-schedules'] })
    queryClient.invalidateQueries({ queryKey: ['exam-schedule-stats', activeScheduleId] })
    queryClient.invalidateQueries({ queryKey: ['schedule-admit-cards', activeScheduleId] })
  }, [activeScheduleId, bulkJob?.status, queryClient])

  const updatePaper = (index, key, value) => {
    setScheduleForm((prev) => ({
      ...prev,
      papers: prev.papers.map((paper, paperIndex) => (
        paperIndex === index ? { ...paper, [key]: value } : paper
      )),
    }))
  }

  const addPaper = () => {
    setScheduleForm((prev) => ({
      ...prev,
      papers: [...prev.papers, { ...emptyPaper, order: prev.papers.length + 1 }],
    }))
  }

  const removePaper = (index) => {
    setScheduleForm((prev) => ({
      ...prev,
      papers: prev.papers.length === 1
        ? [{ ...emptyPaper }]
        : prev.papers.filter((_, paperIndex) => paperIndex !== index).map((paper, paperIndex) => ({
          ...paper,
          order: paperIndex + 1,
        })),
    }))
  }

  const updateInstruction = (index, value) => {
    setScheduleForm((prev) => ({
      ...prev,
      instructions: prev.instructions.map((instruction, instructionIndex) => (
        instructionIndex === index ? { ...instruction, text: value } : instruction
      )),
    }))
  }

  const addInstruction = () => {
    setScheduleForm((prev) => ({
      ...prev,
      instructions: [...prev.instructions, { ...emptyInstruction, order: prev.instructions.length + 1 }],
    }))
  }

  const removeInstruction = (index) => {
    setScheduleForm((prev) => ({
      ...prev,
      instructions: prev.instructions.length === 1
        ? [{ ...emptyInstruction }]
        : prev.instructions.filter((_, instructionIndex) => instructionIndex !== index).map((instruction, instructionIndex) => ({
          ...instruction,
          order: instructionIndex + 1,
        })),
    }))
  }

  return (
    <AdminLayout title="Admit Cards">
      <div className="min-h-full p-5 pt-6 md:p-6 md:pt-7 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admit Cards</h1>
            <p className="text-sm text-gray-500 mt-1">
              {projectId
                ? 'Configure admit-card template, centers, schedules, and release window for this project.'
                : 'Manage exam centers, schedules, allocation, generation, and publication.'}
            </p>
          </div>
          <Button
            onClick={() => runAction('publish')}
            disabled={!activeScheduleId || actionMutation.isPending}
            className="bg-orange-600 hover:bg-orange-700 text-white"
          >
            {actionMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Publish Cards
          </Button>
        </div>

        {projectId && (
          <ProjectFlowNav
            project={admitWorkflowProject}
            current={focus === 'centers' ? 'centers' : 'admit-format'}
            workflowScope="job"
            publishComplete={Boolean(
              selectedJob?._id &&
                String(selectedJob.status || '').toLowerCase() === 'active' &&
                project?.isPublished,
            )}
            jobId={selectedJob?._id}
            contextLabel="Current Job"
            contextValue={selectedJob
              ? `${selectedJob.title}${selectedJob.postCode ? ` (${selectedJob.postCode})` : ''}`
              : 'No job selected'}
          />
        )}

        {projectId && (
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-orange-600">
                    Job Context
                  </p>
                  <h2 className="mt-1 text-lg font-bold text-gray-900">
                    Select the job this admit-card setup should follow
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Centers, schedules, admit-card generation, and publication stay scoped to the selected job.
                  </p>
                </div>
                <div className="w-full lg:w-[420px]">
                  <CustomSelect
                    value={selectedJob?._id || ''}
                    onChange={handleJobChange}
                    placeholder={jobOptions.length ? 'Select a job' : 'No jobs available'}
                    options={jobOptions}
                    disabled={jobOptions.length === 0}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat icon={Building2} label="Centers" value={selectedScheduleCenterCount || centers.length} />
          <Stat icon={Users} label="Eligible" value={stats.eligibleCandidates} />
          <Stat icon={CheckCircle2} label="Allocated" value={stats.allocatedCandidates} />
          <Stat icon={FileBadge} label="Capacity" value={selectedScheduleCapacity || stats.totalCapacity} />
        </div>

        <Card>
          <CardContent>
            <div className="grid gap-3 lg:grid-cols-[1.1fr_repeat(4,minmax(0,1fr))]">
              <div className="flex items-center gap-3 rounded-lg border border-orange-100 bg-orange-50/60 px-4 py-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-orange-600">
                  <FileBadge className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Production Admit-Card Health</p>
                  <p className="mt-0.5 text-xs leading-5 text-gray-500">
                    On-demand allocation uses maximum available center capacity first.
                  </p>
                </div>
              </div>
              {opsCards.map(({ label, value, icon: Icon }) => (
                <div key={label} className="rounded-lg border border-gray-200 bg-white px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">{label}</p>
                    <Icon className="h-4 w-4 text-orange-600" />
                  </div>
                  <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {selectedSchedule?.status === 'published' && (
          <div className="flex items-start gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" />
            <div>
              <p className="font-semibold">Published admit-card schedules are locked.</p>
              <p className="mt-0.5 text-orange-800">
                Unpublish before changing date, timing, centers, rooms, or instructions; then allocate, generate, and publish again.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(380px,440px)_minmax(0,1fr)] xl:items-stretch">
          <div className="space-y-5">
            <Card>
              <CardHeader>
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-orange-600" /> Add Center
                </h2>
              </CardHeader>
              <CardContent>
                <form onSubmit={submitCenter} className="space-y-3">
                  {[
                    ['centerCode', 'Center Code'],
                    ['name', 'Center Name'],
                    ['addressLine1', 'Address'],
                    ['city', 'City'],
                    ['district', 'District'],
                    ['state', 'State'],
                    ['pincode', 'PIN Code'],
                  ].map(([key, label]) => (
                    <input
                      key={key}
                      value={centerForm[key]}
                      onChange={(e) => setCenterForm({ ...centerForm, [key]: e.target.value })}
                      placeholder={label}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                      required={['centerCode', 'name', 'addressLine1', 'city', 'district', 'state', 'pincode'].includes(key)}
                    />
                  ))}
                  <Button type="submit" disabled={createCenter.isPending} className="w-full bg-orange-600 hover:bg-orange-700 text-white">
                    {createCenter.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Save Center
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-orange-600" /> Add Room / Capacity
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Room capacity drives seats. No rooms means no seats.
                </p>
              </CardHeader>
              <CardContent>
                <form onSubmit={submitRoom} className="space-y-3">
                  <CustomSelect
                    value={roomForm.centerId}
                    onChange={(centerId) => setRoomForm({ ...roomForm, centerId })}
                    placeholder="Select center"
                    options={activeCenters.map((center) => ({
                      value: center._id,
                      label: `${center.centerCode} - ${center.name} (${center.totalCapacity || 0} seats)`,
                    }))}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={roomForm.roomCode}
                      onChange={(e) => setRoomForm({ ...roomForm, roomCode: e.target.value })}
                      placeholder="Room Code"
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                      required
                    />
                    <input
                      value={roomForm.roomName}
                      onChange={(e) => setRoomForm({ ...roomForm, roomName: e.target.value })}
                      placeholder="Room Name"
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                      required
                    />
                    <input
                      value={roomForm.block}
                      onChange={(e) => setRoomForm({ ...roomForm, block: e.target.value })}
                      placeholder="Block"
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                    <input
                      value={roomForm.floor}
                      onChange={(e) => setRoomForm({ ...roomForm, floor: e.target.value })}
                      placeholder="Floor"
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                    <input
                      type="number"
                      min="1"
                      value={roomForm.capacity}
                      onChange={(e) => setRoomForm({ ...roomForm, capacity: e.target.value, usableCapacity: e.target.value })}
                      placeholder="Capacity"
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                      required
                    />
                    <input
                      type="number"
                      min="1"
                      value={roomForm.usableCapacity}
                      onChange={(e) => setRoomForm({ ...roomForm, usableCapacity: e.target.value })}
                      placeholder="Usable Seats"
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                      required
                    />
                  </div>
                  <input
                    value={roomForm.seatPrefix}
                    onChange={(e) => setRoomForm({ ...roomForm, seatPrefix: e.target.value })}
                    placeholder="Seat Prefix (optional, defaults to room code)"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                  <Button type="submit" disabled={createRoom.isPending || activeCenters.length === 0} className="w-full bg-orange-600 hover:bg-orange-700 text-white">
                    {createRoom.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Save Room
                  </Button>
                  {activeCenters.length === 0 && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      Add an active center before adding rooms.
                    </p>
                  )}
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <CalendarClock className="w-4 h-4 text-orange-600" /> Create Schedule
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  You can create multiple schedules for the same job. Keep the exam time window separate for each one.
                </p>
              </CardHeader>
              <CardContent>
                <form onSubmit={submitSchedule} className="space-y-3">
                  <label className="block">
                    <span className="text-xs font-semibold text-gray-600">Job</span>
                    <CustomSelect
                      value={scheduleForm.jobId}
                      onChange={(jobId) => {
                        const job = jobs.find((item) => item._id === jobId)
                        setScheduleForm({
                          ...scheduleForm,
                          jobId,
                          examName: jobId === selectedJob?._id ? scheduleForm.examName : job?.title || scheduleForm.examName,
                          examCode: jobId === selectedJob?._id ? scheduleForm.examCode : job?.postCode || scheduleForm.examCode,
                          advertisementNo: jobId === selectedJob?._id ? scheduleForm.advertisementNo : job?.postCode || scheduleForm.advertisementNo,
                        })
                      }}
                      placeholder="Select job"
                      className="mt-1"
                      options={jobs.map((job) => ({
                        value: job._id,
                        label: `${job.title} (${job.postCode})`,
                      }))}
                    />
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-xs font-semibold text-gray-600">Exam Name</span>
                      <input value={scheduleForm.examName} onChange={(e) => setScheduleForm({ ...scheduleForm, examName: e.target.value })} placeholder="e.g. SSC Physics Prof." className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" required />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold text-gray-600">Exam Code</span>
                      <input value={scheduleForm.examCode} onChange={(e) => setScheduleForm({ ...scheduleForm, examCode: e.target.value })} placeholder="Unique code" className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm uppercase focus:outline-none focus:ring-2 focus:ring-orange-500" required />
                    </label>
                  </div>

                  <label className="block">
                    <span className="text-xs font-semibold text-gray-600">Advertisement / Exam Reference</span>
                    <input value={scheduleForm.advertisementNo} onChange={(e) => setScheduleForm({ ...scheduleForm, advertisementNo: e.target.value })} placeholder="Official reference printed above admit card title" className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                  </label>

                  <label className="block">
                    <span className="text-xs font-semibold text-gray-600">Shift Name</span>
                    <input value={scheduleForm.shiftName} onChange={(e) => setScheduleForm({ ...scheduleForm, shiftName: e.target.value })} placeholder="e.g. Shift 1 / Morning" className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                  </label>

                  <label className="block">
                    <span className="text-xs font-semibold text-gray-600">Exam Date</span>
                    <AppDatePicker
                      value={scheduleForm.examDate}
                      onChange={(examDate) => setScheduleForm({ ...scheduleForm, examDate })}
                      placeholder="Select exam date"
                      className="mt-1"
                    />
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-xs font-semibold text-gray-600">Reporting Time</span>
                      <TimeSelect
                        value={toTimeInputValue(scheduleForm.reportingTime)}
                        onChange={(reportingTime) => setScheduleForm({ ...scheduleForm, reportingTime })}
                        placeholder="Select reporting time"
                        className="mt-1"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold text-gray-600">Gate Closing Time</span>
                      <TimeSelect
                        value={toTimeInputValue(scheduleForm.gateClosingTime)}
                        onChange={(gateClosingTime) => setScheduleForm({ ...scheduleForm, gateClosingTime })}
                        placeholder="Select gate close time"
                        className="mt-1"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold text-gray-600">Exam Start Time</span>
                      <TimeSelect
                        value={toTimeInputValue(scheduleForm.examStartTime)}
                        onChange={(examStartTime) => setScheduleForm({ ...scheduleForm, examStartTime })}
                        placeholder="Select start time"
                        className="mt-1"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold text-gray-600">Exam End Time</span>
                      <TimeSelect
                        value={toTimeInputValue(scheduleForm.examEndTime)}
                        onChange={(examEndTime) => setScheduleForm({ ...scheduleForm, examEndTime })}
                        placeholder="Select end time"
                        className="mt-1"
                      />
                    </label>
                  </div>

                  <div className="rounded-xl border border-gray-200 bg-white p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900">Centers For This Exam</p>
                        <p className="text-xs text-gray-500">Allocation will use only selected centers and active rooms.</p>
                      </div>
                      <span className="shrink-0 whitespace-nowrap rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
                        {selectedCapacity} seats
                      </span>
                    </div>
                    <div className="mt-3 hover-scroll max-h-44 space-y-2 overflow-y-auto pr-1">
                      {activeCenters.map((center) => (
                        <label
                          key={center._id}
                          className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm transition ${
                            selectedCenterIds.includes(center._id)
                              ? 'border-orange-300 bg-orange-50'
                              : 'border-gray-200 bg-white hover:border-orange-200'
                          }`}
                        >
                          <span className="min-w-0">
                            <span className="block font-semibold text-gray-900">{center.centerCode} - {center.name}</span>
                            <span className="block truncate text-xs text-gray-500">{center.district}, {center.state}</span>
                          </span>
                          <span className="flex shrink-0 items-center gap-2">
                            <span className="text-xs font-semibold text-gray-500">{center.totalCapacity || 0}</span>
                            <input
                              type="checkbox"
                              checked={selectedCenterIds.includes(center._id)}
                              onChange={() => toggleScheduleCenter(center._id)}
                              className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                            />
                          </span>
                        </label>
                      ))}
                      {activeCenters.length === 0 && (
                        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                          Add centers and rooms before creating a schedule.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="border border-gray-200 rounded-xl p-3 space-y-3 bg-white">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900">Examination Papers</p>
                        <p className="text-xs text-gray-500">These rows print in the Examination Details table.</p>
                      </div>
                      <Button type="button" variant="outline" onClick={addPaper} className="h-9 shrink-0 px-3 text-xs">
                        <Plus className="w-3.5 h-3.5 mr-1" /> Add
                      </Button>
                    </div>
                    {scheduleForm.papers.map((paper, index) => (
                      <div key={index} className="rounded-lg border border-gray-200 bg-gray-50 p-2 space-y-2">
                        <input
                          value={paper.name}
                          onChange={(e) => updatePaper(index, 'name', e.target.value)}
                          placeholder="Paper name"
                          className="h-10 w-full px-3 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                          required
                        />
                        <div className="grid grid-cols-[minmax(0,1fr)_40px] gap-2">
                          <input
                            type="number"
                            min="1"
                            value={paper.numberOfQuestions}
                            onChange={(e) => updatePaper(index, 'numberOfQuestions', e.target.value)}
                            placeholder="Questions"
                            className="h-10 w-full px-3 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => removePaper(index)}
                            className="h-10 w-10 rounded-lg border border-gray-200 bg-white text-gray-500 hover:text-red-600 hover:border-red-200 flex items-center justify-center"
                            aria-label="Remove paper"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <label className="block">
                    <span className="text-xs font-semibold text-gray-600">Provisional Note</span>
                    <textarea
                      value={scheduleForm.provisionalNote}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, provisionalNote: e.target.value })}
                      placeholder="Official provisional note printed before instructions"
                      rows={3}
                      className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                      required
                    />
                  </label>

                  <div className="border border-gray-200 rounded-xl p-3 space-y-3 bg-white">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900">Candidate Instructions</p>
                        <p className="text-xs text-gray-500">Add final instructions exactly as they should appear on page 2.</p>
                      </div>
                      <Button type="button" variant="outline" onClick={addInstruction} className="h-9 shrink-0 px-3 text-xs">
                        <Plus className="w-3.5 h-3.5 mr-1" /> Add
                      </Button>
                    </div>
                    {scheduleForm.instructions.map((instruction, index) => (
                      <div key={index} className="rounded-lg border border-gray-200 bg-gray-50 p-2 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="h-8 min-w-8 px-2 rounded-lg bg-white border border-gray-200 text-xs font-bold text-gray-500 flex items-center justify-center">
                            {index + 1}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeInstruction(index)}
                            className="h-8 w-8 rounded-lg border border-gray-200 bg-white text-gray-500 hover:text-red-600 hover:border-red-200 flex items-center justify-center"
                            aria-label="Remove instruction"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <textarea
                          value={instruction.text}
                          onChange={(e) => updateInstruction(index, e.target.value)}
                          placeholder="Instruction text"
                          rows={2}
                          className="min-h-[72px] w-full resize-y px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                          required
                        />
                      </div>
                    ))}
                  </div>

                  <Button type="submit" disabled={createSchedule.isPending} className="w-full bg-gray-900 hover:bg-gray-800 text-white">
                    {createSchedule.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Create Schedule
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          <div className="grid min-w-0 content-stretch gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.65fr)] xl:grid-rows-[auto_auto_minmax(520px,1fr)]">
            <Card className="self-start xl:col-span-2">
              <CardHeader>
                <h2 className="font-semibold text-gray-900">Selected Exam Lifecycle</h2>
              </CardHeader>
              <CardContent>
                {selectedSchedule ? (
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
                    <div className="min-h-[112px] rounded-xl border border-gray-200 bg-gray-50 p-4">
                      <p className="text-xs font-semibold uppercase text-gray-500">Exam</p>
                      <p className="mt-1 font-bold text-gray-900">{selectedSchedule.examName}</p>
                      <p className="text-xs text-gray-500">{selectedSchedule.shiftName || 'No shift'} - {selectedSchedule.examCode}</p>
                    </div>
                    <div className="min-h-[112px] rounded-xl border border-gray-200 bg-gray-50 p-4">
                      <p className="text-xs font-semibold uppercase text-gray-500">Date & Time</p>
                      <p className="mt-1 font-bold text-gray-900">{new Date(selectedSchedule.examDate).toLocaleDateString('en-IN')}</p>
                      <p className="text-xs text-gray-500">{formatTimeForDisplay(selectedSchedule.examStartTime)} to {formatTimeForDisplay(selectedSchedule.examEndTime) || 'end not set'}</p>
                    </div>
                    <div className="min-h-[112px] rounded-xl border border-gray-200 bg-gray-50 p-4">
                      <p className="text-xs font-semibold uppercase text-gray-500">Selected Centers</p>
                      <p className="mt-1 font-bold text-gray-900">{selectedScheduleCenterCount}</p>
                      <p className="text-xs text-gray-500">{selectedScheduleCapacity} usable seats</p>
                    </div>
                    <div className="min-h-[112px] rounded-xl border border-gray-200 bg-gray-50 p-4">
                      <p className="text-xs font-semibold uppercase text-gray-500">Current Phase</p>
                      <p className="mt-1 font-bold capitalize text-gray-900">{selectedSchedule.status}</p>
                      <p className="text-xs text-gray-500">
                        {selectedSchedule.status === 'draft' && 'Publish after centers and rooms are ready'}
                        {selectedSchedule.status === 'allocated' && 'Bulk allocation exists; publish when ready'}
                        {selectedSchedule.status === 'locked' && 'List locked; publish when ready'}
                        {selectedSchedule.status === 'published' && 'On-demand admit cards are live'}
                        {selectedSchedule.status === 'cancelled' && 'No candidate action'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Create or select a schedule to view lifecycle details.</p>
                )}
              </CardContent>
            </Card>

            <Card className="flex min-h-[500px] min-w-0 flex-col overflow-hidden">
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-semibold text-gray-900">Exam Schedules</h2>
                  {schedulesLoading && <Loader2 className="w-4 h-4 animate-spin text-orange-600" />}
                </div>
              </CardHeader>
              <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="hover-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-1">
                  <table className="w-full table-fixed text-sm">
                    <colgroup>
                      <col className="w-[38%]" />
                      <col className="w-[17%]" />
                      <col className="w-[21%]" />
                      <col className="w-[24%]" />
                    </colgroup>
                    <thead className="sticky top-0 z-10 bg-gray-50 text-gray-500">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-normal">Exam</th>
                        <th className="text-center px-3 py-2 text-xs font-semibold uppercase tracking-normal">Date</th>
                        <th className="text-center px-3 py-2 text-xs font-semibold uppercase tracking-normal">Status</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold uppercase tracking-normal">Select</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedJobSchedules.map((schedule) => (
                        <tr key={schedule._id} className="border-t border-gray-100">
                          <td className="min-w-0 px-3 py-3 align-middle">
                            <p className="truncate font-semibold text-gray-900" title={schedule.examName}>{schedule.examName}</p>
                            <p className="truncate text-xs text-gray-500" title={schedule.examCode}>{schedule.examCode}</p>
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-center align-middle">{new Date(schedule.examDate).toLocaleDateString('en-IN')}</td>
                          <td className="px-3 py-3 text-center align-middle">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusTone[schedule.status] || statusTone.draft}`}>
                              {schedule.status}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-right align-middle">
                            <button
                              onClick={() => setSelectedScheduleId(schedule._id)}
                              className={`whitespace-nowrap px-2.5 py-1.5 rounded-lg text-xs font-semibold border ${
                                activeScheduleId === schedule._id
                                  ? 'bg-orange-600 text-white border-orange-600'
                                  : 'text-gray-600 border-gray-200 hover:border-orange-300'
                              }`}
                            >
                              Manage
                            </button>
                          </td>
                        </tr>
                      ))}
                      {!schedulesLoading && selectedJobSchedules.length === 0 && (
                        <tr>
                          <td colSpan="4" className="px-3 py-10 text-center text-gray-500">
                            {selectedJob
                              ? `No exam schedules for ${selectedJob.title || 'this job'} yet.`
                              : projectId
                                ? 'No exam schedules for this project yet.'
                                : 'No exam schedules yet.'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card className="flex min-h-[500px] min-w-0 flex-col">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-gray-900">Allocation & Publication</h2>
                    <p className="mt-1 text-xs text-gray-500">Run this sequence after eligible applications are ready.</p>
                  </div>
                  {selectedSchedule && (
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone[selectedSchedule.status] || statusTone.draft}`}>
                      {selectedSchedule.status}
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-7">
                <div className="space-y-4">
                  {allocationSteps.map((step, index) => {
                    const Icon = step.icon
                    return (
                      <button
                        key={step.type}
                        type="button"
                        disabled={!activeScheduleId || actionMutation.isPending || (step.type === 'publish' && selectedSchedule?.status === 'published')}
                        onClick={() => runAction(step.type)}
                        className={`group flex w-full items-center gap-4 rounded-xl border px-4 py-3 text-left transition ${
                          step.primary
                            ? selectedSchedule?.status === 'published'
                              ? 'border-green-200 bg-green-50 text-green-700'
                              : 'border-orange-600 bg-orange-600 text-white shadow-lg shadow-orange-100 hover:bg-orange-700'
                            : 'border-gray-200 bg-white text-gray-900 hover:border-orange-300 hover:bg-orange-50'
                        } disabled:cursor-not-allowed disabled:opacity-60`}
                      >
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                          step.primary
                            ? selectedSchedule?.status === 'published'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-white/20 text-white'
                            : 'bg-orange-50 text-orange-700'
                        }`}>
                          {index + 1}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2 text-sm font-semibold">
                            <Icon className="h-4 w-4" />
                            {step.type === 'publish' && selectedSchedule?.status === 'published'
                              ? 'Window Published'
                              : step.label}
                          </span>
                          <span className={`mt-1 block text-xs ${
                            step.primary
                              ? selectedSchedule?.status === 'published'
                                ? 'text-green-700'
                                : 'text-orange-50'
                              : 'text-gray-500'
                          }`}>
                            {step.type === 'publish' && selectedSchedule?.status === 'published'
                              ? 'Candidates can generate admit cards on demand now.'
                              : step.helper}
                          </span>
                        </span>
                      </button>
                    )
                  })}
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <Button variant="outline" disabled={!activeScheduleId || actionMutation.isPending || selectedSchedule?.status !== 'published'} onClick={() => runAction('unpublish')} className="h-10 justify-start px-3">
                    Unpublish
                  </Button>
                  <Button variant="outline" disabled={!activeScheduleId || actionMutation.isPending || !['locked', 'published'].includes(selectedSchedule?.status)} onClick={() => runAction('regenerate')} className="h-10 justify-start px-3">
                    Regenerate
                  </Button>
                </div>
                {activeScheduleId && (
                  <div className="mt-auto rounded-xl border border-gray-200 bg-gray-50 p-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-gray-900">Attendance Print</p>
                        <span className="text-xs font-semibold text-gray-500">{selectedScheduleCenterCount} centers</span>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      <CustomSelect
                        value={selectedAttendanceCenterId}
                        onChange={setSelectedAttendanceCenterId}
                        placeholder="Select center"
                        options={managedCenters.map((center) => ({
                          value: center._id,
                          label: `${center.centerCode} - ${center.name}`,
                        }))}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={!activeScheduleId || !selectedAttendanceCenterId}
                          onClick={previewAttendanceCenter}
                          className="h-10 justify-start px-3 text-xs"
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          Preview
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={!activeScheduleId || !selectedAttendanceCenterId}
                          onClick={printAttendanceCenter}
                          className="h-10 justify-start px-3 text-xs"
                        >
                          <Download className="mr-2 h-4 w-4" />
                          PDF
                        </Button>
                      </div>
                    </div>
                    {selectedAttendanceCenter && (
                      <p className="mt-2 truncate text-xs text-gray-500">
                        {selectedAttendanceCenter.name}, {selectedAttendanceCenter.city}
                      </p>
                    )}
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!activeScheduleId || bulkMutation.isPending}
                        onClick={() => queueBulkJob('admit_zip')}
                        className="h-10 justify-start px-3 text-xs"
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Admit ZIP
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!activeScheduleId || bulkMutation.isPending}
                        onClick={() => queueBulkJob('attendance_zip')}
                        className="h-10 justify-start px-3 text-xs"
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Attendance ZIP
                      </Button>
                    </div>
                    {bulkJob && (
                      <div className={`mt-3 rounded-lg border p-3 ${
                        bulkJob.status === 'failed'
                          ? 'border-red-100 bg-red-50/40'
                          : bulkJob.status === 'completed'
                            ? 'border-green-100 bg-green-50/40'
                            : 'border-gray-200 bg-white'
                      }`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-gray-900">
                              {bulkJob.type?.replaceAll('_', ' ')}
                            </p>
                            <p className={`text-xs ${
                              bulkJob.status === 'failed'
                                ? 'text-red-700'
                                : bulkJob.status === 'completed'
                                  ? 'text-green-700'
                                  : 'text-gray-500'
                            }`}>
                              {bulkProgress.message || bulkJob.status}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                              bulkJob.status === 'completed'
                                ? 'bg-green-100 text-green-700'
                                : bulkJob.status === 'failed'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-blue-50 text-blue-700'
                            }`}>
                              {bulkJob.status}
                            </span>
                            <button
                              type="button"
                              onClick={() => setActiveBulkJobId('')}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-white hover:text-gray-700"
                              aria-label="Close bulk job status"
                              title="Close"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
                          <div className={`h-full rounded-full transition-all ${bulkProgressBarClass}`} style={{ width: `${bulkProgressPercent}%` }} />
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-3 text-xs text-gray-500">
                          <span>{bulkProgressProcessed}/{bulkProgressTotal}</span>
                          {bulkJob.status === 'failed' ? (
                            <span className="font-semibold text-red-600">
                              {bulkProgressFailed > 0 ? `${bulkProgressFailed} failed` : 'failed'}
                            </span>
                          ) : bulkProgressFailed > 0 ? (
                            <span className="font-semibold text-red-600">{bulkProgressFailed} failed</span>
                          ) : null}
                        </div>
                        <div className="mt-3 flex gap-2">
                          {bulkJob.status === 'completed' && (
                            <a
                              href={adminService.getBulkExamJobDownloadUrl(bulkJob._id)}
                              className="inline-flex h-9 flex-1 items-center justify-center rounded-lg bg-orange-600 px-3 text-xs font-semibold text-white hover:bg-orange-700"
                            >
                              Download ZIP
                            </a>
                          )}
                          {bulkJob.status === 'failed' && (
                            <Button
                              type="button"
                              variant="outline"
                              disabled={bulkMutation.isPending}
                              onClick={() => bulkMutation.mutate({ type: 'retry', id: bulkJob._id })}
                              className="h-9 flex-1 px-3 text-xs"
                            >
                              Retry Job
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="flex min-h-[520px] min-w-0 flex-col overflow-hidden xl:col-span-2">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="font-semibold text-gray-900">Generated Admit Cards</h2>
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search roll no."
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm sm:w-56"
                  />
                </div>
              </CardHeader>
              <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="hover-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-1">
                  <table className="w-full table-fixed text-sm">
                    <tbody>
                      {admitCards.map((card) => (
                        <tr key={card._id} className="border-t border-gray-100">
                          <td className="px-3 py-3 align-middle">
                            <p className="font-semibold text-gray-900">{card.rollNumber}</p>
                            <p className="truncate text-xs text-gray-500">{card.applicationId?.applicationId}</p>
                          </td>
                          <td className="w-[120px] px-3 py-3 text-center align-middle">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${card.status === 'published' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                              {card.status}
                            </span>
                          </td>
                          <td className="w-[230px] px-3 py-3 text-right align-middle">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setPreviewAdmitCard(card)}
                                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:border-orange-300 hover:text-orange-700"
                              >
                                <Eye className="h-3.5 w-3.5" /> Preview
                              </button>
                              <a
                                href={adminService.getAdminAdmitCardPdfUrl(card._id)}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:border-orange-300 hover:text-orange-700 text-xs font-semibold"
                              >
                                <Download className="w-3.5 h-3.5" /> PDF
                              </a>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {admitCards.length === 0 && (
                        <tr><td className="px-3 py-10 text-center text-gray-500">No admit cards generated for this schedule yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {centersLoading && <p className="text-xs text-gray-400">Loading centers...</p>}
      </div>

        {previewAdmitCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm">
          <div className="flex max-h-[94vh] w-full max-w-[980px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-white/20">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-600">
                  Admit Card Preview
                </p>
                <h2 className="truncate text-sm font-semibold text-slate-900">
                  Roll {previewAdmitCard.rollNumber} Â· {previewAdmitCard.applicationId?.applicationId || 'Application'}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewAdmitCard(null)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                  aria-label="Close admit card preview"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="overflow-auto bg-slate-100 p-4">
              <div className="mx-auto h-[78vh] max-h-[760px] min-h-[520px] w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <DocumentPreviewFrame
                  title={`Admit card ${previewAdmitCard.rollNumber}`}
                  src={adminService.getAdminAdmitCardHtmlUrl(previewAdmitCard._id)}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {previewAttendance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm">
          <div className="flex max-h-[94vh] w-full max-w-[980px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-white/20">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-600">
                  Attendance Sheet Preview
                </p>
                <h2 className="truncate text-sm font-semibold text-slate-900">
                  {previewAttendance.center?.centerCode || 'Center'} Â· {previewAttendance.center?.name || 'Attendance Sheet'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setPreviewAttendance(null)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                aria-label="Close attendance sheet preview"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-auto bg-slate-100 p-4">
              <div className="mx-auto h-[78vh] max-h-[760px] min-h-[520px] w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <DocumentPreviewFrame
                  title={`Attendance sheet ${previewAttendance.center?.centerCode || ''}`}
                  src={adminService.getCenterAttendanceSheetHtmlUrl(previewAttendance.scheduleId, previewAttendance.centerId)}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}

export default AdmitCards

