import { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';
import { formatCurrency } from '../../services/format';
import PrintAwareReport from './PrintAwareReport';
import ReportFilters from './ReportFilters';

export default function DPEReport({ contacts }) {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [contactFilter, setContactFilter] = useState('');
  const [receitas, setReceitas] = useState([]);
  const [despesas, setDespesas] = useState([]);

  const load = useCallback(() => {
    const params = { start_date: new Date(startDate).toISOString(), end_date: new Date(endDate + 'T23:59:59').toISOString() };
    if (contactFilter) params.contact_id = contactFilter;
    api.get('/financial/transactions/', { params }).then(res => {
      const rcats = {}, dcats = {};
      res.data.forEach(t => {
        const cat = t.financial_category?.name || 'Sem categoria';
        if (t.type === 'receita') {
          if (!rcats[cat]) rcats[cat] = { name: cat, total: 0, count: 0 };
          rcats[cat].total += t.amount;
          rcats[cat].count += 1;
        } else {
          if (!dcats[cat]) dcats[cat] = { name: cat, total: 0, count: 0 };
          dcats[cat].total += t.amount;
          dcats[cat].count += 1;
        }
      });
      setReceitas(Object.values(rcats).sort((a, b) => b.total - a.total));
      setDespesas(Object.values(dcats).sort((a, b) => b.total - a.total));
    });
  }, [startDate, endDate, contactFilter]);

  useEffect(() => { load(); }, [load]);

  const totalReceitas = receitas.reduce((s, c) => s + c.total, 0);
  const totalDespesas = despesas.reduce((s, c) => s + c.total, 0);
  const resultado = totalReceitas - totalDespesas;
  const columns = [
    { header: 'Categoria', accessor: 'name', width: 25 },
    { header: 'Tipo', accessor: 'type', width: 10 },
    { header: 'Lançamentos', accessor: 'count', width: 14 },
    { header: 'Valor', accessor: 'total', format: v => formatCurrency(v), width: 15 },
  ];
  const dreData = [...receitas.map(r => ({ ...r, type: 'Receita' })), ...despesas.map(d => ({ ...d, type: 'Despesa' }))];

  return (
    <PrintAwareReport title="DRE" columns={columns} data={dreData}
      filters={<ReportFilters startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate} contactFilter={contactFilter} setContactFilter={setContactFilter} contacts={contacts} />}>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-green-50 rounded-xl p-4"><div className="text-xs text-green-600 font-medium mb-1">Receitas</div><div className="text-lg font-bold text-green-700">{formatCurrency(totalReceitas)}</div></div>
        <div className="bg-red-50 rounded-xl p-4"><div className="text-xs text-red-600 font-medium mb-1">Despesas</div><div className="text-lg font-bold text-red-700">{formatCurrency(totalDespesas)}</div></div>
        <div className={`rounded-xl p-4 ${resultado >= 0 ? 'bg-brand-50' : 'bg-red-50'}`}><div className={`text-xs font-medium mb-1 ${resultado >= 0 ? 'text-brand-600' : 'text-red-600'}`}>Resultado Líquido</div><div className={`text-lg font-bold ${resultado >= 0 ? 'text-brand-700' : 'text-red-700'}`}>{formatCurrency(resultado)}</div></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl overflow-hidden"><div className="bg-green-50 px-4 py-2 border-b"><h3 className="text-sm font-semibold text-green-700">Receitas por Categoria</h3></div><table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="text-left p-3 text-xs font-semibold text-gray-500 uppercase">Categoria</th><th className="text-center p-3 text-xs font-semibold text-gray-500 uppercase">Qtd</th><th className="text-right p-3 text-xs font-semibold text-gray-500 uppercase">Valor</th></tr></thead><tbody>{receitas.map(c => <tr key={c.name} className="border-t"><td className="p-3 text-gray-900">{c.name}</td><td className="p-3 text-center text-gray-500">{c.count}</td><td className="p-3 text-right text-green-600 font-medium">{formatCurrency(c.total)}</td></tr>)}{receitas.length === 0 && <tr><td colSpan={3} className="p-4 text-center text-gray-400">Nenhuma receita</td></tr>}</tbody><tfoot><tr className="bg-green-50 font-medium"><td className="p-3 text-green-800">Total</td><td className="p-3 text-center text-green-700">{receitas.reduce((s, c) => s + c.count, 0)}</td><td className="p-3 text-right text-green-700">{formatCurrency(totalReceitas)}</td></tr></tfoot></table></div>
        <div className="bg-white rounded-xl overflow-hidden"><div className="bg-red-50 px-4 py-2 border-b"><h3 className="text-sm font-semibold text-red-700">Despesas por Categoria</h3></div><table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="text-left p-3 text-xs font-semibold text-gray-500 uppercase">Categoria</th><th className="text-center p-3 text-xs font-semibold text-gray-500 uppercase">Qtd</th><th className="text-right p-3 text-xs font-semibold text-gray-500 uppercase">Valor</th></tr></thead><tbody>{despesas.map(c => <tr key={c.name} className="border-t"><td className="p-3 text-gray-900">{c.name}</td><td className="p-3 text-center text-gray-500">{c.count}</td><td className="p-3 text-right text-red-600 font-medium">{formatCurrency(c.total)}</td></tr>)}{despesas.length === 0 && <tr><td colSpan={3} className="p-4 text-center text-gray-400">Nenhuma despesa</td></tr>}</tbody><tfoot><tr className="bg-red-50 font-medium"><td className="p-3 text-red-800">Total</td><td className="p-3 text-center text-red-700">{despesas.reduce((s, c) => s + c.count, 0)}</td><td className="p-3 text-right text-red-700">{formatCurrency(totalDespesas)}</td></tr></tfoot></table></div>
      </div>
      <div className={`mt-4 rounded-xl p-4 text-center ${resultado >= 0 ? 'bg-brand-50' : 'bg-red-50'}`}><div className={`text-sm font-semibold mb-1 ${resultado >= 0 ? 'text-brand-600' : 'text-red-600'}`}>Resultado do Período</div><div className={`text-2xl font-bold ${resultado >= 0 ? 'text-brand-700' : 'text-red-700'}`}>{resultado >= 0 ? '+' : ''}{formatCurrency(resultado)}</div></div>
    </PrintAwareReport>
  );
}
