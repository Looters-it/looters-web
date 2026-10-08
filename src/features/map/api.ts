import { apiGet } from '@/lib/api'

/** A geographic area that has municipalities. */
export interface PublicArea {
  id: string
  name: string
  unitCount: number
}

/** What the map needs to show a folder (api: GET /geo/areas/:id/map). */
export interface AreaMap {
  id: string
  name: string
  unitCount: number
  /** [west, south, east, north] in degrees; null while the folder is empty. */
  bounds: [number, number, number, number] | null
  version: string
  /** Tile address with {z}/{x}/{y}, relative to the site. */
  tiles: string
  minZoom: number
  maxZoom: number
  labelMinZoom: number
}

/** A municipality with a point inside it. */
export interface UnitPoint {
  id: number
  name: string
  lon: number
  lat: number
}

export const mapApi = {
  areas: () => apiGet<PublicArea[]>('/geo/areas'),
  areaMap: (areaId: string) => apiGet<AreaMap>(`/geo/areas/${areaId}/map`),
  units: (areaId: string) => apiGet<UnitPoint[]>(`/geo/areas/${areaId}/units`),
}
