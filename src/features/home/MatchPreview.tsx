import { useQuery } from '@tanstack/react-query'

import { matchApi } from '@/features/matches/api'

/** One path for all the cells of a colour: `x, y, x, y…` as unit squares. */
const squares = (cells: number[]) => {
  let d = ''
  for (let i = 0; i < cells.length; i += 2) d += `M${cells[i]} ${cells[i + 1]}h1v1h-1z`
  return d
}

/**
 * The map of a match in miniature, for its card: the shape of the area, with
 * the empires in their colours. A picture, not a map: it cannot be moved.
 */
export function MatchPreview({ matchId, className }: { matchId: string; className?: string }) {
  const preview = useQuery({
    queryKey: ['matches', 'preview', matchId],
    queryFn: () => matchApi.preview(matchId),
    staleTime: 30_000,
  })
  const data = preview.data

  return (
    <div aria-hidden="true" className={className}>
      {data && (
        <svg
          viewBox={`0 0 ${String(data.columns)} ${String(data.rows)}`}
          preserveAspectRatio="xMidYMid meet"
          className="h-full w-full"
          shapeRendering="crispEdges"
        >
          <path d={squares(data.free)} className="fill-background/80" />
          {Object.entries(data.owned).map(([color, cells]) => (
            <path key={color} d={squares(cells)} fill={color} />
          ))}
        </svg>
      )}
    </div>
  )
}
