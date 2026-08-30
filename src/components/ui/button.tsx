import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-full text-xs sm:text-sm font-extrabold tracking-tight transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] cursor-pointer",
  {
    variants: {
      variant: {
        default: "bg-[var(--accent)] text-[var(--fg)] hover:bg-[var(--accent-deep)] shadow-xs hover:-translate-y-0.5",
        destructive:
          "bg-rose-600 text-white hover:bg-rose-700 shadow-xs",
        outline:
          "border-2 border-[var(--border)] bg-[var(--surface)] text-[var(--fg)] hover:border-[var(--fg)] hover:-translate-y-0.5",
        secondary:
          "bg-[var(--accent-soft)] text-[var(--accent-deep)] hover:bg-[oklch(0.90_0.06_60)] border border-transparent",
        accent:
          "bg-[var(--sunny)] text-[var(--fg)] hover:bg-amber-300 font-extrabold shadow-xs hover:-translate-y-0.5",
        dark:
          "bg-[var(--fg)] text-[oklch(0.97_0.01_84)] hover:opacity-90 shadow-xs",
        ghost: "hover:bg-[oklch(0.955_0.012_84)] text-[var(--fg)]",
        link: "text-[var(--accent-deep)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-8 px-3.5 text-xs",
        lg: "h-12 px-7 text-sm sm:text-base",
        icon: "h-9 w-9 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  },
)
Button.displayName = "Button"

export { Button, buttonVariants }

