import { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';
import { formatCurrency } from '../../services/format';
import PrintAwareReport from './PrintAwareReport';

export function percentageDifference(a, b) {
  return b > 0 ? ((a - b) / b * 100).toFixed(1) : '0.0';
}

export function differenceIcon(a, b) {
  if (a > b) return '\u2191';
  if (a < b) return '\u2193';
  return '=';
}

export default function PeriodComparisonReport({ contacts }) {
  const [period1Start, setPeriod1Start] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1); d.setDate(1); return d.toISOString().split('T')[0];
  });
  const [period1End, setPeriod1End] = useState(() => {
    const d = new Date(); d.setDate(0); return d.toISOString().split('T')[0];
  });
  const [period2Start, setPeriod2Start] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 2); d.setDate(1); return d.toISOString().split('T')[0];
  });
  const [period2End, setPeriod2End] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1); d.setDate(0); return d.toISOString().split('T')[0];
  });
  const [contactFilter, setContactFilter] = useState('');
  const [p1, setP1] = useState({ receitas: 0, despesas: 0 });
  const [p2, setP2] = useState({ receitas: 0, despesas: 0 });

  const load = useCallback(async () => {
    const params = { start_date: '2000-01-01', end_date: new Date().toISOString() };
    if (contactFilter) params.contact_id = contactFilter;
    const [rAll] = await Promise.all([api.get('/financial/transactions/', { params })]);
    const inPeriod = (txs, s, e) => txs.filter(t => {
      const d = new Date(t.date);
      return d >= new Date(s) && d <= new Date(e + 'T23:59:59');
    });
    const calc = txs => ({
      receitas: txs.filter(t => t.type === 'receita').reduce((s, t) => s + t.amount, 0),
      despesas: txs.filter(t => t.type === 'despesa').reduce((s, t) => s + t.amount, 0),
    });
    setP1(calc(inPeriod(rAll.data, period1Start, period1End)));
    setP2(calc(inPeriod(rAll.data, period2Start, period2End)));
  }, [period1Start, period1End, period2Start, period2End, contactFilter]);

  useEffect(() => { load(); }, [load]);

  const compData = [
    { indicator: 'Receitas', p1: p1.receitas, p2: p2.receitas, cls: 'text-green-600' },
    { indicator: 'Despesas', p1: p1.despesas, p2: p2.despesas, cls: 'text-red-600' },
    { indicator: 'Saldo', p1: p1.receitas - p1.despesas, p2: p2.receitas - p2.despesas, cls: 'font-bold' },
  ];
  const columns = [
    { header: 'Indicador', accessor: 'indicator', width: 20 },
    { header: 'Período 1', accessor: d => formatCurrency(d.p1), width: 15 },
    { header: 'Período 2', accessor: d => formatCurrency(d.p2), width: 15 },
    { header: 'Variação', accessor: d => `${differenceIcon(d.p1, d.p2)} ${percentageDifference(d.p1, d.p2)}%`, width: 14 },
  ];

  return (
    <PrintAwareReport title="Comparativo Períodos" columns={columns} data={compData}
      filters={<div className="flex flex-wrap items-end gap-3">
        <div className="bg-gray-50 rounded-xl p-4"><p className="text-xs font-semibold text-gray-500 uppercase mb-2">Período 1</p><div className="flex gap-2"><input type="date" value={period1Start} onChange={e => setPeriod1Start(e.target.value)} max={period1End || undefined} className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" /><input type="date" value={period1End} onChange={e => setPeriod1End(e.target.value)} min={period1Start || undefined} className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" /></div></div>
        <div className="bg-gray-50 rounded-xl p-4"><p className="text-xs font-semibold text-gray-500 uppercase mb-2">Período 2</p><div className="flex gap-2"><input type="date" value={period2Start} onChange={e => setPeriod2Start(e.target.value)} max={period2End || undefined} className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" /><input type="date" value={period2End} onChange={e => setPeriod2End(e.target.value)} min={period2Start || undefined} className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" /></div></div>
        <div><label className="block text-xs font-medium text-gray-500 mb-1">Fornecedor/Cliente</label><select value={contactFilter} onChange={e => setContactFilter(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm min-w-[160px]"><option value="">Todos</option>{contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
      </div>}>
      <div className="bg-white rounded-xl overflow-hidden"><table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="text-left p-3">Indicador</th><th className="text-right p-3">Período 1</th><th className="text-right p-3">Período 2</th><th className="text-right p-3">Variação</th></tr></thead><tbody>
        <tr className="border-t"><td className="p-3 font-medium text-green-600">Receitas</td><td className="p-3 text-right">{formatCurrency(p1.receitas)}</td><td className="p-3 text-right">{formatCurrency(p2.receitas)}</td><td className="p-3 text-right font-medium">{differenceIcon(p1.receitas, p2.receitas)} {percentageDifference(p1.receitas, p2.receitas)}%</td></tr>
        <tr className="border-t"><td className="p-3 font-medium text-red-600">Despesas</td><td className="p-3 text-right">{formatCurrency(p1.despesas)}</td><td className="p-3 text-right">{formatCurrency(p2.despesas)}</td><td className="p-3 text-right font-medium">{differenceIcon(p1.despesas, p2.despesas)} {percentageDifference(p1.despesas, p2.despesas)}%</td></tr>
        <tr className="border-t bg-gray-50"><td className="p-3 font-bold">Saldo</td><td className={`p-3 text-right font-bold ${(p1.receitas - p1.despesas) >= 0 ? 'text-brand-700' : 'text-red-700'}`}>{formatCurrency(p1.receitas - p1.despesas)}</td><td className={`p-3 text-right font-bold ${(p2.receitas - p2.despesas) >= 0 ? 'text-brand-700' : 'text-red-700'}`}>{formatCurrency(p2.receitas - p2.despesas)}</td><td className="p-3 text-right font-bold">{differenceIcon(p1.receitas - p1.despesas, p2.receitas - p2.despesas)} {percentageDifference(p1.receitas - p1.despesas, p2.receitas - p2.despesas)}%</td></tr>
      </tbody></table></div>
    </PrintAwareReport>
  );
}
