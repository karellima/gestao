import { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../services/api';
import { formatCurrency, getTodayLocal } from '../services/format';
import { currencyToDigits, formatDigitsToCurrency, parseCurrencyToNumber, formatNumberToCurrency } from '../services/masks';
import { Plus, Edit, Trash2, TrendingUp, TrendingDown, Repeat, Calendar, Landmark, Wallet, CreditCard, AlertTriangle, Clock } from 'lucide-react';
import SortableHeader from '../components/SortableHeader';
import SearchableSelect from '../components/SearchableSelect';
import { CaseInput, CaseTextarea } from '../components/CaseInput';

function getEmptyForm() {
  return {
    type: 'receita', financial_category_id: '', subcategory_id: '', description: '', amount: '',
    date: getTodayLocal(), due_date: '', payment_type_id: '', account_id: '',
    contact_id: '', installments: '1', current_installment: '1', recurrence_frequency: '', notes: '',
  };
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}
function frequencyDays(freq) {
  return freq === 'semanal' ? 7 : freq === 'quinzenal' ? 15 : 0;
}

function calcNextDueDate(baseDueDate, freq, step) {
  const d = new Date(baseDueDate);
  if (freq === 'mensal') return addMonths(d, step);
  return addDays(d, frequencyDays(freq) * step);
}

function calcInstallmentDates(dueDate, total, freq, startInstallment) {
  if (!freq || total <= 1 || !dueDate) return [];
  const start = startInstallment || 1;
  return Array.from({ length: total - start + 1 }, (_, i) => calcNextDueDate(dueDate, freq, i));
}

function autoCalcDueDate(transactionDate, closingDay, dueDay) {
  if (!closingDay || !dueDay) return transactionDate;
  const tx = new Date(transactionDate + 'T12:00:00');
  const txDay = tx.getDate();
  let dueMonth = tx.getMonth();
  let dueYear = tx.getFullYear();
  if (txDay > closingDay) dueMonth += 1;
  const due = new Date(dueYear, dueMonth, Math.min(dueDay, new Date(dueYear, dueMonth + 1, 0).getDate()));
  return `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`;
}

export default function Financial() {
  const [transactions, setTransactions] = useState([]);
  const [filter, setFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [paymentTypes, setPaymentTypes] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [contactFilter, setContactFilter] = useState('');
  const [frequencies, setFrequencies] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
  const [form, setForm] = useState(getEmptyForm());
  const [submitError, setSubmitError] = useState('');
  const [payingTransaction, setPayingTransaction] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amount: '', interest: '', payment_date: getTodayLocal(), notes: '' });

  const loadTransactions = useCallback(() => {
    const params = {};
    if (startDate) params.start_date = new Date(startDate).toISOString();
    if (endDate) params.end_date = new Date(endDate + 'T23:59:59').toISOString();
    api.get('/financial/transactions/', { params }).then(res => setTransactions(res.data));
  }, [startDate, endDate]);

  const loadLookups = useCallback(() => {
    api.get('/financial-categories/all').then(res => setCategories(res.data));
    api.get('/accounts/').then(res => setAccounts(res.data));
    api.get('/payment-types/').then(res => setPaymentTypes(res.data));
    api.get('/contacts/').then(res => setContacts(res.data));
    api.get('/recurrence-frequencies/active').then(res => setFrequencies(res.data));
  }, []);

  useEffect(() => { loadTransactions(); }, [loadTransactions]);
  useEffect(() => { loadLookups(); }, [loadLookups]);

  const filteredCategories = categories.filter(c => c.type === form.type && !c.parent_id);
  const frequencyOptions = useMemo(() =>
    frequencies.map(f => ({ value: f.name.toLowerCase(), label: `${f.name} (${f.days_interval} dias)` })),
    [frequencies]
  );
  const frequencyLabels = useMemo(() =>
    Object.fromEntries(frequencies.map(f => [f.name.toLowerCase(), f.name])),
    [frequencies]
  );
  const subcategories = categories.filter(c =>
    c.type === form.type && c.parent_id && String(c.parent_id) === String(form.financial_category_id)
  );
  const selectedPaymentType = paymentTypes.find(pt => String(pt.id) === String(form.payment_type_id));
  const selectedAccount = accounts.find(a => String(a.id) === String(form.account_id));
  const paymentTypeIsCredit = selectedPaymentType?.name?.toLowerCase().includes('cartão') || selectedPaymentType?.name?.toLowerCase().includes('cartao');
  const isCreditCard = paymentTypeIsCredit || selectedAccount?.account_type === 'cartao_credito';
  const hasClosingDays = isCreditCard && selectedAccount?.closing_day && selectedAccount?.due_day;
  const calculatedDueDate = (hasClosingDays && form.date)
    ? autoCalcDueDate(form.date, selectedAccount.closing_day, selectedAccount.due_day)
    : null;
  const effectiveDueDate = calculatedDueDate || form.due_date;
  const showInstallments = selectedPaymentType?.requires_installments;
  const installmentCount = parseInt(form.installments) || 1;
  const startInstallment = parseInt(form.current_installment) || 1;
  const installmentValue = form.amount && installmentCount > 1 ? (parseCurrencyToNumber(form.amount, 2) / installmentCount) : null;
  const installmentDates = (form.recurrence_frequency && effectiveDueDate && installmentCount > 1)
    ? calcInstallmentDates(effectiveDueDate, installmentCount, form.recurrence_frequency, startInstallment)
    : [];

  const categoryOptions = filteredCategories.map(c => ({ value: c.id, label: c.name }));
  const subcategoryOptions = subcategories.map(c => ({ value: c.id, label: c.name }));
  const paymentTypeOptions = paymentTypes.filter(pt => pt.is_active).map(pt => ({ value: pt.id, label: pt.name }));
  const accountTypeIcons = { banco: Landmark, caixa: Wallet, cartao_credito: CreditCard };
  const accountTypeColors = { banco: 'text-brand-600', caixa: 'text-green-600', cartao_credito: 'text-purple-600' };

const dueDaysInfo = (t) => {
  if (!t.due_date || t.status === 'pago' || t.status === 'recebido') return null;
  const due = new Date(t.due_date);
  due.setHours(12, 0, 0, 0);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const diff = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
  if (diff < 0) return { days: Math.abs(diff), isOverdue: true, cls: 'text-red-700 bg-red-100', label: `${Math.abs(diff)}d atrasado` };
  if (diff <= 3) return { days: diff, isOverdue: false, cls: 'text-orange-700 bg-orange-100', label: `${diff}d` };
  return null;
};
  const accountOptions = accounts.filter(a => a.is_active).map(a => ({
    value: a.id,
    label: a.name,
    data: a,
  }));

  const renderAccountOption = (opt) => {
    const Icon = accountTypeIcons[opt.data.account_type] || Landmark;
    const color = accountTypeColors[opt.data.account_type] || 'text-gray-600';
    return (
      <div className="flex items-center gap-2">
        <Icon size={18} className={color} />
        <span className="flex-1">{opt.data.name}</span>
      </div>
    );
  };

  const renderAccountSelected = (opt) => {
    const Icon = accountTypeIcons[opt.data.account_type] || Landmark;
    const color = accountTypeColors[opt.data.account_type] || 'text-gray-600';
    return (
      <div className="flex items-center gap-2">
        <Icon size={16} className={color} />
        <span>{opt.data.name}</span>
      </div>
    );
  };
  const contactOptions = contacts.filter(c => c.is_active).map(c => ({ value: c.id, label: c.name }));

  const handleAccountChange = (accountId) => {
    const acc = accounts.find(a => String(a.id) === String(accountId));
    const newForm = { ...form, account_id: accountId ? String(accountId) : '' };
    if (acc?.account_type === 'cartao_credito' && acc.closing_day && acc.due_day && form.date) {
      newForm.due_date = autoCalcDueDate(form.date, acc.closing_day, acc.due_day);
    } else if (acc?.account_type !== 'cartao_credito') {
      newForm.due_date = '';
    }
    setForm(newForm);
  };

  const handleDateChange = (dateVal) => {
    const newForm = { ...form, date: dateVal };
    if (selectedAccount?.account_type === 'cartao_credito' && selectedAccount.closing_day && selectedAccount.due_day && dateVal) {
      newForm.due_date = autoCalcDueDate(dateVal, selectedAccount.closing_day, selectedAccount.due_day);
    }
    setForm(newForm);
  };

  const sortedTransactions = useMemo(() => {
    const arr = [...transactions];
    arr.sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];
      if (sortConfig.key === 'financial_category_id') { aVal = a.financial_category?.name || ''; bVal = b.financial_category?.name || ''; }
      if (sortConfig.key === 'payment_type_id') { aVal = a.payment_type?.name || ''; bVal = b.payment_type?.name || ''; }
      if (sortConfig.key === 'account_id') { aVal = a.account?.name || ''; bVal = b.account?.name || ''; }
      if (sortConfig.key === 'due_date') { aVal = a.due_date || ''; bVal = b.due_date || ''; }
      if (aVal == null) aVal = '';
      if (bVal == null) bVal = '';
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [transactions, sortConfig]);

  const displayTransactions = useMemo(() => {
    let arr = sortedTransactions;
    if (filter) arr = arr.filter(t => t.type === filter);
    if (contactFilter) arr = arr.filter(t => String(t.contact_id) === String(contactFilter));
    return arr;
  }, [sortedTransactions, filter, contactFilter]);

  const handleSort = (key, direction) => setSortConfig({ key, direction });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    try {
      const catId = form.subcategory_id || form.financial_category_id;
      const data = {
        type: form.type,
        description: form.description,
        amount: parseCurrencyToNumber(form.amount, 2),
        date: new Date(form.date + 'T12:00:00').toISOString(),
        due_date: effectiveDueDate ? new Date(effectiveDueDate + 'T12:00:00').toISOString() : null,
        financial_category_id: catId ? parseInt(catId) : null,
        payment_type_id: form.payment_type_id ? parseInt(form.payment_type_id) : null,
        account_id: form.account_id ? parseInt(form.account_id) : null,
        contact_id: form.contact_id ? parseInt(form.contact_id) : null,
        installments: showInstallments ? parseInt(form.installments) || 1 : 1,
        current_installment: showInstallments ? parseInt(form.current_installment) || 1 : 1,
        recurrence_frequency: form.recurrence_frequency || null,
        notes: form.notes || null,
      };
      if (editing) { await api.put(`/financial/transactions/${editing.id}`, data); }
      else { await api.post('/financial/transactions/', data); }
      setShowModal(false); setEditing(null); setForm(getEmptyForm()); setSubmitError(''); loadTransactions();
    } catch (err) {
      const detail = err.response?.data?.detail;
      const msg = Array.isArray(detail) ? detail.map(d => d.msg).join(', ') : (detail || err.message);
      setSubmitError(msg);
    }
  };

  const openPaymentModal = (t) => {
    const totalPaid = (t.payments || []).reduce((s, p) => s + p.amount, 0);
    const remaining = t.amount - totalPaid;
    setPayingTransaction(t);
    setPaymentForm({
      amount: formatNumberToCurrency(remaining, 2),
      interest: '',
      payment_date: getTodayLocal(),
      notes: '',
    });
    setShowPaymentModal(true);
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        transaction_id: payingTransaction.id,
        amount: parseCurrencyToNumber(paymentForm.amount, 2),
        interest: parseCurrencyToNumber(paymentForm.interest, 2),
        payment_date: new Date(paymentForm.payment_date + 'T12:00:00').toISOString(),
        notes: paymentForm.notes || null,
      };
      await api.post('/payments/', data);
      setShowPaymentModal(false); setPayingTransaction(null); loadTransactions();
    } catch (err) {
      const detail = err.response?.data?.detail;
      alert(detail || 'Erro ao registrar pagamento');
    }
  };

  const handleEdit = (t) => {
    setEditing(t);
    const cat = categories.find(c => c.id === t.financial_category_id);
    const isSub = cat?.parent_id != null;
    setForm({
      type: t.type,
      financial_category_id: isSub ? String(cat.parent_id) : (t.financial_category_id || ''),
      subcategory_id: isSub ? String(t.financial_category_id) : '',
      description: t.description, amount: formatNumberToCurrency(t.amount, 2),
      date: t.date?.split('T')[0] || '',
      due_date: t.due_date?.split('T')[0] || '',
      payment_type_id: t.payment_type_id || '', account_id: t.account_id || '',
      contact_id: t.contact_id || '',
      installments: String(t.installments || 1),
      current_installment: String(t.current_installment || 1),
      recurrence_frequency: t.recurrence_frequency || '', notes: t.notes || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (confirm('Remover esta transação?')) { await api.delete(`/financial/transactions/${id}`); loadTransactions(); }
  };

  const totalReceitas = transactions.filter(t => t.type === 'receita').reduce((acc, t) => acc + t.amount, 0);
  const totalDespesas = transactions.filter(t => t.type === 'despesa').reduce((acc, t) => acc + t.amount, 0);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Financeiro</h1>
        <button onClick={() => { setEditing(null); setForm(getEmptyForm()); setShowModal(true); }}
          className="bg-brand-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-brand-700">
          <Plus size={18} /> Nova Transação
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-green-50 rounded-xl p-4 flex items-center gap-3">
          <TrendingUp className="text-green-600" size={24} />
          <div><div className="text-sm text-green-600">Receitas</div><div className="text-xl font-bold text-green-700">{formatCurrency(totalReceitas)}</div></div>
        </div>
        <div className="bg-red-50 rounded-xl p-4 flex items-center gap-3">
          <TrendingDown className="text-red-600" size={24} />
          <div><div className="text-sm text-red-600">Despesas</div><div className="text-xl font-bold text-red-700">{formatCurrency(totalDespesas)}</div></div>
        </div>
        <div className="bg-brand-50 rounded-xl p-4 flex items-center gap-3">
          <div><div className="text-sm text-brand-600">Saldo</div><div className="text-xl font-bold text-brand-700">{formatCurrency(totalReceitas - totalDespesas)}</div></div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <div className="flex gap-2">
          {[{ v: '', l: 'Todos' }, { v: 'receita', l: 'Receitas' }, { v: 'despesa', l: 'Despesas' }].map(f => (
            <button key={f.v} onClick={() => setFilter(f.v)}
              className={`px-3 py-1 rounded-lg text-sm ${filter === f.v ? 'bg-brand-600 text-white' : 'bg-white border hover:bg-gray-50'}`}>
              {f.l}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <select value={contactFilter} onChange={e => setContactFilter(e.target.value)}
            className="px-3 py-1 border rounded-lg text-sm max-w-[180px]">
            <option value="">Fornecedor/Cliente</option>
            {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <label className="text-sm text-gray-500">Período:</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            max={endDate || undefined}
            className="px-3 py-1 border rounded-lg text-sm" />
          <span className="text-gray-400">até</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
            min={startDate || undefined}
            className="px-3 py-1 border rounded-lg text-sm" />
        </div>
      </div>

      <div className="flex items-center gap-3 mb-3 pl-1">
        <span className="text-xs text-gray-400 font-medium mr-1">Legenda:</span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
          <AlertTriangle size={11} /> Vencido
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700">
          <Clock size={11} /> Próximo (até 3d)
        </span>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <SortableHeader label="Lançamento" sortKey="date" currentSort={sortConfig} onSort={handleSort} />
              <SortableHeader label="Vencimento" sortKey="due_date" currentSort={sortConfig} onSort={handleSort} />
              <SortableHeader label="Descrição" sortKey="description" currentSort={sortConfig} onSort={handleSort} />
              <th className="p-3 text-xs font-semibold text-gray-500 uppercase text-left">Contato</th>
              <SortableHeader label="Categoria" sortKey="financial_category_id" currentSort={sortConfig} onSort={handleSort} />
              <SortableHeader label="Pagamento" sortKey="payment_type_id" currentSort={sortConfig} onSort={handleSort} />
              <SortableHeader label="Conta" sortKey="account_id" currentSort={sortConfig} onSort={handleSort} />
              <SortableHeader label="Tipo" sortKey="type" currentSort={sortConfig} onSort={handleSort} align="center" />
              <th className="text-center p-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
              <SortableHeader label="Valor" sortKey="amount" currentSort={sortConfig} onSort={handleSort} align="right" />
              <th className="text-center p-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {displayTransactions.map(t => (
              <tr key={t.id} className="border-t hover:bg-gray-50">
                <td className="p-3 whitespace-nowrap text-gray-500">{new Date(t.date).toLocaleDateString('pt-BR')}</td>
                <td className="p-3 whitespace-nowrap">
                  {t.due_date ? (
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{new Date(t.due_date).toLocaleDateString('pt-BR')}</span>
                      {(() => {
                        const info = dueDaysInfo(t);
                        if (!info) return null;
                        const Icon = info.isOverdue ? AlertTriangle : Clock;
                        return (
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${info.cls}`}>
                            <Icon size={11} />
                            {info.label}
                          </span>
                        );
                      })()}
                    </div>
                  ) : <span className="text-gray-300">-</span>}
                </td>
                <td className="p-3">
                  <div className="font-medium">{t.description}</div>
                  {t.installments > 1 && (
                    <div className="text-xs text-gray-400 flex items-center gap-1.5 mt-0.5">
                      {t.recurrence_frequency && <Repeat size={10} />}
                      <span className="font-medium">{t.current_installment}/{t.installments}x</span>
                      {t.recurrence_frequency && (
                        <span className="bg-brand-50 text-brand-600 px-1.5 py-0.5 rounded">
                          {frequencyLabels[t.recurrence_frequency]}
                        </span>
                      )}
                    </div>
                  )}
                </td>
                <td className="p-3 text-gray-500">{t.contact?.name || '-'}</td>
                <td className="p-3 text-gray-500">{t.financial_category?.name || '-'}</td>
                <td className="p-3 text-gray-500">{t.payment_type?.name || '-'}</td>
                <td className="p-3 text-gray-500 text-xs">
                  {t.account ? (
                    <div className="flex items-center gap-1.5">
                      {(() => {
                        const TIcon = accountTypeIcons[t.account.account_type] || Landmark;
                        const tColor = accountTypeColors[t.account.account_type] || 'text-gray-600';
                        return <TIcon size={14} className={tColor} />;
                      })()}
                      <span className="truncate max-w-[80px]">{t.account.name}</span>
                    </div>
                  ) : '-'}
                </td>
                <td className="p-3 text-center">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${t.type === 'receita' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {t.type === 'receita' ? 'Receita' : 'Despesa'}
                  </span>
                </td>
                <td className="p-3 text-center">
                  {(() => {
                    const totalPaid = (t.payments || []).reduce((s, p) => s + p.amount, 0);
                    const status = t.status || 'pendente';
                    const statusConfig = {
                      pendente: { label: 'Pendente', cls: 'bg-yellow-100 text-yellow-700' },
                      pago_parcial: { label: `Parcial ${formatCurrency(totalPaid)}`, cls: 'bg-orange-100 text-orange-700' },
                      pago: { label: 'Pago', cls: 'bg-green-100 text-green-700' },
                      recebido: { label: 'Recebido', cls: 'bg-brand-100 text-brand-700' },
                    };
                    const cfg = statusConfig[status] || statusConfig.pendente;
                    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${cfg.cls}`}>{cfg.label}</span>;
                  })()}
                </td>
                <td className={`p-3 text-right font-medium whitespace-nowrap ${t.type === 'receita' ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(t.amount)}
                </td>
                <td className="p-3 text-center whitespace-nowrap">
                  {(t.status === 'pendente' || t.status === 'pago_parcial') && (
                    <button onClick={() => openPaymentModal(t)}
                      className="text-green-600 hover:text-green-800 mr-2 text-xs font-medium" title="Registrar pagamento">
                      Baixar
                    </button>
                  )}
                  <button onClick={() => handleEdit(t)} className="text-brand-600 hover:text-brand-800 mr-2"><Edit size={16} /></button>
                  <button onClick={() => handleDelete(t.id)} className="text-red-600 hover:text-red-800"><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-auto">
            <h2 className="text-lg font-bold mb-4">{editing ? 'Editar' : 'Nova'} Transação</h2>
            <form onSubmit={handleSubmit} className="space-y-4">

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Tipo *</label>
                  <select value={form.type} onChange={e => setForm({...form, type: e.target.value, financial_category_id: '', subcategory_id: ''})}
                    className="w-full px-3 py-2 border rounded-lg text-sm">
                    <option value="receita">Receita</option>
                    <option value="despesa">Despesa</option>
                  </select>
                </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Data Lançamento *</label>
                <input type="date" value={form.date} onChange={e => handleDateChange(e.target.value)}
                  max={getTodayLocal()}
                  className="w-full px-3 py-2 border rounded-lg text-sm" required />
                {isCreditCard && <p className="text-xs text-purple-500 mt-1">Data em que a compra foi realizada</p>}
              </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Descrição *</label>
                <CaseInput placeholder="Ex: Pagamento fornecedor, Venda produto..." value={form.description}
                  onChange={e => setForm({...form, description: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg text-sm" required />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Valor (R$) *</label>
                <input type="text" inputMode="decimal" placeholder="0,00" value={form.amount}
                  onChange={e => setForm({...form, amount: formatDigitsToCurrency(currencyToDigits(e.target.value), 2)})}
                  className="w-full px-3 py-2 border rounded-lg text-sm" required />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Categoria</label>
                  <SearchableSelect options={categoryOptions} value={form.financial_category_id ? parseInt(form.financial_category_id) : ''}
                    onChange={val => setForm({...form, financial_category_id: val ? String(val) : '', subcategory_id: ''})}
                    placeholder="Selecione..." />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Subcategoria</label>
                  <SearchableSelect options={subcategoryOptions} value={form.subcategory_id ? parseInt(form.subcategory_id) : ''}
                    onChange={val => setForm({...form, subcategory_id: val ? String(val) : ''})}
                    placeholder={form.financial_category_id ? "Selecione..." : "Selecione a categoria primeiro"}
                    disabled={!form.financial_category_id} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Tipo de Pagamento</label>
                  <SearchableSelect options={paymentTypeOptions} value={form.payment_type_id ? parseInt(form.payment_type_id) : ''}
                    onChange={val => setForm({...form, payment_type_id: val ? String(val) : '', installments: '1', current_installment: '1', recurrence_frequency: ''})}
                    placeholder="Selecione..." />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Conta / Cartão</label>
                  <SearchableSelect options={accountOptions} value={form.account_id ? parseInt(form.account_id) : ''}
                    onChange={val => handleAccountChange(val)}
                    renderOption={renderAccountOption}
                    renderSelected={renderAccountSelected}
                    placeholder="Selecione..." />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Contato</label>
                <SearchableSelect options={contactOptions} value={form.contact_id ? parseInt(form.contact_id) : ''}
                  onChange={val => setForm({...form, contact_id: val ? String(val) : ''})}
                  placeholder="Selecione..." />
              </div>

              {isCreditCard ? (
                <div className="bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 space-y-1">
                  <div className="text-xs text-purple-700 flex items-center gap-2">
                    <Calendar size={12} />
                    <span>
                      {selectedAccount ? (
                        <>
                          <strong>{selectedAccount.name}</strong>
                          {selectedAccount.flag && ` (${selectedAccount.flag})`}
                          {selectedAccount.closing_day && selectedAccount.due_day
                            ? ` — fecha dia ${selectedAccount.closing_day} / vence dia ${selectedAccount.due_day}`
                            : ''
                          }
                        </>
                      ) : (
                        'Selecione um cartão na Conta/Cartão para calcular o vencimento'
                      )}
                    </span>
                  </div>
                  {calculatedDueDate && (
                    <div className="text-xs text-purple-600">
                      Vencimento calculado: <strong>{new Date(calculatedDueDate + 'T12:00:00').toLocaleDateString('pt-BR')}</strong>
                      <span className="text-purple-400 ml-1">(compra {form.date && new Date(form.date).getDate() > selectedAccount.closing_day ? 'após' : 'antes'} do fechamento)</span>
                    </div>
                  )}
                  {!selectedAccount?.closing_day && selectedAccount && (
                    <div className="text-xs text-amber-600">
                      Configure fechamento e vencimento na tela de Contas
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Data Vencimento</label>
                  <input type="date" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg text-sm" />
                  <p className="text-xs text-gray-400 mt-1">Data em que a parcela vence</p>
                </div>
              )}

              {showInstallments && (
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1">
                    <Calendar size={12} /> Parcelamento
                  </p>

                  <div className={`grid gap-3 ${installmentCount > 1 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Parcela Inicial</label>
                      <input type="number" min="1" max={parseInt(form.installments) || 60} value={form.current_installment}
                        onChange={e => setForm({...form, current_installment: e.target.value})}
                        className="w-full px-3 py-2 border rounded-lg text-sm" />
                      <p className="text-xs text-gray-400 mt-0.5">Nº desta parcela</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Total de Parcelas</label>
                      <input type="number" min="1" max="60" value={form.installments}
                        onChange={e => {
                          const val = e.target.value;
                          const newForm = {...form, installments: val};
                          const defaultFreq = frequencyOptions.find(f => f.value === 'mensal')?.value || frequencyOptions[0]?.value || '';
                          if (parseInt(val) <= 1) newForm.recurrence_frequency = '';
                          else if (isCreditCard && !newForm.recurrence_frequency) newForm.recurrence_frequency = defaultFreq;
                          setForm(newForm);
                        }}
                        className="w-full px-3 py-2 border rounded-lg text-sm" />
                    </div>
                    {installmentCount > 1 && (
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Frequência *</label>
                        <select value={form.recurrence_frequency} onChange={e => setForm({...form, recurrence_frequency: e.target.value})}
                          className="w-full px-3 py-2 border rounded-lg text-sm" required>
                          <option value="">Selecione...</option>
                          {frequencyOptions.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                        </select>
                      </div>
                    )}
                  </div>

                  {installmentValue && (
                    <div className="bg-white rounded-lg p-3 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Valor total:</span>
                        <span className="font-medium">{formatCurrency(parseCurrencyToNumber(form.amount, 2))}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Valor da parcela:</span>
                        <span className="font-bold text-brand-700">{formatCurrency(installmentValue)}</span>
                      </div>
                      {form.recurrence_frequency && effectiveDueDate && (
                        <div className="border-t pt-2 mt-2">
                          <p className="text-xs font-medium text-gray-500 mb-1">
                            Cronograma (a partir do vencimento):
                          </p>
                          <div className="space-y-1 max-h-40 overflow-auto">
                            {installmentDates.map((d, i) => {
                              const num = startInstallment + i;
                              return (
                                <div key={i} className={`flex justify-between text-xs px-2 py-1 rounded ${num === startInstallment ? 'bg-brand-50 text-brand-700 font-medium' : 'text-gray-600'}`}>
                                  <span>{num}ª parcela{num === startInstallment ? ' (atual)' : ''}</span>
                                  <span>{d.toLocaleDateString('pt-BR')}</span>
                                  <span>{formatCurrency(installmentValue)}</span>
                                </div>
                              );
                            })}
                            {startInstallment + installmentDates.length - 1 < installmentCount && (
                              <p className="text-xs text-gray-400 text-center">
                                ... mais {installmentCount - startInstallment - installmentDates.length + 1} parcelas
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Observações</label>
                <CaseTextarea placeholder="Notas adicionais..." value={form.notes} rows={2}
                  onChange={e => setForm({...form, notes: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>

              {submitError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {submitError}
                </div>
              )}

              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-lg text-sm">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPaymentModal && payingTransaction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm max-h-[90vh] overflow-auto">
            <h2 className="text-lg font-bold mb-4">Registrar Pagamento</h2>
            <div className="mb-3 text-sm text-gray-600">
              <p><strong>{payingTransaction.description}</strong></p>
              <p>Valor total: {formatCurrency(payingTransaction.amount)}</p>
              {payingTransaction.payments?.length > 0 && (
                <p>Já pago: {formatCurrency(payingTransaction.payments.reduce((s, p) => s + p.amount, 0))}</p>
              )}
            </div>
            <form onSubmit={handlePaymentSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Valor a pagar *</label>
                <input type="text" inputMode="decimal" min="0.01"
                  value={paymentForm.amount}
                  onChange={e => setPaymentForm({...paymentForm, amount: formatDigitsToCurrency(currencyToDigits(e.target.value), 2)})}
                  className="w-full px-3 py-2 border rounded-lg text-sm" required />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Data do pagamento *</label>
                <input type="date" value={paymentForm.payment_date}
                  onChange={e => setPaymentForm({...paymentForm, payment_date: e.target.value})}
                  max={getTodayLocal()}
                  className="w-full px-3 py-2 border rounded-lg text-sm" required />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Juros / Multa</label>
                <input type="text" inputMode="decimal" placeholder="0,00"
                  value={paymentForm.interest}
                  onChange={e => setPaymentForm({...paymentForm, interest: formatDigitsToCurrency(currencyToDigits(e.target.value), 2)})}
                  className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Observação</label>
                <CaseInput type="text" placeholder="Nota opcional..."
                  value={paymentForm.notes}
                  onChange={e => setPaymentForm({...paymentForm, notes: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={() => { setShowPaymentModal(false); setPayingTransaction(null); }}
                  className="px-4 py-2 border rounded-lg text-sm">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">Confirmar Pagamento</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
