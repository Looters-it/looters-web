import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'

import { cn } from '@/lib/utils'

// Conventions validated on the prototype (PROMPT §3, §11): thin pill buttons,
// 36px tall (32px small), growing a little and unhurriedly on hover; the main action is deep blue, and
// `secondary` (watermelon) is for the one thing on a page that must stand out.
const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-pill border font-display font-normal whitespace-nowrap tracking-[0.02em] outline-none transition-[scale,transform,background-color,border-color,color] duration-500 ease-in-out hover:scale-[1.03] active:scale-[0.98] active:duration-150 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:border-dashed disabled:border-accent disabled:bg-transparent disabled:text-muted-foreground disabled:hover:scale-100 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // What is pressed is watermelon, everywhere: the page itself is the deep blue.
        default:
          'border-secondary bg-secondary text-white hover:border-secondary-hover hover:bg-secondary-hover',
        secondary:
          'border-secondary bg-secondary text-white hover:border-secondary-hover hover:bg-secondary-hover',
        destructive:
          'border-destructive bg-destructive text-on-danger hover:border-danger-hover hover:bg-danger-hover',
        outline: 'border-foreground bg-transparent text-foreground hover:bg-accent',
        quiet: 'border-border bg-transparent text-foreground hover:bg-accent',
        ghost: 'border-transparent bg-transparent text-foreground hover:bg-accent',
      },
      size: {
        // The heading font sits high on its line: the uneven padding puts the letters,
        // as they are drawn, in the middle of the button (measured, not guessed).
        default: 'min-h-9 px-4 pt-[7px] pb-[3px] text-[15px]',
        sm: 'min-h-8 px-3 pt-1.5 pb-0 text-[13px]',
        lg: 'min-h-12 px-7 pt-2.5 pb-1 text-[17px]',
        icon: 'size-9',
        'icon-sm': 'size-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : 'button'

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

// eslint-disable-next-line react/only-export-components
export { Button, buttonVariants }
