import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

import { adminApi, parseUploadFailure, type GeoUpload } from './api'
import { useErrorText, useFormat } from './hooks'
import { ConfirmDialog, ErrorNote } from './shared'

const isRunning = (upload: GeoUpload) =>
  upload.status === 'PENDING' || upload.status === 'PROCESSING'

function FailureDetails({ upload }: { upload: GeoUpload }) {
  const { t, i18n } = useTranslation()
  const failure = parseUploadFailure(upload.error)
  if (!failure) return null
  const key = `admin.geo.failure.${failure.code}`
  const known = i18n.exists(key)

  return (
    <div role="alert" className="text-danger mt-2">
      <p>{known ? t(key as 'admin.geo.failure.INTERNAL') : t('admin.geo.failure.INTERNAL')}</p>
      {failure.names && <p>{failure.names.join(', ')}</p>}
      {failure.problems && (
        <ul className="mt-1 list-disc pl-5">
          {failure.problems.map((problem) => (
            <li key={problem.feature}>
              {t('admin.geo.problem.item', {
                feature: problem.feature,
                name: problem.name || t('admin.geo.problem.unnamed'),
              })}{' '}
              {t(`admin.geo.problem.${problem.code}` as 'admin.geo.problem.NO_POLYGON')}
            </li>
          ))}
          {(failure.total ?? 0) > failure.problems.length && (
            <li>
              {t('admin.geo.problem.more', {
                count: (failure.total ?? 0) - failure.problems.length,
              })}
            </li>
          )}
        </ul>
      )}
      {failure.detail && !failure.problems && (
        <p className="font-mono text-sm break-words">{failure.detail}</p>
      )}
    </div>
  )
}

/** Uploads of one folder: a file picker, then each upload with its progress or its errors. */
export function UploadList({ areaId }: { areaId: string }) {
  const { t } = useTranslation()
  const format = useFormat()
  const errorText = useErrorText()
  const queryClient = useQueryClient()
  const input = useRef<HTMLInputElement>(null)
  const [toDelete, setToDelete] = useState<GeoUpload | null>(null)

  const refreshGeo = () => queryClient.invalidateQueries({ queryKey: ['admin', 'geo'] })

  const uploads = useQuery({
    queryKey: ['admin', 'geo', 'uploads', areaId],
    queryFn: () => adminApi.uploads(areaId),
    // Follow the processing while something is running.
    refetchInterval: (query) => (query.state.data?.some(isRunning) ? 1500 : false),
  })
  // When an upload finishes, the folder counts have changed too.
  const running = uploads.data?.some(isRunning) ?? false
  const [wasRunning, setWasRunning] = useState(false)
  if (running !== wasRunning) {
    setWasRunning(running)
    if (!running) {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'geo', 'areas'] })
      // A file just processed may have brought islands with it.
      void queryClient.invalidateQueries({ queryKey: ['admin', 'geo', 'isolated'] })
    }
  }

  const send = useMutation({
    mutationFn: (file: File) => adminApi.upload(areaId, file),
    onSettled: () => {
      if (input.current) input.current.value = ''
      return refreshGeo()
    },
  })
  const remove = useMutation({
    mutationFn: (id: string) => adminApi.deleteUpload(id),
    onSuccess: () => {
      setToDelete(null)
      return refreshGeo()
    },
  })

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={input}
          type="file"
          accept=".kml,.json,.geojson"
          aria-label={t('admin.geo.file')}
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) send.mutate(file)
          }}
        />
        <Button disabled={send.isPending} onClick={() => input.current?.click()}>
          <Upload />
          {send.isPending ? t('admin.geo.sending') : t('admin.geo.upload')}
        </Button>
        <p className="text-muted-foreground">{t('admin.geo.formats')}</p>
      </div>
      {send.error && <ErrorNote>{errorText(send.error)}</ErrorNote>}
      {uploads.error && <ErrorNote>{errorText(uploads.error)}</ErrorNote>}

      {uploads.data?.length === 0 && (
        <p className="text-muted-foreground">{t('admin.geo.noUploads')}</p>
      )}
      <ul className="flex flex-col gap-2">
        {uploads.data?.map((upload) => (
          <li key={upload.id} className="rounded-md border p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-bold">{upload.filename}</p>
                <p className="text-muted-foreground text-base">
                  {format.dateTime(upload.createdAt)} · {format.megabytes(upload.sizeBytes)} MB ·{' '}
                  {t(`admin.geo.status.${upload.status}`)}
                </p>
              </div>
              <Button
                variant="quiet"
                size="icon-sm"
                aria-label={t('admin.geo.deleteUpload', { filename: upload.filename })}
                disabled={isRunning(upload)}
                onClick={() => {
                  remove.reset()
                  setToDelete(upload)
                }}
              >
                <Trash2 />
              </Button>
            </div>
            {isRunning(upload) && (
              <div
                role="progressbar"
                aria-label={t('admin.geo.progress', { filename: upload.filename })}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={upload.progress}
                className="rounded-pill mt-2 h-2 overflow-hidden border"
              >
                <div
                  className="bg-primary h-full transition-[width] duration-500"
                  style={{ width: `${upload.progress}%` }}
                />
              </div>
            )}
            {upload.status === 'DONE' && (
              <p className="mt-1">
                {t('admin.geo.units', { count: upload.unitCount })} ·{' '}
                {t('admin.geo.adjacencies', { count: upload.adjacencyCount })}
              </p>
            )}
            {upload.status === 'DONE' && upload.isolatedCount > 0 && (
              <p role="status" className="text-danger mt-1">
                {t('admin.geo.isolated', { count: upload.isolatedCount })}
              </p>
            )}
            {upload.status === 'FAILED' && <FailureDetails upload={upload} />}
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={toDelete !== null}
        title={t('admin.geo.deleteUploadTitle', { filename: toDelete?.filename ?? '' })}
        description={t('admin.geo.deleteUploadText')}
        confirmLabel={t('admin.delete')}
        pending={remove.isPending}
        error={remove.error ? errorText(remove.error) : null}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
        onClose={() => setToDelete(null)}
      />
    </div>
  )
}
