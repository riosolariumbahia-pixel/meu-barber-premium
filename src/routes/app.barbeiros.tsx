import { createFileRoute } from "@tanstack/react-router";
import { Scissors } from "lucide-react";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/app/barbeiros")({
  head: () => ({ meta: [{ title: "Barbeiros — Barber360" }] }),
  component: () => (
    <ModulePlaceholder
      icon={Scissors}
      title="Barbeiros"
      description="Cadastro completo do time com comissões e dashboard individual."
      bullets={[
        "Foto, especialidade e horários",
        "Comissão fixa ou percentual",
        "Dashboard com atendimentos, faturamento e avaliações",
      ]}
    />
  ),
});
