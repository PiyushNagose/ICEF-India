import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, Plus, Search, Building2, MapPin, CheckCircle2, AlertCircle, UploadCloud, DoorOpen, Edit, Power, PowerOff, Trash2 } from 'lucide-react'
import AdminLayout from '../../components/layouts/AdminLayout'
import { Card, CardContent } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import ConfirmDeleteModal from '../../components/ui/ConfirmDeleteModal'
import AdminPagination from '../../components/ui/AdminPagination'
import { AdminTableShell, AdminTableStatusRow } from '../../components/ui/AdminTable'
import { adminService } from '../../services/admin.service'
import { hasPermission, useAuth, isSuperAdminUser } from '../../hooks/useAuth'

export default function ExamCenters() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const isPrivilegedDelete = isSuperAdminUser(user)
  const canCreate = hasPermission(user, 'admitCards', 'create')
  const canEdit = hasPermission(user, 'admitCards', 'edit')
  const canDelete = hasPermission(user, 'admitCards', 'delete')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, center: null })
  const returnTo = searchParams.get('returnTo')
  const centerWizardPath = (mode) => {
    const params = new URLSearchParams()
    if (mode) params.set('mode', mode)
    if (returnTo) params.set('returnTo', returnTo)
    const query = params.toString()
    return `/admin/centers/new${query ? `?${query}` : ''}`
  }

  const { data: centersData, isLoading, isError } = useQuery({
    queryKey: ['admin-exam-centers', { search, page }],
    queryFn: () => adminService.getExamCenters({ search, page, limit: 10 }),
  })

  const centers = Array.isArray(centersData)
    ? centersData
    : centersData?.centers || centersData?.data?.centers || centersData?.data || []
  const meta = centersData?.meta || centersData?.data?.meta
  const totalPages = meta?.totalPages || 1
  const totalItems = meta?.totalItems || meta?.total || centers.length
  const activeCenters = centers.filter((center) => center.active !== false).length
  const totalCapacity = centers.reduce((sum, center) => sum + Number(center.totalCapacity || 0), 0)

  const refreshCenters = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-exam-centers'] })
    queryClient.invalidateQueries({ queryKey: ['exam-centers'] })
  }

  const toggleCenterMutation = useMutation({
    mutationFn: ({ id, active }) => adminService.updateExamCenter(id, { active }),
    onSuccess: (_data, vars) => {
      refreshCenters()
      toast.success(vars.active ? 'Center activated' : 'Center deactivated')
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || error?.message || 'Unable to update center status')
    },
  })

  const deleteCenterMutation = useMutation({
    mutationFn: adminService.deleteExamCenter,
    onSuccess: (result) => {
      refreshCenters()
      setDeleteModal({ isOpen: false, center: null })
      toast.success(result?.message || (result?.deleted ? 'Center deleted' : 'Center deactivated'))
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || error?.message || 'Unable to delete center')
    },
  })

  const handleEditCenter = (center) => {
    const params = new URLSearchParams()
    if (returnTo) params.set('returnTo', returnTo)
    const query = params.toString()
    navigate(`/admin/centers/${center._id}/edit${query ? `?${query}` : ''}`)
  }

  const handleToggleCenter = (center) => {
    toggleCenterMutation.mutate({
      id: center._id,
      active: center.active === false,
    })
  }

  const confirmDelete = () => {
    if (!deleteModal.center?._id) return
    deleteCenterMutation.mutate(deleteModal.center._id)
  }

  return (
    <AdminLayout title="Exam Centers">
      <div className="min-h-full bg-[#f7f4ee] p-5 space-y-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-600">Admin Panel</p>
            <h1 className="mt-1 text-2xl font-bold text-gray-950">Exam Centers</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">
              Maintain the master inventory of centers, addresses, rooms, and usable seats. Admit-card schedules select centers from this list.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 xl:justify-end">
            {canCreate && (
              <>
                <Button
                  onClick={() => navigate(centerWizardPath('upload'))}
                  variant="outline"
                  className="h-11 rounded-2xl bg-white px-5 shadow-sm"
                >
                  <UploadCloud className="w-4 h-4 mr-2" />
                  Bulk Upload
                </Button>
                <Button
                  onClick={() => navigate(centerWizardPath())}
                  className="h-11 rounded-2xl bg-orange-600 px-5 text-white shadow-lg shadow-orange-200 hover:bg-orange-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Center
                </Button>
              </>
            )}
          </div>
        </div>

        {returnTo && (
          <Card className="rounded-2xl border-orange-100 bg-orange-50/70 shadow-sm">
            <CardContent className="px-5 py-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-orange-600">Project Lifecycle Context</p>
                  <p className="mt-1 text-sm text-orange-900">
                    Add or update master centers here, then return to the selected admit-card schedule to choose centers for that job.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(returnTo)}
                  className="h-10 shrink-0 rounded-xl border-orange-200 bg-white px-4 text-orange-700 hover:bg-orange-50"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Return to Schedule
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="rounded-2xl border-gray-200 shadow-sm">
          <CardContent className="py-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full lg:max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search centers by name, code or city..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
                  className="h-12 w-full rounded-2xl border border-gray-200 bg-white py-2 pl-10 pr-4 text-sm text-gray-950 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
            />
              </div>
              <div className="text-sm font-semibold text-gray-500">
                Showing <span className="text-gray-950">{totalItems}</span> centers
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <Card className="rounded-2xl border-gray-200 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-gray-400">Total Centers</p>
                  <p className="mt-2 text-3xl font-extrabold text-gray-950">{meta?.total || centers.length}</p>
                </div>
                <span className="h-12 w-12 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center">
                  <Building2 className="w-5 h-5" />
                </span>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-gray-200 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-gray-400">Active Centers</p>
                  <p className="mt-2 text-3xl font-extrabold text-gray-950">{activeCenters}</p>
                </div>
                <span className="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                </span>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-gray-200 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-gray-400">Usable Capacity</p>
                  <p className="mt-2 text-3xl font-extrabold text-gray-950">{totalCapacity}</p>
                </div>
                <span className="h-12 w-12 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center">
                  <MapPin className="w-5 h-5" />
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="overflow-hidden rounded-2xl border-gray-200 shadow-sm">
          <CardContent className="p-0">
            <AdminTableShell
              className="rounded-none border-0 shadow-none"
              footer={
                !isLoading && !isError && centers.length > 0 ? (
                  <AdminPagination
                    page={page}
                    totalPages={totalPages}
                    totalItems={totalItems}
                    pageSize={meta?.itemsPerPage || 10}
                    itemsOnPage={centers.length}
                    itemLabel="centers"
                    onPageChange={setPage}
                  />
                ) : null
              }
            >
              <table className="w-full min-w-[1040px] table-fixed text-left text-sm text-gray-600">
                <thead className="border-b border-gray-100 bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-[0.14em] text-gray-500">Center Code</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-[0.14em] text-gray-500">Name & Location</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-[0.14em] text-gray-500">Contact</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-[0.14em] text-gray-500">Capacity</th>
                    <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-[0.14em] text-gray-500">Status</th>
                    <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-[0.14em] text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {isLoading ? (
                    <AdminTableStatusRow colSpan={6} type="loading" title="Loading centers..." />
                  ) : isError ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-red-600">
                        <div className="flex flex-col items-center justify-center">
                          <AlertCircle className="w-8 h-8 text-red-300 mb-2" />
                          <p>Unable to load exam centers.</p>
                          <p className="text-xs mt-1 text-red-500">Refresh the page or try again after a moment.</p>
                        </div>
                      </td>
                    </tr>
                  ) : centers.length === 0 ? (
                    <AdminTableStatusRow colSpan={6} icon={Building2} title="No exam centers found" description="Try adjusting your search or add a new center." />
                  ) : (
                    centers.map((center) => (
                      <tr key={center._id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-5 font-semibold text-gray-950">
                          {center.centerCode}
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-semibold text-gray-950">{center.name}</div>
                          <div className="mt-1 flex items-center text-xs font-medium text-gray-500">
                            <MapPin className="w-3 h-3 mr-1" />
                            {center.city}, {center.state} {center.pincode}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-gray-900">{center.contact?.name || 'N/A'}</div>
                          <div className="text-xs font-medium text-gray-500">{center.contact?.phone || 'N/A'}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="inline-flex items-center gap-2 rounded-2xl bg-orange-50 px-3 py-2 text-sm font-bold text-orange-700">
                            <DoorOpen className="h-4 w-4" />
                            {center.totalCapacity || 0} seats
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-3 py-1 text-xs font-bold ${
                            center.isSoftDeleted
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : center.active !== false
                              ? 'bg-green-50 text-green-700 border-green-200'
                              : 'bg-red-50 text-red-700 border-red-200'
                          }`}>
                            {center.isSoftDeleted ? 'Removed by employee' : center.active !== false ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            {canEdit && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleEditCenter(center)}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-gray-500 transition-colors hover:bg-orange-50 hover:text-orange-600"
                                  title="Edit center"
                                  aria-label={`Edit ${center.name}`}
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleCenter(center)}
                                  disabled={toggleCenterMutation.isPending}
                                  className={`inline-flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
                                    center.active !== false
                                      ? 'text-amber-600 hover:bg-amber-50'
                                      : 'text-emerald-600 hover:bg-emerald-50'
                                  } disabled:cursor-not-allowed disabled:opacity-50`}
                                  title={center.active !== false ? 'Deactivate center' : 'Activate center'}
                                  aria-label={`${center.active !== false ? 'Deactivate' : 'Activate'} ${center.name}`}
                                >
                                  {center.active !== false ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                                </button>
                              </>
                            )}
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => setDeleteModal({ isOpen: true, center })}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-red-600 transition-colors hover:bg-red-50"
                                title="Delete center"
                                aria-label={`Delete ${center.name}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </AdminTableShell>
          </CardContent>
        </Card>

        <ConfirmDeleteModal
          isOpen={deleteModal.isOpen}
          onClose={() => setDeleteModal({ isOpen: false, center: null })}
          onConfirm={confirmDelete}
          title="Delete Exam Center"
          message={
            isPrivilegedDelete
              ? `Permanently delete "${deleteModal.center?.name || 'this center'}"? If it is already used by schedules or allocations, it will be deactivated instead.`
              : `Remove "${deleteModal.center?.name || 'this center'}" from the employee portal? Admin/superadmin will still see it and receive a notification.`
          }
          requireType={isPrivilegedDelete}
        />
      </div>
    </AdminLayout>
  )
}
