import { ref } from 'vue'
import { useAppStore } from './useAppStore'

export type AuthState = 'checking' | 'signed-out' | 'signed-in'

const state = ref<AuthState>('checking')

/** Session handling. Data is always (re)loaded from the server right after sign-in, before any save. */
export function useAuth() {
  const store = useAppStore()

  async function check() {
    try {
      const res = await fetch('/api/auth/check', { cache: 'no-store' })
      // Server up but storage down: stay in the app on cached data instead of showing the login
      if (res.status === 503) {
        state.value = 'signed-in'
        await store.pull()
        return
      }
      const data = await res.json() as { authenticated?: boolean }
      if (data.authenticated === true) await signedIn()
      else state.value = 'signed-out'
    } catch {
      state.value = 'signed-out'
    }
  }

  async function signedIn() {
    state.value = 'signed-in'
    await store.pull()
  }

  async function logout() {
    store.flush()
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {
      // ignore — we drop to the login screen either way
    }
    store.resetSession()
    state.value = 'signed-out'
  }

  /** The API answered 401: the session expired or the password changed. */
  function expired() {
    store.resetSession()
    state.value = 'signed-out'
  }

  return { state, check, signedIn, logout, expired }
}
