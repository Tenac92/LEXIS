import { cn } from "@/lib/utils";

interface LoadingSpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "w-4 h-4",
  md: "w-8 h-8",
  lg: "w-12 h-12"
} as const;

export function LoadingSpinner({ 
  size = "md", 
  className,
  ...props 
}: LoadingSpinnerProps) {
  return (
    <div className={cn("flex justify-center items-center", className)} {...props}>
      <div
        className={cn(
          sizeClasses[size],
          "border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"
        )}
        role="status"
        aria-label="loading"
      />
    </div>
  );
}
