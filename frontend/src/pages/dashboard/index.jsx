import { useEffect, useState } from 'react';
import { AlertOctagon, AlertTriangle, ArrowDownRight, ArrowUpRight, Clock, DollarSign, Package, TrendingDown, TrendingUp, Users } from 'lucide-react';
import api from '../../services/api';
import { formatCurrency } from '../../services/format';
import GraficosDoMes from './GraficosDoMes';
import OverdueSection from './OverdueSection';
import PopupList from './PopupList';
import StatCard from './StatCard';
import TabelaDeLancamentos from './TabelaDeLancamentos';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/reports/dashboard')
      .then(res => setData(res.data))
      .catch(() => setError('Erro ao carregar dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64">Carregando...</div>;
  if (error) return <div className="flex items-center justify-center h-64 text-red-500">{error}</div>;
  if (!data) return <div className="flex items-center justify-center h-64">Nenhum dado disponível</div>;

  const financialStats = [
    { label: 'Receitas do Mês', value: formatCurrency(data.monthly_receitas), icon: TrendingUp, color: 'bg-green-500', textColor: 'text-green-700' },
    { label: 'Despesas do Mês', value: formatCurrency(data.monthly_despesas), icon: TrendingDown, color: 'bg-orange-500', textColor: 'text-orange-700' },
    { label: 'Saldo do Mês', value: formatCurrency(data.monthly_balance), icon: DollarSign, color: 'bg-purple-500', textColor: 'text-purple-700' },
  ];
  const otherStats = [
    { label: 'Total Produtos', value: data.total_products, icon: Package, color: 'bg-brand-500' },
    { label: 'Estoque Baixo', value: data.low_stock_products, icon: AlertTriangle, color: 'bg-red-500' },
    { label: 'Total Contatos', value: data.total_contacts, icon: Users, color: 'bg-teal-500' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {financialStats.map((stat, i) => <StatCard key={i} stat={stat} />)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {otherStats.map((stat, i) => <StatCard key={i} stat={stat} />)}
      </div>

      <GraficosDoMes
        monthlyEvolution={data.monthly_evolution}
        despesasPorCategoria={data.despesas_por_categoria}
        receitasPorCategoria={data.receitas_por_categoria}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Contas a Pagar e Receber</h2>
          <div className="space-y-4">
            <div className="group relative flex justify-between items-center p-3 bg-red-50 rounded-lg">
              <span className="flex items-center gap-2 text-red-700 cursor-pointer"><ArrowDownRight size={16} />A Pagar</span>
              <span className="font-bold text-red-700">{formatCurrency(data.a_pagar)}</span>
              <PopupList list={data.a_pagar_list} borderColor="border-red-200" label="Top 5 pendentes do mês" />
            </div>
            <div className="group relative flex justify-between items-center p-3 bg-green-50 rounded-lg">
              <span className="flex items-center gap-2 text-green-700 cursor-pointer"><ArrowUpRight size={16} />A Receber</span>
              <span className="font-bold text-green-700">{formatCurrency(data.a_receber)}</span>
              <PopupList list={data.a_receber_list} borderColor="border-green-200" label="Top 5 pendentes do mês" />
            </div>
            <div className="flex justify-between items-center p-3 bg-brand-50 rounded-lg">
              <span className="flex items-center gap-2 text-brand-700"><DollarSign size={16} />Saldo Previsto</span>
              <span className="font-bold text-brand-700">{formatCurrency(data.a_receber - data.a_pagar)}</span>
            </div>
            <div className="text-xs text-gray-400 text-center pt-1">{data.qtd_pendentes} título(s) pendente(s) no mês</div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border-l-4 border-red-400">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2 text-red-700"><AlertOctagon size={20} />Contas Vencidas</h2>
          <div className="space-y-3">
            <OverdueSection title="A Pagar" icon={<ArrowDownRight size={16} />} data={data.overdue_pagar} bgColor="bg-orange-50" textColor="text-orange-700" borderColor="border-orange-200" popupLabel="Top 5 mais atrasados" />
            <OverdueSection title="A Receber" icon={<ArrowUpRight size={16} />} data={data.overdue_receber} bgColor="bg-green-50" textColor="text-green-700" borderColor="border-green-200" popupLabel="Top 5 mais atrasados" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border-l-4 border-orange-400">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2 text-orange-700"><Clock size={20} />Vencimentos Próximos</h2>
          <div className="space-y-3">
            <OverdueSection title="A Pagar" icon={<ArrowDownRight size={16} />} data={data.next_pagar} bgColor="bg-orange-50" textColor="text-orange-700" borderColor="border-orange-200" popupLabel="Top 5 próximos 7 dias" />
            <OverdueSection title="A Receber" icon={<ArrowUpRight size={16} />} data={data.next_receber} bgColor="bg-green-50" textColor="text-green-700" borderColor="border-green-200" popupLabel="Top 5 próximos 7 dias" />
          </div>
        </div>
      </div>

      <TabelaDeLancamentos transactions={data.recent_transactions} />
    </div>
  );
}
