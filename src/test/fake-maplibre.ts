// A stand-in for maplibre-gl: jsdom has no WebGL. It records what the
// component asks of the map, and lets a test fire the map's events.
type Handler = (event: Record<string, unknown>) => void

export class FakeMap {
  static instances: FakeMap[] = []
  static get latest(): FakeMap {
    const map = FakeMap.instances.at(-1)
    if (!map) throw new Error('no map was created')
    return map
  }

  readonly options: Record<string, unknown>
  readonly handlers: { type: string; layer?: string; handler: Handler }[] = []
  /** Feature state by municipality id. */
  readonly state = new Map<number, Record<string, unknown>>()
  /** How many times feature state was written: the cost of an update. */
  writes = 0
  /** What a click finds under the pointer. */
  featuresAtPoint: { id: number; properties: Record<string, unknown> }[] = []
  readonly sourceData = new Map<string, unknown>()
  removed = false
  readonly canvas = { style: { cursor: '' } }
  readonly touchZoomRotate = { disableRotation: () => undefined }
  readonly keyboard = { disableRotation: () => undefined }

  constructor(options: Record<string, unknown>) {
    this.options = options
    FakeMap.instances.push(this)
  }

  on(type: string, layerOrHandler: string | Handler, handler?: Handler) {
    if (typeof layerOrHandler === 'string') {
      this.handlers.push({ type, layer: layerOrHandler, handler: handler! })
    } else {
      this.handlers.push({ type, handler: layerOrHandler })
    }
    return this
  }
  once(type: string, handler: Handler) {
    return this.on(type, handler)
  }
  fire(type: string, event: Record<string, unknown> = {}, layer?: string) {
    for (const entry of this.handlers) {
      if (entry.type === type && entry.layer === layer) entry.handler(event)
    }
  }

  addControl() {
    return this
  }
  getCanvas() {
    return this.canvas
  }
  queryRenderedFeatures() {
    return this.featuresAtPoint
  }
  setFeatureState(target: { id: number }, state: Record<string, unknown>) {
    this.writes += 1
    this.state.set(target.id, { ...this.state.get(target.id), ...state })
  }
  removeFeatureState(target: { id: number }, key: string) {
    this.writes += 1
    const current = { ...this.state.get(target.id) }
    delete current[key]
    this.state.set(target.id, current)
  }
  getSource(id: string) {
    return { setData: (data: unknown) => this.sourceData.set(id, data) }
  }
  remove() {
    this.removed = true
  }
  setPaintProperty() {
    return this
  }
  getZoom() {
    return 6
  }
  /** The last place the map was asked to move to. */
  easedTo: unknown = null
  easeTo(options: unknown) {
    this.easedTo = options
  }

  /** Clicks the municipality with this id, or empty map when omitted. */
  click(unit?: { id: number; name: string }) {
    this.featuresAtPoint = unit ? [{ id: unit.id, properties: { name: unit.name } }] : []
    this.fire('click', { point: { x: 0, y: 0 }, lngLat: { lng: 9.19, lat: 45.46 } })
  }
}

export class FakePopup {
  static open: FakePopup[] = []
  node: HTMLElement | null = null
  lngLat: unknown = null

  setDOMContent(node: HTMLElement) {
    this.node = node
    return this
  }
  setLngLat(lngLat: unknown) {
    this.lngLat = lngLat
    return this
  }
  addTo() {
    if (this.node) document.body.append(this.node)
    FakePopup.open.push(this)
    return this
  }
  remove() {
    this.node?.remove()
    FakePopup.open = FakePopup.open.filter((popup) => popup !== this)
  }
}

export class FakeNavigationControl {}

export const fakeSetWorkerUrl = () => undefined

export function resetFakeMaplibre() {
  FakeMap.instances = []
  for (const popup of [...FakePopup.open]) popup.remove()
}
