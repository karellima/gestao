import { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../services/api';
import { formatCurrency } from '../services/format';
import { currencyToDigits, formatDigitsToCurrency, parseCurrencyToNumber, formatNumberToCurrency } from '../services/masks';
import { Plus, Edit, Trash2, CreditCard, Landmark, Wallet } from 'lucide-react';
import { CaseInput } from '../components/CaseInput';

const typeConfig = {
  banco: { label: 'Banco', icon: Landmark, color: 'bg-brand-100 text-brand-600' },
  caixa: { label: 'Caixa', icon: Wallet, color: 'bg-green-100 text-green-600' },
  cartao_credito: { label: 'Cartão de Crédito', icon: CreditCard, color: 'bg-purple-100 text-purple-600' },
};

const flagOptions = ['Visa', 'Mastercard', 'Elo', 'Amex', 'Hipercard', 'Aura', 'Outro'];

const emptyForm = {
  name: '', account_type: 'banco', bank_name: '', agency: '', account_number: '', balance: '',
  flag: '', closing_day: '', due_day: '', best_purchase_day: '', credit_limit: '',
};

export default function Accounts() {
  const [accounts, setAccounts] = useState([]);
  const [filter, setFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(() => {
    const params = filter ? { account_type: filter } : {};
    api.get('/accounts/', { params }).then(res => setAccounts(res.data)).catch(() => {});
  }, [filter]);
  useEffect(() => { load(); }, [load]);

  const sortedAccounts = useMemo(() =>
    [...accounts].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [accounts]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...form,
        balance: parseCurrencyToNumber(form.balance, 2),
        closing_day: form.closing_day ? parseInt(form.closing_day) : null,
        due_day: form.due_day ? parseInt(form.due_day) : null,
        best_purchase_day: form.best_purchase_day ? parseInt(form.best_purchase_day) : null,
        credit_limit: form.credit_limit ? parseCurrencyToNumber(form.credit_limit, 2) : null,
        flag: form.flag || null,
      };
      if (editing) { await api.put(`/accounts/${editing.id}`, data); }
      else { await api.post('/accounts/', data); }
      setShowModal(false); setEditing(null); setForm(emptyForm); load();
    } catch (err) {
      alert(err.response?.data?.detail || 'Erro ao salvar conta');
    }
  };

  const handleEdit = (a) => {
    setEditing(a);
    setForm({
      name: a.name, account_type: a.account_type, bank_name: a.bank_name || '',
      agency: a.agency || '', account_number: a.account_number || '', balance: a.balance != null ? formatNumberToCurrency(a.balance, 2) : '',
      flag: a.flag || '', closing_day: a.closing_day ?? '', due_day: a.due_day ?? '',
      best_purchase_day: a.best_purchase_day ?? '', credit_limit: a.credit_limit != null ? formatNumberToCurrency(a.credit_limit, 2) : '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Remover?')) return;
    try { await api.delete(`/accounts/${id}`); load(); }
    catch (err) { alert(err.response?.data?.detail || 'Erro ao remover conta'); }
  };

  const isCreditCard = form.account_type === 'cartao_credito';

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Contas e Cartões de Crédito</h1>
        <button onClick={() => { setEditing(null); setForm(emptyForm); setShowModal(true); }}
          className="bg-brand-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-brand-700">
          <Plus size={18} /> Nova Conta
        </button>
      </div>

      <div className="flex gap-2 mb-4">
        {[{ v: '', l: 'Todas' }, { v: 'banco', l: 'Bancos' }, { v: 'caixa', l: 'Caixa' }, { v: 'cartao_credito', l: 'Cartões' }].map(f => (
          <button key={f.v} onClick={() => setFilter(f.v)}
            className={`px-3 py-1 rounded-lg text-sm ${filter === f.v ? 'bg-brand-600 text-white' : 'bg-white border hover:bg-gray-50'}`}>
            {f.l}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedAccounts.map(a => {
          const cfg = typeConfig[a.account_type] || typeConfig.banco;
          const Icon = cfg.icon;
          return (
            <div key={a.id} className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
              <div className="bg-gray-50 px-5 py-4 flex items-center gap-3 border-b border-gray-100">
                <div className={`p-2.5 rounded-xl ${cfg.color}`}><Icon size={22} /></div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900 truncate">{a.name}</div>
                  <div className="text-xs text-gray-400">{cfg.label}</div>
                </div>
              </div>
              <div className="px-5 py-3">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                  {a.flag && (
                    <div>
                      <span className="text-gray-400 text-xs">Bandeira</span>
                      <div className="text-gray-700">{a.flag}</div>
                    </div>
                  )}
                  {a.account_type !== 'cartao_credito' && a.agency && (
                    <div>
                      <span className="text-gray-400 text-xs">Agência</span>
                      <div className="text-gray-700">{a.agency}</div>
                    </div>
                  )}
                  {a.account_number && (
                    <div>
                      <span className="text-gray-400 text-xs">{a.account_type === 'cartao_credito' ? 'Final' : 'Conta'}</span>
                      <div className="text-gray-700 font-mono">{a.account_number}</div>
                    </div>
                  )}
                  {a.account_type === 'cartao_credito' && (
                    <>
                      {a.closing_day && (
                        <div>
                          <span className="text-gray-400 text-xs">Fechamento</span>
                          <div className="text-gray-700">Dia {a.closing_day}</div>
                        </div>
                      )}
                      {a.due_day && (
                        <div>
                          <span className="text-gray-400 text-xs">Vencimento</span>
                          <div className="text-gray-700">Dia {a.due_day}</div>
                        </div>
                      )}
                      {a.best_purchase_day && (
                        <div>
                          <span className="text-gray-400 text-xs">Melhor Dia</span>
                          <div className="text-gray-700">Dia {a.best_purchase_day}</div>
                        </div>
                      )}
                      {a.credit_limit != null && (
                        <div>
                          <span className="text-gray-400 text-xs">Limite</span>
                          <div className="text-gray-700">{formatCurrency(a.credit_limit)}</div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
              <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
                <div>
                  <span className="text-xs text-gray-400">Saldo</span>
                  <div className={`text-lg font-bold ${a.balance >= 0 ? 'text-brand-700' : 'text-red-600'}`}>
                    {formatCurrency(a.balance)}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => handleEdit(a)}
                    className="p-2 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
                    <Edit size={16} />
                  </button>
                  <button onClick={() => handleDelete(a.id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-auto shadow-2xl">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
              <div className={`p-2 rounded-xl ${isCreditCard ? 'bg-purple-100 text-purple-600' : form.account_type === 'caixa' ? 'bg-green-100 text-green-600' : 'bg-brand-100 text-brand-600'}`}>
                {isCreditCard ? <CreditCard size={20} /> : form.account_type === 'caixa' ? <Wallet size={20} /> : <Landmark size={20} />}
              </div>
              <h2 className="text-lg font-bold text-gray-900">{editing ? 'Editar' : 'Nova'} Conta</h2>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="px-6 py-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Tipo *</label>
                    <select value={form.account_type} onChange={e => setForm({...form, account_type: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none">
                      <option value="banco">Banco</option>
                      <option value="caixa">Caixa</option>
                      <option value="cartao_credito">Cartão de Crédito</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Nome *</label>
                    <CaseInput placeholder="Ex: Itaú Corrente, Nubank..." value={form.name}
                      onChange={e => setForm({...form, name: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none" required />
                  </div>
                </div>

                {form.account_type !== 'caixa' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Banco</label>
                      <CaseInput placeholder="Ex: Itaú, Bradesco, BB..." value={form.bank_name}
                        onChange={e => setForm({...form, bank_name: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Agência</label>
                      <input placeholder="Ex: 0001" value={form.agency}
                        onChange={e => setForm({...form, agency: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none" />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">{isCreditCard ? 'Final do Cartão' : 'Nº Conta'}</label>
                    <input placeholder={isCreditCard ? 'Ex: 1234' : 'Ex: 12345-6'} value={form.account_number}
                      onChange={e => setForm({...form, account_number: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Saldo Inicial</label>
                    <input type="text" inputMode="decimal" placeholder="0,00" value={form.balance}
                      onChange={e => setForm({...form, balance: formatDigitsToCurrency(currencyToDigits(e.target.value), 2)})}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none" />
                  </div>
                </div>

                {isCreditCard && (
                  <div className="border-t border-gray-100 pt-4 mt-2">
                    <div className="flex items-center gap-2 mb-3">
                      <CreditCard size={14} className="text-purple-500" />
                      <p className="text-xs font-semibold text-purple-600 uppercase tracking-wide">Dados do Cartão</p>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Bandeira</label>
                        <select value={form.flag} onChange={e => setForm({...form, flag: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none">
                          <option value="">Selecione a bandeira...</option>
                          {flagOptions.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Fechamento</label>
                          <input type="number" min="1" max="31" placeholder="Dia" value={form.closing_day}
                            onChange={e => setForm({...form, closing_day: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Vencimento</label>
                          <input type="number" min="1" max="31" placeholder="Dia" value={form.due_day}
                            onChange={e => setForm({...form, due_day: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Melhor Dia</label>
                          <input type="number" min="1" max="31" placeholder="Dia" value={form.best_purchase_day}
                            onChange={e => setForm({...form, best_purchase_day: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Limite Disponível (R$)</label>
                        <input type="text" inputMode="decimal" placeholder="0,00" value={form.credit_limit}
                          onChange={e => setForm({...form, credit_limit: formatDigitsToCurrency(currencyToDigits(e.target.value), 2)})}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2 bg-gray-50 rounded-b-2xl">
                <button type="button" onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">
                  Cancelar
                </button>
                <button type="submit"
                  className="px-5 py-2.5 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors shadow-sm">
                  {editing ? 'Atualizar' : 'Criar Conta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
