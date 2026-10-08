import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api'

export interface AdminStats {
  users: number
  matchesRunning: number
  online: number
}

export interface AdminSession {
  id: string
  createdAt: string
  lastSeenAt: string
  expiresAt: string
  ip: string | null
  userAgent: string | null
  user: { id: string; username: string; role: 'USER' | 'ADMIN' }
  connected: boolean
  current: boolean
}

export interface GeoArea {
  id: string
  name: string
  parentId: string | null
  uploadCount: number
  /** Municipalities in this folder and in everything below it. */
  unitCount: number
}

export interface GeoUpload {
  id: string
  areaId: string
  filename: string
  format: 'KML' | 'GEOJSON'
  status: 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED'
  progress: number
  unitCount: number
  adjacencyCount: number
  sizeBytes: number
  /** JSON written by `jobs` when the file is refused (see parseUploadFailure). */
  error: string | null
  createdAt: string
  finishedAt: string | null
}

export interface UploadFailure {
  code: string
  detail?: string
  problems?: { feature: number; name?: string; code: string }[]
  total?: number
  names?: string[]
}

export function parseUploadFailure(error: string | null): UploadFailure | null {
  if (!error) return null
  try {
    return JSON.parse(error) as UploadFailure
  } catch {
    return { code: 'INTERNAL', detail: error }
  }
}

export interface GeoUnit {
  id: number
  name: string
  code: string | null
  area: { name: string }
}

export type Neighbour = GeoUnit & { manual: boolean }

export const adminApi = {
  stats: () => apiGet<AdminStats>('/admin/stats'),
  sessions: () => apiGet<AdminSession[]>('/admin/sessions'),
  revokeSession: (id: string) => apiDelete(`/admin/sessions/${id}`),

  areas: () => apiGet<GeoArea[]>('/admin/geo/areas'),
  createArea: (name: string, parentId?: string) =>
    apiPost<GeoArea>('/admin/geo/areas', { name, parentId }),
  renameArea: (id: string, name: string) => apiPatch<GeoArea>(`/admin/geo/areas/${id}`, { name }),
  deleteArea: (id: string) => apiDelete(`/admin/geo/areas/${id}`),

  uploads: (areaId: string) => apiGet<GeoUpload[]>(`/admin/geo/uploads?areaId=${areaId}`),
  upload: (areaId: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return apiPost<GeoUpload>(`/admin/geo/areas/${areaId}/uploads`, form)
  },
  deleteUpload: (id: string) => apiDelete(`/admin/geo/uploads/${id}`),

  searchUnits: (query: string) =>
    apiGet<GeoUnit[]>(`/admin/geo/units?q=${encodeURIComponent(query)}`),
  neighbours: (unitId: number) => apiGet<Neighbour[]>(`/admin/geo/units/${unitId}/neighbours`),
  addAdjacency: (aId: number, bId: number) => apiPost<void>('/admin/geo/adjacency', { aId, bId }),
  removeAdjacency: (aId: number, bId: number) => apiDelete('/admin/geo/adjacency', { aId, bId }),
}
