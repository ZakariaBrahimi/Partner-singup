import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'
import { cn } from '@/lib/utils'

// 52px high, 12px radius, >= 44px touch target.
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 rounded-[12px] h-[52px] px-6 text-base',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-[#173b4e]',
        outline: 'border-2 border-primary text-primary bg-white hover:bg-surface',
        accent: 'bg-accent text-ink hover:brightness-95',
        ghost: 'text-primary hover:bg-surface',
        link: 'h-auto min-h-11 px-1 text-primary underline underline-offset-4 rounded-md',
        destructive: 'bg-danger text-white hover:brightness-95',
      },
      size: { default: '', sm: 'h-11 px-4 text-sm' },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

export interface ButtonProps extends React.ComponentProps<'button'>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

function Button({ className, variant, size, asChild = false, type, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp
      data-slot="button"
      type={asChild ? undefined : (type ?? 'button')}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
}

export { Button, buttonVariants }
