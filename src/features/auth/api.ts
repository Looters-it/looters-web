import { ApiError, apiGet, apiPost } from '@/lib/api'

export interface User {
  id: string
  username: string
  role: 'USER' | 'ADMIN'
}

export interface Credentials {
  username: string
  password: string
}

export interface Registration extends Credentials {
  email: string
  /** The honeypot of the form: empty for a person. */
  contactTime?: string
}

/** The signed-in user, or null for a guest. */
export async function fetchCurrentUser(signal?: AbortSignal): Promise<User | null> {
  try {
    return await apiGet<User>('/auth/me', { signal })
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null
    throw error
  }
}

export const login = (credentials: Credentials) => apiPost<User>('/auth/login', credentials)
export const register = (registration: Registration) =>
  apiPost<User>('/auth/register', registration)
export const logout = () => apiPost<void>('/auth/logout')
