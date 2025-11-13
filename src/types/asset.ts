export type Corretora =
  | "Nubank"
  | "Inco"
  | "XP"
  | "Clear"
  | "Sofisa"
  | "Grão"
  | "Inter"
  | "Nomad"
  | "Genial"
  | "Binance"
  | "Outros";

export interface Asset {
  id: string;
  ticker: string;
  quantidade: number;
  preco_medio: number;
  setor?: string;
  corretora: Corretora;
  tipo_ativo_manual?: string; // Previdência, Tesouro Direto, CDB, etc.
  indice_referencia?: string; // CDI, IPCA, Selic, etc.
  taxa_contratada?: number; // Taxa em % a.a.
  data_vencimento?: string; // Data de vencimento
  data_aplicacao?: string; // Data de aplicação (início da contagem para RF)
  valor_atual_rf?: number; // Valor atual para renda fixa
}

export interface CalculatedAsset extends Asset {
  ticker_normalizado: string;
  preco_atual: number;
  valor_total: number;
  variacao_percentual: number;
  dividend_yield: number;
  pl_posicao: number;
  peso_carteira: number; // percentual do ativo na carteira total
  yoc: number; // Yield on Cost (DY sobre preço médio)
  projecao_dividendos_anual: number; // projeção anual de dividendos em R$
  tipo_ativo?: string; // Ação, FII, ETF, Outro
}

export interface PortfolioSummary {
  valor_total_carteira: number;
  dy_ponderado: number;
  pl_total: number;
}

export interface CalculateResponse {
  ativos: CalculatedAsset[];
  resumo: PortfolioSummary;
}
