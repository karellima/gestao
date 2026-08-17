import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { parseCurrencyToNumber } from '../../services/masks';

const valorNumerico = (valor) => (
  typeof valor === 'number' ? valor : parseCurrencyToNumber(valor, 2)
);

const formatarValor = (valor) => `R$ ${valor.toFixed(2)}`;

export function montarDadosDoPedido(sale, agora = new Date()) {
  const linhas = (sale.items || []).map((item) => {
    const unitPrice = valorNumerico(item.unitPrice);
    const lineTotal = Number(item.quantity) * unitPrice;
    return [item.productName, item.quantity, formatarValor(unitPrice), formatarValor(lineTotal)];
  });

  return {
    cabecalho: {
      titulo: `Pedido #${sale.id}`,
      geradoEm: `Gerado em ${agora.toLocaleString('pt-BR')}`,
      cliente: `Cliente: ${sale.contact_name || '-'}`,
      tipo: `Tipo: ${sale.sale_type_name || '-'}`,
      status: `Status: ${sale.status}`,
    },
    linhas,
    rodape: ['', '', 'Total:', formatarValor(Number(sale.total_amount))],
    observacao: sale.notes ? `Obs: ${sale.notes}` : null,
  };
}

export function gerarPdfDoPedido(sale) {
  const dados = montarDadosDoPedido(sale);
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(dados.cabecalho.titulo, 14, 20);
  doc.setFontSize(9);
  doc.text(dados.cabecalho.geradoEm, 14, 27);
  doc.setFontSize(11);
  doc.text(dados.cabecalho.cliente, 14, 35);
  doc.text(dados.cabecalho.tipo, 14, 42);
  doc.text(dados.cabecalho.status, 14, 49);
  autoTable(doc, {
    startY: 56,
    head: [['Produto', 'Qtd', 'Valor Unit.', 'Total']],
    body: dados.linhas,
    foot: [dados.rodape],
    footStyles: { fontStyle: 'bold' },
    styles: { fontSize: 9 },
    headStyles: { fillColor: [59, 130, 246] },
  });
  if (dados.observacao) {
    const finalY = doc.lastAutoTable.finalY || 100;
    doc.text(dados.observacao, 14, finalY + 10);
  }
  return doc.output('blob');
}
