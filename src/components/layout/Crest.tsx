/** Shield used as the logo mark; empires use the same shape for their emblems. */
export function Crest({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M12 2l8 3v6c0 5-3.4 9-8 11-4.6-2-8-6-8-11V5z" fill="currentColor" />
      <path d="M12 2v20c4.6-2 8-6 8-11V5z" fill="currentColor" opacity="0.55" />
    </svg>
  )
}
