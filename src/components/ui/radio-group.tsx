import * as RadioGroupPrimitive from '@radix-ui/react-radio-group'
import * as React from 'react'
import { cn } from '@/lib/utils'

function RadioGroup({ className, ...props }: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return <RadioGroupPrimitive.Root data-slot="radio-group" className={cn('grid gap-2', className)} {...props} />
}

/** A full-width, >= 48px selectable row (works as a segmented option on any width). */
function RadioItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-item"
      className={cn(
        'flex min-h-12 w-full items-center gap-3 rounded-[10px] border border-input bg-white px-3.5 text-start text-base text-ink',
        'data-[state=checked]:border-2 data-[state=checked]:border-primary data-[state=checked]:bg-[#eef4f7]',
        'aria-invalid:border-danger',
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className="flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-input [[data-state=checked]_&]:border-primary"
      >
        <RadioGroupPrimitive.Indicator className="size-2.5 rounded-full bg-primary" />
      </span>
      <span className="flex-1">{children}</span>
    </RadioGroupPrimitive.Item>
  )
}
export { RadioGroup, RadioItem }
