import type { RouteObject } from 'react-router'

import { AdminPage } from '@/features/admin/AdminPage'
import { AuthPage } from '@/features/auth/AuthPage'
import { ProfilePage } from '@/features/auth/ProfilePage'
import { MatchPage } from '@/features/matches/MatchPage'
import { NewMatchPage } from '@/features/matches/NewMatchPage'
import { HomePage } from '@/features/home/HomePage'
import { HowItWorks } from '@/features/home/HowItWorks'
import { MatchList } from '@/features/home/MatchList'

import { ErrorPage } from './ErrorPage'
import { Layout } from './Layout'
import { NotFoundPage } from './NotFoundPage'

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
          { path: '/accesso', element: <AuthPage /> },
          { path: '/profilo', element: <ProfilePage /> },
          { path: '/admin', element: <AdminPage /> },
          { path: '/partite', element: <MatchList /> },
          { path: '/come-funziona', element: <HowItWorks /> },
          { path: '/partite/nuova', element: <NewMatchPage /> },
          { path: '/partite/:id', element: <MatchPage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]
