import { createFileRoute } from "@tanstack/react-router";
import { Gift } from "lucide-react";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/app/fidelidade")({
  head: () => ({ meta: [{ title: "Fidelidade — Barber360" }] }),
  component: () => (
    <ModulePlaceholder
      icon={Gift}
      title="Fidelidade"
      description="Cashback, pontuação e clube VIP para reter clientes."
      bullets={[
        "10 cortes = 1 corte grátis (configurável)",
        "Cashback e pontuação automáticos",
        "Tiers Bronze, Silver, Gold e Black VIP",
      ]}
    />
  ),
});
