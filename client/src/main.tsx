import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import axios from 'axios'
import './index.css'
import App from './App.tsx'
import { AppErrorBoundary } from './components/AppErrorBoundary.tsx'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '')

axios.defaults.withCredentials = true
if (apiBaseUrl) {
  axios.defaults.baseURL = apiBaseUrl
}

const internalFetchPrefixes = ['/api', '/auth', '/admin', '/superadmin']
const originalFetch = window.fetch.bind(window)

window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  const initialUrl = input instanceof Request ? input.url : input.toString()
  let url = new URL(initialUrl, window.location.origin)
  const isInternalPath = internalFetchPrefixes.some((prefix) => url.pathname.startsWith(prefix))
  let nextInput: RequestInfo | URL = input

  if (apiBaseUrl && isInternalPath && url.origin === window.location.origin) {
    const rewrittenUrl = `${apiBaseUrl}${url.pathname}${url.search}${url.hash}`
    nextInput = input instanceof Request ? new Request(rewrittenUrl, input) : rewrittenUrl
    url = new URL(rewrittenUrl)
  }

  const apiOrigin = apiBaseUrl ? new URL(apiBaseUrl, window.location.origin).origin : null
  const isInternalRequest = isInternalPath
    && (url.origin === window.location.origin || (apiOrigin && url.origin === apiOrigin))

  if (!isInternalRequest || init?.credentials) {
    return originalFetch(nextInput, init)
  }

  return originalFetch(nextInput, { ...init, credentials: 'include' })
}

const rootElement = document.getElementById('root')

const renderBootError = () => {
  if (!rootElement) return
  rootElement.innerHTML = `
    <main style="min-height:100vh;display:grid;place-items:center;padding:24px;background:#f8fafc;color:#0f172a;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
      <section style="width:min(100%,520px);padding:28px;border:1px solid #dbe4f0;border-radius:12px;background:#fff;box-shadow:0 18px 45px rgba(15,23,42,.08)">
        <p style="margin:0 0 8px;color:#2563eb;font-weight:700">WhatsPoint</p>
        <h1 style="margin:0 0 12px;font-size:28px;line-height:1.15">La page n'a pas pu se charger.</h1>
        <p style="margin:0 0 22px;color:#475569;line-height:1.6">Une ancienne version ou un cache navigateur peut encore bloquer l'application.</p>
        <button style="border:0;border-radius:8px;padding:12px 16px;background:#2563eb;color:#fff;cursor:pointer;font-weight:700" onclick="window.location.reload()">Recharger</button>
      </section>
    </main>
  `
}

window.addEventListener('error', (event) => {
  console.error('WhatsPoint boot error:', event.error || event.message)
  if (!rootElement?.hasChildNodes()) renderBootError()
})

window.addEventListener('unhandledrejection', (event) => {
  console.error('WhatsPoint unhandled rejection:', event.reason)
  if (!rootElement?.hasChildNodes()) renderBootError()
})

if (!rootElement) {
  throw new Error('Root element #root not found')
}

createRoot(rootElement).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
)
