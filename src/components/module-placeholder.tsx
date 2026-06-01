import type { LucideIcon } from "lucide-react";

export function ModulePlaceholder({
  icon: Icon,
  title,
  description,
  bullets,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  bullets: string[];
}) {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="rounded-2xl border border-dashed border-border bg-card p-8 shadow-sm">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/15 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <h2 className="mt-4 text-2xl font-semibold tracking-tight">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        <ul className="mt-6 space-y-2 text-sm">
          {bullets.map((b) => (
            <li key={b} className="flex items-start gap-2 text-muted-foreground">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-xs text-muted-foreground">
          Este módulo será ativado nas próximas fases do roadmap.
        </p>
      </div>
    </div>
  );
}