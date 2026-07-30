import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  Building2, CalendarClock, CheckCircle2, Download, FileBadge,
  Eye, Loader2, Lock, Play, Plus, Search, Send, Trash2, Users,
  X,
} from 'lucide-react'
import AdminLayout from '../../components/layouts/AdminLayout'
import { Card, CardContent, CardHeader } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import DocumentPreviewFrame from '../../components/common/DocumentPreviewFrame'
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
      <p className="text-3xl font-bold text-gray-900">{value ?? 0}</p>
    </div>
  </div>
)

const AdmitCards = () => {
  const queryClient = useQueryClient()
  const [centerForm, setCenterForm] = useState(emptyCenter)
  const [roomForm, setRoomForm] = useState(emptyRoom)
  const [scheduleForm, setScheduleForm] = useState(emptySchedule)
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

  const { data: jobsData } = useQuery({
    queryKey: ['admin-jobs-for-exams'],
    queryFn: () => adminService.getAdminJobs({ limit: 100 }),
  })

  const { data: schedules = [], isLoading: schedulesLoading } = useQuery({
    queryKey: ['exam-schedules'],
    queryFn: () => adminService.getExamSchedules({ limit: 100 }),
  })

  const selectedSchedule = useMemo(
    () => schedules.find((item) => item._id === selectedScheduleId) || schedules[0],
    [schedules, selectedScheduleId],
  )

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
        publish: 'Admit cards published',
        unpublish: 'Admit cards unpublished',
        regenerate: 'Admit cards regenerated',
      }
      toast.success(messages[vars.type])
      queryClient.invalidateQueries({ queryKey: ['exam-schedules'] })
      queryClient.invalidateQueries({ queryKey: ['exam-schedule-stats', vars.id] })
      queryClient.invalidateQueries({ queryKey: ['schedule-admit-cards', vars.id] })
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

  const jobs = jobsData?.jobs || jobsData || []
  const stats = statsData?.stats || {}
  const activeCenters = centers.filter((center) => center.active !== false)
  const selectedCenterIds = scheduleForm.selectedCenterIds || []
  const selectedCenters = activeCenters.filter((center) => selectedCenterIds.includes(center._id))
  const selectedCapacity = selectedCenters.reduce((sum, center) => sum + (Number(center.totalCapacity) || 0), 0)
  const selectedScheduleCenterIds = selectedSchedule?.selectedCenterIds?.map((id) => String(id?._id || id)) || []
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
    { type: 'preview', label: 'Preview', helper: 'Check eligible candidates and capacity.', icon: Search },
    { type: 'allocate', label: 'Allocate', helper: 'Assign roll numbers, centers, and rooms.', icon: Play },
    { type: 'lock', label: 'Lock', helper: 'Freeze allocation before card generation.', icon: Lock },
    { type: 'generate', label: 'Generate', helper: 'Create admit cards from locked allocation.', icon: FileBadge },
    { type: 'publish', label: 'Publish', helper: 'Release admit cards to candidates.', icon: Send, primary: true },
  ]

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

    createSchedule.mutate({
      ...scheduleForm,
      examDate: new Date(scheduleForm.examDate).toISOString(),
      gateClosingTime: scheduleForm.gateClosingTime || undefined,
      examEndTime: scheduleForm.examEndTime || undefined,
      provisionalNote: scheduleForm.provisionalNote.trim() || undefined,
      selectedCenterIds: scheduleForm.selectedCenterIds,
      papers,
      instructions,
    })
  }

  const runAction = (type) => {
    if (!activeScheduleId) return toast.error('Select an exam schedule first')
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
              Manage exam centers, schedules, allocation, generation, and publication.
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat icon={Building2} label="Centers" value={centers.length} />
          <Stat icon={Users} label="Eligible" value={stats.eligibleCandidates} />
          <Stat icon={CheckCircle2} label="Allocated" value={stats.allocatedCandidates} />
          <Stat icon={FileBadge} label="Capacity" value={stats.totalCapacity} />
        </div>

        <div className="grid grid-cols-1 items-stretch gap-5 xl:grid-cols-[minmax(380px,440px)_minmax(0,1fr)]">
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
                  Allocation uses active room capacity. A center without rooms has zero seats.
                </p>
              </CardHeader>
              <CardContent>
                <form onSubmit={submitRoom} className="space-y-3">
                  <select
                    value={roomForm.centerId}
                    onChange={(e) => setRoomForm({ ...roomForm, centerId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                    required
                  >
                    <option value="">Select center</option>
                    {activeCenters.map((center) => (
                      <option key={center._id} value={center._id}>
                        {center.centerCode} - {center.name} ({center.totalCapacity || 0} seats)
                      </option>
                    ))}
                  </select>
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
              </CardHeader>
              <CardContent>
                <form onSubmit={submitSchedule} className="space-y-3">
                  <label className="block">
                    <span className="text-xs font-semibold text-gray-600">Job</span>
                    <select
                      value={scheduleForm.jobId}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, jobId: e.target.value })}
                      className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                      required
                    >
                      <option value="">Select job</option>
                      {jobs.map((job) => (
                        <option key={job._id} value={job._id}>{job.title} ({job.postCode})</option>
                      ))}
                    </select>
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
                    <input type="date" value={scheduleForm.examDate} onChange={(e) => setScheduleForm({ ...scheduleForm, examDate: e.target.value })} className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" required />
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-xs font-semibold text-gray-600">Reporting Time</span>
                      <input value={scheduleForm.reportingTime} onChange={(e) => setScheduleForm({ ...scheduleForm, reportingTime: e.target.value })} placeholder="e.g. 07:00 AM" className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" required />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold text-gray-600">Gate Closing Time</span>
                      <input value={scheduleForm.gateClosingTime} onChange={(e) => setScheduleForm({ ...scheduleForm, gateClosingTime: e.target.value })} placeholder="e.g. 08:30 AM" className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" required />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold text-gray-600">Exam Start Time</span>
                      <input value={scheduleForm.examStartTime} onChange={(e) => setScheduleForm({ ...scheduleForm, examStartTime: e.target.value })} placeholder="e.g. 09:00 AM" className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" required />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold text-gray-600">Exam End Time</span>
                      <input value={scheduleForm.examEndTime} onChange={(e) => setScheduleForm({ ...scheduleForm, examEndTime: e.target.value })} placeholder="e.g. 12:00 PM" className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
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

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2 xl:grid-rows-[minmax(250px,auto)_minmax(340px,0.9fr)_minmax(280px,0.9fr)]">
            <Card className="min-h-[250px] xl:col-span-2">
              <CardHeader>
                <h2 className="font-semibold text-gray-900">Selected Exam Lifecycle</h2>
              </CardHeader>
              <CardContent>
                {selectedSchedule ? (
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
                    <div className="min-h-[136px] rounded-xl border border-gray-200 bg-gray-50 p-5">
                      <p className="text-xs font-semibold uppercase text-gray-500">Exam</p>
                      <p className="mt-1 font-bold text-gray-900">{selectedSchedule.examName}</p>
                      <p className="text-xs text-gray-500">{selectedSchedule.shiftName || 'No shift'} - {selectedSchedule.examCode}</p>
                    </div>
                    <div className="min-h-[136px] rounded-xl border border-gray-200 bg-gray-50 p-5">
                      <p className="text-xs font-semibold uppercase text-gray-500">Date & Time</p>
                      <p className="mt-1 font-bold text-gray-900">{new Date(selectedSchedule.examDate).toLocaleDateString('en-IN')}</p>
                      <p className="text-xs text-gray-500">{selectedSchedule.examStartTime} to {selectedSchedule.examEndTime || 'end not set'}</p>
                    </div>
                    <div className="min-h-[136px] rounded-xl border border-gray-200 bg-gray-50 p-5">
                      <p className="text-xs font-semibold uppercase text-gray-500">Selected Centers</p>
                      <p className="mt-1 font-bold text-gray-900">{managedCenters.length}</p>
                      <p className="text-xs text-gray-500">{managedCenters.reduce((sum, center) => sum + (Number(center.totalCapacity) || 0), 0)} usable seats</p>
                    </div>
                    <div className="min-h-[136px] rounded-xl border border-gray-200 bg-gray-50 p-5">
                      <p className="text-xs font-semibold uppercase text-gray-500">Current Phase</p>
                      <p className="mt-1 font-bold capitalize text-gray-900">{selectedSchedule.status}</p>
                      <p className="text-xs text-gray-500">
                        {selectedSchedule.status === 'draft' && 'Preview and allocate next'}
                        {selectedSchedule.status === 'allocated' && 'Lock allocation next'}
                        {selectedSchedule.status === 'locked' && 'Generate and publish next'}
                        {selectedSchedule.status === 'published' && 'Visible after release date'}
                        {selectedSchedule.status === 'cancelled' && 'No candidate action'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Create or select a schedule to view lifecycle details.</p>
                )}
              </CardContent>
            </Card>

            <Card className="flex min-h-[340px] flex-col xl:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-semibold text-gray-900">Exam Schedules</h2>
                  {schedulesLoading && <Loader2 className="w-4 h-4 animate-spin text-orange-600" />}
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden">
                <div className="hover-scroll max-h-[305px] overflow-auto pr-1">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-gray-50 text-gray-500">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-normal">Exam</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-normal">Date</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-normal">Status</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold uppercase tracking-normal">Select</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schedules.map((schedule) => (
                        <tr key={schedule._id} className="border-t border-gray-100">
                          <td className="px-3 py-3">
                            <p className="font-semibold text-gray-900">{schedule.examName}</p>
                            <p className="text-xs text-gray-500">{schedule.examCode}</p>
                          </td>
                          <td className="px-3 py-3">{new Date(schedule.examDate).toLocaleDateString('en-IN')}</td>
                          <td className="px-3 py-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusTone[schedule.status] || statusTone.draft}`}>
                              {schedule.status}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-right">
                            <button
                              onClick={() => setSelectedScheduleId(schedule._id)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
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
                      {!schedulesLoading && schedules.length === 0 && (
                        <tr><td colSpan="4" className="px-3 py-10 text-center text-gray-500">No exam schedules yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card className="flex min-h-[500px] flex-col">
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
                        disabled={!activeScheduleId || actionMutation.isPending}
                        onClick={() => runAction(step.type)}
                        className={`group flex w-full items-center gap-4 rounded-xl border px-4 py-3 text-left transition ${
                          step.primary
                            ? 'border-orange-600 bg-orange-600 text-white shadow-lg shadow-orange-100 hover:bg-orange-700'
                            : 'border-gray-200 bg-white text-gray-900 hover:border-orange-300 hover:bg-orange-50'
                        } disabled:cursor-not-allowed disabled:opacity-60`}
                      >
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                          step.primary ? 'bg-white/20 text-white' : 'bg-orange-50 text-orange-700'
                        }`}>
                          {index + 1}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2 text-sm font-semibold">
                            <Icon className="h-4 w-4" />
                            {step.label}
                          </span>
                          <span className={`mt-1 block text-xs ${step.primary ? 'text-orange-50' : 'text-gray-500'}`}>
                            {step.helper}
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
                      <span className="text-xs font-semibold text-gray-500">{managedCenters.length} centers</span>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      <select
                        value={selectedAttendanceCenterId}
                        onChange={(event) => setSelectedAttendanceCenterId(event.target.value)}
                        className="h-10 min-w-0 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                      >
                        <option value="">Select center</option>
                        {managedCenters.map((center) => (
                          <option key={center._id} value={center._id}>
                            {center.centerCode} - {center.name}
                          </option>
                        ))}
                      </select>
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

            <Card className="flex min-h-[280px] flex-col">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="font-semibold text-gray-900">Generated Admit Cards</h2>
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search roll no."
                    className="w-44 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden">
                <div className="hover-scroll max-h-[340px] overflow-auto pr-1">
                  <table className="w-full text-sm">
                    <tbody>
                      {admitCards.map((card) => (
                        <tr key={card._id} className="border-t border-gray-100">
                          <td className="px-3 py-3">
                            <p className="font-semibold text-gray-900">{card.rollNumber}</p>
                            <p className="text-xs text-gray-500">{card.applicationId?.applicationId}</p>
                          </td>
                          <td className="px-3 py-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${card.status === 'published' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                              {card.status}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-right">
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
                  Roll {previewAdmitCard.rollNumber} · {previewAdmitCard.applicationId?.applicationId || 'Application'}
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
                  {previewAttendance.center?.centerCode || 'Center'} · {previewAttendance.center?.name || 'Attendance Sheet'}
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





