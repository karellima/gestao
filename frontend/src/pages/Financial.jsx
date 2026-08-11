import { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../services/api';
import { formatCurrency, getTodayLocal } from '../services/format';
import { parseCurrencyToNumber, formatNumberToCurrency } from '../services/masks';
import { Plus, TrendingUp, TrendingDown, Landmark, Wallet, CreditCard, AlertTriangle, Clock } from 'lucide-react';
import FinancialTransactionTable from '../components/FinancialTransactionTable';
import FinancialTransactionForm from '../components/FinancialTransactionForm';
import FinancialPaymentModal from '../components/FinancialPaymentModal';

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

      <FinancialTransactionTable
        transactions={displayTransactions}
        sortConfig={sortConfig}
        onSort={handleSort}
        frequencyLabels={frequencyLabels}
        accountTypeIcons={accountTypeIcons}
        accountTypeColors={accountTypeColors}
        onPay={openPaymentModal}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {showModal && <FinancialTransactionForm
        editing={editing}
        form={form}
        setForm={setForm}
        onSubmit={handleSubmit}
        onClose={() => setShowModal(false)}
        categoryOptions={categoryOptions}
        subcategoryOptions={subcategoryOptions}
        paymentTypeOptions={paymentTypeOptions}
        accountOptions={accountOptions}
        contactOptions={contactOptions}
        renderAccountOption={renderAccountOption}
        renderAccountSelected={renderAccountSelected}
        onAccountChange={handleAccountChange}
        onDateChange={handleDateChange}
        isCreditCard={isCreditCard}
        selectedAccount={selectedAccount}
        calculatedDueDate={calculatedDueDate}
        showInstallments={showInstallments}
        frequencyOptions={frequencyOptions}
        installmentCount={installmentCount}
        installmentValue={installmentValue}
        startInstallment={startInstallment}
        installmentDates={installmentDates}
        effectiveDueDate={effectiveDueDate}
        submitError={submitError}
      />}

      {showPaymentModal && payingTransaction && <FinancialPaymentModal
        transaction={payingTransaction}
        form={paymentForm}
        setForm={setPaymentForm}
        onSubmit={handlePaymentSubmit}
        onClose={() => { setShowPaymentModal(false); setPayingTransaction(null); }}
      />}
    </div>
  );
}
