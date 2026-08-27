import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  Download,
  FileUp,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import AdminLayout from '../../components/layouts/AdminLayout'
import { Card, CardContent, CardHeader } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import { adminService } from '../../services/admin.service'

const emptyCenter = {
  centerCode: '',
  name: '',
  addressLine1: '',
  addressLine2: '',
  landmark: '',
  city: '',
  district: '',
  state: '',
  pincode: '',
  contactName: '',
  contactPhone: '',
  contactEmail: '',
  active: true,
}

const createRoom = () => ({
  _id: '',
  roomCode: '',
  roomName: '',
  block: '',
  floor: '',
  capacity: '',
  usableCapacity: '',
  seatPrefix: '',
  active: true,
  wheelchairAccess: false,
  groundFloor: false,
})

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message ||
  error?.response?.data?.error ||
  error?.response?.data?.errors?.[0]?.message ||
  error?.message ||
  fallback

const toDisplayCase = (value = '') =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\b[a-z]/g, (char) => char.toUpperCase())

const pickPostalCity = (postOffices = []) => {
  const office =
    postOffices.find((item) => item.Block && item.Block !== 'NA') ||
    postOffices.find((item) => item.Name) ||
    postOffices[0]

  return office?.Block && office.Block !== 'NA'
    ? office.Block
    : office?.Name || office?.District || ''
}

const requiredCenterFields = [
  ['centerCode', 'Center code'],
  ['name', 'Center name'],
  ['addressLine1', 'Address line 1'],
  ['city', 'City'],
  ['district', 'District'],
  ['state', 'State'],
  ['pincode', 'Pincode'],
]

export default function CenterWizard() {
  const navigate = useNavigate()
  const { id: centerId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const isEditMode = Boolean(centerId)
  const initialMode = !isEditMode && searchParams.get('mode') === 'upload' ? 'upload' : 'manual'
  const returnTo = searchParams.get('returnTo')
  const backPath = returnTo || '/admin/centers'
  const [mode, setMode] = useState(initialMode)
  const [center, setCenter] = useState(emptyCenter)
  const [rooms, setRooms] = useState([createRoom()])
  const [file, setFile] = useState(null)
  const [result, setResult] = useState(null)
  const [pincodeStatus, setPincodeStatus] = useState('')
  const [formErrors, setFormErrors] = useState({})

  const totalCapacity = useMemo(
    () => rooms.reduce((sum, room) => sum + Number(room.usableCapacity || room.capacity || 0), 0),
    [rooms],
  )

  const { data: centerData, isLoading: isLoadingCenter } = useQuery({
    queryKey: ['admin-exam-center', centerId],
    queryFn: () => adminService.getExamCenter(centerId),
    enabled: isEditMode,
  })

  useEffect(() => {
    if (!isEditMode || !centerData) return
    const savedCenter = centerData.center || centerData.data?.center || centerData
    const savedRooms = centerData.rooms || centerData.data?.rooms || []

    setCenter({
      centerCode: savedCenter.centerCode || '',
      name: savedCenter.name || '',
      addressLine1: savedCenter.addressLine1 || '',
      addressLine2: savedCenter.addressLine2 || '',
      landmark: savedCenter.landmark || '',
      city: savedCenter.city || '',
      district: savedCenter.district || '',
      state: savedCenter.state || '',
      pincode: savedCenter.pincode || '',
      contactName: savedCenter.contact?.name || '',
      contactPhone: savedCenter.contact?.phone || '',
      contactEmail: savedCenter.contact?.email || '',
      active: savedCenter.active !== false,
    })
    setRooms(
      savedRooms.length > 0
        ? savedRooms.map((room) => ({
            _id: room._id || '',
            roomCode: room.roomCode || '',
            roomName: room.roomName || '',
            block: room.block || '',
            floor: room.floor || '',
            capacity: room.capacity || '',
            usableCapacity: room.usableCapacity || '',
            seatPrefix: room.seatPrefix || '',
            active: room.active !== false,
            wheelchairAccess: Boolean(room.accessibility?.wheelchairAccess),
            groundFloor: Boolean(room.accessibility?.groundFloor),
          }))
        : [createRoom()],
    )
  }, [centerData, isEditMode])

  useEffect(() => {
    const pincode = String(center.pincode || '').replace(/\D/g, '').slice(0, 6)
    if (pincode !== center.pincode) {
      setCenter((prev) => ({ ...prev, pincode }))
      return
    }

    if (pincode.length !== 6) {
      setPincodeStatus('')
      return
    }

    const controller = new AbortController()
    setPincodeStatus('Fetching location...')

    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`, {
          signal: controller.signal,
        })
        const payload = await response.json()
        const result = payload?.[0]

        if (result?.Status !== 'Success' || !result?.PostOffice?.length) {
          setPincodeStatus('No location found for this pincode')
          return
        }

        const postOffices = result.PostOffice
        const primary = postOffices[0]
        setCenter((prev) => ({
          ...prev,
          city: toDisplayCase(pickPostalCity(postOffices)),
          district: toDisplayCase(primary?.District || ''),
          state: toDisplayCase(primary?.State || ''),
        }))
        setPincodeStatus('Location filled from pincode')
      } catch (error) {
        if (error.name !== 'AbortError') {
          setPincodeStatus('Unable to fetch location')
        }
      }
    }, 450)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [center.pincode])

  const setModeAndUrl = (nextMode) => {
    if (isEditMode) return
    setMode(nextMode)
    const nextParams = new URLSearchParams()
    if (nextMode === 'upload') nextParams.set('mode', 'upload')
    if (returnTo) nextParams.set('returnTo', returnTo)
    setSearchParams(nextParams)
  }

  const updateCenter = (field, value) => {
    setCenter((prev) => ({ ...prev, [field]: value }))
    setFormErrors((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  const updateRoom = (index, field, value) => {
    setRooms((prev) =>
      prev.map((room, roomIndex) =>
        roomIndex === index ? { ...room, [field]: value } : room,
      ),
    )
    setFormErrors((prev) => {
      const key = `rooms.${index}.${field}`
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const addRoom = () => setRooms((prev) => [...prev, createRoom()])

  const removeRoom = (index) => {
    if (rooms.length === 1) {
      toast.error('At least one room is required')
      return
    }
    if (isEditMode && rooms[index]?._id) {
      setRooms((prev) =>
        prev.map((room, roomIndex) =>
          roomIndex === index ? { ...room, active: false } : room,
        ),
      )
      toast.success('Room marked inactive. Save changes to apply.')
      return
    }
    setRooms((prev) => prev.filter((_, roomIndex) => roomIndex !== index))
  }

  const validateManualForm = () => {
    const errors = {}

    requiredCenterFields.forEach(([field, label]) => {
      if (!String(center[field] || '').trim()) {
        errors[field] = `${label} is required`
      }
    })

    if (center.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(center.contactEmail)) {
      errors.contactEmail = 'Enter a valid contact email'
    }

    if (center.pincode && !/^\d{4,12}$/.test(center.pincode)) {
      errors.pincode = 'Enter a valid pincode'
    }

    const roomCodes = new Set()
    for (const [index, room] of rooms.entries()) {
      const roomCode = String(room.roomCode || '').trim().toUpperCase()
      const capacity = Number(room.capacity)
      const usableCapacity = room.usableCapacity ? Number(room.usableCapacity) : capacity

      if (!roomCode) {
        errors[`rooms.${index}.roomCode`] = 'Room code is required'
      }
      if (!String(room.roomName || '').trim()) {
        errors[`rooms.${index}.roomName`] = 'Room name is required'
      }
      if (!Number.isFinite(capacity) || capacity < 1) {
        errors[`rooms.${index}.capacity`] = 'Enter capacity greater than 0'
      }
      if (room.usableCapacity && (!Number.isFinite(usableCapacity) || usableCapacity < 1)) {
        errors[`rooms.${index}.usableCapacity`] = 'Enter usable capacity greater than 0'
      }
      if (Number.isFinite(capacity) && Number.isFinite(usableCapacity) && usableCapacity > capacity) {
        errors[`rooms.${index}.usableCapacity`] = 'Usable capacity cannot exceed capacity'
      }
      if (roomCode && roomCodes.has(roomCode)) {
        errors[`rooms.${index}.roomCode`] = 'Duplicate room code in this center'
      }
      if (roomCode) roomCodes.add(roomCode)
    }

    setFormErrors(errors)
    if (Object.keys(errors).length > 0) {
      toast.error('Please fix the highlighted fields')
      return false
    }
    return true
  }

  const manualMutation = useMutation({
    mutationFn: async (payload) => {
      if (!isEditMode) return adminService.createCenterWithRooms(payload)

      await adminService.updateExamCenter(centerId, payload.centerDetails)
      await Promise.all(
        payload.rooms.map((room) => {
          const roomPayload = { ...room }
          const roomId = roomPayload._id
          delete roomPayload._id
          return roomId
            ? adminService.updateExamRoom(roomId, roomPayload)
            : adminService.createExamRoom(centerId, roomPayload)
        }),
      )
      return adminService.getExamCenter(centerId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-exam-centers'] })
      queryClient.invalidateQueries({ queryKey: ['admin-exam-center', centerId] })
      queryClient.invalidateQueries({ queryKey: ['exam-centers'] })
      toast.success(isEditMode ? 'Exam center updated' : 'Exam center and rooms saved')
      navigate(backPath)
    },
    onError: (error) => {
      const message = getErrorMessage(error, 'Failed to save exam center')
      setFormErrors({ form: message })
      toast.error(message)
    },
  })

  const uploadMutation = useMutation({
    mutationFn: (formData) => adminService.bulkUploadCenters(formData),
    onSuccess: (res) => {
      setResult(res.summary || res)
      queryClient.invalidateQueries({ queryKey: ['admin-exam-centers'] })
      queryClient.invalidateQueries({ queryKey: ['exam-centers'] })
      toast.success('File processed successfully')
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Failed to upload centers'))
    },
  })

  const handleManualSubmit = () => {
    if (!validateManualForm()) return

    manualMutation.mutate({
      centerDetails: {
        centerCode: center.centerCode.trim().toUpperCase(),
        name: center.name.trim(),
        addressLine1: center.addressLine1.trim(),
        addressLine2: center.addressLine2.trim(),
        landmark: center.landmark.trim(),
        city: center.city.trim(),
        district: center.district.trim(),
        state: center.state.trim(),
        pincode: center.pincode.trim(),
        contact: {
          name: center.contactName.trim(),
          phone: center.contactPhone.trim(),
          email: center.contactEmail.trim(),
        },
        active: Boolean(center.active),
      },
      rooms: rooms.map((room) => {
        const payload = {
          roomCode: room.roomCode.trim().toUpperCase(),
          roomName: room.roomName.trim(),
          block: room.block.trim(),
          floor: room.floor.trim(),
          capacity: Number(room.capacity),
          usableCapacity: room.usableCapacity ? Number(room.usableCapacity) : Number(room.capacity),
          seatPrefix: room.seatPrefix.trim(),
          active: Boolean(room.active),
          accessibility: {
            wheelchairAccess: Boolean(room.wheelchairAccess),
            groundFloor: Boolean(room.groundFloor),
          },
        }

        if (room._id) payload._id = room._id
        return payload
      }),
    })
  }

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      if (!selectedFile.name.match(/\.(xlsx|csv)$/i)) {
        toast.error('Only .xlsx or .csv files are supported')
        e.target.value = ''
        return
      }
      setFile(selectedFile)
      setResult(null)
    }
  }

  const handleUpload = () => {
    if (!file) {
      toast.error('Please select a file first')
      return
    }
    const formData = new FormData()
    formData.append('file', file)
    uploadMutation.mutate(formData)
  }

  const handleDownloadTemplate = () => {
    window.open(adminService.getCenterBulkTemplateUrl(), '_blank')
  }

  return (
    <AdminLayout title={isEditMode ? 'Edit Exam Center' : 'Add Exam Centers'}>
      <div className="min-h-full bg-[#f7f4ee] p-5 space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-600">Admin Panel</p>
            <h1 className="mt-1 text-2xl font-bold text-gray-950">
              {isEditMode ? 'Edit Exam Center' : mode === 'manual' ? 'Add Exam Center' : 'Bulk Upload Centers'}
            </h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">
              {isEditMode
                ? 'Update center details, active status, rooms, and usable seating capacity.'
                : mode === 'manual'
                ? 'Create one center with rooms and usable seating capacity for exam allocation.'
                : 'Import center and room inventory with the official template.'}
            </p>
          </div>
          <button
            onClick={() => navigate(backPath)}
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-gray-200 bg-white px-5 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {returnTo ? 'Back to Admit Setup' : 'Back to Centers'}
          </button>
        </div>

        {returnTo && (
          <Card className="border-orange-100 bg-orange-50/60">
            <CardContent className="py-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-orange-600">Project Lifecycle Context</p>
              <p className="mt-1 text-sm text-orange-900">
                Save the center inventory here, then return to the selected admit-card schedule to choose centers for that job.
              </p>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
          <Card>
            <CardHeader className="border-b border-gray-100 pb-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle>{isEditMode ? 'Update Exam Center' : mode === 'manual' ? 'Create Exam Center' : 'Bulk Upload Centers'}</CardTitle>
                  <CardDescription>
                    {isEditMode
                      ? 'Changes apply to future allocations. Existing allocation records stay intact.'
                      : mode === 'manual'
                      ? 'Add the master center details and at least one active room.'
                      : 'Upload centers and rooms in the same admin format.'}
                  </CardDescription>
                </div>
                {!isEditMode && <div className="inline-flex rounded-xl border border-gray-200 bg-gray-50 p-1">
                  <button
                    type="button"
                    onClick={() => setModeAndUrl('manual')}
                    className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                      mode === 'manual' ? 'bg-orange-600 text-white shadow-sm' : 'text-gray-600 hover:text-orange-600'
                    }`}
                  >
                    Manual
                  </button>
                  <button
                    type="button"
                    onClick={() => setModeAndUrl('upload')}
                    className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                      mode === 'upload' ? 'bg-orange-600 text-white shadow-sm' : 'text-gray-600 hover:text-orange-600'
                    }`}
                  >
                    Upload
                  </button>
                </div>}
              </div>
            </CardHeader>

            {isLoadingCenter ? (
              <CardContent>
                <div className="flex items-center justify-center py-12 text-sm font-semibold text-gray-500">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin text-orange-500" />
                  Loading center...
                </div>
              </CardContent>
            ) : mode === 'manual' ? (
              <CardContent className="space-y-6">
                {formErrors.form && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                    {formErrors.form}
                  </div>
                )}

                <section className="space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="h-10 w-10 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center">
                      <Building2 className="w-5 h-5" />
                    </span>
                    <div>
                      <h3 className="text-lg font-bold text-gray-950">Center Details</h3>
                      <p className="text-sm text-gray-500">Use the same center code that appears on allocation records.</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label="Center Code *" value={center.centerCode} onChange={(value) => updateCenter('centerCode', value)} placeholder="e.g. RNC-001" error={formErrors.centerCode} />
                    <Input label="Center Name *" value={center.name} onChange={(value) => updateCenter('name', value)} placeholder="e.g. Ranchi Central Exam Center" error={formErrors.name} />
                    <Input className="md:col-span-2" label="Address Line 1 *" value={center.addressLine1} onChange={(value) => updateCenter('addressLine1', value)} placeholder="Building, road, area" error={formErrors.addressLine1} />
                    <Input label="Address Line 2" value={center.addressLine2} onChange={(value) => updateCenter('addressLine2', value)} placeholder="Optional address detail" />
                    <Input label="Landmark" value={center.landmark} onChange={(value) => updateCenter('landmark', value)} placeholder="Nearby landmark" />
                    <Input label="City *" value={center.city} onChange={(value) => updateCenter('city', value)} placeholder="City" error={formErrors.city} />
                    <Input label="District *" value={center.district} onChange={(value) => updateCenter('district', value)} placeholder="District" error={formErrors.district} />
                    <Input label="State *" value={center.state} onChange={(value) => updateCenter('state', value)} placeholder="State" error={formErrors.state} />
                    <Input
                      label="Pincode *"
                      value={center.pincode}
                      onChange={(value) => updateCenter('pincode', value)}
                      placeholder="834001"
                      helperText={pincodeStatus}
                      error={formErrors.pincode}
                    />
                  </div>
                  <label className="inline-flex items-center gap-2 rounded-2xl border border-orange-100 bg-orange-50 px-4 py-3 text-sm font-semibold text-orange-900">
                    <input
                      type="checkbox"
                      checked={center.active}
                      onChange={(event) => updateCenter('active', event.target.checked)}
                      className="h-4 w-4 accent-orange-600"
                    />
                    Center active for allocation
                  </label>
                </section>

                <section className="space-y-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-950">Center Contact</h3>
                    <p className="text-sm text-gray-500">Shown internally for operational coordination.</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Input label="Contact Name" value={center.contactName} onChange={(value) => updateCenter('contactName', value)} placeholder="Coordinator name" />
                    <Input label="Contact Phone" value={center.contactPhone} onChange={(value) => updateCenter('contactPhone', value)} placeholder="10-digit mobile" />
                    <Input label="Contact Email" value={center.contactEmail} onChange={(value) => updateCenter('contactEmail', value)} placeholder="email@example.com" error={formErrors.contactEmail} />
                  </div>
                </section>

                <section className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-gray-950">Rooms & Capacity</h3>
                      <p className="text-sm text-gray-500">Seat allocation uses active room usable capacity.</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addRoom}
                      className="h-11 rounded-2xl bg-white px-5"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Room
                    </Button>
                  </div>

                  <div className="space-y-4">
                    {rooms.map((room, index) => (
                      <div key={index} className="rounded-2xl border border-orange-100 bg-orange-50/30 p-4">
                        <div className="flex items-center justify-between gap-3 mb-4">
                          <p className="text-xs font-bold uppercase tracking-[0.14em] text-orange-700">Room {index + 1}</p>
                          <button
                            type="button"
                            onClick={() => removeRoom(index)}
                            disabled={rooms.length === 1}
                            className="h-9 w-9 inline-flex items-center justify-center rounded-xl text-red-500 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                            aria-label={`Remove room ${index + 1}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <Input label="Room Code *" value={room.roomCode} onChange={(value) => updateRoom(index, 'roomCode', value)} placeholder="R-01" error={formErrors[`rooms.${index}.roomCode`]} />
                          <Input label="Room Name *" value={room.roomName} onChange={(value) => updateRoom(index, 'roomName', value)} placeholder="Room 1" error={formErrors[`rooms.${index}.roomName`]} />
                          <Input label="Block" value={room.block} onChange={(value) => updateRoom(index, 'block', value)} placeholder="A" />
                          <Input label="Floor" value={room.floor} onChange={(value) => updateRoom(index, 'floor', value)} placeholder="Ground" />
                          <Input type="number" label="Capacity *" value={room.capacity} onChange={(value) => updateRoom(index, 'capacity', value)} placeholder="50" error={formErrors[`rooms.${index}.capacity`]} />
                          <Input type="number" label="Usable Capacity" value={room.usableCapacity} onChange={(value) => updateRoom(index, 'usableCapacity', value)} placeholder="Same as capacity" error={formErrors[`rooms.${index}.usableCapacity`]} />
                          <Input label="Seat Prefix" value={room.seatPrefix} onChange={(value) => updateRoom(index, 'seatPrefix', value)} placeholder="A" />
                          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-orange-100 bg-white/70 px-4 py-3 md:col-span-4">
                            <label className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700">
                              <input
                                type="checkbox"
                                checked={room.active}
                                onChange={(e) => updateRoom(index, 'active', e.target.checked)}
                                className="h-4 w-4 accent-orange-600"
                              />
                              Active
                            </label>
                            <label className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700">
                              <input
                                type="checkbox"
                                checked={room.wheelchairAccess}
                                onChange={(e) => updateRoom(index, 'wheelchairAccess', e.target.checked)}
                                className="h-4 w-4 accent-orange-600"
                              />
                              Wheelchair
                            </label>
                            <label className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700">
                              <input
                                type="checkbox"
                                checked={room.groundFloor}
                                onChange={(e) => updateRoom(index, 'groundFloor', e.target.checked)}
                                className="h-4 w-4 accent-orange-600"
                              />
                              Ground
                            </label>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-t border-gray-100 pt-5">
                  <div className="rounded-2xl bg-orange-50 px-4 py-3 text-sm text-orange-900">
                    <span className="font-bold">{rooms.length}</span> rooms configured - <span className="font-bold">{totalCapacity}</span> usable seats
                  </div>
                  <Button onClick={handleManualSubmit} disabled={manualMutation.isPending}>
                    {manualMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        {isEditMode ? 'Update Center' : 'Save Center'}
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            ) : (
              <CardContent className="space-y-6">
                <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="font-bold text-orange-900 text-sm">Download Template</h4>
                    <p className="text-sm text-orange-700 mt-1">Use the required Excel format with sample center and room data.</p>
                  </div>
                  <Button onClick={handleDownloadTemplate} variant="outline" className="shrink-0 bg-white">
                    <Download className="w-4 h-4 mr-2" />
                    Download .xlsx
                  </Button>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-gray-900 text-sm">Upload Completed File</h4>
                    <p className="text-sm text-gray-500 mt-1">Supported formats: .xlsx and .csv</p>
                    <input
                      type="file"
                      accept=".xlsx,.csv"
                      id="center-upload"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                    <div className="mt-3 flex items-center gap-3 min-w-0">
                      <label
                        htmlFor="center-upload"
                        className="cursor-pointer inline-flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-semibold rounded-xl text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
                      >
                        Choose File
                      </label>
                      <span className="text-sm text-gray-600 truncate">
                        {file ? file.name : 'No file chosen'}
                      </span>
                    </div>
                  </div>
                  <Button
                    onClick={handleUpload}
                    disabled={!file || uploadMutation.isPending}
                    className="shrink-0"
                  >
                    {uploadMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <FileUp className="w-4 h-4 mr-2" />
                        Process File
                      </>
                    )}
                  </Button>
                </div>

                {result && (
                  <div className={`rounded-2xl p-4 border ${result.errors?.length > 0 && result.createdCenters === 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                    <div className="flex items-start">
                      {result.errors?.length > 0 && result.createdCenters === 0 ? (
                        <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 mr-3 shrink-0" />
                      ) : (
                        <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 mr-3 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className={`text-sm font-bold ${result.errors?.length > 0 && result.createdCenters === 0 ? 'text-red-900' : 'text-green-900'}`}>
                          Processing Complete
                        </h4>
                        <div className="mt-2 text-sm text-gray-600 grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <p>Total Rows: <span className="font-bold text-gray-900">{result.totalRows || 0}</span></p>
                          <p>Centers Created: <span className="font-bold text-gray-900">{result.createdCenters || 0}</span></p>
                          <p>Rooms Created: <span className="font-bold text-gray-900">{result.createdRooms || 0}</span></p>
                        </div>
                        {result.errors && result.errors.length > 0 && (
                          <div className="mt-3">
                            <p className="text-sm font-bold text-red-800 mb-1">Issues Encountered</p>
                            <ul className="list-disc pl-5 text-xs text-red-700 space-y-1 max-h-32 overflow-y-auto">
                              {result.errors.map((err, i) => (
                                <li key={i}>{err}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Production Checks</CardTitle>
              <CardDescription>These rules keep allocation clean for every job schedule.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                'Use unique center and room codes.',
                'Usable capacity must not exceed room capacity.',
                'Inactive centers are excluded from allocation.',
                returnTo ? 'After saving, return to the admit-card setup and select centers for the schedule.' : 'Bulk upload updates existing centers and adds missing rooms.',
              ].map((item) => (
                <div key={item} className="flex gap-3 text-sm text-gray-700">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  )
}

function Input({ label, value, onChange, placeholder, type = 'text', className = '', helperText = '', error = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-sm font-semibold text-gray-900 mb-2">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={`w-full rounded-xl border bg-white px-4 py-3 text-sm text-gray-950 outline-none transition ${
          error
            ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100'
            : 'border-gray-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-100'
        }`}
      />
      {(error || helperText) && (
        <span className={`mt-1.5 block text-xs font-medium ${error ? 'text-red-600' : 'text-gray-500'}`}>
          {error || helperText}
        </span>
      )}
    </label>
  )
}

function CardTitle({ children }) {
  return <h2 className="text-xl font-extrabold text-gray-950">{children}</h2>
}

function CardDescription({ children }) {
  return <p className="mt-1 text-sm leading-6 text-gray-500">{children}</p>
}
