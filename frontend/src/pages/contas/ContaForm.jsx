import { CreditCard, Landmark, Wallet } from 'lucide-react';
import { CaseInput } from '../../components/CaseInput';
import { currencyToDigits, formatDigitsToCurrency } from '../../services/masks';
import ContaCamposCartao from './ContaCamposCartao';

const typeConfig = {
  banco: { icon: Landmark, color: 'bg-brand-100 text-brand-600', isCard: false, showBank: true },
  caixa: { icon: Wallet, color: 'bg-green-100 text-green-600', isCard: false, showBank: false },
  cartao_credito: { icon: CreditCard, color: 'bg-purple-100 text-purple-600', isCard: true, showBank: true },
};

export default function ContaForm({ open, editing, form, setForm, onSubmit, onCancel }) {
  if (!open) return null;

  const config = typeConfig[form.account_type] || typeConfig.banco;
  const HeaderIcon = config.icon;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-auto shadow-2xl">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
          <div className={`p-2 rounded-xl ${config.color}`}><HeaderIcon size={20} /></div>
          <h2 className="text-lg font-bold text-gray-900">{editing ? 'Editar' : 'Nova'} Conta</h2>
        </div>

        <form onSubmit={onSubmit}>
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

            {config.showBank && (
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
                <label className="block text-xs font-medium text-gray-500 mb-1">{config.isCard ? 'Final do Cartão' : 'Nº Conta'}</label>
                <input placeholder={config.isCard ? 'Ex: 1234' : 'Ex: 12345-6'} value={form.account_number}
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

            {config.isCard && <ContaCamposCartao form={form} setForm={setForm} />}
          </div>

          <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2 bg-gray-50 rounded-b-2xl">
            <button type="button" onClick={onCancel}
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
  );
}
