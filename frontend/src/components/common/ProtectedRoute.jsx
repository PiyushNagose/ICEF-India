import { Navigate, useLocation } from 'react-router-dom'
import { getDashboardPath, isAdminUser, isCandidateUser, useAuth } from '../../hooks/useAuth'

const ProtectedRoute = ({ children, role }) => {
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
    return <Navigate to={role === 'admin' ? '/auth/admin-login' : '/auth/candidate-login'} state={{ from: location }} replace />
  }

  if (role === 'admin' && !isAdminUser(user)) {
    return <Navigate to={getDashboardPath(user)} replace />
  }

  if (role === 'candidate' && !isCandidateUser(user)) {
    return <Navigate to={getDashboardPath(user)} replace />
  }

  return children
}

export default ProtectedRoute
