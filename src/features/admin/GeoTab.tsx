import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FolderPlus, Pencil, Trash2 } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { AdjacencyTool } from './AdjacencyTool'
import { AreaPreview } from './AreaPreview'
import { adminApi, type GeoArea } from './api'
import { AreaTree } from './AreaTree'
import { useErrorText } from './hooks'
import { Card, ConfirmDialog, ErrorNote } from './shared'
import { UploadList } from './UploadList'

type NameDialog =
  { kind: 'area' } | { kind: 'folder'; parent: GeoArea } | { kind: 'rename'; area: GeoArea }

/** Asks for the name of a new area or folder, or the new name of an existing one. */
function NameForm(props: {
  dialog: NameDialog
  onDone: (areaId: string) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const id = useId()
  const { dialog } = props
  const [name, setName] = useState(dialog.kind === 'rename' ? dialog.area.name : '')

  const save = useMutation({
    mutationFn: () =>
      dialog.kind === 'rename'
        ? adminApi.renameArea(dialog.area.id, name)
        : adminApi.createArea(name, dialog.kind === 'folder' ? dialog.parent.id : undefined),
    onSuccess: (area) => props.onDone(area.id),
  })
  const submit = (event: FormEvent) => {
    event.preventDefault()
    save.mutate()
  }
  const title =
    dialog.kind === 'area'
      ? t('admin.geo.newArea')
      : dialog.kind === 'folder'
        ? t('admin.geo.newFolderIn', { name: dialog.parent.name })
        : t('admin.geo.renameTitle', { name: dialog.area.name })

  return (
    <Dialog open onOpenChange={(open) => !open && props.onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1">
            <Label htmlFor={id}>{t('admin.geo.name')}</Label>
            <Input
              id={id}
              required
              maxLength={80}
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          {save.error && <ErrorNote>{errorText(save.error)}</ErrorNote>}
          <DialogFooter>
            <Button type="button" variant="quiet" onClick={props.onClose}>
              {t('admin.cancel')}
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {t('admin.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function GeoTab() {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [nameDialog, setNameDialog] = useState<NameDialog | null>(null)
  const [deleting, setDeleting] = useState(false)

  const areas = useQuery({ queryKey: ['admin', 'geo', 'areas'], queryFn: adminApi.areas })
  const selected = areas.data?.find((area) => area.id === selectedId) ?? null
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin', 'geo'] })

  const remove = useMutation({
    mutationFn: (id: string) => adminApi.deleteArea(id),
    onSuccess: () => {
      setDeleting(false)
      setSelectedId(null)
      return refresh()
    },
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:items-start">
        <Card className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg">{t('admin.geo.areas')}</h2>
            <Button variant="outline" size="sm" onClick={() => setNameDialog({ kind: 'area' })}>
              {t('admin.geo.newArea')}
            </Button>
          </div>
          {areas.error && <ErrorNote>{errorText(areas.error)}</ErrorNote>}
          {areas.data?.length === 0 && (
            <p className="text-muted-foreground">{t('admin.geo.noAreas')}</p>
          )}
          {areas.data && (
            <AreaTree areas={areas.data} selectedId={selectedId} onSelect={setSelectedId} />
          )}
        </Card>

        <Card className="flex flex-col gap-4">
          {selected ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg">{selected.name}</h2>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="quiet"
                    size="sm"
                    onClick={() => setNameDialog({ kind: 'folder', parent: selected })}
                  >
                    <FolderPlus />
                    {t('admin.geo.newFolder')}
                  </Button>
                  <Button
                    variant="quiet"
                    size="sm"
                    onClick={() => setNameDialog({ kind: 'rename', area: selected })}
                  >
                    <Pencil />
                    {t('admin.geo.rename')}
                  </Button>
                  <Button
                    variant="quiet"
                    size="sm"
                    onClick={() => {
                      remove.reset()
                      setDeleting(true)
                    }}
                  >
                    <Trash2 />
                    {t('admin.delete')}
                  </Button>
                </div>
              </div>
              {/* Keyed, so that switching folder starts from a clean state. */}
              <UploadList key={selected.id} areaId={selected.id} />
            </>
          ) : (
            <p className="text-muted-foreground">{t('admin.geo.pickFolder')}</p>
          )}
        </Card>
      </div>

      {selected && selected.unitCount > 0 && (
        <Card className="flex flex-col gap-3">
          <h2 className="text-lg">{t('admin.preview.title')}</h2>
          <AreaPreview key={selected.id} areaId={selected.id} />
        </Card>
      )}

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg">{t('admin.adjacency.title')}</h2>
        <AdjacencyTool />
      </Card>

      {nameDialog && (
        <NameForm
          dialog={nameDialog}
          onClose={() => setNameDialog(null)}
          onDone={(areaId) => {
            setNameDialog(null)
            setSelectedId(areaId)
            void refresh()
          }}
        />
      )}
      <ConfirmDialog
        open={deleting && selected !== null}
        title={t('admin.geo.deleteTitle', { name: selected?.name ?? '' })}
        description={t('admin.geo.deleteText')}
        confirmLabel={t('admin.delete')}
        pending={remove.isPending}
        error={remove.error ? errorText(remove.error) : null}
        onConfirm={() => selected && remove.mutate(selected.id)}
        onClose={() => setDeleting(false)}
      />
    </div>
  )
}
