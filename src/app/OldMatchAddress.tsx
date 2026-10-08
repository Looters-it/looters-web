import { Navigate, useParams } from 'react-router'

/** Sends an old `/partite/:id` address to the match it meant. */
export function OldMatchAddress() {
  const { id = '' } = useParams()
  return <Navigate to={`/match/${id}`} replace />
}
