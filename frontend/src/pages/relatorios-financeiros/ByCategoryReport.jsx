import { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';
import { formatCurrency } from '../../services/format';
import PrintAwareReport from './PrintAwareReport';
import ReportFilters from './ReportFilters';

export default function ByCategoryReport({ contacts }) {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [filter, setFilter] = useState('despesa');
  const [contactFilter, setContactFilter] = useState('');
  const [data, setData] = useState([]);

  const load = useCallback(() => {
    const params = { start_date: new Date(startDate).toISOString(), end_date: new Date(endDate + 'T23:59:59').toISOString(), type: filter };
    if (contactFilter) params.contact_id = contactFilter;
    api.get('/financial/transactions/', { params }).then(res => {
      const grouped = {};
      res.data.forEach(t => {
        const cat = t.financial_category?.name || 'Sem categoria';
        if (!grouped[cat]) grouped[cat] = { name: cat, total: 0, count: 0 };
        grouped[cat].total += t.amount;
        grouped[cat].count += 1;
      });
      setData(Object.values(grouped).sort((a, b) => b.total - a.total));
    });
  }, [startDate, endDate, filter, contactFilter]);

  useEffect(() => { load(); }, [load]);

  const grandTotal = data.reduce((s, d) => s + d.total, 0);
  const columns = [
    { header: 'Categoria', accessor: 'name', width: 30 },
    { header: 'Lançamentos', accessor: 'count', width: 14 },
    { header: 'Total', accessor: 'total', format: v => formatCurrency(v), width: 15 },
    { header: '% do Total', accessor: d => grandTotal > 0 ? ((d.total / grandTotal) * 100).toFixed(1) + '%' : '0%', width: 14 },
  ];

  return (
    <PrintAwareReport title={`Por Categoria${filter ? ` (${filter === 'despesa' ? 'Despesas' : 'Receitas'})` : ''}`} columns={columns} data={data}
      filters={<ReportFilters startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate} contactFilter={contactFilter} setContactFilter={setContactFilter} contacts={contacts} showType filter={filter} setFilter={setFilter} />}>
      <div className="bg-white rounded-xl overflow-hidden">
        <table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="text-left p-3">Categoria</th><th className="text-center p-3">Lançamentos</th><th className="text-right p-3">Total</th><th className="text-right p-3">% do Total</th></tr></thead>
          <tbody>{data.map(d => <tr key={d.name} className="border-t"><td className="p-3 text-gray-900 font-medium">{d.name}</td><td className="p-3 text-center text-gray-500">{d.count}</td><td className={`p-3 text-right font-medium ${filter === 'receita' ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(d.total)}</td><td className="p-3 text-right text-gray-500">{grandTotal > 0 ? ((d.total / grandTotal) * 100).toFixed(1) : 0}%</td></tr>)}</tbody>
          <tfoot className="bg-gray-50 font-medium"><tr><td className="p-3">Total</td><td className="p-3 text-center">{data.reduce((s, d) => s + d.count, 0)}</td><td className={`p-3 text-right ${filter === 'receita' ? 'text-green-700' : 'text-red-700'}`}>{formatCurrency(grandTotal)}</td><td className="p-3 text-right">100%</td></tr></tfoot>
        </table>
      </div>
    </PrintAwareReport>
  );
}
