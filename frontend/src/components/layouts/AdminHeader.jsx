import { Search, Bell, HelpCircle, Menu, Settings, LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getStoredUser } from '../../services/auth.service'
import { adminService } from '../../services/admin.service'
import { REALTIME_ENABLED } from '../../api/config'

const AdminHeader = ({ onToggleSidebar, title = 'Admin Panel', isCollapsed, onLogout }) => {
  const user = getStoredUser()
  const displayName = user?.fullName || user?.officialEmail || 'Admin Central'
  const roleName = user?.systemRole?.roleName || user?.roleDesignation || 'Admin'
  const initials = (user?.fullName || 'AC').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()

  // Live unread notification count
  const { data: notifData } = useQuery({
    queryKey: ['admin-notifications-count'],
    queryFn: () => adminService.getAdminNotifications({ limit: 1 }),
    refetchInterval: REALTIME_ENABLED ? false : 60000,
    staleTime: 60000,
  })
  const unreadCount = notifData?.unreadCount || 0

  return (
    <header className="flex h-[72px] items-center bg-white border-b border-gray-100 px-4 sm:px-6 shadow-sm">
      <div className="flex w-full items-center justify-between gap-4">

        {/* Left: toggle + title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onToggleSidebar}
            className="p-2 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors flex-shrink-0"
          >
            <span className="lg:hidden"><Menu className="w-5 h-5" /></span>
            <span className="hidden lg:block">
              {isCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
            </span>
          </button>
          <h1 className="text-base sm:text-lg font-semibold text-gray-800 truncate leading-tight">{title}</h1>
        </div>

        {/* Right */}
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          {/* Search */}
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search..."
              className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent w-56 lg:w-72 bg-gray-50 focus:bg-white transition-all text-sm"
            />
          </div>
          <button className="md:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors">
            <Search className="w-5 h-5" />
          </button>

          {/* Notifications */}
          <Link to="/admin/notifications" className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors">
            <Bell className="w-5 h-5" />
            {unreadCount > 0 ? (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-orange-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center ring-2 ring-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            ) : null}
          </Link>

          <button className="hidden sm:flex p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors">
            <HelpCircle className="w-5 h-5" />
          </button>

          <Link to="/admin/settings-profile" className="hidden sm:flex p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors">
            <Settings className="w-5 h-5" />
          </Link>

          {/* User + dropdown */}
          <div className="relative group pl-2 sm:pl-3 border-l border-gray-200 ml-1">
            <Link
              to="/admin/settings-profile"
              className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-400 transition-colors"
              aria-label="Open settings and profile"
            >
              <div className="text-right hidden sm:block">
                <div className="text-sm font-semibold text-gray-800 leading-tight">{displayName}</div>
                <div className="text-[10px] text-orange-600 font-bold uppercase tracking-wide">{roleName}</div>
              </div>
              <div className="w-9 h-9 bg-gradient-to-br from-orange-500 to-orange-700 rounded-full flex items-center justify-center shadow-md">
                <span className="text-white font-bold text-sm">{initials}</span>
              </div>
            </Link>
            <div className="absolute right-0 top-full hidden h-2 w-full group-hover:block group-focus-within:block" />
            {/* Dropdown */}
            <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl shadow-xl border border-gray-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-all duration-200 z-50">
              <div className="p-3 border-b border-gray-100">
                <div className="font-semibold text-gray-900 text-sm">{displayName}</div>
                <div className="text-xs text-gray-500">{user?.officialEmail || user?.email || ''}</div>
              </div>
              <div className="p-2">
                <Link to="/admin/settings-profile" className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors">
                  <Settings className="w-4 h-4 text-gray-400" />
                  <span>Settings & Profile</span>
                </Link>
                <button
                  type="button"
                  onClick={onLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

export default AdminHeader
