import * as React from "react"

import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200",
          "border-input bg-background focus-visible:ring-ring",
          "data-[error='true']:border-destructive/50 data-[error='true']:bg-destructive/5 data-[error='true']:focus-visible:ring-destructive/20 data-[error='true']:focus-visible:border-destructive",
          "data-[success='true']:border-emerald-500/50 data-[success='true']:bg-emerald-50/30 data-[success='true']:focus-visible:ring-emerald-500/20 data-[success='true']:focus-visible:border-emerald-500",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
