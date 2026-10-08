import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'

import { cn } from '@/lib/utils'

// Conventions validated on the prototype (PROMPT §3, §11): thin pill buttons,
// 36px tall (32px small), growing slightly on hover; the main action is hunter-green-700.
const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-pill border font-bold whitespace-nowrap uppercase tracking-[0.09em] outline-none transition-[transform,background-color,border-color,color] duration-150 ease-spring hover:scale-[1.07] active:scale-[0.96] active:duration-75 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:border-dashed disabled:border-accent disabled:bg-transparent disabled:text-muted-foreground disabled:hover:scale-100 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          'border-primary bg-primary text-primary-foreground hover:border-primary-hover hover:bg-primary-hover',
        destructive:
          'border-destructive bg-destructive text-on-danger hover:border-danger-hover hover:bg-danger-hover',
        outline: 'border-foreground bg-transparent text-foreground hover:bg-accent',
        quiet: 'border-border bg-transparent text-foreground hover:bg-accent',
        ghost: 'border-transparent bg-transparent text-foreground hover:bg-accent',
      },
      size: {
        default: 'min-h-9 px-4 pt-1.5 pb-1 text-[15px]',
        sm: 'min-h-8 px-3 pt-1 pb-0.5 text-[13px]',
        lg: 'min-h-12 px-7 pt-2 pb-1.5 text-[17px]',
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
