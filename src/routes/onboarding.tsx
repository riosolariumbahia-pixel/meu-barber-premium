import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createTenant } from "@/lib/tenant.functions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AuthCard } from "@/components/auth-card";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Configurar barbearia — Barber360" }] }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/login" });
  },
  component: OnboardingPage,
});

function suggestSlug(v: string) {
  return v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

function OnboardingPage() {
  const navigate = useNavigate();
  const create = useServerFn(createTenant);
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await create({ data: { name, slug, city } });
      await queryClient.invalidateQueries({ queryKey: ["app", "context"] });
      toast.success("Barbearia criada!");
      navigate({ to: "/app" });
    } catch (err) {
      toast.error("Erro ao criar barbearia", {
        description: err instanceof Error ? err.message : "Tente novamente",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard title="Configure sua barbearia" subtitle="Leva menos de 1 minuto.">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nome da barbearia</Label>
          <Input
            id="name"
            required
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slug) setSlug(suggestSlug(e.target.value));
            }}
            placeholder="Barbearia do João"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="slug">URL única</Label>
          <div className="flex items-center rounded-md border border-input bg-background pl-3 focus-within:ring-2 focus-within:ring-ring">
            <span className="text-sm text-muted-foreground">barber360.app/</span>
            <Input
              id="slug"
              required
              className="border-0 focus-visible:ring-0"
              value={slug}
              onChange={(e) => setSlug(suggestSlug(e.target.value))}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="city">Cidade</Label>
          <Input id="city" required value={city} onChange={(e) => setCity(e.target.value)} placeholder="São Paulo" />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Criando..." : "Criar barbearia"}
        </Button>
      </form>
    </AuthCard>
  );
}