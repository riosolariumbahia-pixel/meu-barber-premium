export function formatBRL(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatPhone(v: string | null | undefined): string {
  if (!v) return "";
  const d = v.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return v;
}

export function onlyDigits(v: string): string {
  return v.replace(/\D/g, "");
}

export function vipTierFromSpend(total: number): "bronze" | "silver" | "gold" | "platinum" {
  if (total >= 5000) return "platinum";
  if (total >= 2000) return "gold";
  if (total >= 500) return "silver";
  return "bronze";
}