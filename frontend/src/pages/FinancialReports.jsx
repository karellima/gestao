import { useState, useEffect, useMemo, useCallback, Fragment } from 'react';
import api from '../services/api';
import { formatCurrency } from '../services/format';
import { FileText, Calendar, TrendingUp, AlertTriangle, Clock, BarChart3, ArrowRightLeft, Landmark, Printer, Download } from 'lucide-react';
import { exportToExcel } from '../utils/reportExport';
import PrintPreview from '../components/PrintPreview';

const reports = [
  { id: 'payable-receivable', label: 'Contas a Pagar/Receber', icon: FileText },
  { id: 'cash-flow', label: 'Fluxo de Caixa', icon: ArrowRightLeft },
  { id: 'monthly-summary', label: 'Resumo Mensal', icon: BarChart3 },
  { id: 'by-category', label: 'Por Categoria', icon: TrendingUp },
  { id: 'by-account', label: 'Por Conta', icon: Landmark },
  { id: 'by-contact', label: 'Extrato por Fornecedor/Cliente', icon: FileText },
  { id: 'dre', label: 'DRE', icon: TrendingUp },
  { id: 'overdue', label: 'Inadimplência', icon: AlertTriangle },
  { id: 'forecast', label: 'Previsão de Pagamentos', icon: Clock },
  { id: 'period-comparison', label: 'Comparativo Períodos', icon: Calendar },
];

const typeColors = {
  receita: 'text-green-600 bg-green-50',
  despesa: 'text-red-600 bg-red-50',
};

function PrintAwareReport({ title, subtitle, columns, data, filters, children, renderPrint }) {
  const [printing, setPrinting] = useState(false);
  if (printing) {
    return (
      <PrintPreview title={title} subtitle={subtitle} onClose={() => setPrinting(false)} autoPrint>
        {renderPrint ? renderPrint() : children}
      </PrintPreview>
    );
  }
  return (
    <div className="space-y-4">
      <ReportActions title={title} columns={columns} data={data} onPrint={() => setPrinting(true)} />
      {filters}
      <div id="report-content">{children}</div>
    </div>
  );
}

function ReportActions({ title, columns, data, filename, onPrint }) {
  return (
    <div className="flex justify-end gap-2 mb-3 no-print">
      <button onClick={() => exportToExcel({ title, columns, rows: data, filename: filename || title })}
        className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
        <Download size={16} /> Excel
      </button>
      <button onClick={onPrint}
        className="flex items-center gap-2 px-3 py-2 bg-gray-600 text-white rounded-lg text-sm hover:bg-gray-700">
        <Printer size={16} /> Imprimir
      </button>
    </div>
  );
}

function ReportFilters({ startDate, setStartDate, endDate, setEndDate, contactFilter, setContactFilter, contacts, showType, filter, setFilter, showContact = true }) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Data Inicial</label>
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
          max={endDate || undefined}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Data Final</label>
        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
          min={startDate || undefined}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
      </div>
      {showType && (
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Tipo</label>
          <select value={filter} onChange={e => setFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
            <option value="">Todos</option>
            <option value="despesa">Despesas</option>
            <option value="receita">Receitas</option>
          </select>
        </div>
      )}
      {showContact && (
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Fornecedor/Cliente</label>
          <select value={contactFilter} onChange={e => setContactFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm min-w-[160px]">
            <option value="">Todos</option>
            {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}
    </div>
  );
}

function PayableReceivableReport({ contacts }) {
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
      filters={<ReportFilters startDate={startDate} setStartDate={setStartDate} endDate={setEndDate} setEndDate={setEndDate} contactFilter={contactFilter} setContactFilter={setContactFilter} contacts={contacts} showType filter={filter} setFilter={setFilter} />}>

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
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${typeColors[t.type]}`}>
                      {t.type === 'receita' ? 'Receita' : 'Despesa'}
                    </span>
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

function CashFlowReport({ contacts }) {
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
      filters={<ReportFilters startDate={startDate} setStartDate={setStartDate} endDate={setEndDate} setEndDate={setEndDate} contactFilter={contactFilter} setContactFilter={setContactFilter} contacts={contacts} />}>

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
            <tr>
              <th className="text-left p-3">Data</th>
              <th className="text-right p-3">Entradas</th>
              <th className="text-right p-3">Saídas</th>
              <th className="text-right p-3">Saldo Dia</th>
            </tr>
          </thead>
          <tbody>
            {data.map(d => {
              const saldo = d.entradas - d.saidas;
              return (
                <tr key={d.date} className="border-t">
                  <td className="p-3 text-gray-900">{new Date(d.date + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                  <td className="p-3 text-right text-green-600">{d.entradas > 0 ? formatCurrency(d.entradas) : '-'}</td>
                  <td className="p-3 text-right text-red-600">{d.saidas > 0 ? formatCurrency(d.saidas) : '-'}</td>
                  <td className={`p-3 text-right font-medium ${saldo >= 0 ? 'text-brand-700' : 'text-red-700'}`}>
                    {formatCurrency(saldo)}
                  </td>
                </tr>
              );
            })}
            {data.length === 0 && (
              <tr><td colSpan={4} className="p-6 text-center text-gray-400">Nenhum lançamento encontrado</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </PrintAwareReport>
  );
}

function MonthlySummaryReport({ contacts }) {
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
          <select value={year} onChange={e => setYear(parseInt(e.target.value))}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Fornecedor/Cliente</label>
          <select value={contactFilter} onChange={e => setContactFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm min-w-[160px]">
            <option value="">Todos</option>
            {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>}>

      <div className="bg-white rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3">Mês</th>
              <th className="text-right p-3">Receitas</th>
              <th className="text-right p-3">Despesas</th>
              <th className="text-right p-3">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {data.map(m => {
              const saldo = m.receitas - m.despesas;
              return (
                <tr key={m.month} className="border-t">
                  <td className="p-3 text-gray-900 capitalize">{m.label}</td>
                  <td className="p-3 text-right text-green-600">{m.receitas > 0 ? formatCurrency(m.receitas) : '-'}</td>
                  <td className="p-3 text-right text-red-600">{m.despesas > 0 ? formatCurrency(m.despesas) : '-'}</td>
                  <td className={`p-3 text-right font-medium ${saldo >= 0 ? 'text-brand-700' : 'text-red-700'}`}>
                    {formatCurrency(saldo)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-gray-50 font-medium">
            <tr>
              <td className="p-3 text-gray-900">Total Anual</td>
              <td className="p-3 text-right text-green-700">{formatCurrency(totals.receitas)}</td>
              <td className="p-3 text-right text-red-700">{formatCurrency(totals.despesas)}</td>
              <td className={`p-3 text-right ${(totals.receitas - totals.despesas) >= 0 ? 'text-brand-700' : 'text-red-700'}`}>
                {formatCurrency(totals.receitas - totals.despesas)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </PrintAwareReport>
  );
}

function ByCategoryReport({ contacts }) {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [filter, setFilter] = useState('despesa');
  const [contactFilter, setContactFilter] = useState('');
  const [data, setData] = useState([]);

  const load = useCallback(() => {
    const params = {
      start_date: new Date(startDate).toISOString(),
      end_date: new Date(endDate + 'T23:59:59').toISOString(),
      type: filter,
    };
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
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3">Categoria</th>
                <th className="text-center p-3">Lançamentos</th>
                <th className="text-right p-3">Total</th>
                <th className="text-right p-3">% do Total</th>
              </tr>
            </thead>
            <tbody>
              {data.map(d => (
                <tr key={d.name} className="border-t">
                  <td className="p-3 text-gray-900 font-medium">{d.name}</td>
                  <td className="p-3 text-center text-gray-500">{d.count}</td>
                  <td className={`p-3 text-right font-medium ${filter === 'receita' ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(d.total)}
                  </td>
                  <td className="p-3 text-right text-gray-500">{grandTotal > 0 ? ((d.total / grandTotal) * 100).toFixed(1) : 0}%</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 font-medium">
              <tr>
                <td className="p-3">Total</td>
                <td className="p-3 text-center">{data.reduce((s, d) => s + d.count, 0)}</td>
                <td className={`p-3 text-right ${filter === 'receita' ? 'text-green-700' : 'text-red-700'}`}>
                  {formatCurrency(grandTotal)}
                </td>
                <td className="p-3 text-right">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </PrintAwareReport>
  );
}

function ByAccountReport({ contacts }) {
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
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3">Conta</th>
                <th className="text-center p-3">Lançamentos</th>
                <th className="text-right p-3">Receitas</th>
                <th className="text-right p-3">Despesas</th>
                <th className="text-right p-3">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {data.map(d => {
                const saldo = d.receitas - d.despesas;
                return (
                  <tr key={d.name} className="border-t">
                    <td className="p-3 text-gray-900 font-medium">{d.name}</td>
                    <td className="p-3 text-center text-gray-500">{d.count}</td>
                    <td className="p-3 text-right text-green-600">{d.receitas > 0 ? formatCurrency(d.receitas) : '-'}</td>
                    <td className="p-3 text-right text-red-600">{d.despesas > 0 ? formatCurrency(d.despesas) : '-'}</td>
                    <td className={`p-3 text-right font-medium ${saldo >= 0 ? 'text-brand-700' : 'text-red-700'}`}>
                      {formatCurrency(saldo)}
                    </td>
                  </tr>
                );
              })}
              {data.length === 0 && (
                <tr><td colSpan={5} className="p-6 text-center text-gray-400">Nenhum lançamento encontrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </PrintAwareReport>
  );
}

function ByContactReport() {
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
  const ChevronDown = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>;
  const ChevronRight = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>;

  const load = useCallback(() => {
    const params = {
      start_date: new Date(startDate).toISOString(),
      end_date: new Date(endDate + 'T23:59:59').toISOString(),
    };
    api.get('/financial/transactions/', { params }).then(res => {
      setRawData(res.data);
      const filtered = statusFilter
        ? res.data.filter(t => t.status === statusFilter)
        : res.data;
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

  const toggleExpand = (name) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const togglePrint = (name) => {
    setPrintSelected(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const situationBadge = (t) => {
    const now = new Date();
    if (t.status === 'pago' || t.status === 'recebido') {
      return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Pago</span>;
    }
    if (t.due_date && new Date(t.due_date) < now) {
      return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Atrasado</span>;
    }
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-brand-100 text-brand-700">Em dia</span>;
  };

  const renderPrint = () => {
    const sorted = Array.from(printSelected).sort();
    const total = sorted.length;
    if (total === 0) return <p className="text-gray-400 text-center py-8">Nenhum contato selecionado.</p>;
    const name = sorted[printPage] || sorted[0];
    if (!name) return null;
    const buildContact = (contactName) => {
      const txs = rawData.filter(t => (t.contact?.name || 'Sem contato') === contactName)
        .sort((a, b) => new Date(b.date) - new Date(a.date));
      const totalRec = txs.filter(t => t.type === 'receita').reduce((s, t) => s + t.amount, 0);
      const totalDesp = txs.filter(t => t.type === 'despesa').reduce((s, t) => s + t.amount, 0);
      const saldo = totalRec - totalDesp;
      return { txs, totalRec, totalDesp, saldo };
    };
    const renderContact = (contactName, showPageBreak) => {
      const { txs, totalRec, totalDesp, saldo } = buildContact(contactName);
      return (
        <div key={contactName} style={showPageBreak ? { pageBreakBefore: 'always' } : undefined}>
          <p className="text-sm text-gray-500 mb-1">Fornecedor/Cliente: <span className="font-medium text-gray-900">{contactName}</span></p>
          <h2 className="text-xl font-bold mb-1">{contactName}</h2>
          <div className="flex gap-4 text-sm mb-3">
            <span className="text-green-600 font-medium">Receitas: {formatCurrency(totalRec)}</span>
            <span className="text-red-600 font-medium">Despesas: {formatCurrency(totalDesp)}</span>
            <span className={`font-medium ${saldo >= 0 ? 'text-brand-600' : 'text-red-600'}`}>
              Saldo: {formatCurrency(saldo)}
            </span>
          </div>
          <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3">Data Lançamento</th>
                  <th className="text-left p-3">Data Vencimento</th>
                  <th className="text-left p-3">Descrição</th>
                  <th className="text-left p-3">Categoria</th>
                  <th className="text-center p-3">Tipo</th>
                  <th className="text-right p-3">Valor</th>
                  <th className="text-center p-3">Situação</th>
                </tr>
              </thead>
              <tbody>
                {txs.map(t => (
                  <tr key={t.id} className="border-t hover:bg-gray-50">
                    <td className="p-3 text-gray-600">{new Date(t.date).toLocaleDateString('pt-BR')}</td>
                    <td className="p-3 text-gray-600">{t.due_date ? new Date(t.due_date).toLocaleDateString('pt-BR') : '-'}</td>
                    <td className="p-3 text-gray-900">{t.description}</td>
                    <td className="p-3 text-gray-500">{t.financial_category?.name || '-'}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${t.type === 'receita' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {t.type === 'receita' ? 'Receita' : 'Despesa'}
                      </span>
                    </td>
                    <td className={`p-3 text-right font-medium ${t.type === 'receita' ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(t.amount)}
                    </td>
                    <td className="p-3 text-center">{situationBadge(t)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
        </div>
      );
    };
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-gray-500 no-print">{printPage + 1} de {total}</span>
          <div className="flex gap-2 no-print">
            <button onClick={() => setPrintPage(p => Math.max(0, p - 1))} disabled={printPage === 0}
              className="px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-50 disabled:opacity-30">Anterior</button>
            <button onClick={() => setPrintPage(p => Math.min(total - 1, p + 1))} disabled={printPage >= total - 1}
              className="px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-50 disabled:opacity-30">Próximo</button>
          </div>
        </div>
        <div className="no-print">
          {renderContact(name)}
        </div>
        <div className="print-only">
          {sorted.map((contactName, i) => renderContact(contactName, i > 0))}
        </div>
      </div>
    );
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

  const renderDetail = (name) => {
    const txs = rawData.filter(t =>
      (t.contact?.name || 'Sem contato') === name
    ).sort((a, b) => new Date(b.date) - new Date(a.date));
    const totalRec = txs.filter(t => t.type === 'receita').reduce((s, t) => s + t.amount, 0);
    const totalDesp = txs.filter(t => t.type === 'despesa').reduce((s, t) => s + t.amount, 0);
    return (
      <div className="p-4 bg-gray-50 border-t">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-gray-900">{name}</h4>
          <div className="flex gap-4 text-sm">
            <span className="text-green-600 font-medium">Receitas: {formatCurrency(totalRec)}</span>
            <span className="text-red-600 font-medium">Despesas: {formatCurrency(totalDesp)}</span>
            <span className={`font-medium ${(totalRec - totalDesp) >= 0 ? 'text-brand-600' : 'text-red-600'}`}>
              Saldo: {formatCurrency(totalRec - totalDesp)}
            </span>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3">Data Lançamento</th>
              <th className="text-left p-3">Data Vencimento</th>
              <th className="text-left p-3">Descrição</th>
              <th className="text-left p-3">Categoria</th>
              <th className="text-center p-3">Tipo</th>
              <th className="text-right p-3">Valor</th>
              <th className="text-center p-3">Situação</th>
            </tr>
          </thead>
          <tbody>
            {txs.map(t => (
              <tr key={t.id} className="border-t hover:bg-gray-50">
                <td className="p-3 text-gray-600">{new Date(t.date).toLocaleDateString('pt-BR')}</td>
                <td className="p-3 text-gray-600">{t.due_date ? new Date(t.due_date).toLocaleDateString('pt-BR') : '-'}</td>
                <td className="p-3 text-gray-900">{t.description}</td>
                <td className="p-3 text-gray-500">{t.financial_category?.name || '-'}</td>
                <td className="p-3 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${t.type === 'receita' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {t.type === 'receita' ? 'Receita' : 'Despesa'}
                  </span>
                </td>
                <td className={`p-3 text-right font-medium ${t.type === 'receita' ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(t.amount)}
                </td>
                <td className="p-3 text-center">{situationBadge(t)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <PrintAwareReport title="Extrato por Fornecedor/Cliente" subtitle={`Período: ${formatPeriod()}`} columns={columns} data={data}
      renderPrint={renderPrint}
      filters={<div className="flex flex-wrap items-end gap-3">
        <ReportFilters startDate={startDate} setStartDate={setStartDate} endDate={endDate} setEndDate={setEndDate}
          contactFilter="" setContactFilter={() => {}} contacts={[]} showContact={false} />
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
            <option value="">Todos</option>
            <option value="pendente">Pendente</option>
            <option value="pago_parcial">Pago Parcial</option>
            <option value="pago">Pago</option>
            <option value="recebido">Recebido</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-2 no-print">
            <button onClick={() => setPrintSelected(new Set(data.map(d => d.name)))}
              className="px-3 py-2 bg-brand-50 text-brand-600 rounded-lg text-sm hover:bg-brand-100">
              Selecionar tudo
            </button>
            <button onClick={() => setPrintSelected(new Set())}
              className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200">
              Limpar seleção
            </button>
            <button onClick={() => setExpanded(new Set(data.map(d => d.name)))}
              className="px-3 py-2 bg-brand-50 text-brand-600 rounded-lg text-sm hover:bg-brand-100">
              Expandir tudo
            </button>
            <button onClick={() => setExpanded(new Set())}
              className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200">
              Recolher tudo
            </button>
          </div>
      </div>}>

        <div className="mb-4 text-sm text-gray-500">
          Período: {formatPeriod()}
        </div>

        <div className="bg-white rounded-xl overflow-hidden no-print">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-2 w-8 no-print"></th>
                <th className="p-2 w-8 no-print"></th>
                <th className="text-left p-2">Fornecedor/Cliente</th>
                <th className="text-center p-2">Lançamentos</th>
                <th className="text-right p-2">Receitas</th>
                <th className="text-right p-2">Despesas</th>
                <th className="text-right p-2">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {data.map(d => {
                const saldo = d.receitas - d.despesas;
                const isOpen = expanded.has(d.name);
                const checked = printSelected.has(d.name);
                return (
                  <Fragment key={d.name}>
                    <tr className={`border-b${isOpen ? ' bg-gray-50' : ''}`}>
                      <td className="p-2 text-center no-print">
                        <input type="checkbox" checked={checked} onChange={() => togglePrint(d.name)}
                          className="w-4 h-4 rounded border-gray-300 text-brand-600 cursor-pointer" />
                      </td>
                      <td className="p-2 text-center no-print">
                        <button onClick={() => toggleExpand(d.name)}
                          className="text-gray-400 hover:text-gray-600 cursor-pointer">
                          {isOpen ? <ChevronDown /> : <ChevronRight />}
                        </button>
                      </td>
                      <td className="p-2 text-gray-900 font-medium cursor-pointer" onClick={() => toggleExpand(d.name)}>{d.name}</td>
                      <td className="p-2 text-center text-gray-500">{d.count}</td>
                      <td className="p-2 text-right text-green-600">{d.receitas > 0 ? formatCurrency(d.receitas) : '-'}</td>
                      <td className="p-2 text-right text-red-600">{d.despesas > 0 ? formatCurrency(d.despesas) : '-'}</td>
                      <td className={`p-2 text-right font-medium ${saldo >= 0 ? 'text-brand-700' : 'text-red-700'}`}>
                        {formatCurrency(saldo)}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={7} className="p-0">{renderDetail(d.name)}</td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {data.length === 0 && (
                <tr><td colSpan={7} className="p-6 text-center text-gray-400">Nenhum lançamento encontrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </PrintAwareReport>
  );
}

function OverdueReport({ contacts }) {
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
      const overdue = res.data.filter(t =>
        t.due_date && new Date(t.due_date) < now && t.status !== 'pago' && t.status !== 'recebido'
      ).sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
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

        <div className="bg-red-50 rounded-xl p-4">
          <div className="text-xs text-red-600 font-medium mb-1">Total em Atraso</div>
          <div className="text-xl font-bold text-red-700">{formatCurrency(total)}</div>
          <div className="text-xs text-red-500 mt-1">{data.length} título(s) em atraso</div>
        </div>

        <div className="bg-white rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3">Vencimento</th>
                <th className="text-left p-3">Dias em Atraso</th>
                <th className="text-left p-3">Descrição</th>
                <th className="text-left p-3">Contato</th>
                <th className="text-left p-3">Categoria</th>
                <th className="text-center p-3">Tipo</th>
                <th className="text-right p-3">Valor</th>
              </tr>
            </thead>
            <tbody>
              {data.map(t => {
                const days = Math.ceil((new Date() - new Date(t.due_date)) / (1000 * 60 * 60 * 24));
                return (
                  <tr key={t.id} className="border-t">
                    <td className="p-3 text-gray-600">{new Date(t.due_date).toLocaleDateString('pt-BR')}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${days > 30 ? 'bg-red-100 text-red-700' : days > 15 ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {days} dias
                      </span>
                    </td>
                    <td className="p-3 text-gray-900">{t.description}</td>
                    <td className="p-3 text-gray-500">{t.contact?.name || '-'}</td>
                    <td className="p-3 text-gray-500">{t.financial_category?.name || '-'}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${t.type === 'receita' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {t.type === 'receita' ? 'A Receber' : 'A Pagar'}
                      </span>
                    </td>
                    <td className="p-3 text-right font-medium text-red-600">{formatCurrency(t.amount)}</td>
                  </tr>
                );
              })}
              {data.length === 0 && (
                <tr><td colSpan={7} className="p-6 text-center text-green-600">Nenhum título em atraso</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </PrintAwareReport>
  );
}

function ForecastReport({ contacts }) {
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

        <div className="bg-brand-50 rounded-xl p-4">
          <div className="text-xs text-brand-600 font-medium mb-1">Total Previsto</div>
          <div className="text-xl font-bold text-brand-700">{formatCurrency(total)}</div>
          <div className="text-xs text-brand-500 mt-1">{data.length} título(s) previsto(s)</div>
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
                <tr key={t.id} className="border-t">
                  <td className="p-3 text-gray-600">{new Date(t.due_date).toLocaleDateString('pt-BR')}</td>
                  <td className="p-3 text-gray-900">{t.description}</td>
                  <td className="p-3 text-gray-500">{t.contact?.name || '-'}</td>
                  <td className="p-3 text-gray-500">{t.financial_category?.name || '-'}</td>
                  <td className="p-3 text-gray-500">{t.account?.name || '-'}</td>
                  <td className="p-3 text-center text-gray-500">{t.current_installment}/{t.installments}</td>
                  <td className="p-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${t.type === 'receita' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {t.type === 'receita' ? 'Receita' : 'Despesa'}
                    </span>
                  </td>
                  <td className={`p-3 text-right font-medium ${t.type === 'receita' ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(t.amount)}
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr><td colSpan={8} className="p-6 text-center text-gray-400">Nenhuma previsão encontrada</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </PrintAwareReport>
  );
}

function PeriodComparisonReport({ contacts }) {
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
    const [rAll] = await Promise.all([
      api.get('/financial/transactions/', { params }),
    ]);
    const inPeriod = (txs, s, e) => txs.filter(t => {
      const d = new Date(t.date);
      return d >= new Date(s) && d <= new Date(e + 'T23:59:59');
    });
    const calc = (txs) => ({
      receitas: txs.filter(t => t.type === 'receita').reduce((s, t) => s + t.amount, 0),
      despesas: txs.filter(t => t.type === 'despesa').reduce((s, t) => s + t.amount, 0),
    });
    setP1(calc(inPeriod(rAll.data, period1Start, period1End)));
    setP2(calc(inPeriod(rAll.data, period2Start, period2End)));
  }, [period1Start, period1End, period2Start, period2End, contactFilter]);

  useEffect(() => { load(); }, [load]);

  const diff = (a, b) => b > 0 ? ((a - b) / b * 100).toFixed(1) : '0.0';
  const diffIcon = (a, b) => a > b ? '\u2191' : a < b ? '\u2193' : '=';

  const compData = [
    { indicator: 'Receitas', p1: p1.receitas, p2: p2.receitas, cls: 'text-green-600' },
    { indicator: 'Despesas', p1: p1.despesas, p2: p2.despesas, cls: 'text-red-600' },
    { indicator: 'Saldo', p1: p1.receitas - p1.despesas, p2: p2.receitas - p2.despesas, cls: 'font-bold' },
  ];

  const columns = [
    { header: 'Indicador', accessor: 'indicator', width: 20 },
    { header: 'Período 1', accessor: d => formatCurrency(d.p1), width: 15 },
    { header: 'Período 2', accessor: d => formatCurrency(d.p2), width: 15 },
    { header: 'Variação', accessor: d => `${diffIcon(d.p1, d.p2)} ${diff(d.p1, d.p2)}%`, width: 14 },
  ];

  return (
    <PrintAwareReport title="Comparativo Períodos" columns={columns} data={compData}
      filters={<div className="flex flex-wrap items-end gap-3">
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Período 1</p>
          <div className="flex gap-2">
            <input type="date" value={period1Start} onChange={e => setPeriod1Start(e.target.value)}
              max={period1End || undefined}
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            <input type="date" value={period1End} onChange={e => setPeriod1End(e.target.value)}
              min={period1Start || undefined}
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          </div>
        </div>
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Período 2</p>
          <div className="flex gap-2">
            <input type="date" value={period2Start} onChange={e => setPeriod2Start(e.target.value)}
              max={period2End || undefined}
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            <input type="date" value={period2End} onChange={e => setPeriod2End(e.target.value)}
              min={period2Start || undefined}
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Fornecedor/Cliente</label>
          <select value={contactFilter} onChange={e => setContactFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm min-w-[160px]">
            <option value="">Todos</option>
            {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>}>

        <div className="bg-white rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3">Indicador</th>
                <th className="text-right p-3">Período 1</th>
                <th className="text-right p-3">Período 2</th>
                <th className="text-right p-3">Variação</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td className="p-3 font-medium text-green-600">Receitas</td>
                <td className="p-3 text-right">{formatCurrency(p1.receitas)}</td>
                <td className="p-3 text-right">{formatCurrency(p2.receitas)}</td>
                <td className="p-3 text-right font-medium">
                  {diffIcon(p1.receitas, p2.receitas)} {diff(p1.receitas, p2.receitas)}%
                </td>
              </tr>
              <tr className="border-t">
                <td className="p-3 font-medium text-red-600">Despesas</td>
                <td className="p-3 text-right">{formatCurrency(p1.despesas)}</td>
                <td className="p-3 text-right">{formatCurrency(p2.despesas)}</td>
                <td className="p-3 text-right font-medium">
                  {diffIcon(p1.despesas, p2.despesas)} {diff(p1.despesas, p2.despesas)}%
                </td>
              </tr>
              <tr className="border-t bg-gray-50">
                <td className="p-3 font-bold">Saldo</td>
                <td className={`p-3 text-right font-bold ${(p1.receitas - p1.despesas) >= 0 ? 'text-brand-700' : 'text-red-700'}`}>
                  {formatCurrency(p1.receitas - p1.despesas)}
                </td>
                <td className={`p-3 text-right font-bold ${(p2.receitas - p2.despesas) >= 0 ? 'text-brand-700' : 'text-red-700'}`}>
                  {formatCurrency(p2.receitas - p2.despesas)}
                </td>
                <td className="p-3 text-right font-bold">
                  {diffIcon((p1.receitas - p1.despesas), (p2.receitas - p2.despesas))}{' '}
                  {diff((p1.receitas - p1.despesas), (p2.receitas - p2.despesas))}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </PrintAwareReport>
  );
}

function DPEReport({ contacts }) {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [contactFilter, setContactFilter] = useState('');
  const [receitas, setReceitas] = useState([]);
  const [despesas, setDespesas] = useState([]);

  const load = useCallback(() => {
    const params = {
      start_date: new Date(startDate).toISOString(),
      end_date: new Date(endDate + 'T23:59:59').toISOString(),
    };
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
          <div className="bg-green-50 rounded-xl p-4">
            <div className="text-xs text-green-600 font-medium mb-1">Receitas</div>
            <div className="text-lg font-bold text-green-700">{formatCurrency(totalReceitas)}</div>
          </div>
          <div className="bg-red-50 rounded-xl p-4">
            <div className="text-xs text-red-600 font-medium mb-1">Despesas</div>
            <div className="text-lg font-bold text-red-700">{formatCurrency(totalDespesas)}</div>
          </div>
          <div className={`rounded-xl p-4 ${resultado >= 0 ? 'bg-brand-50' : 'bg-red-50'}`}>
            <div className={`text-xs font-medium mb-1 ${resultado >= 0 ? 'text-brand-600' : 'text-red-600'}`}>Resultado Líquido</div>
            <div className={`text-lg font-bold ${resultado >= 0 ? 'text-brand-700' : 'text-red-700'}`}>
              {formatCurrency(resultado)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl overflow-hidden">
            <div className="bg-green-50 px-4 py-2 border-b">
              <h3 className="text-sm font-semibold text-green-700">Receitas por Categoria</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3 text-xs font-semibold text-gray-500 uppercase">Categoria</th>
                  <th className="text-center p-3 text-xs font-semibold text-gray-500 uppercase">Qtd</th>
                  <th className="text-right p-3 text-xs font-semibold text-gray-500 uppercase">Valor</th>
                </tr>
              </thead>
              <tbody>
                {receitas.map(c => (
                  <tr key={c.name} className="border-t">
                    <td className="p-3 text-gray-900">{c.name}</td>
                    <td className="p-3 text-center text-gray-500">{c.count}</td>
                    <td className="p-3 text-right text-green-600 font-medium">{formatCurrency(c.total)}</td>
                  </tr>
                ))}
                {receitas.length === 0 && (
                  <tr><td colSpan={3} className="p-4 text-center text-gray-400">Nenhuma receita</td></tr>
                )}
              </tbody>
              <tfoot>
                <tr className="bg-green-50 font-medium">
                  <td className="p-3 text-green-800">Total</td>
                  <td className="p-3 text-center text-green-700">{receitas.reduce((s, c) => s + c.count, 0)}</td>
                  <td className="p-3 text-right text-green-700">{formatCurrency(totalReceitas)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="bg-white rounded-xl overflow-hidden">
            <div className="bg-red-50 px-4 py-2 border-b">
              <h3 className="text-sm font-semibold text-red-700">Despesas por Categoria</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3 text-xs font-semibold text-gray-500 uppercase">Categoria</th>
                  <th className="text-center p-3 text-xs font-semibold text-gray-500 uppercase">Qtd</th>
                  <th className="text-right p-3 text-xs font-semibold text-gray-500 uppercase">Valor</th>
                </tr>
              </thead>
              <tbody>
                {despesas.map(c => (
                  <tr key={c.name} className="border-t">
                    <td className="p-3 text-gray-900">{c.name}</td>
                    <td className="p-3 text-center text-gray-500">{c.count}</td>
                    <td className="p-3 text-right text-red-600 font-medium">{formatCurrency(c.total)}</td>
                  </tr>
                ))}
                {despesas.length === 0 && (
                  <tr><td colSpan={3} className="p-4 text-center text-gray-400">Nenhuma despesa</td></tr>
                )}
              </tbody>
              <tfoot>
                <tr className="bg-red-50 font-medium">
                  <td className="p-3 text-red-800">Total</td>
                  <td className="p-3 text-center text-red-700">{despesas.reduce((s, c) => s + c.count, 0)}</td>
                  <td className="p-3 text-right text-red-700">{formatCurrency(totalDespesas)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className={`mt-4 rounded-xl p-4 text-center ${resultado >= 0 ? 'bg-brand-50' : 'bg-red-50'}`}>
          <div className={`text-sm font-semibold mb-1 ${resultado >= 0 ? 'text-brand-600' : 'text-red-600'}`}>
            Resultado do Período
          </div>
          <div className={`text-2xl font-bold ${resultado >= 0 ? 'text-brand-700' : 'text-red-700'}`}>
            {resultado >= 0 ? '+' : ''}{formatCurrency(resultado)}
          </div>
        </div>
      </PrintAwareReport>
  );
}

const reportComponents = {
  'payable-receivable': PayableReceivableReport,
  'cash-flow': CashFlowReport,
  'monthly-summary': MonthlySummaryReport,
  'by-category': ByCategoryReport,
  'by-account': ByAccountReport,
  'by-contact': ByContactReport,
  'dre': DPEReport,
  'overdue': OverdueReport,
  'forecast': ForecastReport,
  'period-comparison': PeriodComparisonReport,
};

export default function FinancialReports() {
  const [activeReport, setActiveReport] = useState('payable-receivable');
  const [contacts, setContacts] = useState([]);
  const ReportComponent = reportComponents[activeReport];

  useEffect(() => { api.get('/contacts/').then(res => setContacts(res.data)); }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Relatórios Financeiros</h1>

      <div className="flex flex-wrap gap-2 mb-6">
        {reports.map(r => {
          const Icon = r.icon;
          return (
            <button key={r.id} onClick={() => setActiveReport(r.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeReport === r.id
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}>
              <Icon size={16} />
              {r.label}
            </button>
          );
        })}
      </div>

      <ReportComponent contacts={contacts} />
    </div>
  );
}
