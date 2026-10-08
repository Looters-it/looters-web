/** Emblem drawings, by the key the api stores (authored for the prototype, one weight). */
export const GLYPHS: Record<string, string> = {
  torre: 'M6 21V9H4V4h3v2h2V4h6v2h2V4h3v5h-2v12z',
  stella: 'M12 2l2.9 6.6 7.1.7-5.4 4.8 1.6 7L12 17.5 5.8 21.1l1.6-7L2 9.3l7.1-.7z',
  croce: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z',
  corona: 'M3 19L2 7l5.5 4.5L12 4l4.5 7.5L22 7l-1 12z',
  scudo: 'M12 2l8 3v6c0 5-3.4 9-8 11-4.6-2-8-6-8-11V5z',
  rombo: 'M12 2l9 10-9 10-9-10z',
  bande: 'M3 5h18v3.5H3zM3 10.25h18v3.5H3zM3 15.5h18V19H3z',
  scacchi: 'M3 3h6v6H3zM15 3h6v6h-6zM9 9h6v6H9zM3 15h6v6H3zM15 15h6v6h-6z',
  monte: 'M12 3l10 18H2z',
  luna: 'M14 2a10 10 0 1 0 0 20 8 8 0 0 1 0-20z',
}

export const SHIELD = 'M12 1.5l9 3.2v6.6c0 5.4-3.7 9.7-9 11.9-5.3-2.2-9-6.5-9-11.9V4.700z'

/** Black or white, whichever reads better on the given colour. */
export function inkOn(color: string): string {
  const value = Number.parseInt(color.slice(1), 16)
  const [r, g, b] = [(value >> 16) & 255, (value >> 8) & 255, value & 255]
  // Perceived brightness (ITU-R BT.601).
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#16120d' : '#fef5eb'
}
