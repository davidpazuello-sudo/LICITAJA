import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "../../utils/cn";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

function Card({ children, className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-[26px] border border-line/80 bg-white shadow-card transition duration-200",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export { Card };

