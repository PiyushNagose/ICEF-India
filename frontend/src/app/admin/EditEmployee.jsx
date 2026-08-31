import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Loader2, Eye, EyeOff, User, Briefcase, Lock, Shield, X, Save } from 'lucide-react'
import AdminLayout from '../../components/layouts/AdminLayout'
import { adminService } from '../../services/admin.service'
import CustomSelect from '../../components/ui/CustomSelect'
import AppDatePicker from '../../components/ui/AppDatePicker'

const DEPARTMENTS = [
  'Administration','Public Works','Healthcare','Education','Finance',
  'Information Technology','Home Affairs','Revenue','Agriculture','Transport','Law & Justice','Other',
]


const inp = (err, disabled) =>
  `w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors ${disabled ? 'bg-gray-100 cursor-not-allowed border-gray-200 text-gray-500' : err ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white'}`

const Label = ({ children }) => (
  <p className="text-xs font-semibold text-gray-500 uppercase tracking-normal mb-1.5">{children}</p>
)
const Err = ({ msg }) => msg ? <p className="text-red-500 text-xs mt-1">{msg}</p> : null

const getEmployeeSnapshot = (data = {}) =>
  JSON.stringify({
    fullName: (data.fullName || '').trim(),
    dateOfBirth: data.dateOfBirth || '',
    gender: data.gender || '',
    contactNumber: data.contactNumber || '',
    department: data.department || '',
    roleDesignation: (data.roleDesignation || '').trim(),
    dateOfJoining: data.dateOfJoining || '',
    systemRole: data.systemRole || '',
    status: data.status || 'Active',
    password: data.password || '',
  })

const Section = ({ icon: Icon, title, color, children }) => (
  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
    <div className={`flex items-center gap-3 px-6 py-4 border-l-4 ${color}`}>
      <Icon className="w-5 h-5 text-gray-600" />
      <h3 className="font-semibold text-gray-900">{title}</h3>
    </div>
    <div className="px-6 py-5 space-y-5">{children}</div>
  </div>
)

const EditEmployee = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState({})
  const [savedSnapshot, setSavedSnapshot] = useState('')

  const [formData, setFormData] = useState({
    fullName:'', dateOfBirth:'', gender:'', contactNumber:'',
    department:'', roleDesignation:'', employeeId:'', dateOfJoining:'',
    officialEmail:'', password:'', systemRole:'', status:'Active',
  })

  const { data: employeeData, isLoading: employeeLoading } = useQuery({
    queryKey: ['admin-employee', id],
    queryFn: () => adminService.getEmployee(id),
  })

  const { data: rolesData, isLoading: rolesLoading } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: () => adminService.getRoles(),
  })
  const allRoles = rolesData?.data?.roles || rolesData?.roles || []
  const selectedRole = allRoles.find((role) => role._id === formData.systemRole)
  const isEditingSuperAdmin =
    selectedRole?.roleName?.trim().toLowerCase() === 'super admin'
  const roles = allRoles.filter(
    (role) =>
      role.roleName?.trim().toLowerCase() !== 'super admin' ||
      role._id === formData.systemRole
  )

  useEffect(() => {
    if (employeeData?.employee) {
      const emp = employeeData.employee
      const nextFormData = {
        fullName: emp.fullName || '',
        dateOfBirth: emp.dateOfBirth ? emp.dateOfBirth.split('T')[0] : '',
        gender: emp.gender || '',
        contactNumber: emp.contactNumber || '',
        department: emp.department || '',
        roleDesignation: emp.roleDesignation || '',
        employeeId: emp.employeeId || '',
        dateOfJoining: emp.dateOfJoining ? emp.dateOfJoining.split('T')[0] : '',
        officialEmail: emp.officialEmail || '',
        password: '',
        systemRole: emp.systemRole?._id || '',
        status: emp.status || 'Active',
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormData(nextFormData)
      setSavedSnapshot(getEmployeeSnapshot(nextFormData))
    }
  }, [employeeData])

  const { mutate: updateEmployee, isPending } = useMutation({
    mutationFn: ({ id, data }) => adminService.updateEmployee(id, data),
    onSuccess: () => {
      toast.success('Employee updated successfully')
      queryClient.invalidateQueries({ queryKey: ['admin-employees'] })
      queryClient.invalidateQueries({ queryKey: ['admin-employee', id] })
      queryClient.invalidateQueries({ queryKey: ['admin-employee-stats'] })
      navigate('/admin/employees')
    },
    onError: (err) => toast.error(err.message || 'Failed to update employee'),
  })

  const set = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }))
  }

  const hasUnsavedChanges = Boolean(savedSnapshot) && getEmployeeSnapshot(formData) !== savedSnapshot

  const validate = () => {
    const e = {}
    if (!formData.fullName.trim()) e.fullName = 'Full name is required'
    if (!formData.contactNumber) e.contactNumber = 'Contact number is required'
    else if (!/^[6-9]\d{9}$/.test(formData.contactNumber)) e.contactNumber = 'Enter valid 10-digit mobile'
    if (!formData.department) e.department = 'Department is required'
    if (!formData.roleDesignation.trim()) e.roleDesignation = 'Role designation is required'
    if (!formData.dateOfJoining) e.dateOfJoining = 'Date of joining is required'
    if (!formData.systemRole) e.systemRole = 'System role is required'
    if (formData.password && formData.password.length < 8) e.password = 'Minimum 8 characters'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = () => {
    if (!hasUnsavedChanges) {
      toast('No employee changes to save')
      return
    }
    if (!validate()) return
    updateEmployee({ id, data: {
      fullName: formData.fullName.trim(),
      contactNumber: formData.contactNumber,
      department: formData.department,
      roleDesignation: formData.roleDesignation.trim(),
      dateOfJoining: formData.dateOfJoining,
      ...(!isEditingSuperAdmin && { systemRole: formData.systemRole }),
      status: formData.status,
      ...(formData.dateOfBirth && { dateOfBirth: formData.dateOfBirth }),
      ...(formData.gender && { gender: formData.gender }),
      ...(formData.password && { password: formData.password }),
    }})
  }

  if (employeeLoading) return (
    <AdminLayout title="Edit Employee">
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    </AdminLayout>
  )

  const emp = employeeData?.employee
  const initials = (emp?.fullName || '?').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()

  return (
    <AdminLayout title="Edit Employee">
      <div className="min-h-full p-5 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold text-lg shadow-md">
              {initials}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Edit Employee</h1>
              <p className="text-sm text-gray-500 mt-0.5">Update profile for <span className="font-medium text-gray-700">{emp?.fullName}</span></p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {['Active','Inactive','On Leave'].map(s => (
              <label key={s} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer border transition-colors ${formData.status === s ? s === 'Active' ? 'bg-emerald-100 border-emerald-300 text-emerald-700' : s === 'Inactive' ? 'bg-red-100 border-red-300 text-red-700' : 'bg-amber-100 border-amber-300 text-amber-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                <input type="radio" name="status" value={s} checked={formData.status === s} onChange={e => set('status', e.target.value)} className="hidden" />
                <span className={`w-1.5 h-1.5 rounded-full ${s === 'Active' ? 'bg-emerald-500' : s === 'Inactive' ? 'bg-red-500' : 'bg-amber-500'}`} />
                {s}
              </label>
            ))}
          </div>
        </div>

        {/* Personal Details */}
        <Section icon={User} title="Personal Details" color="border-l-orange-500">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <Label>Full Name</Label>
              <input type="text" placeholder="Enter legal full name" className={inp(errors.fullName)}
                value={formData.fullName} onChange={e => set('fullName', e.target.value)} />
              <Err msg={errors.fullName} />
            </div>
            <div>
              <Label>Date of Birth</Label>
              <AppDatePicker
                value={formData.dateOfBirth}
                onChange={(val) => set('dateOfBirth', val)}
                placeholder="Select date of birth"
                maxDate={new Date()}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <Label>Gender</Label>
              <div className="flex gap-3">
                {['Male','Female','Other'].map(g => (
                  <label key={g} className={`flex-1 flex items-center gap-2 border rounded-xl px-4 py-3 cursor-pointer transition-colors text-sm ${formData.gender === g.toLowerCase() ? 'border-orange-500 bg-orange-50 text-orange-700 font-medium' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                    <input type="radio" name="gender" value={g.toLowerCase()} checked={formData.gender === g.toLowerCase()}
                      onChange={e => set('gender', e.target.value)} className="accent-orange-600" />
                    {g}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label>Contact Number</Label>
              <div className="flex">
                <span className="inline-flex items-center px-3 border border-r-0 border-gray-200 bg-gray-50 text-gray-500 text-sm rounded-l-xl">+91</span>
                <input type="tel" placeholder="9876543210" maxLength={10}
                  className={`flex-1 px-4 py-3 border rounded-r-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 ${errors.contactNumber ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
                  value={formData.contactNumber} onChange={e => set('contactNumber', e.target.value.replace(/\D/g, ''))} />
              </div>
              <Err msg={errors.contactNumber} />
            </div>
          </div>
        </Section>

        {/* Employment Details */}
        <Section icon={Briefcase} title="Employment Details" color="border-l-amber-500">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <Label>Department</Label>
              <CustomSelect
                value={formData.department}
                onChange={(val) => set('department', val)}
                options={DEPARTMENTS}
                placeholder="Select Department"
                error={!!errors.department}
              />
              <Err msg={errors.department} />
            </div>
            <div>
              <Label>Role / Designation</Label>
              <input type="text" placeholder="e.g. Senior Reviewer" className={inp(errors.roleDesignation)}
                value={formData.roleDesignation} onChange={e => set('roleDesignation', e.target.value)} />
              <Err msg={errors.roleDesignation} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <Label>Employee ID</Label>
              <input type="text" className={inp(false, true)} value={formData.employeeId} disabled />
            </div>
            <div>
              <Label>Date of Joining</Label>
              <AppDatePicker
                value={formData.dateOfJoining}
                onChange={(val) => set('dateOfJoining', val)}
                placeholder="Select joining date"
                error={!!errors.dateOfJoining}
              />
              <Err msg={errors.dateOfJoining} />
            </div>
          </div>
        </Section>

        {/* Security & Access */}
        <Section icon={Lock} title="Security & Access" color="border-l-blue-500">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <Label>Official Email</Label>
              <input type="email" className={inp(false, true)} value={formData.officialEmail} disabled />
            </div>
            <div>
              <Label>New Password (Optional)</Label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} placeholder="Leave blank to keep current"
                  className={inp(errors.password)}
                  value={formData.password} onChange={e => set('password', e.target.value)} />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <Err msg={errors.password} />
            </div>
          </div>

          {/* System Role */}
          <div>
            <Label>System Role</Label>
            <Err msg={errors.systemRole} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {(roles.length > 0 ? roles : []).map(role => {
                const isSelected = formData.systemRole === role._id
                const isReserved = role.roleName?.trim().toLowerCase() === 'super admin'
                return (
                  <label key={role._id} className={`relative flex flex-col gap-2 p-4 border-2 rounded-xl transition-all ${isReserved ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'} ${isSelected ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <input type="radio" name="systemRole" value={role._id} checked={isSelected}
                      disabled={isReserved}
                      onChange={e => set('systemRole', e.target.value)} className="absolute top-3 right-3 accent-orange-600" />
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isSelected ? 'bg-orange-100' : 'bg-gray-100'}`}>
                      <Shield className={`w-5 h-5 ${isSelected ? 'text-orange-600' : 'text-gray-500'}`} />
                    </div>
                    <p className="font-semibold text-gray-900 text-sm">{role.roleName}</p>
                    <p className="text-xs text-gray-500">{role.roleDescription || role.description || 'System role'}</p>
                  </label>
                )
              })}
              {rolesLoading && <p className="text-sm text-gray-400 col-span-3">Loading roles...</p>}
            </div>
          </div>
        </Section>

        {/* Footer */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-4 flex items-center justify-between">
          <button onClick={() => navigate('/admin/employees')}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors">
            <X className="w-4 h-4" /> Cancel
          </button>
          <button onClick={handleSubmit} disabled={isPending || !hasUnsavedChanges}
            className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold px-5 py-2 rounded-xl transition-colors disabled:cursor-not-allowed disabled:bg-orange-200 disabled:text-orange-700/60 shadow-sm">
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isPending ? 'Saving...' : hasUnsavedChanges ? 'Save Changes' : 'No Changes'}
          </button>
        </div>

      </div>
    </AdminLayout>
  )
}

export default EditEmployee





