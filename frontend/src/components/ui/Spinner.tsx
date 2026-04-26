import { cn } from "../../utils/cn";

interface SpinnerProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "h-4 w-4 border-2",
  md: "h-5 w-5 border-2",
  lg: "h-7 w-7 border-[3px]",
};

function Spinner({ className, size = "md" }: SpinnerProps) {
  return (
    <span
      className={cn(
        "inline-block animate-spin rounded-full border-current border-r-transparent",
        sizeClasses[size],
        className,
      )}
      aria-hidden="true"
    />
  );
}

export { Spinner };

