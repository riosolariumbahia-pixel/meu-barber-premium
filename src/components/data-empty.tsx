import { type ReactNode } from "react";

export function DataEmpty({ icon: Icon, title, description, action }: { icon: any; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="grid place-items-center rounded-xl border border-dashed border-border bg-card/50 p-10 text-center">
      <Icon className="h-10 w-10 text-muted-foreground" />
      <h3 className="mt-3 font-semibold">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}