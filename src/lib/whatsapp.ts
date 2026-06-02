import { onlyDigits } from "./format";

export function buildWhatsAppLink(phone: string, message: string): string {
  const digits = onlyDigits(phone);
  const num = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${num}?text=${encodeURIComponent(message)}`;
}

export function reminderTemplate(opts: { customerName: string; serviceName: string; startsAt: string; tenantName: string }) {
  const d = new Date(opts.startsAt);
  const date = d.toLocaleDateString("pt-BR");
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `Olá, ${opts.customerName}! 👋\nLembrete do seu horário na ${opts.tenantName}: ${opts.serviceName} em ${date} às ${time}.\nQualquer coisa, é só responder por aqui.`;
}