import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2, UserX, Activity, Filter, Users, UserCheck, Building2, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import AdminLayout from '../../components/layouts/AdminLayout'
import CustomSelect from '../../components/ui/CustomSelect'
import AdminPagination from '../../components/ui/AdminPagination'
import { AdminTableShell, AdminTableStatusRow } from '../../components/ui/AdminTable'
import AdminKpiCard from '../../components/ui/AdminKpiCard'
import { adminService } from '../../services/admin.service'
import { hasPermission, useAuth, isSuperAdminUser } from '../../hooks/useAuth'
import ConfirmDeleteModal from '../../components/ui/ConfirmDeleteModal'

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
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, employee: null })

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

  const { mutate: deactivateEmployee } = useMutation({
    mutationFn: adminService.deleteEmployee,
    onSuccess: () => {
      toast.success('Employee deactivated')
      queryClient.invalidateQueries({ queryKey: ['admin-employees'] })
      queryClient.invalidateQueries({ queryKey: ['admin-employee-stats'] })
    },
    onError: (err) => toast.error(err.message || 'Failed to deactivate'),
  })

  const handleDeactivate = (emp) => {
    setDeleteModal({ isOpen: true, employee: emp })
  }

  const confirmDelete = () => {
    if (deleteModal.employee) {
      deactivateEmployee(deleteModal.employee._id)
      setDeleteModal({ isOpen: false, employee: null })
    }
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
          <AdminKpiCard title="Total Employees" value={totalEmp} icon={Users} tone="orange" helper="Registered staff" />
          <AdminKpiCard title="Active Accounts" value={activeEmp} icon={UserCheck} tone="green" helper="Allowed to sign in" />
          <AdminKpiCard title="Departments" value={deptCount} icon={Building2} tone="blue" />
          <AdminKpiCard
            title="Inactive Accounts"
            value={inactiveEmp}
            icon={AlertCircle}
            tone="red"
            badge={inactiveEmp > 0 ? { label: 'Review', className: 'bg-orange-100 text-orange-700' } : null}
          />
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-600 flex-shrink-0">
              <Filter className="w-4 h-4" /> Filters:
            </div>
            <CustomSelect
              value={deptFilter}
              onChange={val => { setDeptFilter(val); setPage(1) }}
              options={[
                { value: '', label: 'All Departments' },
                ...['Administration','Public Works','Healthcare','Education','Finance','Information Technology','Home Affairs','Revenue','Agriculture','Transport','Law & Justice'].map(d => ({ value: d, label: d }))
              ]}
              className="w-44 border-gray-200"
            />
            <CustomSelect
              value={roleFilter}
              onChange={val => { setRoleFilter(val); setPage(1) }}
              options={[
                { value: '', label: 'All Roles' },
                ...roles.map(role => ({ value: role._id, label: role.roleName }))
              ]}
              className="w-40 border-gray-200"
            />
            <CustomSelect
              value={statusFilter}
              onChange={val => { setStatusFilter(val); setPage(1) }}
              options={[
                { value: '', label: 'Status: All' },
                { value: 'Active', label: 'Active' },
                { value: 'Inactive', label: 'Inactive' },
                { value: 'On Leave', label: 'On Leave' },
              ]}
              className="w-40 border-gray-200"
            />
            {hasFilters && (
              <button onClick={clearFilters} className="ml-auto text-sm font-semibold text-orange-600 hover:underline">
                Clear All
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <AdminTableShell
          footer={
            !isLoading && employees.length > 0 ? (
              <AdminPagination
                page={page}
                totalPages={totalPages}
                totalItems={totalItems}
                pageSize={pagination.itemsPerPage || 10}
                itemsOnPage={employees.length}
                itemLabel="employees"
                onPageChange={setPage}
              />
            ) : null
          }
        >
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
                  <AdminTableStatusRow colSpan={7} type="loading" title="Loading employees..." />
                )}
                {!isLoading && employees.length === 0 && (
                  <AdminTableStatusRow colSpan={7} icon={Users} title="No employees found" description="Try adjusting filters or add a new employee." />
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
                        <span className={`inline-flex items-center gap-1.5 whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-semibold ${scfg.bg} ${scfg.text}`}>
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
                          {canDelete && emp.status !== 'Inactive' && (
                            <button onClick={() => handleDeactivate(emp)}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Deactivate">
                              <UserX className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
        </AdminTableShell>

      </div>
      <ConfirmDeleteModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, employee: null })}
        onConfirm={confirmDelete}
        title="Deactivate Employee"
        message={`Are you sure you want to deactivate employee "${deleteModal.employee?.fullName}"? They will be signed out and blocked from access.`}
        requireType={isSuperAdminUser(user)}
      />
    </AdminLayout>
  )
}

export default Employees





