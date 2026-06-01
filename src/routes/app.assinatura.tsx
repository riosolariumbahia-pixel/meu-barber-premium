import { createFileRoute } from "@tanstack/react-router";
import { Crown } from "lucide-react";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/app/assinatura")({
  head: () => ({ meta: [{ title: "Assinatura — Barber360" }] }),
  component: () => (
    <ModulePlaceholder
      icon={Crown}
      title="Assinatura"
      description="Gerencie seu plano Starter, Pro ou Premium."
      bullets={[
        "Plano atual e status (trial, ativo, suspenso)",
        "Upgrade / downgrade quando quiser",
        "Faturamento e renovação automáticos",
      ]}
    />
  ),
});
