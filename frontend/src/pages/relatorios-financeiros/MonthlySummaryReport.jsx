import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../services/api';
import { formatCurrency } from '../../services/format';
import PrintAwareReport from './PrintAwareReport';

export default function MonthlySummaryReport({ contacts }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [contactFilter, setContactFilter] = useState('');
  const [data, setData] = useState([]);

  const load = useCallback(() => {
    const start = `${year}-01-01`;
    const end = `${year}-12-31T23:59:59`;
    const params = { start_date: new Date(start).toISOString(), end_date: new Date(end).toISOString() };
    if (contactFilter) params.contact_id = contactFilter;
    api.get('/financial/transactions/', { params }).then(res => {
      const months = Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        label: new Date(year, i).toLocaleDateString('pt-BR', { month: 'long' }),
        receitas: 0, despesas: 0, contatos: new Set(),
      }));
      res.data.forEach(t => {
        const m = new Date(t.date).getMonth();
        if (t.type === 'receita') months[m].receitas += t.amount;
        else months[m].despesas += t.amount;
        if (t.contact?.name) months[m].contatos.add(t.contact.name);
      });
      setData(months);
    });
  }, [year, contactFilter]);

  useEffect(() => { load(); }, [load]);

  const totals = useMemo(() => ({
    receitas: data.reduce((s, m) => s + m.receitas, 0),
    despesas: data.reduce((s, m) => s + m.despesas, 0),
  }), [data]);

  const columns = [
    { header: 'Mês', accessor: 'label', width: 18 },
    { header: 'Receitas', accessor: m => m.receitas, format: v => v > 0 ? formatCurrency(v) : '-', width: 15 },
    { header: 'Despesas', accessor: m => m.despesas, format: v => v > 0 ? formatCurrency(v) : '-', width: 15 },
    { header: 'Saldo', accessor: m => m.receitas - m.despesas, format: v => formatCurrency(v), width: 15 },
  ];

  return (
    <PrintAwareReport title={`Resumo Mensal ${year}`} columns={columns} data={data}
      filters={<div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Ano</label>
          <select value={year} onChange={e => setYear(parseInt(e.target.value))} className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Fornecedor/Cliente</label>
          <select value={contactFilter} onChange={e => setContactFilter(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm min-w-[160px]">
            <option value="">Todos</option>
            {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>}>

      <div className="bg-white rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50"><tr><th className="text-left p-3">Mês</th><th className="text-right p-3">Receitas</th><th className="text-right p-3">Despesas</th><th className="text-right p-3">Saldo</th></tr></thead>
          <tbody>
            {data.map(m => {
              const saldo = m.receitas - m.despesas;
              return <tr key={m.month} className="border-t"><td className="p-3 text-gray-900 capitalize">{m.label}</td><td className="p-3 text-right text-green-600">{m.receitas > 0 ? formatCurrency(m.receitas) : '-'}</td><td className="p-3 text-right text-red-600">{m.despesas > 0 ? formatCurrency(m.despesas) : '-'}</td><td className={`p-3 text-right font-medium ${saldo >= 0 ? 'text-brand-700' : 'text-red-700'}`}>{formatCurrency(saldo)}</td></tr>;
            })}
          </tbody>
          <tfoot className="bg-gray-50 font-medium"><tr><td className="p-3 text-gray-900">Total Anual</td><td className="p-3 text-right text-green-700">{formatCurrency(totals.receitas)}</td><td className="p-3 text-right text-red-700">{formatCurrency(totals.despesas)}</td><td className={`p-3 text-right ${(totals.receitas - totals.despesas) >= 0 ? 'text-brand-700' : 'text-red-700'}`}>{formatCurrency(totals.receitas - totals.despesas)}</td></tr></tfoot>
        </table>
      </div>
    </PrintAwareReport>
  );
}
