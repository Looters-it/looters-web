import { apiGet } from '@/lib/api'
import type { AreaMap } from '@/features/map/api'

/** An area a match can be played on: a folder with municipalities of its own. */
export interface AtlasArea {
  id: string
  name: string
  /** The geographic area it belongs to (Italy, France…): itself, when it stands alone. */
  rootId: string
  rootName: string
  unitCount: number
  /** A point to name it at. */
  lon: number
  lat: number
  /** [west, south, east, north] in degrees. */
  bounds: [number, number, number, number]
  /** The areas it shares a border with. */
  borders: string[]
}

/** Every area on one map (api: GET /geo/atlas). */
export interface Atlas {
  map: AreaMap
  areas: AtlasArea[]
}

export const atlasApi = {
  atlas: () => apiGet<Atlas>('/geo/atlas'),
  /** The municipalities of each area, by the id of the area. */
  units: () => apiGet<Record<string, number[]>>('/geo/atlas/units'),
}
