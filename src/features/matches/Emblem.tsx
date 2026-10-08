import { useId } from 'react'

import { cn } from '@/lib/utils'

import { GLYPHS, SHIELD, inkOn } from './emblem-glyphs'

/** Just the drawing of an emblem, for the picker. */
export function EmblemGlyph({ emblem, className }: { emblem: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d={GLYPHS[emblem] ?? GLYPHS.scudo} fill="currentColor" />
    </svg>
  )
}

/**
 * The coat of arms of an empire: its emblem on a shield of its colour, or the
 * image the player uploaded, cut to the same shield. Colour and emblem
 * together tell empires apart, never colour alone.
 */
export function EmpireShield(props: {
  color: string
  emblem: string
  /** Address of the uploaded logo, when there is one. */
  logo?: string | null
  className?: string
}) {
  const clipId = useId()
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cn('size-8 flex-none', props.className)}>
      <path d={SHIELD} fill={props.color} stroke="var(--color-ink)" strokeWidth="1" />
      {props.logo ? (
        <>
          <clipPath id={clipId}>
            <path d={SHIELD} />
          </clipPath>
          <image
            href={props.logo}
            width="24"
            height="24"
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#${clipId})`}
          />
          {/* The border again, over the picture, in the colour of the empire. */}
          <path d={SHIELD} fill="none" stroke={props.color} strokeWidth="1.5" />
        </>
      ) : (
        <path
          d={GLYPHS[props.emblem] ?? GLYPHS.scudo}
          fill={inkOn(props.color)}
          transform="translate(12 11.5) scale(0.5) translate(-12 -12)"
        />
      )}
    </svg>
  )
}
