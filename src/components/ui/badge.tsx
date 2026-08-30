import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-3 py-0.5 text-xs font-extrabold tracking-tight transition-all duration-200",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[var(--accent)] text-[var(--fg)] shadow-xs",
        accent:
          "border-transparent bg-[var(--sunny)] text-[var(--fg)] font-extrabold shadow-xs",
        secondary:
          "border-transparent bg-[var(--accent-soft)] text-[var(--accent-deep)] font-bold",
        dark:
          "border-transparent bg-[var(--fg)] text-white font-bold",
        destructive:
          "border-transparent bg-rose-100 text-rose-800 border-rose-300 font-bold",
        outline: "border-[var(--border)] text-[var(--fg)] bg-[var(--surface)] font-bold",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  className?: string;
  children?: React.ReactNode;
}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }

