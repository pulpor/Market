export interface FinancingInstallment {
  data_vencimento: string; // ISO date
  data_pagamento?: string; // ISO date
  numero: number; // nº da parcela
  amortizacao: number; // R$
  seguro?: number; // R$
  taxas?: number; // R$
  subsidio_correcao?: number; // R$
  diferencial_juros?: number; // R$
  fgts?: number; // R$
  mora_multa?: number; // R$
  devolvido?: number; // R$
  pago: number; // R$ valor pago
  diferenca_pagamento?: number; // R$
}

export interface FinancingDebt {
  instituicao?: string;
  numero_contrato?: string;
  valor_financiado?: number; // R$ - valor original
  saldo_devedor_atual?: number; // R$ - do app da Caixa
  parcela_atual?: number; // R$ - valor da parcela atual informada (ex: 776,42)
  taxa_juros_nominal?: number; // % a.a. - juro nominal vigente
  prazo_total_meses: number; // em meses - prazo do contrato
  meses_restantes?: number; // quantos faltam
  data_inicio: string; // ISO date (yyyy-mm-dd)
  sistema_amortizacao?: 'PRICE' | 'SAC'; // padrão PRICE
  seguros_taxas_mensais?: number; // R$ - seguros (MIP/DFI) + taxas administrativas
  ultimo_processamento_automatico?: string; // YYYY-MM - controla processamento mensal
  ultimasPrestacoes?: FinancingInstallment[]; // histórico das últimas parcelas pagas
}

export interface CardSpendingEntry {
  month: string; // YYYY-MM
  amount: number; // R$
}

export interface OtherDebt {
  id: string;
  descricao: string;
  valor: number; // R$
  vencimento?: string; // ISO date (null = é anotação, não lembrete)
  tem_vencimento: boolean; // controla se tem vencimento (lembrete) ou não (anotação)
}

export interface DebtsState {
  financings: FinancingDebt[]; // Changed from optional single object to array
  cardSpending: CardSpendingEntry[];
  monthlyTarget?: number; // meta mensal para cartão (R$)
  others: OtherDebt[];
}
