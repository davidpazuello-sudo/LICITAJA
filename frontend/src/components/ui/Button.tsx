import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "../../utils/cn";
import { Spinner } from "./Spinner";

type ButtonVariant = "primary" | "secondary" | "ghost" | "outline";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-white shadow-card hover:bg-accentDark focus-visible:ring-accent/40",
  secondary:
    "bg-softBlue text-accent hover:bg-blue-100 focus-visible:ring-accent/25",
  ghost:
    "bg-transparent text-slate hover:bg-slate-100 focus-visible:ring-slate-200",
  outline:
    "border border-line bg-white text-ink hover:border-accent/40 hover:text-accent focus-visible:ring-accent/20",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-10 px-4 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-base",
};

function Button({
  children,
  className,
  variant = "primary",
  size = "md",
  isLoading = false,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-60",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? <Spinner className="text-current" size="sm" /> : null}
      <span>{children}</span>
    </button>
  );
}

export { Button };

