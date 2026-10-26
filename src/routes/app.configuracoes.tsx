import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { queryOptions, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles, QrCode, MessageCircle, Share2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { getTenantSettings, updateTenantSettings } from "@/lib/settings.functions";
import { generateInstagramPost, generateWhatsappMessage, suggestCampaign } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { buildPixPayload } from "@/lib/pix";

const q = queryOptions({ queryKey: ["tenant-settings"], queryFn: () => getTenantSettings() });

export const Route = createFileRoute("/app/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — Barber360" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(q),
  component: SettingsPage,
  errorComponent: ({ error }) => <div className="p-6 text-sm text-destructive">{error instanceof Error ? error.message : String(error)}</div>,
});

function SettingsPage() {
  const { data: t } = useQuery(q);
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground">Dados da barbearia, PIX, WhatsApp e IA.</p>
      </header>
      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">Geral</TabsTrigger>
          <TabsTrigger value="link"><Share2 className="mr-1 h-3.5 w-3.5" />Link público</TabsTrigger>
          <TabsTrigger value="pix">PIX</TabsTrigger>
          <TabsTrigger value="ai"><Sparkles className="mr-1 h-3.5 w-3.5" />IA</TabsTrigger>
        </TabsList>
        <TabsContent value="general"><GeneralForm tenant={t} /></TabsContent>
        <TabsContent value="link"><PublicLinkPanel tenant={t} /></TabsContent>
        <TabsContent value="pix"><PixPanel tenant={t} /></TabsContent>
        <TabsContent value="ai"><AIPanel /></TabsContent>
      </Tabs>
    </div>
  );
}

function PublicLinkPanel({ tenant }: { tenant: any }) {
  const url = tenant?.slug && typeof window !== "undefined" ? `${window.location.origin}/b/${tenant.slug}` : "";
  return (
    <div className="mt-4 space-y-3 rounded-xl border border-border/60 bg-card p-5">
      <div className="flex items-center gap-2"><Share2 className="h-4 w-4 text-primary" /><h2 className="font-semibold">Link de agendamento online</h2></div>
      <p className="text-sm text-muted-foreground">Compartilhe este link com seus clientes pelo WhatsApp, Instagram ou stories. Eles se cadastram e marcam o horário sozinhos — você recebe na agenda automaticamente e enviamos um lembrete 1 hora antes.</p>
      {url ? (
        <>
          <Input readOnly value={url} className="font-mono text-xs" />
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => { navigator.clipboard.writeText(url); toast.success("Link copiado!"); }}>Copiar link</Button>
            <Button variant="outline" asChild><a href={url} target="_blank" rel="noreferrer"><ExternalLink className="mr-1 h-4 w-4" />Abrir</a></Button>
            <Button variant="outline" asChild>
              <a target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`Agende seu horário online: ${url}`)}`}>
                <MessageCircle className="mr-1 h-4 w-4" />Compartilhar no WhatsApp
              </a>
            </Button>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Salve o nome da barbearia primeiro para gerar o link.</p>
      )}
    </div>
  );
}

function GeneralForm({ tenant }: { tenant: any }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>({ name: "", city: "", whatsapp_number: "", instagram_handle: "", pix_key: "", pix_key_type: "cpf" });
  useMemo(() => {
    if (tenant) setForm({
      name: tenant.name ?? "", city: tenant.city ?? "",
      whatsapp_number: tenant.whatsapp_number ?? "", instagram_handle: tenant.instagram_handle ?? "",
      pix_key: tenant.pix_key ?? "", pix_key_type: tenant.pix_key_type ?? "cpf",
    });
  }, [tenant]);
  const save = useMutation({
    mutationFn: () => updateTenantSettings({ data: form }),
    onSuccess: () => { qc.invalidateQueries(); toast.success("Configurações salvas"); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="mt-4 grid gap-3 rounded-xl border border-border/60 bg-card p-5 sm:grid-cols-2">
      <div className="sm:col-span-2"><Label>Nome da barbearia</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
      <div><Label>Cidade</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
      <div><Label>WhatsApp</Label><Input value={form.whatsapp_number} onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })} placeholder="(11) 99999-9999" /></div>
      <div><Label>Instagram</Label><Input value={form.instagram_handle} onChange={(e) => setForm({ ...form, instagram_handle: e.target.value })} placeholder="@suabarbearia" /></div>
      <div>
        <Label>Tipo da chave PIX</Label>
        <Select value={form.pix_key_type} onValueChange={(v) => setForm({ ...form, pix_key_type: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="cpf">CPF</SelectItem>
            <SelectItem value="cnpj">CNPJ</SelectItem>
            <SelectItem value="email">E-mail</SelectItem>
            <SelectItem value="phone">Telefone</SelectItem>
            <SelectItem value="random">Aleatória</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="sm:col-span-2"><Label>Chave PIX</Label><Input value={form.pix_key} onChange={(e) => setForm({ ...form, pix_key: e.target.value })} /></div>
      <div className="sm:col-span-2"><Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Salvando..." : "Salvar"}</Button></div>
    </div>
  );
}

function PixPanel({ tenant }: { tenant: any }) {
  const [amount, setAmount] = useState(0);
  const payload = useMemo(() => {
    if (!tenant?.pix_key) return "";
    try {
      return buildPixPayload({ key: tenant.pix_key, merchantName: tenant.name, merchantCity: tenant.city ?? "BRASIL", amount });
    } catch { return ""; }
  }, [tenant, amount]);
  return (
    <div className="mt-4 rounded-xl border border-border/60 bg-card p-5">
      <div className="flex items-center gap-2"><QrCode className="h-4 w-4 text-primary" /><h2 className="font-semibold">PIX Copia e Cola</h2></div>
      {tenant?.pix_key ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div><Label>Valor opcional (R$)</Label><Input type="number" step="0.01" min={0} value={amount} onChange={(e) => setAmount(Number(e.target.value))} /></div>
          <div className="sm:col-span-2"><Label>Código BR Code</Label><Textarea rows={4} readOnly value={payload} className="font-mono text-xs" /></div>
          <Button onClick={() => { navigator.clipboard.writeText(payload); toast.success("Copiado!"); }}>Copiar código PIX</Button>
        </div>
      ) : <p className="mt-3 text-sm text-muted-foreground">Configure sua chave PIX em Geral para gerar o código.</p>}
    </div>
  );
}

function AIPanel() {
  const [tab, setTab] = useState("insta");
  const [topic, setTopic] = useState("");
  const [goal, setGoal] = useState("");
  const [wpKind, setWpKind] = useState<"lembrete" | "promocao" | "aniversario" | "reativacao">("lembrete");
  const [wpName, setWpName] = useState("");
  const [out, setOut] = useState("");

  const m1 = useMutation({ mutationFn: () => generateInstagramPost({ data: { topic, tone: "descontraido" } }), onSuccess: (r) => setOut(r.content), onError: (e: Error) => toast.error(e.message) });
  const m2 = useMutation({ mutationFn: () => generateWhatsappMessage({ data: { kind: wpKind, clientName: wpName } }), onSuccess: (r) => setOut(r.content), onError: (e: Error) => toast.error(e.message) });
  const m3 = useMutation({ mutationFn: () => suggestCampaign({ data: { goal } }), onSuccess: (r) => setOut(r.content), onError: (e: Error) => toast.error(e.message) });

  return (
    <div className="mt-4 rounded-xl border border-border/60 bg-card p-5">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="insta">Post Instagram</TabsTrigger>
          <TabsTrigger value="wp"><MessageCircle className="mr-1 h-3.5 w-3.5" />WhatsApp</TabsTrigger>
          <TabsTrigger value="camp">Campanhas</TabsTrigger>
        </TabsList>
        <TabsContent value="insta" className="mt-4 space-y-3">
          <div><Label>Tema</Label><Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="ex.: promoção de corte + barba" /></div>
          <Button onClick={() => m1.mutate()} disabled={!topic || m1.isPending}>{m1.isPending ? "Gerando..." : "Gerar post"}</Button>
        </TabsContent>
        <TabsContent value="wp" className="mt-4 grid gap-3 sm:grid-cols-2">
          <div><Label>Tipo</Label>
            <Select value={wpKind} onValueChange={(v) => setWpKind(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="lembrete">Lembrete</SelectItem>
                <SelectItem value="promocao">Promoção</SelectItem>
                <SelectItem value="aniversario">Aniversário</SelectItem>
                <SelectItem value="reativacao">Reativação</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Nome do cliente</Label><Input value={wpName} onChange={(e) => setWpName(e.target.value)} /></div>
          <div className="sm:col-span-2"><Button onClick={() => m2.mutate()} disabled={m2.isPending}>{m2.isPending ? "Gerando..." : "Gerar mensagem"}</Button></div>
        </TabsContent>
        <TabsContent value="camp" className="mt-4 space-y-3">
          <div><Label>Objetivo</Label><Input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="ex.: aumentar clientes recorrentes" /></div>
          <Button onClick={() => m3.mutate()} disabled={!goal || m3.isPending}>{m3.isPending ? "Gerando..." : "Sugerir campanhas"}</Button>
        </TabsContent>
      </Tabs>
      {out && (
        <div className="mt-5">
          <Label>Resultado</Label>
          <Textarea rows={10} value={out} readOnly className="mt-1 font-mono text-sm" />
          <Button size="sm" variant="outline" className="mt-2" onClick={() => { navigator.clipboard.writeText(out); toast.success("Copiado"); }}>Copiar</Button>
        </div>
      )}
    </div>
  );
}