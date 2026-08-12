import { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';
import { formatCurrency } from '../../services/format';
import PrintAwareReport from './PrintAwareReport';
import ReportFilters from './ReportFilters';

export default function OverdueReport({ contacts }) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [contactFilter, setContactFilter] = useState('');
  const [data, setData] = useState([]);

  const load = useCallback(() => {
    const params = { due_date_end: new Date(endDate + 'T23:59:59').toISOString() };
    if (startDate) params.due_date_start = new Date(startDate).toISOString();
    if (contactFilter) params.contact_id = contactFilter;
    api.get('/financial/transactions/', { params }).then(res => {
      const now = new Date();
      const overdue = res.data.filter(t => t.due_date && new Date(t.due_date) < now && t.status !== 'pago' && t.status !== 'recebido')
        .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
      setData(overdue);
    });
  }, [startDate, endDate, contactFilter]);

  useEffect(() => { load(); }, [load]);

  const total = data.reduce((s, t) => s + t.amount, 0);
  const columns = [
    { header: 'Vencimento', accessor: t => new Date(t.due_date).toLocaleDateString('pt-BR'), width: 14 },
    { header: 'Dias em Atraso', accessor: t => Math.ceil((new Date() - new Date(t.due_date)) / (1000 * 60 * 60 * 24)), width: 14 },
    { header: 'Descrição', accessor: 'description', width: 22 },
    { header: 'Contato', accessor: t => t.contact?.name || '-', width: 18 },
    { header: 'Categoria', accessor: t => t.financial_category?.name || '-', width: 16 },
    { header: 'Tipo', accessor: t => t.type === 'receita' ? 'A Receber' : 'A Pagar', width: 10 },
    { header: 'Valor', accessor: t => t.amount, format: v => formatCurrency(v), width: 15 },
  ];

  return (
    <PrintAwareReport title="Inadimplência" columns={columns} data={data}
      filters={<ReportFilters startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate} contactFilter={contactFilter} setContactFilter={setContactFilter} contacts={contacts} />}>
      <div className="bg-red-50 rounded-xl p-4"><div className="text-xs text-red-600 font-medium mb-1">Total em Atraso</div><div className="text-xl font-bold text-red-700">{formatCurrency(total)}</div><div className="text-xs text-red-500 mt-1">{data.length} título(s) em atraso</div></div>
      <div className="bg-white rounded-xl overflow-hidden">
        <table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="text-left p-3">Vencimento</th><th className="text-left p-3">Dias em Atraso</th><th className="text-left p-3">Descrição</th><th className="text-left p-3">Contato</th><th className="text-left p-3">Categoria</th><th className="text-center p-3">Tipo</th><th className="text-right p-3">Valor</th></tr></thead>
          <tbody>{data.map(t => { const days = Math.ceil((new Date() - new Date(t.due_date)) / (1000 * 60 * 60 * 24)); return <tr key={t.id} className="border-t"><td className="p-3 text-gray-600">{new Date(t.due_date).toLocaleDateString('pt-BR')}</td><td className="p-3"><span className={`px-2 py-1 rounded-full text-xs font-medium ${days > 30 ? 'bg-red-100 text-red-700' : days > 15 ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'}`}>{days} dias</span></td><td className="p-3 text-gray-900">{t.description}</td><td className="p-3 text-gray-500">{t.contact?.name || '-'}</td><td className="p-3 text-gray-500">{t.financial_category?.name || '-'}</td><td className="p-3 text-center"><span className={`px-2 py-1 rounded-full text-xs font-medium ${t.type === 'receita' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{t.type === 'receita' ? 'A Receber' : 'A Pagar'}</span></td><td className="p-3 text-right font-medium text-red-600">{formatCurrency(t.amount)}</td></tr>; })}
          {data.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-green-600">Nenhum título em atraso</td></tr>}
        </tbody></table>
      </div>
    </PrintAwareReport>
  );
}
