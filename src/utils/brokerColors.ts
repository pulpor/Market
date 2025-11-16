import { Corretora } from "@/types/asset";

export const BROKER_COLORS: Record<Corretora, string> = {
  Nubank: "#8A05BE",           // roxo Nubank
  Inco: "#FFFFFF",             // branco
  XP: "#000000",               // preto
  Clear: "#00C2FF",           // azul claro
  Sofisa: "#C9A227",          // dourado
  "Grão": "#A3E635",         // verde lima
  Inter: "#FF7A00",           // laranja Inter
  Nomad: "#B38F00",           // amarelo escuro
  Genial: "#0F2B6B",          // azul escuro
  Binance: "#F0B90B",         // amarelo dourado escuro
  Outros: "#7E8895",          // cinza
};

export function getBrokerColor(name: Corretora): string {
  return BROKER_COLORS[name] || BROKER_COLORS["Outros"];
}
