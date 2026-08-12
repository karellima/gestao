import { formatCurrency } from '../../services/format';
import ByContactTransactionTable from './ByContactTransactionTable';

export default function ByContactPrintView({ rawData, printSelected, printPage, setPrintPage, situationBadge }) {
  const sorted = Array.from(printSelected).sort();
  const total = sorted.length;
  if (total === 0) return <p className="text-gray-400 text-center py-8">Nenhum contato selecionado.</p>;

  const name = sorted[printPage] || sorted[0];
  const buildContact = contactName => {
    const txs = rawData.filter(t => (t.contact?.name || 'Sem contato') === contactName)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    const totalRec = txs.filter(t => t.type === 'receita').reduce((s, t) => s + t.amount, 0);
    const totalDesp = txs.filter(t => t.type === 'despesa').reduce((s, t) => s + t.amount, 0);
    return { txs, totalRec, totalDesp, saldo: totalRec - totalDesp };
  };
  const renderContact = (contactName, showPageBreak) => {
    const { txs, totalRec, totalDesp, saldo } = buildContact(contactName);
    return (
      <div key={contactName} style={showPageBreak ? { pageBreakBefore: 'always' } : undefined}>
        <p className="text-sm text-gray-500 mb-1">Fornecedor/Cliente: <span className="font-medium text-gray-900">{contactName}</span></p>
        <h2 className="text-xl font-bold mb-1">{contactName}</h2>
        <div className="flex gap-4 text-sm mb-3"><span className="text-green-600 font-medium">Receitas: {formatCurrency(totalRec)}</span><span className="text-red-600 font-medium">Despesas: {formatCurrency(totalDesp)}</span><span className={`font-medium ${saldo >= 0 ? 'text-brand-600' : 'text-red-600'}`}>Saldo: {formatCurrency(saldo)}</span></div>
        <ByContactTransactionTable transactions={txs} situationBadge={situationBadge} />
      </div>
    );
  };

  return <div><div className="flex items-center justify-between mb-4"><span className="text-sm text-gray-500 no-print">{printPage + 1} de {total}</span><div className="flex gap-2 no-print"><button onClick={() => setPrintPage(p => Math.max(0, p - 1))} disabled={printPage === 0} className="px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-50 disabled:opacity-30">Anterior</button><button onClick={() => setPrintPage(p => Math.min(total - 1, p + 1))} disabled={printPage >= total - 1} className="px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-50 disabled:opacity-30">Próximo</button></div></div><div className="no-print">{renderContact(name)}</div><div className="print-only">{sorted.map((contactName, i) => renderContact(contactName, i > 0))}</div></div>;
}
