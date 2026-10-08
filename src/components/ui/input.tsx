import * as React from 'react'
import { cn } from '@/lib/utils'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // A line to write on, not a box: only the bottom edge is drawn.
        'border-input selection:bg-primary selection:text-primary-foreground file:text-foreground placeholder:text-muted-foreground h-9 w-full min-w-0 rounded-none border-0 border-b-2 bg-transparent px-1 py-1 text-base transition-[border-color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        // Focus thickens the line in the primary colour.
        'focus-visible:border-ring focus-visible:shadow-[0_2px_0_0_var(--color-ring)]',
        'aria-invalid:border-destructive',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
