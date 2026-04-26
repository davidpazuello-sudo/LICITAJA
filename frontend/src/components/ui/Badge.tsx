import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "../../utils/cn";

type BadgeVariant = "neutral" | "blue" | "green" | "amber" | "slate";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  neutral: "bg-slate-100 text-slate-700 ring-slate-200",
  blue: "bg-blue-50 text-accent ring-blue-100",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  amber: "bg-amber-50 text-amber-700 ring-amber-100",
  slate: "bg-[#EFF2F8] text-[#596376] ring-[#DEE5F0]",
};

function Badge({ children, className, variant = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset",
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export { Badge };

