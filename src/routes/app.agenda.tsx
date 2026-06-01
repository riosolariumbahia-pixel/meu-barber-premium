import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays } from "lucide-react";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/app/agenda")({
  head: () => ({ meta: [{ title: "Agenda — Barber360" }] }),
  component: () => (
    <ModulePlaceholder
      icon={CalendarDays}
      title="Agenda"
      description="Visualize e gerencie a agenda da barbearia em modo dia, semana e mês."
      bullets={[
        "Visões dia, semana e mês",
        "Arrastar para reagendar",
        "Status: agendado, confirmado, em atendimento, finalizado, cancelado, no-show",
        "Confirmação automática por WhatsApp (Fase 5)",
      ]}
    />
  ),
});