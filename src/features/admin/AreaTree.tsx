import { Folder, FolderOpen } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import type { GeoArea } from './api'
import { useFormat } from './hooks'

/** The folder tree: roots are geographic areas, the rest are folders inside them. */
export function AreaTree(props: {
  areas: GeoArea[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const { t } = useTranslation()
  const format = useFormat()

  const branch = (parentId: string | null, depth: number) =>
    props.areas
      .filter((area) => area.parentId === parentId)
      .map((area) => {
        const selected = area.id === props.selectedId
        const Icon = selected ? FolderOpen : Folder
        return (
          <li key={area.id}>
            <button
              type="button"
              aria-current={selected ? 'true' : undefined}
              onClick={() => props.onSelect(area.id)}
              style={{ paddingLeft: `${0.5 + depth * 1.25}rem` }}
              className={cn(
                'hover:bg-accent flex w-full cursor-pointer items-center gap-2 rounded-md py-1.5 pr-2 text-left',
                selected && 'bg-accent font-bold',
              )}
            >
              <Icon className="size-4 flex-none" aria-hidden="true" />
              <span className="flex-1 truncate">{area.name}</span>
              <span className="text-muted-foreground font-mono text-sm">
                {format.number(area.unitCount)}
                <span className="sr-only"> {t('admin.geo.units', { count: area.unitCount })}</span>
              </span>
            </button>
            <ul>{branch(area.id, depth + 1)}</ul>
          </li>
        )
      })

  return <ul aria-label={t('admin.geo.tree')}>{branch(null, 0)}</ul>
}
