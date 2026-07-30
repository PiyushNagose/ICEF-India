import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Activity, Clock, User, FileText } from 'lucide-react'
import AdminLayout from '../../components/layouts/AdminLayout'
import { Card, CardContent, CardHeader } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import { adminService } from '../../services/admin.service'

const EmployeeActivity = () => {
  const { id } = useParams()
  const navigate = useNavigate()

  // Fetch employee data
  const { data: employeeData, isLoading: employeeLoading } = useQuery({
    queryKey: ['admin-employee', id],
    queryFn: () => adminService.getEmployee(id),
  })

  // Fetch activity logs for this employee
  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ['admin-activity-logs', id],
    queryFn: () => adminService.getActivityLogs({ employeeId: id, limit: 50 }),
  })

  const employee = employeeData?.employee
  const logs = logsData?.logs || logsData?.activityLogs || logsData?.data?.logs || []

  const getActionColor = (action) => {
    if (action.includes('CREATE') || action.includes('created')) return 'text-green-600 bg-green-50'
    if (action.includes('UPDATE') || action.includes('updated')) return 'text-blue-600 bg-blue-50'
    if (action.includes('DELETE') || action.includes('deleted')) return 'text-red-600 bg-red-50'
    if (action.includes('LOGIN') || action.includes('login')) return 'text-purple-600 bg-purple-50'
    return 'text-gray-600 bg-gray-50'
  }

  const formatDate = (date) => {
    return new Date(date).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <AdminLayout title="Employee Activity">
      <div className="min-h-full p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin/employees')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">Employee Activity Logs</h1>
            <p className="text-gray-600 text-sm">View all activities performed by this employee.</p>
          </div>
        </div>

        {/* Employee Info Card */}
        {employeeLoading ? (
          <Card>
            <CardContent className="py-8 text-center text-gray-600">Loading employee details...</CardContent>
          </Card>
        ) : employee ? (
          <Card className="bg-gradient-to-r from-orange-50 to-orange-100 border-orange-200">
            <CardContent className="py-6">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 rounded-full bg-orange-600 flex items-center justify-center text-white text-2xl font-bold">
                  {employee.fullName?.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-gray-900">{employee.fullName}</h2>
                  <p className="text-gray-600">{employee.officialEmail}</p>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-sm text-gray-600">
                      <strong>ID:</strong> {employee.employeeId}
                    </span>
                    <span className="text-sm text-gray-600">
                      <strong>Department:</strong> {employee.department}
                    </span>
                    <span className="text-sm text-gray-600">
                      <strong>Role:</strong> {employee.systemRole?.roleName || employee.roleDesignation}
                    </span>
                    <Badge className={employee.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                      {employee.status}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Activity Logs */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-orange-600" />
              <h3 className="font-semibold text-gray-900">Activity Timeline</h3>
            </div>
          </CardHeader>
          <CardContent>
            {logsLoading ? (
              <div className="py-8 text-center text-gray-600">Loading activity logs...</div>
            ) : logs.length === 0 ? (
              <div className="py-8 text-center text-gray-600">
                <Activity className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p>No activity logs found for this employee.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {logs.map((log, index) => (
                  <div key={log._id || index} className="flex gap-4 pb-4 border-b border-gray-100 last:border-0">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${getActionColor(log.action)}`}>
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-medium text-gray-900">{log.action}</p>
                          {log.description && (
                            <p className="text-sm text-gray-600 mt-1">{log.description}</p>
                          )}
                          {log.module && (
                            <Badge className="mt-2 bg-gray-100 text-gray-700 text-xs">
                              {log.module}
                            </Badge>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="flex items-center gap-1 text-sm text-gray-500">
                            <Clock className="w-3 h-3" />
                            {formatDate(log.timestamp || log.createdAt)}
                          </div>
                          {log.ipAddress && (
                            <p className="text-xs text-gray-400 mt-1">IP: {log.ipAddress}</p>
                          )}
                        </div>
                      </div>
                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                          <p className="text-xs font-medium text-gray-600 mb-1">Additional Details:</p>
                          <pre className="hover-scroll text-xs text-gray-700 overflow-x-auto">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}

export default EmployeeActivity





