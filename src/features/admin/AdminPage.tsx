import { useTranslation } from 'react-i18next'

import { NotFoundPage } from '@/app/NotFoundPage'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useSession } from '@/features/auth/session-context'

import { GeoTab } from './GeoTab'
import { OverviewTab } from './OverviewTab'
import { SessionsTab } from './SessionsTab'

/** Dashboard of the platform admin. The api enforces the role; this only hides the page. */
export function AdminPage() {
  const { t } = useTranslation()
  const { user } = useSession()

  if (user === undefined) return null
  // Everyone else sees what any unknown address shows.
  if (user?.role !== 'ADMIN') return <NotFoundPage />

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
      <h1 className="text-3xl">{t('admin.title')}</h1>
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">{t('admin.tabs.overview')}</TabsTrigger>
          <TabsTrigger value="sessions">{t('admin.tabs.sessions')}</TabsTrigger>
          <TabsTrigger value="geo">{t('admin.tabs.geo')}</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="pt-4">
          <OverviewTab />
        </TabsContent>
        <TabsContent value="sessions" className="pt-4">
          <SessionsTab />
        </TabsContent>
        <TabsContent value="geo" className="pt-4">
          <GeoTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
