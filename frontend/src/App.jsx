import { BrowserRouter as Router, useLocation } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { Toaster } from 'react-hot-toast'
import AppRoutes from './routes'
import DevNavigation from './components/common/DevNavigation'
import GlobalPageLoader from './components/common/GlobalPageLoader'

const ScrollToTop = () => {
  const { pathname, search, hash } = useLocation()

  useEffect(() => {
    const scrollTargets = () => {
      document.documentElement.scrollTo({ top: 0, left: 0, behavior: 'auto' })
      document.body.scrollTo?.({ top: 0, left: 0, behavior: 'auto' })
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })

      document
        .querySelectorAll(
          '.hover-scroll, main, [data-scroll-container], .admin-page-root, .customer-motion-root',
        )
        .forEach((node) => {
          if (node && typeof node.scrollTo === 'function') {
            node.scrollTo({ top: 0, left: 0, behavior: 'auto' })
          }
        })
    }

    if (hash) {
      requestAnimationFrame(() => {
        const target = document.getElementById(hash.slice(1))
        if (target) {
          target.scrollIntoView({ block: 'start', behavior: 'auto' })
        } else {
          scrollTargets()
        }
      })
      return
    }

    requestAnimationFrame(scrollTargets)
  }, [pathname, search, hash])

  return null
}

const GlobalNavigationLoader = () => {
  const location = useLocation()
  const [isLoading, setIsLoading] = useState(false)
  const timeoutRef = useRef(null)
  const previousLocationRef = useRef(location)

  const stopLoadingSoon = () => {
    window.clearTimeout(timeoutRef.current)
    timeoutRef.current = window.setTimeout(() => {
      setIsLoading(false)
    }, 900)
  }

  useEffect(() => {
    const handleClick = (event) => {
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return
      }

      const trigger = event.target.closest('a, [data-navigation-trigger]')

      if (
        !trigger ||
        trigger.closest('[data-no-global-loader], .dev-navigation, .DevNavigation') ||
        trigger.getAttribute('aria-disabled') === 'true'
      ) {
        return
      }

      if (trigger.tagName === 'A') {
        const href = trigger.getAttribute('href')
        const target = trigger.getAttribute('target')

        if (
          !href ||
          href.startsWith('mailto:') ||
          href.startsWith('tel:') ||
          trigger.hasAttribute('download') ||
          target === '_blank'
        ) {
          return
        }

        const url = new URL(href, window.location.origin)
        const samePageHash =
          url.origin === window.location.origin &&
          url.pathname === window.location.pathname &&
          url.search === window.location.search &&
          url.hash

        if (url.origin !== window.location.origin || samePageHash) {
          return
        }
      } else if (!trigger.hasAttribute('data-navigation-trigger')) {
        return
      }

      setIsLoading(true)
      stopLoadingSoon()
    }

    document.addEventListener('click', handleClick, true)

    return () => {
      document.removeEventListener('click', handleClick, true)
      window.clearTimeout(timeoutRef.current)
    }
  }, [])

  useEffect(() => {
    const previousLocation = previousLocationRef.current
    const pathChanged =
      previousLocation.pathname !== location.pathname ||
      previousLocation.search !== location.search
    const hashOnlyChanged =
      !pathChanged && previousLocation.hash !== location.hash

    previousLocationRef.current = location

    if (pathChanged && !hashOnlyChanged) {
      setIsLoading(true)
      stopLoadingSoon()
      return
    }

    if (isLoading) {
      stopLoadingSoon()
    }
  }, [location.pathname, location.search, location.hash])

  return isLoading ? <GlobalPageLoader overlay /> : null
}

function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <div className="App">
        <ScrollToTop />
        <GlobalNavigationLoader />
        <AppRoutes />
        
        {/* Development Navigation - Remove in production */}
        {import.meta.env.DEV && <DevNavigation />}
        
        <Toaster 
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
              maxWidth: 'min(420px, calc(100vw - 32px))',
              width: 'fit-content',
              lineHeight: '1.35',
              whiteSpace: 'normal',
              overflowWrap: 'anywhere',
              wordBreak: 'break-word',
              textAlign: 'left',
            },
          }}
        />
      </div>
    </Router>
  )
}

export default App
