import { createFileRoute } from "@tanstack/react-router";
import { Wallet } from "lucide-react";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/app/financeiro")({
  head: () => ({ meta: [{ title: "Financeiro — Barber360" }] }),
  component: () => (
    <ModulePlaceholder
      icon={Wallet}
      title="Financeiro"
      description="Fluxo de caixa, receitas, despesas e indicadores em tempo real."
      bullets={[
        "Fluxo de caixa diário e mensal",
        "Receita por barbeiro e por serviço",
        "Ticket médio e faturamento",
        "Comissões automáticas com fechamento mensal",
      ]}
    />
  ),
});
