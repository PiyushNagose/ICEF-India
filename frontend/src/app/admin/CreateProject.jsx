import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'

import {
  FileText,
  Calendar,
  Plus,
  Loader2,
  Sparkles,
} from 'lucide-react'

import AdminLayout from '../../components/layouts/AdminLayout'
import {
  Card,
  CardContent,
  CardHeader,
} from '../../components/ui/Card'

import Button from '../../components/ui/Button'
import CustomSelect from '../../components/ui/CustomSelect'
import AppDatePicker from '../../components/ui/AppDatePicker'
import { adminService } from '../../services/admin.service'

const STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
]

const PROJECT_STATUSES = [
  'Upcoming',
  'Active',
  'Completed',
  'Cancelled',
]

const toDateInput = (value) => {
  if (!value) return ''
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const CreateProject = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isEditMode = Boolean(id)

  const [formData, setFormData] = useState({
    name: '',
    state: 'Bihar',
    department: '',
    description: '',
    status: 'Upcoming',
    startDate: '',
    endDate: '',
  })

  const [errors, setErrors] = useState({})

  const { data: projectData, isLoading: isProjectLoading } = useQuery({
    queryKey: ['admin-project', id],
    queryFn: () => adminService.getProject(id),
    enabled: isEditMode,
  })

  const project = projectData?.project || projectData

  useEffect(() => {
    if (!project) return

    setFormData({
      name: project.name || '',
      state: project.state || 'Bihar',
      department: project.department || '',
      description: project.description || '',
      status: project.status || 'Upcoming',
      startDate: toDateInput(project.startDate),
      endDate: toDateInput(project.endDate || project.closureDate),
    })
  }, [project])

  const { mutate: createProject, isPending: isCreating } =
    useMutation({
      mutationFn: adminService.createProject,

      onSuccess: () => {
        toast.success('Project created successfully')

        queryClient.invalidateQueries({
          queryKey: ['admin-projects'],
        })

        navigate('/admin/projects')
      },

      onError: (err) => {
        toast.error(
          err.message || 'Failed to create project'
        )
      },
    })

  const { mutate: updateProject, isPending: isUpdating } =
    useMutation({
      mutationFn: (payload) => adminService.updateProject(id, payload),

      onSuccess: () => {
        toast.success('Project updated successfully')

        queryClient.invalidateQueries({
          queryKey: ['admin-projects'],
        })

        queryClient.invalidateQueries({
          queryKey: ['admin-project-stats'],
        })

        queryClient.invalidateQueries({
          queryKey: ['admin-project', id],
        })

        navigate('/admin/projects')
      },

      onError: (err) => {
        toast.error(
          err.message || 'Failed to update project'
        )
      },
    })

  const handleChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))

    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: '',
      }))
    }
  }

  const validate = () => {
    const newErrors = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Project name is required'
    }

    if (!formData.department.trim()) {
      newErrors.department =
        'Department is required'
    }

    if (
      formData.startDate &&
      formData.endDate &&
      formData.endDate < formData.startDate
    ) {
      newErrors.endDate =
        'Project closure date must be after start date'
    }

    setErrors(newErrors)

    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = () => {
    if (!validate()) return

    const payload = {
      ...formData,
    }

    if (!isEditMode) {
      delete payload.status
      createProject(payload)
      return
    }

    updateProject(payload)
  }

  const isPending = isCreating || isUpdating

  return (
    <AdminLayout title={isEditMode ? 'Edit Project' : 'Create Project'}>
      <div className="min-h-full bg-[#f7f4ee] p-5">

        {/* HEADER */}
        <div className="mb-6">

          <p className="text-xs font-bold tracking-normal text-orange-500 mb-2">
            {isEditMode ? 'PROJECT EDIT' : 'PROJECT CREATION'}
          </p>

          <h1 className="text-2xl font-bold text-gray-900">
            {isEditMode ? 'Edit Project' : 'Create Project'}
          </h1>

          <p className="text-sm text-gray-500 mt-1">
            {isEditMode
              ? 'Update recruitment cycle details, timeline, and current status.'
              : 'Set up a new recruitment drive or administrative project.'}
          </p>
        </div>

        {isEditMode && isProjectLoading ? (
          <div className="
            min-h-[420px]
            flex items-center justify-center
            rounded-[24px]
            bg-white
            border border-gray-200
            shadow-sm
          ">
            <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
          </div>
        ) : (

        <div className="grid grid-cols-1 items-stretch xl:grid-cols-3 gap-5">

          {/* MAIN */}
          <div className="xl:col-span-2 space-y-5">

            {/* BASIC INFO */}
            <Card className="
              rounded-[24px]
              bg-white
              border border-gray-200
              shadow-sm
            ">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="
                    w-10 h-10 rounded-2xl
                    bg-orange-100
                    flex items-center justify-center
                  ">
                    <FileText className="w-5 h-5 text-orange-600" />
                  </div>

                  <div>
                    <h3 className="font-bold text-gray-900">
                      Basic Information
                    </h3>

                    <p className="text-xs text-gray-500">
                      Project details & department info
                    </p>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-5">

                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-2">
                    Project Name
                  </label>

                  <input
                    type="text"
                    placeholder="e.g Bihar Police Recruitment 2026"
                    value={formData.name}
                    onChange={(e) =>
                      handleChange(
                        'name',
                        e.target.value
                      )
                    }
                    className="
                      w-full h-12 px-4
                      rounded-2xl
                      border border-gray-200
                      bg-gray-50
                      focus:outline-none
                      focus:ring-2
                      focus:ring-orange-500
                    "
                  />

                  {errors.name && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.name}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  <div>
                    <label className="text-sm font-semibold text-gray-700 block mb-2">
                      State
                    </label>

                    <CustomSelect
                      value={formData.state}
                      onChange={(val) => handleChange('state', val)}
                      options={STATES}
                      placeholder="Select State"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-gray-700 block mb-2">
                      Department
                    </label>

                    <input
                      type="text"
                      placeholder="e.g Home Affairs"
                      value={formData.department}
                      onChange={(e) =>
                        handleChange(
                          'department',
                          e.target.value
                        )
                      }
                      className="
                        w-full h-12 px-4
                        rounded-2xl
                        border border-gray-200
                        bg-gray-50
                        focus:outline-none
                        focus:ring-2
                        focus:ring-orange-500
                      "
                    />

                    {errors.department && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors.department}
                      </p>
                    )}
                  </div>

                </div>

                {isEditMode && (
                  <div>
                    <label className="text-sm font-semibold text-gray-700 block mb-2">
                      Status
                    </label>

                    <CustomSelect
                      value={formData.status}
                      onChange={(val) => handleChange('status', val)}
                      options={PROJECT_STATUSES}
                      placeholder="Select Status"
                    />
                  </div>
                )}

                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-2">
                    Description
                  </label>

                  <textarea
                    rows="5"
                    placeholder="Describe the purpose and scope of this project..."
                    value={formData.description}
                    onChange={(e) =>
                      handleChange(
                        'description',
                        e.target.value
                      )
                    }
                    className="
                      w-full px-4 py-4
                      rounded-2xl
                      border border-gray-200
                      bg-gray-50
                      resize-none
                      focus:outline-none
                      focus:ring-2
                      focus:ring-orange-500
                    "
                  />
                </div>

              </CardContent>
            </Card>

            {/* ACTIONS */}
            <div className="flex items-center justify-between">

              <Button
                variant="outline"
                onClick={() =>
                  navigate('/admin/projects')
                }
                className="
                  rounded-2xl h-11 px-6
                "
              >
                Cancel
              </Button>

              <Button
                onClick={handleSubmit}
                disabled={isPending}
                className="
                  bg-orange-600 hover:bg-orange-700
                  text-white rounded-2xl
                  h-11 px-6
                  shadow-lg shadow-orange-200
                "
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {isEditMode ? 'Saving...' : 'Creating...'}
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    {isEditMode ? 'Save Changes' : 'Create Project'}
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* SIDEBAR */}
          <div className="space-y-5">

            {/* TIMELINE */}
            <Card className="
              rounded-[24px]
              bg-white
              border border-gray-200
              shadow-sm
            ">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-orange-600" />

                  <h3 className="font-bold text-gray-900">
                    Timeline
                  </h3>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">

                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-2">
                    Start Date
                  </label>

                  <AppDatePicker
                    value={formData.startDate}
                    onChange={(val) => handleChange('startDate', val)}
                    placeholder="Select start date"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-2">
                    Project Closure Date
                  </label>

                  <AppDatePicker
                    value={formData.endDate}
                    onChange={(val) => handleChange('endDate', val)}
                    placeholder="Select closure date after result"
                    minDate={formData.startDate ? new Date(formData.startDate) : undefined}
                  />
                  {errors.endDate && (
                    <p className="text-red-500 text-xs mt-1">{errors.endDate}</p>
                  )}
                </div>

              </CardContent>
            </Card>

            {/* INFO CARD */}
            <div className="
              rounded-[24px]
              overflow-hidden
              relative
              bg-gradient-to-br
              from-[#2b1c16]
              to-[#6f3e25]
              p-5 text-white
              min-h-[220px]
            ">

              <div className="absolute inset-0 bg-black/20" />

              <div className="relative z-10">

                <div className="
                  w-12 h-12 rounded-2xl
                  bg-white/10
                  flex items-center justify-center
                  mb-4
                ">
                  <Sparkles className="w-5 h-5" />
                </div>

                <h3 className="text-lg font-bold">
                  State Compliance
                </h3>

                <p className="text-sm text-white/80 mt-2 leading-relaxed">
                  Keep the project closure date after the result, final
                  selection, and any waiting-list or archive activity.
                </p>

              </div>
            </div>

          </div>
        </div>
        )}
      </div>
    </AdminLayout>
  )
}

export default CreateProject





