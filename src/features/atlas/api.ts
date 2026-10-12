import type { MultiPolygon, Polygon } from 'geojson'

import { apiGet } from '@/lib/api'

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
  /** Its outline: the border of the area, not of its municipalities. */
  outline: Polygon | MultiPolygon
}

/** Every area on one map (api: GET /geo/atlas). */
export interface Atlas {
  unitCount: number
  /** [west, south, east, north] of everything; null while there is nothing. */
  bounds: [number, number, number, number] | null
  areas: AtlasArea[]
}

export const atlasApi = {
  atlas: () => apiGet<Atlas>('/geo/atlas'),
}
