import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.jsx'
import RealtimeProvider from './realtime/RealtimeProvider.jsx'
import { installGlobalToastDedupe } from './utils/toastDedupe.js'

installGlobalToastDedupe()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: (failureCount, error) => {
        const status = error?.status;
        if (status && status < 500) return false;
        return failureCount < 1;
      },
    },
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RealtimeProvider>
        <App />
      </RealtimeProvider>
    </QueryClientProvider>
  </StrictMode>,
)
