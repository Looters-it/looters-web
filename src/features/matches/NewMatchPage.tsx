import { useNavigate } from 'react-router'

import { MatchList } from '@/features/home/MatchList'

import { NewMatchDialog } from './NewMatchDialog'

/** `/match/new`: the page of the matches, with the dialog that creates one open over it. */
export function NewMatchPage() {
  const navigate = useNavigate()
  return (
    <>
      <MatchList />
      <NewMatchDialog open onClose={() => void navigate('/matches')} />
    </>
  )
}
