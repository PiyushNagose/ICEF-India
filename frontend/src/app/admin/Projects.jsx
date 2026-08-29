import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'

import {
  Plus,
  Eye,
  Edit,
  FolderOpen,
  Rocket,
  CheckCircle,
  Calendar,
  Trash2,
} from 'lucide-react'

import AdminLayout from '../../components/layouts/AdminLayout'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import ConfirmDeleteModal from '../../components/ui/ConfirmDeleteModal'
import AdminPagination from '../../components/ui/AdminPagination'
import { AdminTableShell, AdminTableStatusRow } from '../../components/ui/AdminTable'
import { adminService } from '../../services/admin.service'
import { hasPermission, useAuth, isSuperAdminUser } from '../../hooks/useAuth'
import {
  getProjectLifecycleStatus,
  getProjectStatusBadgeClass,
} from '../../utils/projectLifecycle'

const Projects = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const isPrivilegedDelete = isSuperAdminUser(user)
  const canCreate = hasPermission(user, 'projects', 'create')
  const canEdit = hasPermission(user, 'projects', 'edit')
  const canDelete = hasPermission(user, 'projects', 'delete')
  const [page, setPage] = useState(1)
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, project: null })

  const { data, isLoading } = useQuery({
    queryKey: ['admin-projects', page],
    queryFn: () => adminService.getProjects({ page, limit: 10 }),
  })



  const { mutate: deleteProject } = useMutation({
    mutationFn: adminService.deleteProject,
    onSuccess: (result) => {
      toast.success(result?.message || 'Project deleted')

      queryClient.invalidateQueries({
        queryKey: ['admin-projects'],
      })

      queryClient.invalidateQueries({
        queryKey: ['admin-project-stats'],
      })
    },

    onError: (err) =>
      toast.error(err.message || 'Failed to delete project'),
  })

  const handleDeleteClick = (project) => {
    setDeleteModal({ isOpen: true, project })
  }

  const confirmDelete = () => {
    if (deleteModal.project) {
      deleteProject(deleteModal.project._id)
      setDeleteModal({ isOpen: false, project: null })
    }
  }

  const projects = (data?.projects || []).map((project) => ({
    ...project,
    status: getProjectLifecycleStatus(project),
  }))
  const pagination = data?.pagination || data?.meta || {}
  const totalPages = pagination.totalPages || 1
  const totalItems = pagination.totalItems || pagination.total || projects.length

  const stats = [
    {
      title: 'TOTAL PROJECTS',
      value:
        data?.pagination?.totalItems || projects.length,
      icon: FolderOpen,
      color:
        'from-blue-500 to-blue-600',
      bg: 'bg-blue-50',
      iconColor: 'text-blue-600',
    },
    {
      title: 'ACTIVE',
      value:
        projects.filter((p) => p.status === 'Active').length,
      icon: Rocket,
      color:
        'from-green-500 to-green-600',
      bg: 'bg-green-50',
      iconColor: 'text-green-600',
    },
    {
      title: 'COMPLETED',
      value:
        projects.filter((p) => p.status === 'Completed').length,
      icon: CheckCircle,
      color:
        'from-purple-500 to-purple-600',
      bg: 'bg-purple-50',
      iconColor: 'text-purple-600',
    },
    {
      title: 'UPCOMING',
      value:
        projects.filter((p) => p.status === 'Upcoming').length,
      icon: Calendar,
      color:
        'from-orange-500 to-orange-600',
      bg: 'bg-orange-50',
      iconColor: 'text-orange-600',
    },
  ]

  return (
    <AdminLayout title="Projects">
      <div className="min-h-full bg-[#f7f4ee] p-5 space-y-5">

        {/* HEADER */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">

          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Projects
            </h1>

            <p className="text-sm text-gray-500 mt-1">
              Oversee and manage recruitment cycles across Bihar departments.
            </p>
          </div>

          {canCreate && (
            <Button
              onClick={() =>
                navigate('/admin/projects/create')
              }
              className="
                bg-orange-600 hover:bg-orange-700
                text-white rounded-2xl
                shadow-lg shadow-orange-200
                px-5 h-11
              "
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Project
            </Button>
          )}
        </div>

        {/* STATS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">

          {stats.map((stat) => (
            <div
              key={stat.title}
              className="
                relative overflow-hidden
                rounded-[22px]
                bg-white
                border border-gray-200
                shadow-sm
                hover:-translate-y-0.5
                transition-all duration-200 ease-out
                p-4
              "
            >

              <div className={`
                absolute top-0 left-0 w-full h-1
                bg-gradient-to-r ${stat.color}
              `} />

              <div className="flex items-center justify-between">

                <div>
                  <p className="text-xs tracking-normal font-bold text-gray-400 mb-2">
                    {stat.title}
                  </p>

                  <h2 className="text-3xl font-bold text-gray-900">
                    {Number(stat.value || 0).toLocaleString('en-IN')}
                  </h2>
                </div>

                <div className={`
                  w-12 h-12 rounded-2xl
                  flex items-center justify-center
                  ${stat.bg}
                `}>
                  <stat.icon
                    className={`w-5 h-5 ${stat.iconColor}`}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* TABLE */}
        <AdminTableShell
          className="rounded-[24px]"
          minHeight="min-h-[620px] xl:min-h-[calc(100vh_-_300px)]"
          footer={
            !isLoading && projects.length > 0 ? (
              <AdminPagination
                page={page}
                totalPages={totalPages}
                totalItems={totalItems}
                pageSize={pagination.itemsPerPage || 10}
                itemsOnPage={projects.length}
                itemLabel="projects"
                onPageChange={setPage}
              />
            ) : null
          }
        >

            <table className="w-full min-w-[1040px] table-fixed">
              <colgroup>
                <col className="w-[24%]" />
                <col className="w-[16%]" />
                <col className="w-[16%]" />
                <col className="w-[12%]" />
                <col className="w-[10%]" />
                <col className="w-[10%]" />
                <col className="w-[12%]" />
              </colgroup>

              <thead className="bg-gray-50 border-b border-gray-100">

                <tr>
                  {[
                    'Project Name',
                    'State',
                    'Department',
                    'Status',
                    'Start',
                    'End',
                    'Actions',
                  ].map((head) => (
                    <th
                      key={head}
                      className={`
                        px-5 py-4
                        text-xs
                        font-semibold
                        tracking-normal
                        text-gray-500
                        uppercase
                        ${['State', 'Status', 'Start', 'End', 'Actions'].includes(head) ? 'text-center' : 'text-left'}
                      `}
                    >
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">

                {isLoading && (
                  <AdminTableStatusRow colSpan={7} type="loading" title="Loading projects..." />
                )}

                {!isLoading &&
                  projects.length === 0 && (
                    <AdminTableStatusRow colSpan={7} icon={FolderOpen} title="No projects found" description="Create a project to organize recruitment jobs." />
                  )}

                {projects.map((project) => (
                  <tr
                    key={project._id}
                    className="
                      hover:bg-orange-50/40
                      transition-all duration-200
                    "
                  >

                    <td className="px-5 py-5">

                      <div className="font-bold text-gray-900">
                        {project.name}
                      </div>

                      {project.isSoftDeleted && (
                        <Badge className="mt-2 bg-amber-50 text-amber-700 border border-amber-200">
                          Removed by employee
                        </Badge>
                      )}

                      <div className="text-xs text-gray-500 mt-1 max-w-[250px] truncate">
                        {project.description ||
                          'No description'}
                      </div>
                    </td>

                    <td className="px-5 py-5 text-center">
                      <Badge className="bg-gray-100 text-gray-700">
                        {project.state}
                      </Badge>
                    </td>

                    <td className="px-5 py-5 text-sm text-gray-600 leading-snug">
                      {project.department}
                    </td>

                    <td className="px-5 py-5 text-center">

                      <Badge
                        className={
                          getProjectStatusBadgeClass(project.status)
                        }
                      >
                        {project.status}
                      </Badge>
                    </td>

                    <td className="px-5 py-5 text-center text-sm text-gray-500">
                      {project.startDate
                        ? new Date(
                            project.startDate
                          ).toLocaleDateString('en-IN')
                        : '—'}
                    </td>

                    <td className="px-5 py-5 text-center text-sm text-gray-500">
                      {project.endDate
                        ? new Date(
                            project.endDate
                          ).toLocaleDateString('en-IN')
                        : '—'}
                    </td>

                    <td className="px-5 py-5 text-center">

                      <div className="flex items-center justify-center gap-2">

                        <button
                          onClick={() =>
                            navigate(
                              `/admin/projects/${project._id}`
                            )
                          }
                          className="
                            w-9 h-9 rounded-xl
                            flex items-center justify-center
                            hover:bg-gray-100
                            text-gray-500
                            transition-all
                          "
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {canEdit && (
                          <button
                            onClick={() =>
                              navigate(
                                `/admin/projects/${project._id}/edit`
                              )
                            }
                            className="
                              w-9 h-9 rounded-xl
                              flex items-center justify-center
                              hover:bg-blue-50
                              text-blue-600
                              transition-all
                            "
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        )}

                        {canDelete && (
                          <button
                            onClick={() =>
                              handleDeleteClick(project)
                            }
                            className="
                              w-9 h-9 rounded-xl
                              flex items-center justify-center
                              hover:bg-red-50
                              text-red-600
                              transition-all
                            "
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}

                      </div>
                    </td>

                  </tr>
                ))}
              </tbody>

            </table>
        </AdminTableShell>
      </div>

      <ConfirmDeleteModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, project: null })}
        onConfirm={confirmDelete}
        title="Delete Project"
        message={
          isPrivilegedDelete
            ? `Are you sure you want to permanently delete "${deleteModal.project?.name}"? This will delete all its jobs and data.`
            : `Remove "${deleteModal.project?.name}" from the employee portal? Admin/superadmin will still see it and receive a notification.`
        }
        requireType={isPrivilegedDelete}
      />
    </AdminLayout>
  )
}

export default Projects
