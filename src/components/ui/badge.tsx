import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-tight transition-all duration-300",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[#08ba61] text-white hover:bg-[#07a656]",
        accent:
          "border-[#171719]/20 bg-[#1ff98c] text-[#171719] font-bold shadow-xs",
        secondary:
          "border-[#171719]/10 bg-[#ededed] text-[#171719]",
        dark:
          "border-transparent bg-[#171719] text-white",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "border-[#171719]/20 text-[#171719] bg-white",
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
