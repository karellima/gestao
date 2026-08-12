import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../services/api';
import { formatCurrency } from '../../services/format';
import PrintAwareReport from './PrintAwareReport';
import ReportFilters from './ReportFilters';
import TransactionTypeBadge from './TransactionTypeBadge';

export default function PayableReceivableReport({ contacts }) {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [filter, setFilter] = useState('');
  const [contactFilter, setContactFilter] = useState('');
  const [data, setData] = useState([]);

  const load = useCallback(() => {
    const params = {
      due_date_start: new Date(startDate).toISOString(),
      due_date_end: new Date(endDate + 'T23:59:59').toISOString(),
    };
    if (filter) params.type = filter;
    if (contactFilter) params.contact_id = contactFilter;
    api.get('/financial/transactions/', { params }).then(res => {
      setData(res.data.sort((a, b) => new Date(a.due_date) - new Date(b.due_date)));
    });
  }, [startDate, endDate, filter, contactFilter]);

  useEffect(() => { load(); }, [load]);

  const totals = useMemo(() => {
    const receitas = data.filter(t => t.type === 'receita').reduce((s, t) => s + t.amount, 0);
    const despesas = data.filter(t => t.type === 'despesa').reduce((s, t) => s + t.amount, 0);
    return { receitas, despesas, saldo: receitas - despesas };
  }, [data]);

  const columns = [
    { header: 'Vencimento', accessor: t => new Date(t.due_date).toLocaleDateString('pt-BR'), width: 14 },
    { header: 'Descrição', accessor: 'description', width: 25 },
    { header: 'Contato', accessor: t => t.contact?.name || '-', width: 20 },
    { header: 'Categoria', accessor: t => t.financial_category?.name || '-', width: 18 },
    { header: 'Conta', accessor: t => t.account?.name || '-', width: 18 },
    { header: 'Parcela', accessor: t => `${t.current_installment}/${t.installments}`, width: 10 },
    { header: 'Tipo', accessor: t => t.type === 'receita' ? 'Receita' : 'Despesa', width: 10 },
    { header: 'Valor', accessor: t => t.amount, format: v => formatCurrency(v), width: 15 },
  ];

  return (
    <PrintAwareReport title="Contas a Pagar/Receber" columns={columns} data={data}
      filters={<ReportFilters startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate} contactFilter={contactFilter} setContactFilter={setContactFilter} contacts={contacts} showType filter={filter} setFilter={setFilter} />}>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-green-50 rounded-xl p-4">
          <div className="text-xs text-green-600 font-medium mb-1">Total Receitas</div>
          <div className="text-lg font-bold text-green-700">{formatCurrency(totals.receitas)}</div>
        </div>
        <div className="bg-red-50 rounded-xl p-4">
          <div className="text-xs text-red-600 font-medium mb-1">Total Despesas</div>
          <div className="text-lg font-bold text-red-700">{formatCurrency(totals.despesas)}</div>
        </div>
        <div className="bg-brand-50 rounded-xl p-4">
          <div className="text-xs text-brand-600 font-medium mb-1">Saldo</div>
          <div className={`text-lg font-bold ${totals.saldo >= 0 ? 'text-brand-700' : 'text-red-700'}`}>{formatCurrency(totals.saldo)}</div>
        </div>
      </div>

        <div className="bg-white rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3">Vencimento</th>
                <th className="text-left p-3">Descrição</th>
                <th className="text-left p-3">Contato</th>
                <th className="text-left p-3">Categoria</th>
                <th className="text-left p-3">Conta</th>
                <th className="text-center p-3">Parcela</th>
                <th className="text-center p-3">Tipo</th>
                <th className="text-right p-3">Valor</th>
              </tr>
            </thead>
            <tbody>
              {data.map(t => (
                <tr key={t.id} className="border-t hover:bg-gray-50">
                  <td className="p-3 text-gray-600">{new Date(t.due_date).toLocaleDateString('pt-BR')}</td>
                  <td className="p-3 text-gray-900">{t.description}</td>
                  <td className="p-3 text-gray-500">{t.contact?.name || '-'}</td>
                  <td className="p-3 text-gray-500">{t.financial_category?.name || '-'}</td>
                  <td className="p-3 text-gray-500">{t.account?.name || '-'}</td>
                  <td className="p-3 text-center text-gray-500">{t.current_installment}/{t.installments}</td>
                  <td className="p-3 text-center">
                    <TransactionTypeBadge type={t.type} />
                  </td>
                  <td className={`p-3 text-right font-medium ${t.type === 'receita' ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(t.amount)}
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr><td colSpan={8} className="p-6 text-center text-gray-400">Nenhum lançamento encontrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </PrintAwareReport>
  );
}
