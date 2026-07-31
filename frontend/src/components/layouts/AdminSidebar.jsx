import { 
  LayoutDashboard, 
  Briefcase, 
  Users, 
  HeadphonesIcon, 
  BarChart3, 
  Activity, 
  UserCheck, 
  Shield, 
  CreditCard,
  FolderOpen,
  Layers,
  FileBadge,
  X
} from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '../../lib/utils'
import { hasPermission, useAuth } from '../../hooks/useAuth'
import logo from '../../assets/logo.png'

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard',          path: '/admin/dashboard' },
  { icon: FolderOpen,      label: 'Projects',            path: '/admin/projects',         permission: ['projects', 'view'] },
  { icon: Briefcase,       label: 'Jobs',                path: '/admin/jobs',             permission: ['jobs', 'view'] },
  { icon: Users,           label: 'Applications',        path: '/admin/applications',     permission: ['applications', 'view'] },
  { icon: FileBadge,       label: 'Admit Cards',         path: '/admin/admit-cards',      permission: ['admitCards', 'view'] },
  { icon: BarChart3,       label: 'Analytics',           path: '/admin/analytics',        permission: ['analytics', 'view'] },
  { icon: Activity,        label: 'Activity Logs',       path: '/admin/activity-logs',    permission: ['employees', 'view'] },
  { icon: HeadphonesIcon,  label: 'Support',             path: '/admin/support',          permission: ['support', 'view'] },
  { icon: UserCheck,       label: 'Employees',           path: '/admin/employees',        permission: ['employees', 'view'] },
  { icon: Shield,          label: 'Roles & Permissions', path: '/admin/roles',            permission: ['employees', 'view'] },
  { icon: CreditCard,      label: 'Payment Settings',    path: '/admin/payment-settings', permission: ['paymentSettings', 'view'] },
  { icon: Layers,          label: 'CMS',                 path: '/admin/cms',              permission: ['projects', 'edit'] },
]

const AdminSidebar = ({ isCollapsed = false, isMobile = false, onClose }) => {
  const location = useLocation()
  const { user } = useAuth()
  const visibleMenuItems = menuItems.filter((item) => {
    if (!item.permission) return true
    return hasPermission(user, item.permission[0], item.permission[1])
  })

  return (
    <div className="bg-white border-r border-orange-100 h-full flex flex-col shadow-sm overflow-hidden">
      {/* Logo */}
      <div className={cn(
        'flex h-[72px] items-center border-b border-orange-100 bg-white flex-shrink-0',
        isCollapsed && !isMobile ? 'justify-center px-3' : 'justify-center px-5'
      )}>
        {isCollapsed && !isMobile ? (
          <Link to="/admin/dashboard">
            <div className="w-9 h-9 rounded-lg bg-[#1f1d1b] flex items-center justify-center p-1.5 overflow-hidden">
              <img src={logo} alt="ICEF India" className="w-full h-full object-contain" />
            </div>
          </Link>
        ) : (
          <Link to="/admin/dashboard" className="flex h-full items-center justify-center min-w-0">
            <div className="h-[50px] w-[126px] rounded-lg bg-[#1f1d1b] inline-flex items-center justify-center px-3">
              <img src={logo} alt="ICEF India" className="max-h-8 max-w-full object-contain" />
            </div>
          </Link>
        )}
        {isMobile && onClose && (
          <button
            onClick={onClose}
            className="ml-auto p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors flex-shrink-0"
            aria-label="Close sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {!isCollapsed || isMobile ? (
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 pb-2 pt-1">
            Main Navigation
          </p>
        ) : null}

        {visibleMenuItems.map((item) => {
          const Icon = item.icon
          // Highlight active: exact match OR sub-path (but not cross-contaminating)
          const isActive =
            location.pathname === item.path ||
            (item.path !== '/admin/dashboard' && location.pathname.startsWith(item.path + '/'))
          
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={isMobile ? onClose : undefined}
              title={isCollapsed && !isMobile ? item.label : undefined}
              className={cn(
                'flex items-center rounded-lg transition-all duration-200 ease-out group relative',
                isCollapsed && !isMobile
                  ? 'px-2 py-2.5 justify-center'
                  : 'px-3 py-2.5 space-x-3',
                isActive
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-orange-50 hover:text-gray-900'
              )}
            >
              <Icon
                className={cn(
                  'w-5 h-5 flex-shrink-0 transition-colors',
                  isActive ? 'text-white' : 'text-gray-400 group-hover:text-orange-600'
                )}
              />
              {(!isCollapsed || isMobile) && (
                <span className="font-medium text-sm leading-none">{item.label}</span>
              )}
              {/* Tooltip for collapsed mode */}
              {isCollapsed && !isMobile && (
                <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-gray-900 text-white text-xs rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
                  {item.label}
                  <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900" />
                </div>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Quick Access */}
      {(!isCollapsed || isMobile) && (
        <div className="flex-shrink-0 border-t border-orange-100 p-3">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 pb-2">
            Quick Access
          </p>
          
          <Link
            to="/"
            onClick={isMobile ? onClose : undefined}
            className="flex items-center space-x-3 px-3 py-2 rounded-lg text-orange-600 hover:bg-orange-50 transition-colors text-sm font-medium"
          >
            <LayoutDashboard className="w-4 h-4 flex-shrink-0" />
            <span>Public Website</span>
          </Link>
        </div>
      )}
    </div>
  )
}

export default AdminSidebar
