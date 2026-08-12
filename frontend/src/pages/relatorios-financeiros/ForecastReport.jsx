import { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';
import { formatCurrency } from '../../services/format';
import PrintAwareReport from './PrintAwareReport';
import ReportFilters from './ReportFilters';
import TransactionTypeBadge from './TransactionTypeBadge';

export default function ForecastReport({ contacts }) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState(() => {
    const d = new Date(); d.setMonth(11); d.setDate(31); return d.toISOString().split('T')[0];
  });
  const [contactFilter, setContactFilter] = useState('');
  const [data, setData] = useState([]);

  const load = useCallback(() => {
    const params = {};
    if (startDate) params.due_date_start = new Date(startDate).toISOString();
    if (endDate) params.due_date_end = new Date(endDate + 'T23:59:59').toISOString();
    if (contactFilter) params.contact_id = contactFilter;
    api.get('/financial/transactions/', { params }).then(res => {
      const future = res.data.filter(t => t.status !== 'pago' && t.status !== 'recebido');
      setData(future.sort((a, b) => new Date(a.due_date) - new Date(b.due_date)));
    });
  }, [startDate, endDate, contactFilter]);

  useEffect(() => { load(); }, [load]);

  const total = data.reduce((s, t) => s + t.amount, 0);
  const columns = [
    { header: 'Vencimento', accessor: t => new Date(t.due_date).toLocaleDateString('pt-BR'), width: 14 },
    { header: 'Descrição', accessor: 'description', width: 22 },
    { header: 'Contato', accessor: t => t.contact?.name || '-', width: 18 },
    { header: 'Categoria', accessor: t => t.financial_category?.name || '-', width: 16 },
    { header: 'Conta', accessor: t => t.account?.name || '-', width: 16 },
    { header: 'Parcela', accessor: t => `${t.current_installment}/${t.installments}`, width: 10 },
    { header: 'Tipo', accessor: t => t.type === 'receita' ? 'Receita' : 'Despesa', width: 10 },
    { header: 'Valor', accessor: t => t.amount, format: v => formatCurrency(v), width: 15 },
  ];

  return (
    <PrintAwareReport title="Previsão de Pagamentos" columns={columns} data={data}
      filters={<ReportFilters startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate} contactFilter={contactFilter} setContactFilter={setContactFilter} contacts={contacts} />}>
      <div className="bg-brand-50 rounded-xl p-4"><div className="text-xs text-brand-600 font-medium mb-1">Total Previsto</div><div className="text-xl font-bold text-brand-700">{formatCurrency(total)}</div><div className="text-xs text-brand-500 mt-1">{data.length} título(s) previsto(s)</div></div>
      <div className="bg-white rounded-xl overflow-hidden">
        <table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="text-left p-3">Vencimento</th><th className="text-left p-3">Descrição</th><th className="text-left p-3">Contato</th><th className="text-left p-3">Categoria</th><th className="text-left p-3">Conta</th><th className="text-center p-3">Parcela</th><th className="text-center p-3">Tipo</th><th className="text-right p-3">Valor</th></tr></thead>
          <tbody>{data.map(t => <tr key={t.id} className="border-t"><td className="p-3 text-gray-600">{new Date(t.due_date).toLocaleDateString('pt-BR')}</td><td className="p-3 text-gray-900">{t.description}</td><td className="p-3 text-gray-500">{t.contact?.name || '-'}</td><td className="p-3 text-gray-500">{t.financial_category?.name || '-'}</td><td className="p-3 text-gray-500">{t.account?.name || '-'}</td><td className="p-3 text-center text-gray-500">{t.current_installment}/{t.installments}</td><td className="p-3 text-center"><TransactionTypeBadge type={t.type} /></td><td className={`p-3 text-right font-medium ${t.type === 'receita' ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(t.amount)}</td></tr>)}
          {data.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-gray-400">Nenhuma previsão encontrada</td></tr>}
        </tbody></table>
      </div>
    </PrintAwareReport>
  );
}
