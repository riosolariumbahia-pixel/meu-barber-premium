import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  // Isso força o conversor a gerar o build ideal do Nitro para o Vercel
  nitro: true, 
  
  // Mantenha qualquer outra configuração existente abaixo desse campo, se houver
});
