import { Navigate, useLocation, useParams } from 'react-router'

/**
 * Sends an address the site used to have to the one it has now, so that
 * links already shared keep working. `:id` in the new address is filled in
 * from the old one, and whatever followed the `?` is kept.
 */
export function Redirect({ to }: { to: string }) {
  const { id = '' } = useParams()
  const { search } = useLocation()
  return <Navigate to={`${to.replace(':id', id)}${search.replace('poi=', 'next=')}`} replace />
}
