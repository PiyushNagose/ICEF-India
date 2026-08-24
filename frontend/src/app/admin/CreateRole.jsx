import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ArrowLeft, Lock, Loader2 } from 'lucide-react'
import AdminLayout from '../../components/layouts/AdminLayout'
import { Card, CardContent, CardHeader } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import { adminService } from '../../services/admin.service'

const MODULES = [
  { id: 'jobs',           label: 'Jobs Management' },
  { id: 'applications',  label: 'Applications Management' },
  { id: 'analytics',     label: 'Analytics & Reports' },
  { id: 'employees',     label: 'Employee Management' },
  { id: 'paymentSettings', label: 'Payment Settings' },
  { id: 'payments',      label: 'Payments & Reconciliation' },
  { id: 'support',       label: 'Support Management' },
  { id: 'projects',      label: 'Project Management' },
  { id: 'results',       label: 'Results Management' },
  { id: 'admitCards',    label: 'Admit Card Management' },
  { id: 'cms',           label: 'Public CMS' },
  { id: 'activityLogs',  label: 'Activity Logs' },
]
const ACTIONS = ['create', 'view', 'edit', 'delete', 'publish', 'approve', 'reject', 'assign', 'resolve', 'refund', 'reconcile', 'publishWindow', 'generateOnDemand', 'bulkGenerate', 'attendance', 'download']
const ACTION_LABELS = {
  create: 'Create',
  view: 'View',
  edit: 'Edit',
  delete: 'Delete',
  publish: 'Publish',
  approve: 'Approve',
  reject: 'Reject',
  assign: 'Assign',
  resolve: 'Resolve',
  refund: 'Refund',
  reconcile: 'Reconcile',
  publishWindow: 'Window',
  generateOnDemand: 'On-demand',
  bulkGenerate: 'Bulk gen.',
  attendance: 'Attendance',
  download: 'Download',
}

const emptyPermissions = () =>
  Object.fromEntries(
    MODULES.map(m => [m.id, Object.fromEntries(ACTIONS.map(a => [a, false]))])
  )

const CreateRole = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [roleName, setRoleName] = useState('')
  const [roleDescription, setRoleDescription] = useState('')
  const [permissions, setPermissions] = useState(emptyPermissions())
  const [errors, setErrors] = useState({})

  const { mutate: createRole, isPending } = useMutation({
    mutationFn: adminService.createRole,
    onSuccess: () => {
      toast.success('Role created successfully')
      queryClient.invalidateQueries({ queryKey: ['admin-roles'] })
      navigate('/admin/roles')
    },
    onError: (err) => toast.error(err.message || 'Failed to create role'),
  })

  const togglePermission = (moduleId, action) => {
    setPermissions(prev => ({
      ...prev,
      [moduleId]: { ...prev[moduleId], [action]: !prev[moduleId][action] },
    }))
  }

  const toggleAll = (moduleId) => {
    const allOn = ACTIONS.every(a => permissions[moduleId][a])
    setPermissions(prev => ({
      ...prev,
      [moduleId]: Object.fromEntries(ACTIONS.map(a => [a, !allOn])),
    }))
  }

  const totalActive = Object.values(permissions).flatMap(Object.values).filter(Boolean).length

  const handleSubmit = () => {
    const e = {}
    if (!roleName.trim()) e.roleName = 'Role name is required'
    if (roleName.trim().length < 2) e.roleName = 'At least 2 characters'
    setErrors(e)
    if (Object.keys(e).length > 0) return
    createRole({ roleName: roleName.trim(), roleDescription: roleDescription.trim() || undefined, permissions })
  }

  return (
    <AdminLayout title="Create Role">
      <div className="min-h-full p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin/roles')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Create New Role</h1>
            <p className="text-gray-600 text-sm">Define permissions for this role.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 items-stretch lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info */}
            <Card>
              <CardHeader><h3 className="font-semibold text-gray-900">Basic Information</h3></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Role Name <span className="text-red-500">*</span>
                  </label>
                  <input type="text" placeholder="e.g. Recruitment Manager"
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${errors.roleName ? 'border-red-400' : 'border-gray-300'}`}
                    value={roleName} onChange={(e) => { setRoleName(e.target.value); setErrors({}) }} />
                  {errors.roleName && <p className="text-red-500 text-xs mt-1">{errors.roleName}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea rows="3" placeholder="Describe the responsibilities of this role..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    value={roleDescription} onChange={(e) => setRoleDescription(e.target.value)} />
                </div>
              </CardContent>
            </Card>

            {/* Permission Matrix */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Lock className="w-5 h-5 text-orange-600" />
                    <h3 className="font-semibold text-gray-900">Permission Matrix</h3>
                  </div>
                  <span className="text-sm text-gray-500">{totalActive} permissions active</span>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="admin-compact-scroll hover-scroll overflow-x-auto overflow-y-hidden">
                  <table className="w-full min-w-[1760px] table-fixed">
                    <colgroup>
                      <col className="w-[250px]" />
                      {ACTIONS.map(a => (
                        <col key={a} className="w-[86px]" />
                      ))}
                      <col className="w-[70px]" />
                    </colgroup>
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="sticky left-0 z-10 bg-gray-50 text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-normal shadow-[1px_0_0_#e5e7eb]">Module</th>
                        {ACTIONS.map(a => (
                          <th
                            key={a}
                            title={a}
                            className="text-center py-3 px-2 text-[10px] font-semibold text-gray-500 uppercase tracking-normal leading-tight"
                          >
                            <span className="block truncate">{ACTION_LABELS[a] || a}</span>
                          </th>
                        ))}
                        <th className="text-center py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-normal">All</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {MODULES.map(mod => (
                        <tr key={mod.id} className="hover:bg-gray-50">
                          <td className="sticky left-0 z-10 bg-white py-3 px-4 text-sm font-medium text-gray-900 shadow-[1px_0_0_#e5e7eb]">{mod.label}</td>
                          {ACTIONS.map(action => (
                          <td key={action} className="py-3 px-2 text-center">
                              <input type="checkbox"
                                checked={permissions[mod.id][action]}
                                onChange={() => togglePermission(mod.id, action)}
                                className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500 cursor-pointer" />
                            </td>
                          ))}
                          <td className="py-3 px-3 text-center">
                            <button onClick={() => toggleAll(mod.id)}
                              className="text-xs text-orange-600 hover:text-orange-800 font-medium">
                              {ACTIONS.every(a => permissions[mod.id][a]) ? 'None' : 'All'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card className="bg-gray-800 text-white">
              <CardContent className="p-6 space-y-4">
                <h3 className="font-semibold">Role Summary</h3>
                <div>
                  <p className="text-xs text-gray-400">ROLE NAME</p>
                  <p className="font-medium text-white">{roleName || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">ACTIVE PERMISSIONS</p>
                  <p className="text-2xl font-bold text-orange-400">{totalActive}</p>
                  <p className="text-xs text-gray-400">out of {MODULES.length * ACTIONS.length} total</p>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div className="bg-orange-500 h-2 rounded-full transition-all"
                    style={{ width: `${(totalActive / (MODULES.length * ACTIONS.length)) * 100}%` }} />
                </div>
              </CardContent>
            </Card>

            <div className="space-y-3">
              <Button onClick={handleSubmit} disabled={isPending}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white">
                {isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating...</> : 'Create Role'}
              </Button>
              <Button variant="outline" onClick={() => navigate('/admin/roles')} className="w-full">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}

export default CreateRole