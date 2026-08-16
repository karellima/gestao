import { ArrowDownRight, ArrowUpRight, Receipt } from 'lucide-react';
import { formatCurrency } from '../../services/format';
import StatusBadge from './StatusBadge';

export default function TabelaDeLancamentos({ transactions }) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Receipt size={20} />Últimos Lançamentos</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b">
              <th className="pb-3 font-medium">Descrição</th>
              <th className="pb-3 font-medium">Tipo</th>
              <th className="pb-3 font-medium">Categoria</th>
              <th className="pb-3 font-medium">Contato</th>
              <th className="pb-3 font-medium">Valor</th>
              <th className="pb-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map(t => (
              <tr key={t.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="py-3">{t.description}</td>
                <td className="py-3">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${t.type === 'receita' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                    {t.type === 'receita' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                    {t.type === 'receita' ? 'Receita' : 'Despesa'}
                  </span>
                </td>
                <td className="py-3 text-gray-600">{t.category || '-'}</td>
                <td className="py-3 text-gray-600">{t.contact || '-'}</td>
                <td className={`py-3 font-medium ${t.type === 'receita' ? 'text-green-600' : 'text-orange-600'}`}>{formatCurrency(t.amount)}</td>
                <td className="py-3"><StatusBadge status={t.status} type={t.type} /></td>
              </tr>
            ))}
            {transactions.length === 0 && (
              <tr><td colSpan="6" className="py-6 text-center text-gray-400">Nenhum lançamento encontrado</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
