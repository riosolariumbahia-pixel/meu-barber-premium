import { createFileRoute } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/app/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — Barber360" }] }),
  component: () => (
    <ModulePlaceholder
      icon={Settings}
      title="Configurações"
      description="Dados da barbearia, equipe e integrações."
      bullets={[
        "Identidade e dados da empresa",
        "Equipe e permissões",
        "Integrações WhatsApp, PIX e IA (Fase 5)",
      ]}
    />
  ),
});
