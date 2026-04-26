import type { ReactNode } from "react";

import { Badge } from "../ui/Badge";

interface PageHeaderProps {
  title: string;
  description: string;
  eyebrow?: string;
  badgeText?: string;
  actions?: ReactNode;
}

function PageHeader({ title, description, eyebrow, badgeText, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-5 border-b border-line px-6 pb-6 pt-8 sm:px-8 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-3">
        {eyebrow ? (
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent/80">
            {eyebrow}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-4xl font-extrabold tracking-tight text-ink sm:text-[3.2rem]">
            {title}
          </h1>
          {badgeText ? <Badge variant="slate">{badgeText}</Badge> : null}
        </div>
        <p className="max-w-3xl text-lg text-slate">{description}</p>
      </div>

      {actions ? <div className="shrink-0">{actions}</div> : null}
    </header>
  );
}

export { PageHeader };

