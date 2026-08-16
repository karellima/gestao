import { CreditCard, Edit, Landmark, Trash2, Wallet } from 'lucide-react';
import { formatCurrency } from '../../services/format';

const typeConfig = {
  banco: { label: 'Banco', icon: Landmark, color: 'bg-brand-100 text-brand-600' },
  caixa: { label: 'Caixa', icon: Wallet, color: 'bg-green-100 text-green-600' },
  cartao_credito: { label: 'Cartão de Crédito', icon: CreditCard, color: 'bg-purple-100 text-purple-600' },
};

function ContaCartaoDetalhes({ account }) {
  return (
    <>
      {account.closing_day && (
        <div>
          <span className="text-gray-400 text-xs">Fechamento</span>
          <div className="text-gray-700">Dia {account.closing_day}</div>
        </div>
      )}
      {account.due_day && (
        <div>
          <span className="text-gray-400 text-xs">Vencimento</span>
          <div className="text-gray-700">Dia {account.due_day}</div>
        </div>
      )}
      {account.best_purchase_day && (
        <div>
          <span className="text-gray-400 text-xs">Melhor Dia</span>
          <div className="text-gray-700">Dia {account.best_purchase_day}</div>
        </div>
      )}
      {account.credit_limit != null && (
        <div>
          <span className="text-gray-400 text-xs">Limite</span>
          <div className="text-gray-700">{formatCurrency(account.credit_limit)}</div>
        </div>
      )}
    </>
  );
}

export default function ContaCard({ account, onEdit, onDelete }) {
  const cfg = typeConfig[account.account_type] || typeConfig.banco;
  const Icon = cfg.icon;
  const isCreditCard = account.account_type === 'cartao_credito';

  return (
    <article aria-label={`Conta ${account.name}`} className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      <div className="bg-gray-50 px-5 py-4 flex items-center gap-3 border-b border-gray-100">
        <div className={`p-2.5 rounded-xl ${cfg.color}`}><Icon size={22} /></div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-gray-900 truncate">{account.name}</div>
          <div className="text-xs text-gray-400">{cfg.label}</div>
        </div>
      </div>
      <div className="px-5 py-3">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
          {account.flag && (
            <div>
              <span className="text-gray-400 text-xs">Bandeira</span>
              <div className="text-gray-700">{account.flag}</div>
            </div>
          )}
          {!isCreditCard && account.agency && (
            <div>
              <span className="text-gray-400 text-xs">Agência</span>
              <div className="text-gray-700">{account.agency}</div>
            </div>
          )}
          {account.account_number && (
            <div>
              <span className="text-gray-400 text-xs">{isCreditCard ? 'Final' : 'Conta'}</span>
              <div className="text-gray-700 font-mono">{account.account_number}</div>
            </div>
          )}
          {isCreditCard && <ContaCartaoDetalhes account={account} />}
        </div>
      </div>
      <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
        <div>
          <span className="text-xs text-gray-400">Saldo</span>
          <div className={`text-lg font-bold ${account.balance >= 0 ? 'text-brand-700' : 'text-red-600'}`}>
            {formatCurrency(account.balance)}
          </div>
        </div>
        <div className="flex gap-1">
          <button aria-label={`Editar ${account.name}`} onClick={() => onEdit(account)}
            className="p-2 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
            <Edit size={16} />
          </button>
          <button aria-label={`Excluir ${account.name}`} onClick={() => onDelete(account.id)}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </article>
  );
}
