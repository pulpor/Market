export interface FreelanceEntry {
  id: string;
  date: string; // YYYY-MM-DD
  dayName?: string; // opcional
  client?: string; // unidade / centro
  description?: string; // conteúdo / atividade
  hours?: number; // horas totais (ex: 3.5)
  startEnd?: string; // faixa de horas: 08:30 - 12:30
  ch?: number; // carga horária bloque / crédito
  hourlyRate?: number; // R$ por hora
  extra?: number; // adicional (vt, bônus, transporte)
  total?: number; // calculado = (hours * hourlyRate) + (extra || 0)
}

export interface DividendForecast {
  id: string;
  assetTicker: string;
  amount: number; // R$
  expectedDate?: string; // YYYY-MM-DD
  auto?: boolean; // foi gerado automaticamente a partir dos ativos
}

export interface ReceivableEntry {
  id: string;
  description: string;
  amount: number; // R$
  expectedDate?: string; // YYYY-MM-DD
}

export interface ExpenseEntry {
  id: string;
  description: string;
  amount: number; // R$
  expectedDate?: string; // YYYY-MM-DD
}

export interface ReturnsForecastState {
  month: string; // YYYY-MM
  salary?: number; // salário variável do mês
  freelas: FreelanceEntry[];
  dividends: DividendForecast[];
  receivables: ReceivableEntry[];
  expenses: ExpenseEntry[];
}
