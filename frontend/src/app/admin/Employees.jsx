import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2, Trash2, Activity, ChevronLeft, ChevronRight, Filter, Users, UserCheck, Building2, AlertCircle, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import AdminLayout from '../../components/layouts/AdminLayout'
import { adminService } from '../../services/admin.service'
import { hasPermission, useAuth } from '../../hooks/useAuth'

const STATUS_CFG = {
  Active:   { dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' },
  Inactive: { dot: 'bg-red-500',     text: 'text-red-700',     bg: 'bg-red-50'     },
  'On Leave':{ dot: 'bg-amber-500',  text: 'text-amber-700',   bg: 'bg-amber-50'   },
}

const Avatar = ({ name }) => {
  const initials = (name || '?').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
  const colors = ['bg-orange-500','bg-blue-500','bg-purple-500','bg-teal-500','bg-rose-500','bg-indigo-500']
  const color = colors[(initials.charCodeAt(0) || 0) % colors.length]
  return (
    <div className={`w-9 h-9 rounded-full ${color} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
      {initials}
    </div>
  )
}

const Employees = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [page, setPage] = useState(1)
  const [deptFilter, setDeptFilter] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-employees', page, deptFilter, roleFilter, statusFilter],
    queryFn: () => adminService.getEmployees({
      limit: 10, page,
      ...(deptFilter   && { department: deptFilter }),
      ...(roleFilter   && { systemRole: roleFilter }),
      ...(statusFilter && { status: statusFilter }),
    }),
  })

  const { data: statsData } = useQuery({
    queryKey: ['admin-employee-stats'],
    queryFn: adminService.getEmployeeStats,
  })

  const { data: rolesData } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: () => adminService.getRoles(),
  })

  const { mutate: deleteEmployee } = useMutation({
    mutationFn: adminService.deleteEmployee,
    onSuccess: () => {
      toast.success('Employee deleted')
      queryClient.invalidateQueries({ queryKey: ['admin-employees'] })
      queryClient.invalidateQueries({ queryKey: ['admin-employee-stats'] })
    },
    onError: (err) => toast.error(err.message || 'Failed to delete'),
  })

  const handleDelete = (emp) => {
    if (window.confirm(`Delete ${emp.fullName}? This cannot be undone.`)) deleteEmployee(emp._id)
  }

  const employees  = data?.employees || []
  const pagination = data?.pagination || {}
  const totalPages = pagination.totalPages || 1
  const totalItems = pagination.totalItems || pagination.total || employees.length

  const totalEmp   = statsData?.totalEmployees || totalItems
  const activeEmp  = statsData?.statusStats?.find(s => s._id === 'Active')?.count || employees.filter(e => e.status === 'Active').length
  const inactiveEmp = statsData?.statusStats?.find(s => s._id === 'Inactive')?.count || employees.filter(e => e.status === 'Inactive').length
  const deptCount  = statsData?.departmentStats?.length || new Set(employees.map(e => e.department).filter(Boolean)).size
  const roles = rolesData?.data?.roles || rolesData?.roles || []

  const pages = []
  if (totalPages <= 7) { for (let i = 1; i <= totalPages; i++) pages.push(i) }
  else {
    pages.push(1)
    if (page > 3) pages.push('...')
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i)
    if (page < totalPages - 2) pages.push('...')
    pages.push(totalPages)
  }

  const clearFilters = () => { setDeptFilter(''); setRoleFilter(''); setStatusFilter(''); setPage(1) }
  const hasFilters = deptFilter || roleFilter || statusFilter
  const canCreate = hasPermission(user, 'employees', 'create')
  const canEdit = hasPermission(user, 'employees', 'edit')
  const canDelete = hasPermission(user, 'employees', 'delete')

  if (error) return (
    <AdminLayout title="Employees">
      <div className="p-6 text-red-600">Error: {error.message}</div>
    </AdminLayout>
  )

  return (
    <AdminLayout title="Employees">
      <div className="p-5 space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Staff Directory</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage and monitor institutional workforce across departments.</p>
          </div>
          {canCreate && (
            <button
              onClick={() => navigate('/admin/employees/add')}
              className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" /> Add New Employee
            </button>
          )}
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-gray-200 border-t-4 border-t-orange-500 p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-normal mb-2">Total Employees</p>
                <p className="text-3xl font-bold text-gray-900">{Number(totalEmp).toLocaleString('en-IN')}</p>
                <p className="text-xs text-gray-400 mt-1">Registered staff</p>
              </div>
              <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                <Users className="w-5 h-5 text-orange-500" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 border-t-4 border-t-emerald-500 p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-normal mb-2">Active Accounts</p>
                <p className="text-3xl font-bold text-gray-900">{Number(activeEmp).toLocaleString('en-IN')}</p>
                <p className="text-xs text-gray-400 mt-1">Allowed to sign in</p>
              </div>
              <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                <UserCheck className="w-5 h-5 text-emerald-500" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 border-t-4 border-t-blue-500 p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-normal mb-2">Departments</p>
                <p className="text-3xl font-bold text-gray-900">{deptCount}</p>
              </div>
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <Building2 className="w-5 h-5 text-blue-500" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 border-t-4 border-t-red-400 p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-normal mb-2">Inactive Accounts</p>
                <p className="text-3xl font-bold text-gray-900">{inactiveEmp}</p>
                {inactiveEmp > 0 && (
                  <span className="text-xs font-bold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full mt-1 inline-block">REVIEW</span>
                )}
              </div>
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-600 flex-shrink-0">
              <Filter className="w-4 h-4" /> Filters:
            </div>
            <select value={deptFilter} onChange={e => { setDeptFilter(e.target.value); setPage(1) }}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500">
              <option value="">All Departments</option>
              {['Administration','Public Works','Healthcare','Education','Finance','Information Technology','Home Affairs','Revenue','Agriculture','Transport','Law & Justice'].map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1) }}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500">
              <option value="">All Roles</option>
              {roles.map(role => (
                <option key={role._id} value={role._id}>{role.roleName}</option>
              ))}
            </select>
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500">
              <option value="">Status: All</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="On Leave">On Leave</option>
            </select>
            {hasFilters && (
              <button onClick={clearFilters} className="ml-auto text-sm font-semibold text-orange-600 hover:underline">
                Clear All
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="admin-data-scroll hover-scroll overflow-auto">
            <table className="w-full min-w-[1080px] table-fixed">
              <colgroup>
                <col className="w-[24%]" />
                <col className="w-[13%]" />
                <col className="w-[18%]" />
                <col className="w-[17%]" />
                <col className="w-[10%]" />
                <col className="w-[10%]" />
                <col className="w-[8%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-gray-100">
                  {['Employee Name','ID','Department','Role','Status','Date Joined','Actions'].map(h => (
                    <th key={h} className={`py-3 px-5 text-xs font-semibold text-gray-500 uppercase tracking-normal ${['Status','Date Joined','Actions'].includes(h) ? 'text-center' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {isLoading && (
                  <tr><td colSpan="7" className="py-16 text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-orange-500 mx-auto" />
                  </td></tr>
                )}
                {!isLoading && employees.length === 0 && (
                  <tr><td colSpan="7" className="py-16 text-center text-gray-400 text-sm">No employees found.</td></tr>
                )}
                {employees.map(emp => {
                  const scfg = STATUS_CFG[emp.status] || STATUS_CFG.Inactive
                  return (
                    <tr key={emp._id} className="hover:bg-orange-50/30 transition-colors">
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <Avatar name={emp.fullName} />
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{emp.fullName}</p>
                            <p className="text-xs text-gray-400">{emp.officialEmail}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-5">
                        <span className="text-sm font-mono text-gray-700">{emp.employeeId}</span>
                      </td>
                      <td className="py-4 px-5">
                        <span className="text-sm text-gray-700">{emp.department || '-'}</span>
                      </td>
                      <td className="py-4 px-5">
                        <span className="text-sm text-gray-700">{emp.systemRole?.roleName || emp.roleDesignation || '-'}</span>
                      </td>
                      <td className="py-4 px-5 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${scfg.bg} ${scfg.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${scfg.dot}`} />
                          {emp.status || 'Inactive'}
                        </span>
                      </td>
                      <td className="py-4 px-5 text-center">
                        <span className="text-sm text-gray-700">
                          {emp.dateOfJoining ? new Date(emp.dateOfJoining).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                        </span>
                      </td>
                      <td className="py-4 px-5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {canEdit && (
                            <button onClick={() => navigate(`/admin/employees/${emp._id}/edit`)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                          <button onClick={() => navigate(`/admin/employees/${emp._id}/activity`)}
                            className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors" title="Activity">
                            <Activity className="w-4 h-4" />
                          </button>
                          {canDelete && (
                            <button onClick={() => handleDelete(emp)}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
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
              Showing <span className="font-medium text-gray-700">1-{employees.length}</span> of{' '}
              <span className="font-medium text-gray-700">{Number(totalItems).toLocaleString('en-IN')}</span> employees
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => p - 1)} disabled={page <= 1}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                <ChevronLeft className="w-4 h-4" />
              </button>
              {pages.map((p, i) =>
                p === '...'
                  ? <span key={`d${i}`} className="w-8 h-8 flex items-center justify-center text-gray-400 text-sm">...</span>
                  : <button key={p} onClick={() => setPage(p)}
                      className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${p === page ? 'bg-orange-600 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                      {p}
                    </button>
              )}
              <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

      </div>
    </AdminLayout>
  )
}

export default Employees





