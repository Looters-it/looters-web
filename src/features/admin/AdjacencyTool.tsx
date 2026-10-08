import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { adminApi, type GeoUnit } from './api'
import { useErrorText } from './hooks'
import { ErrorNote } from './shared'

/** Finds a municipality by name; the choice goes to `onPick`. */
function UnitSearch(props: { label: string; exclude?: number; onPick: (unit: GeoUnit) => void }) {
  const { t } = useTranslation()
  const id = useId()
  const [text, setText] = useState('')
  const query = text.trim()
  const results = useQuery({
    queryKey: ['admin', 'geo', 'units', query],
    queryFn: () => adminApi.searchUnits(query),
    enabled: query.length >= 2,
  })
  const units = results.data?.filter((unit) => unit.id !== props.exclude) ?? []

  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{props.label}</Label>
      <Input
        id={id}
        value={text}
        placeholder={t('admin.adjacency.searchHint')}
        onChange={(event) => setText(event.target.value)}
      />
      {query.length >= 2 && results.data && (
        <ul className="max-h-56 overflow-y-auto rounded-md border">
          {units.length === 0 && (
            <li className="text-muted-foreground p-2">{t('admin.adjacency.noResults')}</li>
          )}
          {units.map((unit) => (
            <li key={unit.id}>
              <button
                type="button"
                className="hover:bg-accent flex w-full cursor-pointer justify-between gap-3 px-2 py-1.5 text-left"
                onClick={() => {
                  props.onPick(unit)
                  setText('')
                }}
              >
                <span>{unit.name}</span>
                <span className="text-muted-foreground">{unit.area.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * Checks the neighbours of a municipality and adds the adjacencies that
 * geometry cannot find: islands and places that do not touch (PROMPT §9 #6).
 */
export function AdjacencyTool() {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const queryClient = useQueryClient()
  const [unit, setUnit] = useState<GeoUnit | null>(null)

  const neighbours = useQuery({
    queryKey: ['admin', 'geo', 'neighbours', unit?.id],
    queryFn: () => adminApi.neighbours(unit?.id ?? 0),
    enabled: unit !== null,
  })
  // Islands: municipalities no border reaches. They are found when the file is processed.
  const isolated = useQuery({ queryKey: ['admin', 'geo', 'isolated'], queryFn: adminApi.isolated })
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin', 'geo', 'neighbours'] }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'geo', 'isolated'] }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'geo', 'uploads'] }),
    ])
  const add = useMutation({
    mutationFn: (other: GeoUnit) => adminApi.addAdjacency(unit?.id ?? 0, other.id),
    onSuccess: refresh,
  })
  const remove = useMutation({
    mutationFn: (otherId: number) => adminApi.removeAdjacency(unit?.id ?? 0, otherId),
    onSuccess: refresh,
  })
  const error = add.error ?? remove.error ?? neighbours.error

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground">{t('admin.adjacency.intro')}</p>
      {isolated.data && isolated.data.length > 0 && (
        <div className="border-danger flex flex-col gap-2 rounded-md border p-3">
          <h3 className="text-lg">
            {t('admin.adjacency.isolatedTitle', { count: isolated.data.length })}
          </h3>
          <p className="text-muted-foreground">{t('admin.adjacency.isolatedIntro')}</p>
          <ul className="flex flex-wrap gap-2" aria-label={t('admin.adjacency.isolatedList')}>
            {isolated.data.map((island) => (
              <li key={island.id}>
                <Button
                  variant={unit?.id === island.id ? 'default' : 'quiet'}
                  size="sm"
                  className="tracking-normal normal-case"
                  onClick={() => {
                    add.reset()
                    remove.reset()
                    setUnit(island)
                  }}
                >
                  {island.name}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <UnitSearch
        label={t('admin.adjacency.unit')}
        onPick={(picked) => {
          add.reset()
          remove.reset()
          setUnit(picked)
        }}
      />

      {unit && (
        <div className="flex flex-col gap-3 rounded-md border p-3">
          <h3 className="text-lg">{t('admin.adjacency.neighboursOf', { name: unit.name })}</h3>
          {neighbours.data?.length === 0 && (
            <p className="text-muted-foreground">{t('admin.adjacency.none')}</p>
          )}
          <ul className="flex flex-wrap gap-2">
            {neighbours.data?.map((neighbour) => (
              <li
                key={neighbour.id}
                className="rounded-pill flex items-center gap-1 border py-0.5 pr-1 pl-3"
              >
                {neighbour.name}
                {neighbour.manual ? (
                  <>
                    <span className="text-muted-foreground text-sm">
                      {t('admin.adjacency.manual')}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="size-6"
                      aria-label={t('admin.adjacency.remove', { name: neighbour.name })}
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(neighbour.id)}
                    >
                      <X />
                    </Button>
                  </>
                ) : (
                  <span className="pr-2" />
                )}
              </li>
            ))}
          </ul>
          <UnitSearch
            label={t('admin.adjacency.add', { name: unit.name })}
            exclude={unit.id}
            onPick={(other) => add.mutate(other)}
          />
          {error && <ErrorNote>{errorText(error)}</ErrorNote>}
        </div>
      )}
    </div>
  )
}
