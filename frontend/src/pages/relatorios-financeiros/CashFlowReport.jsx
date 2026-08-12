import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../services/api';
import { formatCurrency } from '../../services/format';
import PrintAwareReport from './PrintAwareReport';
import ReportFilters from './ReportFilters';

export default function CashFlowReport({ contacts }) {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [contactFilter, setContactFilter] = useState('');
  const [data, setData] = useState([]);

  const load = useCallback(() => {
    const params = {
      start_date: new Date(startDate).toISOString(),
      end_date: new Date(endDate + 'T23:59:59').toISOString(),
    };
    if (contactFilter) params.contact_id = contactFilter;
    api.get('/financial/transactions/', { params }).then(res => {
      const grouped = {};
      res.data.forEach(t => {
        const day = new Date(t.date).toISOString().split('T')[0];
        if (!grouped[day]) grouped[day] = { date: day, entradas: 0, saidas: 0 };
        if (t.type === 'receita') grouped[day].entradas += t.amount;
        else grouped[day].saidas += t.amount;
      });
      setData(Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date)));
    });
  }, [startDate, endDate, contactFilter]);

  useEffect(() => { load(); }, [load]);

  const totals = useMemo(() => ({
    entradas: data.reduce((s, d) => s + d.entradas, 0),
    saidas: data.reduce((s, d) => s + d.saidas, 0),
  }), [data]);

  const columns = [
    { header: 'Data', accessor: d => new Date(d.date + 'T12:00:00').toLocaleDateString('pt-BR'), width: 14 },
    { header: 'Entradas', accessor: d => d.entradas, format: v => v > 0 ? formatCurrency(v) : '-', width: 15 },
    { header: 'Saídas', accessor: d => d.saidas, format: v => v > 0 ? formatCurrency(v) : '-', width: 15 },
    { header: 'Saldo Dia', accessor: d => d.entradas - d.saidas, format: v => formatCurrency(v), width: 15 },
  ];

  return (
    <PrintAwareReport title="Fluxo de Caixa" columns={columns} data={data}
      filters={<ReportFilters startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate} contactFilter={contactFilter} setContactFilter={setContactFilter} contacts={contacts} />}>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-green-50 rounded-xl p-4">
          <div className="text-xs text-green-600 font-medium mb-1">Total Entradas</div>
          <div className="text-lg font-bold text-green-700">{formatCurrency(totals.entradas)}</div>
        </div>
        <div className="bg-red-50 rounded-xl p-4">
          <div className="text-xs text-red-600 font-medium mb-1">Total Saídas</div>
          <div className="text-lg font-bold text-red-700">{formatCurrency(totals.saidas)}</div>
        </div>
        <div className="bg-brand-50 rounded-xl p-4">
          <div className="text-xs text-brand-600 font-medium mb-1">Saldo do Período</div>
          <div className={`text-lg font-bold ${(totals.entradas - totals.saidas) >= 0 ? 'text-brand-700' : 'text-red-700'}`}>
            {formatCurrency(totals.entradas - totals.saidas)}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr><th className="text-left p-3">Data</th><th className="text-right p-3">Entradas</th><th className="text-right p-3">Saídas</th><th className="text-right p-3">Saldo Dia</th></tr>
          </thead>
          <tbody>
            {data.map(d => {
              const saldo = d.entradas - d.saidas;
              return (
                <tr key={d.date} className="border-t">
                  <td className="p-3 text-gray-900">{new Date(d.date + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                  <td className="p-3 text-right text-green-600">{d.entradas > 0 ? formatCurrency(d.entradas) : '-'}</td>
                  <td className="p-3 text-right text-red-600">{d.saidas > 0 ? formatCurrency(d.saidas) : '-'}</td>
                  <td className={`p-3 text-right font-medium ${saldo >= 0 ? 'text-brand-700' : 'text-red-700'}`}>{formatCurrency(saldo)}</td>
                </tr>
              );
            })}
            {data.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-gray-400">Nenhum lançamento encontrado</td></tr>}
          </tbody>
        </table>
      </div>
    </PrintAwareReport>
  );
}
