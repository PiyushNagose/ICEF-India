import { useMemo, useState } from 'react'
import { Search, Bell, HelpCircle, Menu, Settings, LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getStoredUser } from '../../services/auth.service'
import { adminService } from '../../services/admin.service'
import { REALTIME_ENABLED } from '../../api/config'
import { hasPermission } from '../../hooks/useAuth'

const SEARCH_TARGETS = [
  { label: 'Dashboard', path: '/admin/dashboard', keywords: 'overview home kpi' },
  { label: 'Projects', path: '/admin/projects', permission: ['projects', 'view'], keywords: 'project lifecycle setup publish' },
  { label: 'Jobs', path: '/admin/jobs', permission: ['jobs', 'view'], keywords: 'job advertisement vacancy posts recruitment' },
  { label: 'Applications', path: '/admin/applications', permission: ['applications', 'view'], keywords: 'candidate application register' },
  { label: 'Admit Cards', path: '/admin/admit-cards', permission: ['admitCards', 'view'], keywords: 'hall ticket schedule exam' },
  { label: 'Exam Centers', path: '/admin/centers', permission: ['admitCards', 'view'], keywords: 'center room capacity seats pincode' },
  { label: 'Exam Templates', path: '/admin/admit-card-templates', permission: ['admitCards', 'view'], keywords: 'template admit card design' },
  { label: 'Analytics', path: '/admin/analytics', permission: ['analytics', 'view'], keywords: 'report chart stats' },
  { label: 'Funnel Analysis', path: '/admin/analytics/funnel', permission: ['analytics', 'view'], keywords: 'conversion stage' },
  { label: 'Activity Logs', path: '/admin/activity-logs', permission: ['activityLogs', 'view'], keywords: 'audit employee history' },
  { label: 'Support', path: '/admin/support', permission: ['support', 'view'], keywords: 'ticket help complaint query' },
  { label: 'Support Kanban', path: '/admin/support/kanban', permission: ['support', 'view'], keywords: 'ticket board drag status' },
  { label: 'Employees', path: '/admin/employees', permission: ['employees', 'view'], keywords: 'staff team users' },
  { label: 'Roles & Permissions', path: '/admin/roles', permission: ['employees', 'view'], keywords: 'access role permission' },
  { label: 'Payment Settings', path: '/admin/payment-settings', permission: ['paymentSettings', 'view'], keywords: 'gateway razorpay cashfree fee' },
  { label: 'CMS', path: '/admin/cms', permission: ['cms', 'view'], keywords: 'public page landing content publish' },
  { label: 'Standards Settings', path: '/admin/standards-settings', permission: ['standardsSettings', 'view'], keywords: 'eligibility preset rules' },
  { label: 'Notifications', path: '/admin/notifications', keywords: 'alerts notice updates' },
  { label: 'Settings & Profile', path: '/admin/settings-profile', keywords: 'profile password account' },
]

const AdminHeader = ({ onToggleSidebar, title = 'Admin Panel', isCollapsed, onLogout }) => {
  const location = useLocation()
  const navigate = useNavigate()
  const user = getStoredUser()
  const [search, setSearch] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
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
  const visibleSearchTargets = useMemo(
    () =>
      SEARCH_TARGETS.filter((item) => {
        if (!item.permission) return true
        return hasPermission(user, item.permission[0], item.permission[1])
      }),
    [user],
  )
  const searchResults = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return []

    return visibleSearchTargets
      .filter((item) =>
        `${item.label} ${item.keywords || ''}`.toLowerCase().includes(query),
      )
      .slice(0, 6)
  }, [search, visibleSearchTargets])
  const iconNavClass = (path) => {
    const isActive = location.pathname === path || location.pathname.startsWith(`${path}/`)
    return `relative inline-flex h-10 w-10 items-center justify-center rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 ${
      isActive
        ? 'border border-orange-200 bg-orange-50 text-orange-700'
        : 'text-gray-500 hover:bg-orange-50 hover:text-orange-700'
    }`
  }
  const goToSearchResult = (target) => {
    if (!target) return
    navigate(target.path)
    setSearch('')
    setSearchFocused(false)
  }
  const handleSearchKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      goToSearchResult(searchResults[0])
    }
    if (event.key === 'Escape') {
      setSearch('')
      setSearchFocused(false)
      event.currentTarget.blur()
    }
  }

  return (
    <header className="flex h-[72px] items-center bg-white border-b border-gray-100 px-4 sm:px-6 shadow-sm">
      <div className="flex w-full items-center justify-between gap-4">

        {/* Left: toggle + title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onToggleSidebar}
            className="p-2 rounded-xl text-gray-500 hover:text-orange-700 hover:bg-orange-50 transition-colors flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
            aria-label="Toggle sidebar"
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
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 120)}
              onKeyDown={handleSearchKeyDown}
              className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent w-56 lg:w-72 bg-gray-50 focus:bg-white transition-all text-sm"
              aria-label="Search admin screens"
            />
            {searchFocused && search.trim() && (
              <div className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-xl border border-orange-100 bg-white shadow-xl">
                {searchResults.length > 0 ? (
                  searchResults.map((item) => (
                    <button
                      key={item.path}
                      type="button"
                      onMouseDown={(event) => {
                        event.preventDefault()
                        goToSearchResult(item)
                      }}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm text-gray-700 transition-colors hover:bg-orange-50 hover:text-orange-700"
                    >
                      <span className="font-semibold">{item.label}</span>
                      <span className="truncate text-xs text-gray-400">{item.path}</span>
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-3 text-sm text-gray-500">
                    No matching screen
                  </div>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            className="md:hidden p-2 rounded-xl text-gray-500 hover:bg-orange-50 hover:text-orange-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
            aria-label="Search"
          >
            <Search className="w-5 h-5" />
          </button>

          {/* Notifications */}
          <Link
            to="/admin/notifications"
            className={iconNavClass('/admin/notifications')}
            aria-label="Open notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 ? (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-orange-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center ring-2 ring-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            ) : null}
          </Link>

          <Link
            to="/admin/support"
            className={`${iconNavClass('/admin/support')} hidden sm:inline-flex`}
            aria-label="Open support"
          >
            <HelpCircle className="w-5 h-5" />
          </Link>

          <Link
            to="/admin/settings-profile"
            className={`${iconNavClass('/admin/settings-profile')} hidden sm:inline-flex`}
            aria-label="Open settings and profile"
          >
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
