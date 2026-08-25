import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Shield, Edit, Trash2, Eye, Users, Activity, Lock } from 'lucide-react'
import toast from 'react-hot-toast'
import AdminLayout from '../../components/layouts/AdminLayout'
import { adminService } from '../../services/admin.service'
import { hasPermission, useAuth, isSuperAdminUser } from '../../hooks/useAuth'
import ConfirmDeleteModal from '../../components/ui/ConfirmDeleteModal'

// Role type badge config
const ROLE_TYPE = {
  critical:   { label: 'CRITICAL ROLE',    bg: 'bg-red-100',    text: 'text-red-700',    bar: 'bg-red-500'    },
  system:     { label: 'SYSTEM ROLE',      bg: 'bg-blue-100',   text: 'text-blue-700',   bar: 'bg-blue-500'   },
  standard:   { label: 'STANDARD ROLE',    bg: 'bg-orange-100', text: 'text-orange-700', bar: 'bg-orange-500' },
  restricted: { label: 'RESTRICTED ROLE',  bg: 'bg-gray-100',   text: 'text-gray-600',   bar: 'bg-gray-400'   },
  custom:     { label: 'CUSTOM ROLE',      bg: 'bg-purple-100', text: 'text-purple-700', bar: 'bg-purple-500' },
}

const getRoleType = (role) => {
  const name = role.roleName?.toLowerCase() || ''
  if (name.includes('admin') || name.includes('super')) return ROLE_TYPE.critical
  if (role.isSystemRole) return ROLE_TYPE.system
  if (name.includes('staff') || name.includes('reviewer')) return ROLE_TYPE.standard
  if (name.includes('observer') || name.includes('view')) return ROLE_TYPE.restricted
  return ROLE_TYPE.custom
}

// Stacked avatar circles
const AvatarStack = ({ count }) => {
  const colors = [
    'bg-orange-600 text-white',
    'bg-orange-100 text-orange-700',
    'bg-orange-50 text-orange-600',
  ]
  const show = Math.min(3, count || 0)
  const extra = (count || 0) - show
  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {Array.from({ length: show }).map((_, i) => (
          <div key={i} className={`w-7 h-7 rounded-full ${colors[i]} border-2 border-white flex items-center justify-center text-xs font-bold shadow-sm`}>
            {String.fromCharCode(65 + i)}
          </div>
        ))}
      </div>
      {extra > 0 && (
        <span className="ml-1.5 text-xs font-semibold text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded-full">+{extra}</span>
      )}
    </div>
  )
}

const LIMIT = 10

const getRoleRank = (role) => {
  const name = role.roleName?.toLowerCase() || ''
  if (name === 'super admin') return 0
  if (name.includes('super') || name.includes('admin')) return 1
  if (role.isSystemRole) return 2
  return 3
}

const Roles = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [page, setPage] = useState(1)
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, role: null })

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: () => adminService.getRoles({ limit: 100 }),
  })

  const { mutate: deleteRole } = useMutation({
    mutationFn: adminService.deleteRole,
    onSuccess: () => {
      toast.success('Role deleted successfully')
      queryClient.invalidateQueries({ queryKey: ['admin-roles'] })
    },
    onError: (err) => toast.error(err.message || 'Failed to delete role'),
  })

  const handleDelete = (role) => {
    if (role.isSystemRole) { toast.error('System roles cannot be deleted'); return }
    setDeleteModal({ isOpen: true, role })
  }

  const confirmDelete = () => {
    if (deleteModal.role) {
      deleteRole(deleteModal.role._id)
      setDeleteModal({ isOpen: false, role: null })
    }
  }

  const roles      = [...(data?.roles || [])].sort((a, b) => {
    const rankDiff = getRoleRank(a) - getRoleRank(b)
    if (rankDiff !== 0) return rankDiff
    return (a.roleName || '').localeCompare(b.roleName || '')
  })
  const totalRoles = roles.length
  const totalPages = Math.ceil(totalRoles / LIMIT) || 1
  const paged      = roles.slice((page - 1) * LIMIT, page * LIMIT)
  const canCreate = hasPermission(user, 'employees', 'create')
  const canEdit = hasPermission(user, 'employees', 'edit')
  const canDelete = hasPermission(user, 'employees', 'delete')

  // Real assigned users from employeeCount populated by backend
  const totalAssigned = roles.reduce((s, r) => s + (r.employeeCount || 0), 0)

  if (error) return (
    <AdminLayout title="Roles & Permissions">
      <div className="p-6 text-red-600">Error: {error.message}</div>
    </AdminLayout>
  )

  return (
    <AdminLayout title="Roles & Permissions">
      <div className="p-5 space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Role Management</h1>
            <p className="text-sm text-gray-500 mt-0.5 max-w-md">
              Define institutional hierarchies and control administrative access across the Bihar Recruitment Portal.
            </p>
          </div>
          {canCreate && (
            <button
              onClick={() => navigate('/admin/roles/create')}
              className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" /> Create Role
            </button>
          )}
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Total Active Roles */}
          <div className="bg-white rounded-2xl border border-gray-200 border-l-4 border-l-orange-500 p-5 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                <Shield className="w-5 h-5 text-orange-500" />
              </div>
              <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Active</span>
            </div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-normal mb-1">Total Active Roles</p>
            <p className="text-3xl font-bold text-gray-900">{String(totalRoles).padStart(2, '0')}</p>
          </div>

          {/* Users Assigned */}
          <div className="bg-white rounded-2xl border border-gray-200 border-l-4 border-l-blue-500 p-5 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-500" />
              </div>
            </div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-normal mb-1">Users Assigned</p>
            <p className="text-3xl font-bold text-gray-900">{Number(totalAssigned).toLocaleString('en-IN')}</p>
          </div>

          {/* System Load */}
          <div className="bg-white rounded-2xl border border-gray-200 border-l-4 border-l-amber-400 p-5 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                <Activity className="w-5 h-5 text-amber-500" />
              </div>
              <div className="w-8 h-1 bg-amber-400 rounded-full mt-3" />
            </div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-normal mb-1">Permission Modules</p>
            <p className="text-3xl font-bold text-gray-900">9</p>
          </div>
        </div>

        {/* Access Control List */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 text-base">Access Control List</h3>
          </div>

          <div className="admin-data-scroll hover-scroll overflow-auto">
            <table className="w-full min-w-[960px] table-fixed">
              <colgroup>
                <col className="w-[22%]" />
                <col className="w-[34%]" />
                <col className="w-[14%]" />
                <col className="w-[18%]" />
                <col className="w-[12%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-gray-100">
                  {['Role Name','Description','Assigned Users','Last Updated','Actions'].map(h => (
                    <th key={h} className={`py-3 px-5 text-xs font-semibold text-gray-500 uppercase tracking-normal ${['Assigned Users','Actions'].includes(h) ? 'text-center' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {isLoading && (
                  <tr><td colSpan="5" className="py-16 text-center text-gray-400 text-sm">Loading roles...</td></tr>
                )}
                {!isLoading && roles.length === 0 && (
                  <tr><td colSpan="5" className="py-16 text-center text-gray-400 text-sm">No roles found.</td></tr>
                )}
                {paged.map(role => {
                  const rtype = getRoleType(role)
                  return (
                    <tr key={role._id} className="hover:bg-gray-50/60 transition-colors">
                      {/* Role Name */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div className={`w-1 h-10 rounded-full ${rtype.bar} flex-shrink-0`} />
                          <div>
                            <p className="font-semibold text-gray-900 text-sm">{role.roleName}</p>
                            <span className={`text-xs font-bold uppercase tracking-normal px-1.5 py-0.5 rounded ${rtype.bg} ${rtype.text}`}>
                              {rtype.label}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Description */}
                      <td className="py-4 px-5 max-w-xs">
                        <p className="text-sm text-gray-600 line-clamp-2">{role.roleDescription || '-'}</p>
                      </td>

                      {/* Assigned Users */}
                      <td className="py-4 px-5 text-center">
                        <AvatarStack count={role.employeeCount || 0} />
                      </td>

                      {/* Last Updated */}
                      <td className="py-4 px-5">
                        <p className="text-sm font-medium text-gray-900">
                          {role.updatedAt ? new Date(role.updatedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {role.createdBy?.fullName ? `by ${role.createdBy.fullName}` : 'by System'}
                        </p>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => navigate(`/admin/roles/${role._id}/edit`)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="View"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {canEdit && (
                            <button
                              onClick={() => navigate(`/admin/roles/${role._id}/edit`)}
                              disabled={role.isSystemRole}
                              className={`p-2 rounded-lg transition-colors ${
                                role.isSystemRole
                                  ? 'text-gray-200 cursor-not-allowed'
                                  : 'text-gray-400 hover:text-orange-600 hover:bg-orange-50'
                              }`}
                              title={role.isSystemRole ? 'System role is locked' : 'Edit'}
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => handleDelete(role)}
                              disabled={role.isSystemRole}
                              className={`p-2 rounded-lg transition-colors ${role.isSystemRole ? 'text-gray-200 cursor-not-allowed' : 'text-gray-400 hover:text-red-600 hover:bg-red-50'}`}
                              title={role.isSystemRole ? 'Cannot delete system role' : 'Delete'}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              Showing {paged.length} of {totalRoles} active roles
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => p - 1)} disabled={page <= 1}
                className="px-4 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}
                className="px-4 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium"
              >
                Next
              </button>
            </div>
          </div>
        </div>

        {/* Permission Audit Banner */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-orange-600 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md">
              <Lock className="w-6 h-6 text-white" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">Quarterly Permission Audit</h4>
              <p className="text-sm text-gray-500 mt-0.5 max-w-lg">
                Review employee role assignments regularly and revoke temporary access as soon as operational work is complete.
              </p>
            </div>
          </div>
          <button onClick={() => navigate('/admin/activity-logs')} className="bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-orange-500/20 transition-colors hover:bg-orange-700 flex-shrink-0 rounded-xl">
            View Audit Logs
          </button>
        </div>

      </div>

      <ConfirmDeleteModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, role: null })}
        onConfirm={confirmDelete}
        title="Delete Role"
        message={`Are you sure you want to permanently delete the role "${deleteModal.role?.roleName}"? All users with this role will lose its permissions.`}
        requireType={isSuperAdminUser(user)}
      />
    </AdminLayout>
  )
}

export default Roles





