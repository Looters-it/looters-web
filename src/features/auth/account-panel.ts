/** Lets any page ask for the sign-in panel of the navbar to open. */
const listeners = new Set<() => void>()

export function openAccountPanel(): void {
  for (const listener of listeners) listener()
}

export function onOpenAccountPanel(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
