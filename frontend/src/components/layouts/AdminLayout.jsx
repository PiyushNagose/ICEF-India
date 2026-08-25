import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import AdminSidebar from './AdminSidebar'
import AdminHeader from './AdminHeader'
import LogoutModal from '../ui/LogoutModal'
import { authService, getLastInternalLoginPath } from '../../services/auth.service'

const pageVariants = {
  initial:  { opacity: 0, y: 14 },
  animate:  { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } },
  exit:     { opacity: 0, y: -8, transition: { duration: 0.16, ease: 'easeOut' } },
}

const AdminLayout = ({ children, title }) => {
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [showLogout, setShowLogout] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) setMobileSidebarOpen(false)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleToggleSidebar = () => {
    if (window.innerWidth < 1024) setMobileSidebarOpen(p => !p)
    else setSidebarCollapsed(p => !p)
  }

  const handleLogout = async () => {
    setLoggingOut(true)
    const loginPath = getLastInternalLoginPath()
    await authService.logout()
    navigate(loginPath, { replace: true })
  }

  return (
    <div className="admin-motion-root h-screen overflow-hidden bg-[#f7f4ee] flex text-[#1f2937]">

      {/* DESKTOP SIDEBAR */}
      <aside className={`hidden lg:flex flex-col fixed left-0 top-0 h-full z-30 transition-all duration-200 ease-out ${sidebarCollapsed ? 'w-[78px]' : 'w-[260px]'}`}>
        <AdminSidebar isCollapsed={sidebarCollapsed} />
      </aside>

      {/* MOBILE SIDEBAR */}
      <AnimatePresence>
        {mobileSidebarOpen && (
          <div className="lg:hidden fixed inset-0 z-40 flex" aria-modal="true" role="dialog">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setMobileSidebarOpen(false)}
            />
            <motion.div
              initial={{ x: -260 }} animate={{ x: 0 }} exit={{ x: -260 }}
              transition={{ type: 'tween', duration: 0.2, ease: 'easeOut' }}
              className="relative flex flex-col w-[260px] max-w-xs bg-white shadow-2xl z-50"
            >
              <AdminSidebar isCollapsed={false} isMobile={true} onClose={() => setMobileSidebarOpen(false)} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MAIN CONTENT */}
      <div className={`flex h-screen flex-col flex-1 min-w-0 transition-all duration-200 ease-out ${sidebarCollapsed ? 'lg:ml-[78px]' : 'lg:ml-[260px]'}`}>

        {/* HEADER — passes logout trigger down */}
        <div className="sticky top-0 z-20 backdrop-blur-md">
          <AdminHeader
            title={title}
            isCollapsed={sidebarCollapsed}
            onToggleSidebar={handleToggleSidebar}
            onLogout={() => setShowLogout(true)}
          />
        </div>

        {/* PAGE CONTENT with animation */}
        <main
          data-scroll-root="true"
          className="admin-page-scroll hover-scroll flex-1 min-h-0 overflow-auto"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="admin-page-root min-h-full w-full [&>*]:min-h-full [&>*]:w-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* LOGOUT MODAL — at page root, always centered */}
      <LogoutModal
        isOpen={showLogout}
        onCancel={() => setShowLogout(false)}
        onConfirm={handleLogout}
        isPending={loggingOut}
      />
    </div>
  )
}

export default AdminLayout
