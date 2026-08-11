import { useState, useEffect } from 'react';
import api from '../services/api';
import { formatCurrency } from '../services/format';
import { Package, AlertTriangle, DollarSign, TrendingUp, TrendingDown, Users, Clock, AlertOctagon, Receipt, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const COLORS = ['#0D9488', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16'];

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

  const despPie = Object.entries(data.despesas_por_categoria || {}).map(([name, valor]) => ({ name, valor }));
  const recPie = Object.entries(data.receitas_por_categoria || {}).map(([name, valor]) => ({ name, valor }));

  const StatCard = ({ stat }) => (
    <div className="bg-white rounded-xl p-5 shadow-sm flex items-center gap-4">
      <div className={`${stat.color} p-3 rounded-lg text-white`}>
        <stat.icon size={24} />
      </div>
      <div>
        <div className="text-sm text-gray-500">{stat.label}</div>
        <div className="text-xl font-bold">{stat.value}</div>
      </div>
    </div>
  );

  const PopupList = ({ list, borderColor, label }) => (
    list && list.length > 0 && (
      <div className={`absolute z-50 left-0 top-full mt-0 bg-white border ${borderColor} rounded-xl shadow-lg p-3 hidden group-hover:block min-w-[300px]`}>
        <p className="text-xs font-semibold text-gray-500 uppercase mb-2">{label}</p>
        {list.slice(0, 5).map(t => {
          const due = t.due_date ? new Date(t.due_date.replace('T', ' ')) : null;
          const diff = due ? Math.floor((new Date() - due) / (1000 * 60 * 60 * 24)) : 0;
          return (
            <div key={t.id} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0 text-sm">
              <div className="flex-1 min-w-0 mr-3">
                <p className="truncate font-medium text-gray-800">{t.contact || t.description}</p>
                <p className="text-xs text-gray-400">{t.contact && t.description !== t.contact ? t.description : ''}</p>
              </div>
              <div className="text-right whitespace-nowrap">
                <p className="font-semibold text-red-600">{formatCurrency(t.amount)}</p>
                <p className={`text-xs ${diff > 0 ? 'text-red-400' : 'text-gray-400'}`}>{diff > 0 ? `${diff}d atraso` : diff < 0 ? `em ${Math.abs(diff)}d` : 'hoje'}</p>
              </div>
            </div>
          );
        })}
      </div>
    )
  );

  const OverdueSection = ({ title, icon, data, bgColor, textColor, borderColor, popupLabel }) => (
    <div className={`p-3 ${bgColor} rounded-lg relative`}>
      <div className="group relative inline-block">
        <span className={`flex items-center gap-1 ${textColor} font-medium cursor-pointer text-sm`}>
          {icon}{title}
        </span>
        <PopupList list={data?.list} borderColor={borderColor} label={popupLabel || "Top 5 mais atrasados"} />
      </div>
      <div className="flex items-baseline justify-between mt-1">
        <span className="text-lg font-bold">{data ? data.count : 0}</span>
        <span className="font-semibold">{data ? formatCurrency(data.total) : formatCurrency(0)}</span>
      </div>
    </div>
  );

  const statusBadge = (status) => {
    const map = {
      pendente: 'bg-yellow-100 text-yellow-800',
      pago_parcial: 'bg-brand-100 text-brand-800',
      pago: 'bg-green-100 text-green-800',
      recebido: 'bg-green-100 text-green-800',
    };
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[status] || 'bg-gray-100'}`}>{status === 'recebido' ? 'Recebido' : status === 'pago' ? 'Pago' : status === 'pago_parcial' ? 'Parcial' : 'Pendente'}</span>;
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {financialStats.map((stat, i) => <StatCard key={i} stat={stat} />)}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {otherStats.map((stat, i) => <StatCard key={i} stat={stat} />)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {data.monthly_evolution && data.monthly_evolution.length > 0 && (
          <div className="bg-white rounded-xl p-5 shadow-sm lg:col-span-1">
            <h2 className="text-lg font-semibold mb-4">Evolução Mensal</h2>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={data.monthly_evolution}>
                <XAxis dataKey="mes" tickFormatter={(v) => v.slice(5)} />
                <YAxis />
                <Tooltip formatter={(v) => formatCurrency(v)} labelFormatter={(l) => { const [y, m] = l.split('-'); const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']; return `${months[parseInt(m)-1]}/${y}`; }} />
                <Legend />
                <Line type="monotone" dataKey="receitas" stroke="#10B981" strokeWidth={2} name="Receitas" dot={{ r: 4 }} />
                <Line type="monotone" dataKey="despesas" stroke="#EF4444" strokeWidth={2} name="Despesas" dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {despPie.length > 0 && (
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <h2 className="text-lg font-semibold mb-4">Despesas por Categoria</h2>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={despPie} dataKey="valor" nameKey="name" cx="50%" cy="45%" outerRadius={70} label={({ percent }) => `${(percent * 100).toFixed(0)}%`}>
                  {despPie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(value, name) => [formatCurrency(value), name]} labelFormatter={() => ''} />
                <Legend verticalAlign="bottom" height={36} formatter={(value) => <span className="text-xs text-gray-600">{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {recPie.length > 0 && (
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <h2 className="text-lg font-semibold mb-4">Receitas por Categoria</h2>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={recPie} dataKey="valor" nameKey="name" cx="50%" cy="45%" outerRadius={70} label={({ percent }) => `${(percent * 100).toFixed(0)}%`}>
                  {recPie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(value, name) => [formatCurrency(value), name]} labelFormatter={() => ''} />
                <Legend verticalAlign="bottom" height={36} formatter={(value) => <span className="text-xs text-gray-600">{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

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
            <OverdueSection
              title="A Pagar"
              icon={<ArrowDownRight size={16} />}
              data={data.overdue_pagar}
              bgColor="bg-orange-50"
              textColor="text-orange-700"
              borderColor="border-orange-200"
              popupLabel="Top 5 mais atrasados"
            />
            <OverdueSection
              title="A Receber"
              icon={<ArrowUpRight size={16} />}
              data={data.overdue_receber}
              bgColor="bg-green-50"
              textColor="text-green-700"
              borderColor="border-green-200"
              popupLabel="Top 5 mais atrasados"
            />
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border-l-4 border-orange-400">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2 text-orange-700"><Clock size={20} />Vencimentos Próximos</h2>
          <div className="space-y-3">
            <OverdueSection
              title="A Pagar"
              icon={<ArrowDownRight size={16} />}
              data={data.next_pagar}
              bgColor="bg-orange-50"
              textColor="text-orange-700"
              borderColor="border-orange-200"
              popupLabel="Top 5 próximos 7 dias"
            />
            <OverdueSection
              title="A Receber"
              icon={<ArrowUpRight size={16} />}
              data={data.next_receber}
              bgColor="bg-green-50"
              textColor="text-green-700"
              borderColor="border-green-200"
              popupLabel="Top 5 próximos 7 dias"
            />
          </div>
        </div>
      </div>

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
              {data.recent_transactions.map(t => (
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
                  <td className="py-3">{statusBadge(t.status, t.type)}</td>
                </tr>
              ))}
              {data.recent_transactions.length === 0 && (
                <tr><td colSpan="6" className="py-6 text-center text-gray-400">Nenhum lançamento encontrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
