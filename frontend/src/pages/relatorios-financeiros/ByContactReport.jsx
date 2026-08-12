import { Fragment, useCallback, useEffect, useState } from 'react';
import api from '../../services/api';
import { formatCurrency } from '../../services/format';
import ByContactPrintView from './ByContactPrintView';
import ByContactTransactionTable from './ByContactTransactionTable';
import PrintAwareReport from './PrintAwareReport';
import ReportFilters from './ReportFilters';

export default function ByContactReport() {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState('');
  const [data, setData] = useState([]);
  const [rawData, setRawData] = useState([]);
  const [expanded, setExpanded] = useState(new Set());
  const [printSelected, setPrintSelected] = useState(new Set());
  const [printPage, setPrintPage] = useState(0);

  const load = useCallback(() => {
    const params = { start_date: new Date(startDate).toISOString(), end_date: new Date(endDate + 'T23:59:59').toISOString() };
    api.get('/financial/transactions/', { params }).then(res => {
      setRawData(res.data);
      const filtered = statusFilter ? res.data.filter(t => t.status === statusFilter) : res.data;
      const grouped = {};
      filtered.forEach(t => {
        const name = t.contact?.name || 'Sem contato';
        if (!grouped[name]) grouped[name] = { name, receitas: 0, despesas: 0, count: 0 };
        grouped[name].count += 1;
        if (t.type === 'receita') grouped[name].receitas += t.amount;
        else grouped[name].despesas += t.amount;
      });
      setData(Object.values(grouped).sort((a, b) => (b.receitas + b.despesas) - (a.receitas + a.despesas)));
    });
  }, [startDate, endDate, statusFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPrintPage(0); }, [printSelected]);

  const toggleExpand = name => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };
  const togglePrint = name => {
    setPrintSelected(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };
  const situationBadge = t => {
    const now = new Date();
    if (t.status === 'pago' || t.status === 'recebido') return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Pago</span>;
    if (t.due_date && new Date(t.due_date) < now) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Atrasado</span>;
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-brand-100 text-brand-700">Em dia</span>;
  };
  const formatPeriod = () => {
    const s = new Date(startDate + 'T12:00:00').toLocaleDateString('pt-BR');
    const e = new Date(endDate + 'T12:00:00').toLocaleDateString('pt-BR');
    return `${s} a ${e}`;
  };
  const columns = [
    { header: 'Fornecedor/Cliente', accessor: 'name', width: 25 },
    { header: 'Lançamentos', accessor: 'count', width: 14 },
    { header: 'Receitas', accessor: d => d.receitas, format: v => v > 0 ? formatCurrency(v) : '-', width: 15 },
    { header: 'Despesas', accessor: d => d.despesas, format: v => v > 0 ? formatCurrency(v) : '-', width: 15 },
    { header: 'Saldo', accessor: d => d.receitas - d.despesas, format: v => formatCurrency(v), width: 15 },
  ];
  const renderDetail = name => {
    const txs = rawData.filter(t => (t.contact?.name || 'Sem contato') === name).sort((a, b) => new Date(b.date) - new Date(a.date));
    const totalRec = txs.filter(t => t.type === 'receita').reduce((s, t) => s + t.amount, 0);
    const totalDesp = txs.filter(t => t.type === 'despesa').reduce((s, t) => s + t.amount, 0);
    return <div className="p-4 bg-gray-50 border-t"><div className="flex items-center justify-between mb-3"><h4 className="font-semibold text-gray-900">{name}</h4><div className="flex gap-4 text-sm"><span className="text-green-600 font-medium">Receitas: {formatCurrency(totalRec)}</span><span className="text-red-600 font-medium">Despesas: {formatCurrency(totalDesp)}</span><span className={`font-medium ${(totalRec - totalDesp) >= 0 ? 'text-brand-600' : 'text-red-600'}`}>Saldo: {formatCurrency(totalRec - totalDesp)}</span></div></div><ByContactTransactionTable transactions={txs} situationBadge={situationBadge} /></div>;
  };

  return (
    <PrintAwareReport title="Extrato por Fornecedor/Cliente" subtitle={`Período: ${formatPeriod()}`} columns={columns} data={data}
      renderPrint={() => <ByContactPrintView rawData={rawData} printSelected={printSelected} printPage={printPage} setPrintPage={setPrintPage} situationBadge={situationBadge} />}
      filters={<div className="flex flex-wrap items-end gap-3"><ReportFilters startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate} contactFilter="" setContactFilter={() => {}} contacts={[]} showContact={false} /><div><label className="block text-xs font-medium text-gray-500 mb-1">Status</label><select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm"><option value="">Todos</option><option value="pendente">Pendente</option><option value="pago_parcial">Pago Parcial</option><option value="pago">Pago</option><option value="recebido">Recebido</option></select></div><div className="flex flex-wrap gap-2 no-print"><button onClick={() => setPrintSelected(new Set(data.map(d => d.name)))} className="px-3 py-2 bg-brand-50 text-brand-600 rounded-lg text-sm hover:bg-brand-100">Selecionar tudo</button><button onClick={() => setPrintSelected(new Set())} className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200">Limpar seleção</button><button onClick={() => setExpanded(new Set(data.map(d => d.name)))} className="px-3 py-2 bg-brand-50 text-brand-600 rounded-lg text-sm hover:bg-brand-100">Expandir tudo</button><button onClick={() => setExpanded(new Set())} className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200">Recolher tudo</button></div></div>}>
      <div className="mb-4 text-sm text-gray-500">Período: {formatPeriod()}</div>
      <div className="bg-white rounded-xl overflow-hidden no-print"><table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="p-2 w-8 no-print"></th><th className="p-2 w-8 no-print"></th><th className="text-left p-2">Fornecedor/Cliente</th><th className="text-center p-2">Lançamentos</th><th className="text-right p-2">Receitas</th><th className="text-right p-2">Despesas</th><th className="text-right p-2">Saldo</th></tr></thead><tbody>
        {data.map(d => { const saldo = d.receitas - d.despesas; const isOpen = expanded.has(d.name); const checked = printSelected.has(d.name); return <Fragment key={d.name}><tr className={`border-b${isOpen ? ' bg-gray-50' : ''}`}><td className="p-2 text-center no-print"><input type="checkbox" checked={checked} onChange={() => togglePrint(d.name)} className="w-4 h-4 rounded border-gray-300 text-brand-600 cursor-pointer" /></td><td className="p-2 text-center no-print"><button onClick={() => toggleExpand(d.name)} className="text-gray-400 hover:text-gray-600 cursor-pointer">{isOpen ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>}</button></td><td className="p-2 text-gray-900 font-medium cursor-pointer" onClick={() => toggleExpand(d.name)}>{d.name}</td><td className="p-2 text-center text-gray-500">{d.count}</td><td className="p-2 text-right text-green-600">{d.receitas > 0 ? formatCurrency(d.receitas) : '-'}</td><td className="p-2 text-right text-red-600">{d.despesas > 0 ? formatCurrency(d.despesas) : '-'}</td><td className={`p-2 text-right font-medium ${saldo >= 0 ? 'text-brand-700' : 'text-red-700'}`}>{formatCurrency(saldo)}</td></tr>{isOpen && <tr><td colSpan={7} className="p-0">{renderDetail(d.name)}</td></tr>}</Fragment>; })}
        {data.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-gray-400">Nenhum lançamento encontrado</td></tr>}
      </tbody></table></div>
    </PrintAwareReport>
  );
}
