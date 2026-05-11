import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import axios from 'axios'
import './index.css'
import App from './App.tsx'

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

  const isInternalRequest = isInternalPath
    && (url.origin === window.location.origin || (apiBaseUrl && url.origin === new URL(apiBaseUrl).origin))

  if (!isInternalRequest || init?.credentials) {
    return originalFetch(nextInput, init)
  }

  return originalFetch(nextInput, { ...init, credentials: 'include' })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
