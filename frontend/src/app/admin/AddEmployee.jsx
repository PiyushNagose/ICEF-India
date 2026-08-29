import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Loader2, Eye, EyeOff, User, Briefcase, Lock, Shield, X } from 'lucide-react'
import AdminLayout from '../../components/layouts/AdminLayout'
import { adminService } from '../../services/admin.service'
import CustomSelect from '../../components/ui/CustomSelect'
import AppDatePicker from '../../components/ui/AppDatePicker'

const DEPARTMENTS = [
  'Administration','Public Works','Healthcare','Education','Finance',
  'Information Technology','Home Affairs','Revenue','Agriculture','Transport','Law & Justice','Other',
]

const inp = (err) =>
  `w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors ${err ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white'}`

const Label = ({ children }) => (
  <p className="text-xs font-semibold text-gray-500 uppercase tracking-normal mb-1.5">{children}</p>
)

const Err = ({ msg }) => msg ? <p className="text-red-500 text-xs mt-1">{msg}</p> : null

const Section = ({ icon: Icon, title, color, children }) => (
  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
    <div className={`flex items-center gap-3 px-6 py-4 border-l-4 ${color}`}>
      <Icon className="w-5 h-5 text-gray-600" />
      <h3 className="font-semibold text-gray-900">{title}</h3>
    </div>
    <div className="px-6 py-5 space-y-5">{children}</div>
  </div>
)

const AddEmployee = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState({})

  const [formData, setFormData] = useState({
    fullName: '', dateOfBirth: '', gender: '', contactNumber: '',
    department: '', roleDesignation: '', employeeId: '', dateOfJoining: '',
    officialEmail: '', password: '', systemRole: '',
  })

  const { data: rolesData, isLoading: rolesLoading } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: () => adminService.getRoles(),
  })
  const roles = (rolesData?.data?.roles || rolesData?.roles || []).filter(
    (role) => role.roleName?.trim().toLowerCase() !== 'super admin'
  )

  const { mutate: createEmployee, isPending } = useMutation({
    mutationFn: adminService.createEmployee,
    onSuccess: () => {
      toast.success('Employee created successfully')
      queryClient.invalidateQueries({ queryKey: ['admin-employees'] })
      queryClient.invalidateQueries({ queryKey: ['admin-employee-stats'] })
      navigate('/admin/employees')
    },
    onError: (err) => toast.error(err.message || 'Failed to create employee'),
  })

  const set = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }))
  }

  const validate = () => {
    const e = {}
    if (!formData.fullName.trim()) e.fullName = 'Full name is required'
    if (!formData.contactNumber) e.contactNumber = 'Contact number is required'
    else if (!/^[6-9]\d{9}$/.test(formData.contactNumber)) e.contactNumber = 'Enter valid 10-digit mobile'
    if (!formData.department) e.department = 'Department is required'
    if (!formData.roleDesignation.trim()) e.roleDesignation = 'Role designation is required'
    if (!formData.employeeId.trim()) e.employeeId = 'Employee ID is required'
    if (!formData.dateOfJoining) e.dateOfJoining = 'Date of joining is required'
    if (!formData.officialEmail) e.officialEmail = 'Official email is required'
    else if (!/^\S+@\S+\.\S+$/.test(formData.officialEmail)) e.officialEmail = 'Invalid email'
    if (!formData.password) e.password = 'Password is required'
    else if (formData.password.length < 8) e.password = 'Minimum 8 characters'
    if (!formData.systemRole) e.systemRole = 'System role is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = () => {
    if (!validate()) return
    createEmployee({
      fullName: formData.fullName.trim(),
      contactNumber: formData.contactNumber,
      department: formData.department,
      roleDesignation: formData.roleDesignation.trim(),
      employeeId: formData.employeeId.trim(),
      dateOfJoining: formData.dateOfJoining,
      officialEmail: formData.officialEmail.toLowerCase().trim(),
      password: formData.password,
      systemRole: formData.systemRole,
      ...(formData.dateOfBirth && { dateOfBirth: formData.dateOfBirth }),
      ...(formData.gender && { gender: formData.gender }),
    })
  }

  return (
    <AdminLayout title="Add a New Employee">
      <div className="min-h-full p-5 space-y-5">

        {/* Page Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Create New Profile</h1>
            <p className="text-sm text-gray-500 mt-0.5">Register a new employee to the central recruitment administration system.</p>
          </div>
          <span className="flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" /> SYSTEM ONLINE
          </span>
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
                <input type="tel" placeholder="98765 43210" maxLength={10}
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
              <div className="relative">
                <input type="text" placeholder="EMP-2026-0001" className={inp(errors.employeeId)}
                  value={formData.employeeId} onChange={e => set('employeeId', e.target.value)} />
              </div>
              <Err msg={errors.employeeId} />
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
              <input type="email" placeholder="employee.name@bihar.gov.in" className={inp(errors.officialEmail)}
                value={formData.officialEmail} onChange={e => set('officialEmail', e.target.value)} />
              <Err msg={errors.officialEmail} />
            </div>
            <div>
              <Label>Temporary Password</Label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} placeholder="••••••••" className={inp(errors.password)}
                  value={formData.password} onChange={e => set('password', e.target.value)} />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <Err msg={errors.password} />
              <p className="mt-1.5 text-xs text-gray-400">A welcome email will be sent, and the employee must change this after first login.</p>
            </div>
          </div>

          {/* System Role Cards */}
          <div>
            <Label>System Role</Label>
            <Err msg={errors.systemRole} />
            {rolesLoading ? (
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-5 text-sm text-gray-500">
                Loading roles...
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {roles.length > 0 ? roles.map(role => {
                  const isSelected = formData.systemRole === role._id
                  return (
                    <label key={role._id} className={`relative flex flex-col gap-2 p-4 border-2 rounded-xl cursor-pointer transition-all ${isSelected ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <input type="radio" name="systemRole" value={role._id} checked={isSelected}
                        onChange={e => set('systemRole', e.target.value)} className="absolute top-3 right-3 accent-orange-600" />
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isSelected ? 'bg-orange-100' : 'bg-gray-100'}`}>
                        <Shield className={`w-5 h-5 ${isSelected ? 'text-orange-600' : 'text-gray-500'}`} />
                      </div>
                      <p className="font-semibold text-gray-900 text-sm">{role.roleName}</p>
                      <p className="text-xs text-gray-500">{role.roleDescription || role.description || 'System role'}</p>
                    </label>
                  )
                }) : (
                  <div className="md:col-span-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-5 text-sm text-amber-800">
                    No roles found. Create a role first.
                  </div>
                )}
              </div>
            )}
          </div>
        </Section>

        {/* Footer Actions */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-4 flex items-center justify-between">
          <button onClick={() => navigate('/admin/employees')}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors">
            <X className="w-4 h-4" /> Cancel
          </button>
          <div className="flex items-center gap-3">
            <button onClick={handleSubmit} disabled={isPending || rolesLoading || roles.length === 0}
              className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold px-5 py-2 rounded-xl transition-colors disabled:opacity-60 shadow-sm">
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <User className="w-4 h-4" />}
              {isPending ? 'Creating...' : 'Create Employee'}
            </button>
          </div>
        </div>

      </div>
    </AdminLayout>
  )
}

export default AddEmployee





