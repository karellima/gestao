import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { formatCurrency } from '../../services/format';

const COLORS = ['#0D9488', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16'];
const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function MonthlyEvolution({ data }) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm lg:col-span-1">
      <h2 className="text-lg font-semibold mb-4">Evolução Mensal</h2>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data}>
          <XAxis dataKey="mes" tickFormatter={v => v.slice(5)} />
          <YAxis />
          <Tooltip formatter={v => formatCurrency(v)} labelFormatter={l => {
            const [y, m] = l.split('-');
            return `${MONTHS[parseInt(m) - 1]}/${y}`;
          }} />
          <Legend />
          <Line type="monotone" dataKey="receitas" stroke="#10B981" strokeWidth={2} name="Receitas" dot={{ r: 4 }} />
          <Line type="monotone" dataKey="despesas" stroke="#EF4444" strokeWidth={2} name="Despesas" dot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function CategoryPie({ title, data }) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm">
      <h2 className="text-lg font-semibold mb-4">{title}</h2>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie data={data} dataKey="valor" nameKey="name" cx="50%" cy="45%" outerRadius={70} label={({ percent }) => `${(percent * 100).toFixed(0)}%`}>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip formatter={(value, name) => [formatCurrency(value), name]} labelFormatter={() => ''} />
          <Legend verticalAlign="bottom" height={36} formatter={value => <span className="text-xs text-gray-600">{value}</span>} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function GraficosDoMes({ monthlyEvolution, despesasPorCategoria, receitasPorCategoria }) {
  const despPie = Object.entries(despesasPorCategoria || {}).map(([name, valor]) => ({ name, valor }));
  const recPie = Object.entries(receitasPorCategoria || {}).map(([name, valor]) => ({ name, valor }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
      {monthlyEvolution && monthlyEvolution.length > 0 && <MonthlyEvolution data={monthlyEvolution} />}
      {despPie.length > 0 && <CategoryPie title="Despesas por Categoria" data={despPie} />}
      {recPie.length > 0 && <CategoryPie title="Receitas por Categoria" data={recPie} />}
    </div>
  );
}
