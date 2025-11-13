
import { CalculatedAsset } from "@/types/asset";

export async function exportPortfolioToPDF(assets: CalculatedAsset[], summary: any) {
  const jsPDF = (await import("jspdf")).default;
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.text("Resumo da Carteira", 14, 18);

  // Resumo
  doc.setFontSize(12);
  doc.text(`Valor Total: R$ ${summary.valor_total_carteira.toLocaleString('pt-BR', {minimumFractionDigits:2})}` , 14, 28);
  doc.text(`DY Médio Ponderado: ${summary.dy_ponderado.toLocaleString('pt-BR', {minimumFractionDigits:2})}%`, 14, 36);
  doc.text(`Crescimento Médio: ${(assets.reduce((sum, a) => sum + a.variacao_percentual, 0) / assets.length).toLocaleString('pt-BR', {minimumFractionDigits:2})}%`, 14, 44);
  doc.text(`P/L Total: R$ ${summary.pl_total.toLocaleString('pt-BR', {minimumFractionDigits:2})}`, 14, 52);

  // Tabela de ativos
  autoTable(doc, {
    startY: 60,
    head: [[
      "Ativo",
      "Tipo",
      "Corretora",
      "Valor Atual",
      "Valor Aplicado",
      "Rentabilidade %",
      "P/L Posição"
    ]],
    body: assets.map(a => [
      a.ticker_normalizado.replace('.SA', ''),
      a.tipo_ativo_manual || a.tipo_ativo || '',
      a.corretora,
      `R$ ${a.valor_total.toLocaleString('pt-BR', {minimumFractionDigits:2})}`,
  (a.preco_medio && a.quantidade) ? `R$ ${(a.preco_medio * a.quantidade).toLocaleString('pt-BR', {minimumFractionDigits:2})}` : `R$ ${a.valor_total.toLocaleString('pt-BR', {minimumFractionDigits:2})}`,
      `${a.variacao_percentual?.toLocaleString('pt-BR', {minimumFractionDigits:2}) ?? '-'}%`,
      `R$ ${a.pl_posicao?.toLocaleString('pt-BR', {minimumFractionDigits:2}) ?? '-'}`
    ]),
    styles: { fontSize: 10 },
    headStyles: { fillColor: [44, 62, 80] },
    margin: { left: 14, right: 14 },
    theme: 'grid',
  });

  doc.save("carteira_dashboard_b3.pdf");
}
