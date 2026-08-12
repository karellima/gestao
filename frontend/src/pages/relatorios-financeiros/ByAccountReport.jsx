import { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';
import { formatCurrency } from '../../services/format';
import PrintAwareReport from './PrintAwareReport';
import ReportFilters from './ReportFilters';

export default function ByAccountReport({ contacts }) {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [contactFilter, setContactFilter] = useState('');
  const [data, setData] = useState([]);

  const load = useCallback(() => {
    const params = { start_date: new Date(startDate).toISOString(), end_date: new Date(endDate + 'T23:59:59').toISOString() };
    if (contactFilter) params.contact_id = contactFilter;
    api.get('/financial/transactions/', { params }).then(res => {
      const grouped = {};
      res.data.forEach(t => {
        const name = t.account?.name || 'Sem conta';
        if (!grouped[name]) grouped[name] = { name, receitas: 0, despesas: 0, count: 0 };
        grouped[name].count += 1;
        if (t.type === 'receita') grouped[name].receitas += t.amount;
        else grouped[name].despesas += t.amount;
      });
      setData(Object.values(grouped).sort((a, b) => (b.receitas - b.despesas) - (a.receitas - a.despesas)));
    });
  }, [startDate, endDate, contactFilter]);

  useEffect(() => { load(); }, [load]);

  const columns = [
    { header: 'Conta', accessor: 'name', width: 25 },
    { header: 'Lançamentos', accessor: 'count', width: 14 },
    { header: 'Receitas', accessor: d => d.receitas, format: v => v > 0 ? formatCurrency(v) : '-', width: 15 },
    { header: 'Despesas', accessor: d => d.despesas, format: v => v > 0 ? formatCurrency(v) : '-', width: 15 },
    { header: 'Saldo', accessor: d => d.receitas - d.despesas, format: v => formatCurrency(v), width: 15 },
  ];

  return (
    <PrintAwareReport title="Por Conta" columns={columns} data={data}
      filters={<ReportFilters startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate} contactFilter={contactFilter} setContactFilter={setContactFilter} contacts={contacts} />}>
      <div className="bg-white rounded-xl overflow-hidden">
        <table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="text-left p-3">Conta</th><th className="text-center p-3">Lançamentos</th><th className="text-right p-3">Receitas</th><th className="text-right p-3">Despesas</th><th className="text-right p-3">Saldo</th></tr></thead>
          <tbody>{data.map(d => { const saldo = d.receitas - d.despesas; return <tr key={d.name} className="border-t"><td className="p-3 text-gray-900 font-medium">{d.name}</td><td className="p-3 text-center text-gray-500">{d.count}</td><td className="p-3 text-right text-green-600">{d.receitas > 0 ? formatCurrency(d.receitas) : '-'}</td><td className="p-3 text-right text-red-600">{d.despesas > 0 ? formatCurrency(d.despesas) : '-'}</td><td className={`p-3 text-right font-medium ${saldo >= 0 ? 'text-brand-700' : 'text-red-700'}`}>{formatCurrency(saldo)}</td></tr>; })}
            {data.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-gray-400">Nenhum lançamento encontrado</td></tr>}
          </tbody>
        </table>
      </div>
    </PrintAwareReport>
  );
}
