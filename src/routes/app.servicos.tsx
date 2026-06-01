import { createFileRoute } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/app/servicos")({
  head: () => ({ meta: [{ title: "Serviços — Barber360" }] }),
  component: () => (
    <ModulePlaceholder
      icon={Sparkles}
      title="Serviços"
      description="Catálogo de serviços com duração, preço e combos."
      bullets={[
        "Categorias: corte, barba, sobrancelha, pigmentação, combos",
        "Duração e preço configuráveis",
        "Ativação/desativação rápida",
      ]}
    />
  ),
});
