import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-[9px] text-xs sm:text-sm font-semibold tracking-wide ring-offset-background transition-all duration-300 ease-[cubic-bezier(0.14,1,0.34,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] cursor-pointer",
  {
    variants: {
      variant: {
        default: "bg-[#08ba61] text-white hover:bg-[#07a656] shadow-sm hover:shadow-[0_0_15px_rgba(31,249,140,0.35)]",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm",
        outline:
          "border border-[#171719]/20 bg-white text-[#171719] hover:bg-[#ededed] hover:border-[#171719]",
        secondary:
          "bg-[#ededed] text-[#171719] hover:bg-[#e2e2e2] border border-transparent",
        accent:
          "bg-[#1ff98c] text-[#171719] hover:bg-[#1ae07d] font-bold shadow-sm hover:shadow-[0_0_20px_rgba(31,249,140,0.5)]",
        dark:
          "bg-[#171719] text-white hover:bg-[#232327] shadow-sm",
        ghost: "hover:bg-[#ededed] text-[#171719]",
        link: "text-[#08ba61] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-[9px] px-3 text-xs",
        lg: "h-11 rounded-[9px] px-6 text-sm",
        icon: "h-9 w-9 rounded-[9px]",
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
