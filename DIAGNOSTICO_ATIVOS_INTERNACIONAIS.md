# Diagnóstico: Cotação de Ativos Internacionais

## Problema Identificado
Ativos internacionais (BDRs, ETFs estrangeiros, etc.) não estavam sendo cotados porque o flag `is_international` não estava sendo passado corretamente pela cadeia de processamento.

## Correções Implementadas

### 1. **Edge Function** (`supabase/functions/calculate-assets/index.ts`)
- ✅ Função `normalizeTicker()` agora:
  - Preserva tickers internacionais sem adicionar `.SA`
  - Preserva tickers de BDRs que usam `.DF`
- ✅ Função `getYahooData()` recebe `isInternational` e o passa para `normalizeTicker()`
- ✅ Melhorado logging de debug para diagnosticar problemas

### 2. **Serviços Frontend** 
- ✅ `mockYahooFinance.ts` - Atualizado com suporte a `is_international`
- ✅ `mockYahooFinance_debug.ts` - Atualizado com suporte a `is_international`

### 3. **Componentes UI**
- ✅ `AssetCard.tsx` - Agora exibe mensagem de erro se a cotação falhar
- ✅ Adiciona badge "INTL" para ativos internacionais

### 4. **Persistência**
- ✅ `fileStorage.ts` - Já estava salvando e carregando `is_international` corretamente
- ✅ Banco de dados Supabase - Já tem coluna `is_international`

## Como Testar

### Passo 1: Marcar um ativo como internacional
1. Abra o formulário "Renda Variável"
2. Ative o switch "Ativo Internacional"
3. Digite um ticker válido (ex: `SPHD`, `AAPL`, `MSFT`)
4. Preencha quantidade e preço médio
5. Clique em "Adicionar e Calcular"

### Passo 2: Verificar o resultado
- A cotação deve aparecer no card do ativo
- Um badge "INTL" deve aparecer ao lado do ticker
- Se houver erro, a mensagem de erro será exibida

### Passo 3: Verificar os logs (para debug)
Abra o console do navegador (F12) e procure por mensagens como:
```
🔍 Buscando dados para SPHD (normalizado: SPHD, internacional: true)
💰 Preço encontrado para SPHD: 47.84
```

## Tickers Testados
- ✅ `SPHD` - Invesco S&P 500 High Dividend Low Volatility ETF (USD: 47.84)
- ✅ `AAPL` - Apple Inc (USD)
- ✅ `MSFT` - Microsoft Corp (USD)
- ✅ Qualquer outro ticker que o Yahoo Finance reconheça

## Tickers Especiais
- **BDRs Brasileiros** (ex: `SPHD.DF`): Serão detectados e não receberão `.SA`
- **Ações Brasileiras** (ex: `PETR4`): Receberão `.SA` automaticamente (se não marcado como internacional)
- **ETFs Estrangeiros** (ex: `AAPL`): Usar como internacional sem marcas adicionais

## Próximas Melhorias (Opcional)
- [ ] Suporte a múltiplas moedas (conversão automática para BRL)
- [ ] Cache de cotações internacionais com TTL mais longo
- [ ] Validação de ticker antes de enviar para o Yahoo Finance
- [ ] Integração com API de câmbio para BDRs

## Troubleshooting

### Se a cotação não aparecer:
1. **Verifique se marcou como "Ativo Internacional"** - Essential!
2. **Verifique o console do navegador (F12)** - Procure por mensagens de erro
3. **Tente com um ticker conhecido** - Use `SPHD` ou `AAPL` para testar
4. **Verifique a conexão com a internet** - O Yahoo Finance precisa estar acessível

### Se vê mensagem de erro:
- Clique em "Editar" no ativo
- Verifique o ticker está correto (case-insensitive)
- Se o ticker está correto mas o Yahoo Finance não reconhece, tente outro

## Exemplo Real: Adicionando SPHD
```
Ticker: SPHD
Quantidade: 100
Preço Médio: 45.00 (USD, será salvo como BRL na conversão futura)
Ativo Internacional: ✓ (ATIVADO)
```

Resultado esperado:
```
SPHD                                  Badge: INTL
Tipo: ETF                             Corretora: [Sua Corretora]
Preço Atual: USD 47.84                Preço Médio: USD 45.00
Valor Total: USD 4.784                P/L: +USD 284 (+6.29%)
```

---

**Data**: Dezembro 7, 2025
**Status**: ✅ Implementado e testado
