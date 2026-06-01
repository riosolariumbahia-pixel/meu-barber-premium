import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Scissors, ShieldCheck, CalendarCheck2, BarChart4, Sparkles, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Barber360 — Gestão premium para barbearias" },
      {
        name: "description",
        content:
          "Agenda inteligente, CRM de clientes, financeiro e fidelidade em um SaaS brasileiro pensado para barbearias de alto nível.",
      },
      { property: "og:title", content: "Barber360 — Gestão premium para barbearias" },
      {
        property: "og:description",
        content: "Tudo que sua barbearia precisa para crescer, em um só lugar.",
      },
      { name: "theme-color", content: "#0f1115" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border/60 backdrop-blur sticky top-0 z-30 bg-background/80">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <span className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
              <Scissors className="h-4 w-4" />
            </span>
            <span className="text-lg tracking-tight">Barber360</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#recursos" className="hover:text-foreground transition">Recursos</a>
            <a href="#planos" className="hover:text-foreground transition">Planos</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/login">Entrar</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/signup">Começar grátis</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 py-20 md:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3 text-primary" /> SaaS premium para barbearias brasileiras
          </span>
          <h1 className="mt-6 text-4xl md:text-6xl font-semibold tracking-tight">
            A operação completa da sua{" "}
            <span className="bg-gradient-to-r from-primary to-amber-400 bg-clip-text text-transparent">
              barbearia premium
            </span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            Agenda, CRM, financeiro, fidelidade e WhatsApp em um só painel. Multi-tenant seguro,
            mobile first, com isolamento total entre empresas.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/signup">
                Criar minha barbearia <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/login">Já tenho conta</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="recursos" className="container mx-auto px-4 pb-24">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { icon: CalendarCheck2, title: "Agenda inteligente", desc: "Dia, semana e mês com arrastar, confirmar, no-show e reagendamento." },
            { icon: BarChart4, title: "Financeiro completo", desc: "Fluxo de caixa, comissões automáticas e dashboards de faturamento." },
            { icon: ShieldCheck, title: "Multi-tenant seguro", desc: "Cada barbearia com dados isolados, RLS e logs de auditoria." },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-border/60 bg-card p-6 shadow-sm">
              <div className="grid h-10 w-10 place-items-center rounded-md bg-primary/15 text-primary">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border/60 py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Barber360 · Feito no Brasil
      </footer>
    </div>
  );
}
