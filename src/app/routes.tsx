import type { RouteObject } from 'react-router'

import { AdminPage } from '@/features/admin/AdminPage'
import { MatchPage } from '@/features/matches/MatchPage'
import { NewMatchPage } from '@/features/matches/NewMatchPage'
import { HomePage } from '@/features/home/HomePage'

import { Layout } from './Layout'
import { NotFoundPage } from './NotFoundPage'

export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/admin', element: <AdminPage /> },
      { path: '/partite/nuova', element: <NewMatchPage /> },
      { path: '/partite/:id', element: <MatchPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
