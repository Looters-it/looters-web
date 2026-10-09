import { cn } from '@/lib/utils'

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']
/** Height of a digit's cell: a little more than the type, so tall faces do not spill into the next. */
const CELL_EM = 1.2

/**
 * A number whose digits roll to their new value, like a mechanical counter.
 * Screen readers get the plain value; the motion stops with reduced-motion
 * (see index.css).
 */
export function RollingNumber({ value, className }: { value: number; className?: string }) {
  const digits = String(Math.max(0, Math.trunc(value))).split('')

  return (
    <span className={cn('inline-flex font-mono leading-none', className)}>
      <span className="sr-only">{value}</span>
      <span aria-hidden="true" className="inline-flex h-[1.2em] overflow-hidden">
        {digits.map((digit, index) => (
          // Keyed from the right, so units stay units when the number gains a digit.
          <span
            key={digits.length - index}
            className="flex flex-col transition-transform duration-500 ease-out"
            style={{ transform: `translateY(-${Number(digit) * CELL_EM}em)` }}
          >
            {DIGITS.map((d) => (
              <span key={d} className="h-[1.2em] leading-[1.2em]">
                {d}
              </span>
            ))}
          </span>
        ))}
      </span>
    </span>
  )
}
