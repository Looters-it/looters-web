import { lazy, Suspense, type ComponentProps } from 'react'

import { cn } from '@/lib/utils'

// MapLibre is most of the weight of the site: it is fetched only when a map
// is about to be shown, so every other page opens quickly on a phone.
const GameMap = lazy(() => import('./GameMap').then((module) => ({ default: module.GameMap })))

type Props = ComponentProps<typeof GameMap>

export function LazyGameMap(props: Props) {
  return (
    <Suspense fallback={<div className={cn(props.className)} aria-busy="true" />}>
      <GameMap {...props} />
    </Suspense>
  )
}
