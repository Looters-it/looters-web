import type { RouteObject } from 'react-router'

import { AdminPage } from '@/features/admin/AdminPage'
import { HomePage } from '@/features/home/HomePage'

import { Layout } from './Layout'
import { NotFoundPage } from './NotFoundPage'

export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/admin', element: <AdminPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
