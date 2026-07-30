import { useState, useEffect, useRef } from 'react'
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell, Briefcase, FileText, HelpCircle,
  Home, LogOut, User, FileBadge,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { authService, getStoredUser } from '../../services/auth.service'
import { candidateService } from '../../services/candidate.service'
import LogoutModal from '../ui/LogoutModal'
import { REALTIME_ENABLED } from '../../api/config'
import logo from '../../assets/logo.png'

const navItems = [
  { to: '/candidate/dashboard',     label: 'Dashboard',     icon: Home       },
  { to: '/candidate/jobs',          label: 'Jobs',          icon: Briefcase  },
  { to: '/candidate/applications',  label: 'Applications',  icon: FileText   },
  { to: '/candidate/admit-card',    label: 'Admit Card',    icon: FileBadge  },
  { to: '/candidate/profile',       label: 'Profile',       icon: User       },
  { to: '/candidate/notifications', label: 'Notifications', icon: Bell, badge: true },
  { to: '/candidate/support',       label: 'Support',       icon: HelpCircle },
]

// Page transition variants
const pageVariants = {
  initial:  { opacity: 0, y: 16 },
  animate:  { opacity: 1, y: 0, transition: { duration: 0.22, ease: 'easeOut' } },
  exit:     { opacity: 0, y: -8, transition: { duration: 0.12 } },
}

// Sidebar nav item stagger
const sidebarVariants = {
  animate: { transition: { staggerChildren: 0.05 } },
}
const navItemVariants = {
  initial: { opacity: 0, x: -12 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.18, ease: 'easeOut' } },
}

const CandidateLayout = ({ children, title = 'Candidate Portal' }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const user = getStoredUser()
  const [showLogout, setShowLogout] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const mainRef = useRef(null)

  const { data: notifData } = useQuery({
    queryKey: ['candidate-notifications-count'],
    queryFn: () => candidateService.getNotifications({ limit: 1 }),
    refetchInterval: REALTIME_ENABLED ? false : 60000,
    staleTime: 60000,
  })
  const unreadCount = notifData?.unreadCount || 0

  // Header shadow on scroll
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const handleLogout = async () => {
    setLoggingOut(true)
    await authService.logout()
    navigate('/auth/candidate-login', { replace: true })
  }

  return (
    <div className="customer-motion-root h-screen overflow-hidden bg-orange-50 flex flex-col">

      {/* ── Top Header ── */}
      <header className={`sticky top-0 z-30 bg-white border-b border-gray-100 transition-all duration-200 ${scrolled ? 'shadow-[0_2px_16px_rgba(0,0,0,0.08)]' : ''}`}>
        <div className="w-full px-3 sm:px-4 lg:px-6 h-14 flex items-center justify-between gap-4">

          {/* ── Brand ── */}
          <Link to="/" className="flex items-center gap-2.5 group flex-shrink-0">
            <motion.div
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.95 }}
              className="w-8 h-8 rounded-lg bg-[#1f1d1b] flex items-center justify-center shadow-sm overflow-hidden"
            >
              <img src={logo} alt="ICEF India" className="h-full w-full object-contain p-1" />
            </motion.div>
            <div className="hidden sm:block">
              <div className="text-sm font-bold text-gray-900 leading-tight tracking-tight group-hover:text-orange-600 transition-colors">
                Recruitment Portal
              </div>
              <div className="text-[10px] font-semibold text-orange-500 uppercase tracking-widest leading-tight">
                Candidate Portal
              </div>
            </div>
          </Link>

          {/* ── Right side ── */}
          <div className="flex items-center gap-1.5 sm:gap-2">

            {/* Notification bell */}
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Link
                to="/candidate/notifications"
                className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gray-50 hover:bg-orange-50 border border-gray-200 hover:border-orange-200 transition-all duration-150"
              >
                <Bell className="w-4 h-4 text-gray-500" />
                <AnimatePresence>
                  {unreadCount > 0 && (
                    <motion.span
                      key="badge"
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                      className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-[5px] bg-orange-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none ring-2 ring-white tabular-nums"
                    >
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Link>
            </motion.div>

            {/* Divider */}
            <div className="hidden sm:block w-px h-5 bg-gray-200 mx-1" />

            {/* User chip */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setShowLogout(true)}
              className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-xl border border-gray-200 hover:border-orange-300 hover:bg-orange-50 transition-all duration-150 group"
            >
              {/* Avatar */}
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                <span className="text-white font-bold text-[11px] leading-none">
                  {(user?.fullName || user?.email || 'C')
                    .split(' ')
                    .map(n => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()}
                </span>
              </div>
              <span className="hidden sm:inline text-sm font-semibold text-gray-700 group-hover:text-orange-700 transition-colors max-w-[120px] truncate">
                {user?.fullName?.split(' ')[0] || user?.email?.split('@')[0] || 'Candidate'}
              </span>
              <LogOut className="w-3.5 h-3.5 text-gray-400 group-hover:text-red-500 transition-colors flex-shrink-0" />
            </motion.button>
          </div>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex-1 min-h-0 w-full grid grid-cols-1 lg:grid-cols-[220px_1fr] items-stretch gap-6 lg:gap-8 px-3 sm:px-4 lg:px-6 py-5">

        {/* ── Sidebar ── */}
        <aside className="min-h-0 flex flex-col overflow-hidden lg:h-full">
          {/* Header strip */}
          <div className="bg-[#0f172a] rounded-t-xl px-4 py-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#1f1d1b] flex items-center justify-center flex-shrink-0 shadow-md overflow-hidden">
              <img src={logo} alt="ICEF India" className="h-full w-full object-contain p-1" />
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-tight">Candidate Portal</p>
              <p className="text-orange-400 text-[10px] font-semibold uppercase tracking-widest">Bihar Recruitment</p>
            </div>
          </div>

          {/* Nav */}
          <motion.nav
            variants={sidebarVariants}
            initial="initial"
            animate="animate"
            className="hover-scroll bg-[#1e293b] rounded-b-xl p-2 space-y-0.5 flex-1 min-h-0 overflow-y-auto max-h-[240px] lg:max-h-none"
          >
            {navItems.map((item) => (
              <motion.div key={item.to} variants={navItemVariants}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                      isActive
                        ? 'bg-orange-600 text-white shadow-sm shadow-orange-900/30'
                        : 'text-slate-300 hover:bg-white/[0.08] hover:text-white'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <div className="relative flex-shrink-0">
                        <item.icon className={`w-4 h-4 transition-colors ${isActive ? 'text-white' : 'text-slate-400'}`} />
                        {item.badge && unreadCount > 0 && (
                          <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-orange-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                            {unreadCount > 9 ? '9+' : unreadCount}
                          </span>
                        )}
                      </div>
                      <span className="flex-1">{item.label}</span>
                      {item.badge && unreadCount > 0 && (
                        <span className="bg-orange-500 text-white text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              </motion.div>
            ))}

            {/* Divider */}
            <div className="border-t border-white/10 my-1" />

            {/* Sign out */}
            <motion.button
              variants={navItemVariants}
              whileHover={{ x: 2 }}
              onClick={() => setShowLogout(true)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all"
            >
              <LogOut className="w-4 h-4 flex-shrink-0" />
              <span>Sign Out</span>
            </motion.button>
          </motion.nav>
        </aside>

        {/* ── Page Content with animation ── */}
        <main
          className="hover-scroll min-w-0 min-h-0 overflow-y-auto"
          ref={mainRef}
          onScroll={(event) => setScrolled(event.currentTarget.scrollTop > 8)}
        >
          <h1 className="sr-only">{title}</h1>
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="candidate-page-root min-h-full w-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* ── Logout Modal ── */}
      <LogoutModal
        isOpen={showLogout}
        onCancel={() => setShowLogout(false)}
        onConfirm={handleLogout}
        isPending={loggingOut}
      />
    </div>
  )
}

export default CandidateLayout
