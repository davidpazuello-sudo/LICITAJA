import type { InputHTMLAttributes, ReactNode } from "react";

import { cn } from "../../utils/cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: ReactNode;
}

function Input({ className, icon, ...props }: InputProps) {
  return (
    <label
      className={cn(
        "flex h-14 items-center gap-3 rounded-2xl border border-line bg-white px-4 text-slate shadow-sm transition duration-200 focus-within:border-accent/40 focus-within:ring-4 focus-within:ring-accent/10",
        className,
      )}
    >
      {icon ? <span className="text-slate">{icon}</span> : null}
      <input
        className="w-full border-none bg-transparent text-sm text-ink outline-none placeholder:text-slate/90"
        {...props}
      />
    </label>
  );
}

export { Input };

