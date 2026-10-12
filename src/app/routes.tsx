import { LeaderboardPage } from '@/features/leaderboard/LeaderboardPage'
import type { RouteObject } from 'react-router'

import { AdminPage } from '@/features/admin/AdminPage'
import { AtlasPage } from '@/features/atlas/AtlasPage'
import { AuthPage } from '@/features/auth/AuthPage'
import { CreditsPage } from '@/features/credits/CreditsPage'
import { ChangePasswordPage } from '@/features/profile/ChangePasswordPage'
import { InvitationsPage } from '@/features/profile/InvitationsPage'
import { PublicProfilePage } from '@/features/profile/PublicProfilePage'
import { ProfilePage } from '@/features/profile/ProfilePage'
import { MatchPage } from '@/features/matches/MatchPage'
import { NewMatchPage } from '@/features/matches/NewMatchPage'
import { HomePage } from '@/features/home/HomePage'
import { HowItWorks } from '@/features/home/HowItWorks'
import { MatchList } from '@/features/home/MatchList'

import { ErrorPage } from './ErrorPage'
import { Layout } from './Layout'
import { NotFoundPage } from './NotFoundPage'
import { Redirect } from './Redirect'

export const routes: RouteObject[] = [
  {
    element: <Layout />,
    // A page that breaks leaves the navbar standing; a broken navbar falls back here too.
    errorElement: <ErrorPage />,
    children: [
      {
        errorElement: <ErrorPage />,
        children: [
          { path: '/', element: <HomePage /> },
          { path: '/auth/login', element: <AuthPage mode="login" /> },
          { path: '/auth/register', element: <AuthPage mode="register" /> },
          { path: '/profile', element: <ProfilePage /> },
          { path: '/profile/invitations', element: <InvitationsPage /> },
          { path: '/profile/change-password', element: <ChangePasswordPage /> },
          { path: '/user/:username', element: <PublicProfilePage /> },
          { path: '/profilo', element: <Redirect to="/profile" /> },
          { path: '/admin', element: <AdminPage /> },
          { path: '/matches', element: <MatchList /> },
          { path: '/leaderboard', element: <LeaderboardPage /> },
          { path: '/classifica', element: <Redirect to="/leaderboard" /> },
          { path: '/atlas', element: <AtlasPage /> },
          { path: '/credits', element: <CreditsPage /> },
          { path: '/crediti', element: <Redirect to="/credits" /> },
          { path: '/mappa', element: <Redirect to="/atlas" /> },
          { path: '/come-funziona', element: <HowItWorks /> },
          { path: '/match/new', element: <NewMatchPage /> },
          { path: '/match/:id', element: <MatchPage /> },
          // The addresses the site had before: links already shared keep working.
          { path: '/partite', element: <Redirect to="/matches" /> },
          { path: '/partite/nuova', element: <Redirect to="/match/new" /> },
          { path: '/partite/:id', element: <Redirect to="/match/:id" /> },
          { path: '/accesso', element: <Redirect to="/auth/login" /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]
