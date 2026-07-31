import { Navigate, useLocation } from 'react-router-dom'
import { getDashboardPath, getInternalLoginPath, hasPermission, isAdminUser, isCandidateUser, useAuth } from '../../hooks/useAuth'

const PermissionDenied = () => (
  <div className="min-h-screen bg-[#fbf7ef] flex items-center justify-center px-4">
    <div className="max-w-md w-full rounded-2xl border border-orange-100 bg-white p-6 text-center shadow-sm">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-orange-50 text-orange-600">
        !
      </div>
      <h1 className="text-xl font-bold text-gray-900">Permission denied</h1>
      <p className="mt-2 text-sm text-gray-500">
        Your role does not allow access to this admin module.
      </p>
    </div>
  </div>
)

const ProtectedRoute = ({ children, role, permission }) => {
  const location = useLocation()
  const { token, user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-orange-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!token || !user) {
    return <Navigate to={role === 'admin' ? getInternalLoginPath(user) : '/auth/candidate-login'} state={{ from: location }} replace />
  }

  if (role === 'admin' && !isAdminUser(user)) {
    return <Navigate to={getDashboardPath(user)} replace />
  }

  if (
    role === 'admin' &&
    user?.mustChangePassword &&
    location.pathname !== '/admin/settings-profile'
  ) {
    return <Navigate to="/admin/settings-profile" replace />
  }

  if (role === 'admin' && permission && !hasPermission(user, permission[0], permission[1])) {
    return <PermissionDenied />
  }

  if (role === 'candidate' && !isCandidateUser(user)) {
    return <Navigate to={getDashboardPath(user)} replace />
  }

  return children
}

export default ProtectedRoute
