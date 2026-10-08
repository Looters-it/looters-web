/** Words that say nothing about which empire it is. */
const FILLERS = new Set([
  'di',
  'del',
  'dello',
  'della',
  'dei',
  'degli',
  'delle',
  'de',
  'da',
  'il',
  'lo',
  'la',
  'i',
  'gli',
  'le',
  'e',
  'the',
  'of',
  // What is left of an article before an apostrophe.
  'd',
  'l',
  'dell',
  'all',
  'nell',
  'sull',
  'dall',
])

/**
 * A short tag for each empire, written on its territories and next to its
 * name, so that who owns what can be read without telling colours apart
 * (WCAG 1.4.1). The initials of the name, up to three letters; when two
 * empires would share a tag, the later ones get a number.
 */
export function empireTags(empires: readonly { id: string; name: string }[]): Map<string, string> {
  const tags = new Map<string, string>()
  const used = new Set<string>()
  for (const empire of empires) {
    const words = empire.name
      .split(/[\s'’-]+/)
      .filter((word) => word !== '' && !FILLERS.has(word.toLowerCase()))
    const initials = words.map((word) => [...word][0] ?? '').join('')
    const base = (initials.length >= 2 ? initials : (words[0] ?? empire.name)).slice(0, 3)
    let tag = base.toLocaleUpperCase('it')
    for (let n = 2; used.has(tag); n++) tag = `${base.toLocaleUpperCase('it')}${n}`
    used.add(tag)
    tags.set(empire.id, tag)
  }
  return tags
}
