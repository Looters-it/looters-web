/**
 * The sounds of a match, made on the spot: no file to load. First the tick of a
 * clock. Two short knocks, one
 * higher ("tic") and one lower ("tac"), each a burst that dies away at once.
 *
 * Browsers let a page make a sound only after the person has touched it: the
 * first click or key anywhere unlocks it, and until then nothing is heard.
 */
let context: AudioContext | null = null

function audio(): AudioContext | null {
  if (context) return context
  const Context =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Context) return null
  context = new Context()
  return context
}

/** To be called once: from then on the first gesture on the page lets the sound through. */
export function unlockSoundOnFirstGesture(): () => void {
  const unlock = () => {
    void audio()?.resume()
    stop()
  }
  const stop = () => {
    window.removeEventListener('pointerdown', unlock)
    window.removeEventListener('keydown', unlock)
  }
  window.addEventListener('pointerdown', unlock)
  window.addEventListener('keydown', unlock)
  return stop
}

/** One knock of the clock: `tic` for the higher one, otherwise the lower "tac". */
export function tick(tic: boolean): void {
  const ctx = audio()
  if (!ctx || ctx.state !== 'running') return
  const at = ctx.currentTime
  const knock = ctx.createOscillator()
  const volume = ctx.createGain()
  const tone = ctx.createBiquadFilter()
  // A dry, woody knock: a square wave through a narrow band, gone in a few hundredths.
  knock.type = 'square'
  knock.frequency.setValueAtTime(tic ? 2100 : 1500, at)
  tone.type = 'bandpass'
  tone.frequency.setValueAtTime(tic ? 2400 : 1700, at)
  tone.Q.setValueAtTime(6, at)
  volume.gain.setValueAtTime(0.0001, at)
  volume.gain.exponentialRampToValueAtTime(0.35, at + 0.004)
  volume.gain.exponentialRampToValueAtTime(0.0001, at + 0.07)
  knock.connect(tone).connect(volume).connect(ctx.destination)
  knock.start(at)
  knock.stop(at + 0.08)
}

/** A note that swells and fades: the brick the other sounds are built with. */
function note(
  ctx: AudioContext,
  wave: OscillatorType,
  hertz: number,
  startsIn: number,
  lasts: number,
  loudness: number,
): void {
  const at = ctx.currentTime + startsIn
  const voice = ctx.createOscillator()
  const volume = ctx.createGain()
  voice.type = wave
  voice.frequency.setValueAtTime(hertz, at)
  volume.gain.setValueAtTime(0.0001, at)
  volume.gain.exponentialRampToValueAtTime(loudness, at + 0.015)
  volume.gain.exponentialRampToValueAtTime(0.0001, at + lasts)
  voice.connect(volume).connect(ctx.destination)
  voice.start(at)
  voice.stop(at + lasts + 0.02)
}

/**
 * Something needs the player now: two short, sharp calls, the second lower. For
 * the warnings at the top of the map, such as an attack on a municipality.
 */
export function alertSound(): void {
  const ctx = audio()
  if (!ctx || ctx.state !== 'running') return
  note(ctx, 'triangle', 880, 0, 0.16, 0.3)
  note(ctx, 'triangle', 660, 0.18, 0.22, 0.3)
}

/** A turn begins: three soft notes going up, nothing like an alarm. */
export function turnSound(): void {
  const ctx = audio()
  if (!ctx || ctx.state !== 'running') return
  note(ctx, 'sine', 523.25, 0, 0.3, 0.22)
  note(ctx, 'sine', 659.25, 0.12, 0.3, 0.22)
  note(ctx, 'sine', 783.99, 0.24, 0.5, 0.22)
}
