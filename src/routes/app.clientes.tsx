import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/app/clientes")({
  head: () => ({ meta: [{ title: "Clientes — Barber360" }] }),
  component: () => (
    <ModulePlaceholder
      icon={Users}
      title="Clientes"
      description="CRM completo com histórico, frequência, gasto total e última visita."
      bullets={[
        "Cadastro: nome, telefone, WhatsApp, e-mail, nascimento",
        "Histórico de serviços e visitas",
        "Gasto total acumulado e frequência",
        "Segmentação por VIP tier",
      ]}
    />
  ),
});
