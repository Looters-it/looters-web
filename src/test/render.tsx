import { render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'

import { routes } from '@/app/routes'

/** Renders the whole app at the given path. */
export function renderApp(path = '/') {
  return render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />)
}
