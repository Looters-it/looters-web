import { useQuery } from '@tanstack/react-query'

import { matchApi } from '@/features/matches/api'

/**
 * The map of a match in miniature, for its card: the shape of the area, with
 * the real borders of the empires in their colours. A picture, not a map: it
 * cannot be moved.
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
        <svg viewBox={data.viewBox} preserveAspectRatio="xMidYMid meet" className="h-full w-full">
          {/* The area as it really is, then every empire inside its real borders. */}
          <path d={data.outline} className="fill-background/85" fillRule="evenodd" />
          {data.empires.map((empire) => (
            <path
              key={empire.color}
              d={empire.path}
              fill={empire.color}
              stroke={empire.color}
              // Thick enough for a single small municipality to show on a wide area.
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
            />
          ))}
        </svg>
      )}
    </div>
  )
}
