import { Corretora } from "@/types/asset";

export const BROKER_COLORS: Record<Corretora, string> = {
  Nubank: "#8A05BE",           // roxo Nubank
  Inco: "#FFFFFF",             // branco
  XP: "#000000",               // preto
  Clear: "#00C2FF",           // azul claro
  Sofisa: "#C9A227",          // dourado
  "Grão": "#A3E635",         // verde lima
  Inter: "#FF7A00",           // laranja Inter
  Nomad: "#D4AF37",           // dourado metálico (mais claro que Binance)
  Genial: "#0F2B6B",          // azul escuro
  Binance: "#F3A701",         // amarelo Binance (mais vibrante)
  Outros: "#7E8895",          // cinza
};

export function getBrokerColor(name: Corretora): string {
  return BROKER_COLORS[name] || BROKER_COLORS["Outros"];
}

// Lista canônica e ordenada de corretoras para formularios e filtros
export const BROKER_LIST: Corretora[] = [
  "Nubank",
  "Inco",
  "XP",
  "Clear",
  "Sofisa",
  "Grão",
  "Inter",
  "Nomad",
  "Genial",
  "Binance",
  "Outros",
];
