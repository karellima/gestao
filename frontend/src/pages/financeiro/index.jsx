import { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../../services/api';
import { useNotificacao } from '../../contexts/NotificacaoContext';
import { formatCurrency, getTodayLocal } from '../../services/format';
import { parseCurrencyToNumber, formatNumberToCurrency } from '../../services/masks';
import { Plus, TrendingUp, TrendingDown, Landmark, Wallet, CreditCard, AlertTriangle, Clock } from 'lucide-react';
import FinancialTransactionTable from '../../components/FinancialTransactionTable';
import FinancialTransactionForm from '../../components/FinancialTransactionForm';
import FinancialPaymentModal from '../../components/FinancialPaymentModal';
import { sortTransactions } from './ordenacao';
import { getEmptyForm, buildTransactionPayload, mapTransactionToForm, formatSubmitError } from './transacao-form';
import { deriveFormState, applyAccountChange, applyDateChange } from './form-derivado';

const accountTypeIcons = { banco: Landmark, caixa: Wallet, cartao_credito: CreditCard };
const accountTypeColors = { banco: 'text-brand-600', caixa: 'text-green-600', cartao_credito: 'text-purple-600' };

function renderAccountOption(opt) {
  const Icon = accountTypeIcons[opt.data.account_type] || Landmark;
  const color = accountTypeColors[opt.data.account_type] || 'text-gray-600';
  return (
    <div className="flex items-center gap-2">
      <Icon size={18} className={color} />
      <span className="flex-1">{opt.data.name}</span>
    </div>
  );
}

function renderAccountSelected(opt) {
  const Icon = accountTypeIcons[opt.data.account_type] || Landmark;
  const color = accountTypeColors[opt.data.account_type] || 'text-gray-600';
  return (
    <div className="flex items-center gap-2">
      <Icon size={16} className={color} />
      <span>{opt.data.name}</span>
    </div>
  );
}

export default function Financial() {
  const { notificar } = useNotificacao();
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

  const derived = useMemo(
    () => deriveFormState(form, { categories, accounts, paymentTypes, frequencies }),
    [form, categories, accounts, paymentTypes, frequencies]
  );
  const contactOptions = contacts.filter(c => c.is_active).map(c => ({ value: c.id, label: c.name }));

  const sortedTransactions = useMemo(
    () => sortTransactions(transactions, sortConfig),
    [transactions, sortConfig]
  );

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
      const data = buildTransactionPayload(form, {
        effectiveDueDate: derived.effectiveDueDate,
        showInstallments: derived.showInstallments,
      });
      if (editing) await api.put(`/financial/transactions/${editing.id}`, data);
      else await api.post('/financial/transactions/', data);
      setShowModal(false); setEditing(null); setForm(getEmptyForm()); setSubmitError(''); loadTransactions();
    } catch (err) {
      setSubmitError(formatSubmitError(err));
    }
  };

  const openPaymentModal = (t) => {
    const totalPaid = (t.payments || []).reduce((s, p) => s + p.amount, 0);
    setPayingTransaction(t);
    setPaymentForm({
      amount: formatNumberToCurrency(t.amount - totalPaid, 2),
      interest: '',
      payment_date: getTodayLocal(),
      notes: '',
    });
    setShowPaymentModal(true);
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/payments/', {
        transaction_id: payingTransaction.id,
        amount: parseCurrencyToNumber(paymentForm.amount, 2),
        interest: parseCurrencyToNumber(paymentForm.interest, 2),
        payment_date: new Date(paymentForm.payment_date + 'T12:00:00').toISOString(),
        notes: paymentForm.notes || null,
      });
      setShowPaymentModal(false); setPayingTransaction(null); loadTransactions();
    } catch (err) {
      const detail = err.response?.data?.detail;
      notificar.erro(detail || 'Erro ao registrar pagamento');
    }
  };

  const handleEdit = (t) => {
    setEditing(t);
    setForm(mapTransactionToForm(t, categories));
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (confirm('Remover esta transação?')) {
      await api.delete(`/financial/transactions/${id}`);
      loadTransactions();
    }
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
            max={endDate || undefined} className="px-3 py-1 border rounded-lg text-sm" />
          <span className="text-gray-400">até</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
            min={startDate || undefined} className="px-3 py-1 border rounded-lg text-sm" />
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
        frequencyLabels={derived.frequencyLabels}
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
        categoryOptions={derived.categoryOptions}
        subcategoryOptions={derived.subcategoryOptions}
        paymentTypeOptions={derived.paymentTypeOptions}
        accountOptions={derived.accountOptions}
        contactOptions={contactOptions}
        renderAccountOption={renderAccountOption}
        renderAccountSelected={renderAccountSelected}
        onAccountChange={(id) => setForm(applyAccountChange(form, accounts, id))}
        onDateChange={(d) => setForm(applyDateChange(form, derived.selectedAccount, d))}
        isCreditCard={derived.isCreditCard}
        selectedAccount={derived.selectedAccount}
        calculatedDueDate={derived.calculatedDueDate}
        showInstallments={derived.showInstallments}
        frequencyOptions={derived.frequencyOptions}
        installmentCount={derived.installmentCount}
        installmentValue={derived.installmentValue}
        startInstallment={derived.startInstallment}
        installmentDates={derived.installmentDates}
        effectiveDueDate={derived.effectiveDueDate}
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
