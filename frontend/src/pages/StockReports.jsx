import { useState, useEffect } from 'react';
import api from '../services/api';
import { formatCurrency } from '../services/format';
import { ArrowDownCircle, ArrowUpCircle, FileText, Download, Printer, List, AlignJustify } from 'lucide-react';
import PrintPreview from '../components/PrintPreview';
import { exportToExcel } from '../utils/reportExport';

export default function StockReports() {
  const [deposits, setDeposits] = useState([]);
  const [activeTab, setActiveTab] = useState('balance');
  const [filters, setFilters] = useState({ deposit_id: '', start_date: '', end_date: '' });
  const [financialData, setFinancialData] = useState(true);
  const [balance, setBalance] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState(null);

  useEffect(() => {
    api.get('/deposits/mine').then(res => setDeposits(res.data));
  }, []);

  const fetchBalance = (f) => {
    setLoading(true);
    const params = {};
    if (f.deposit_id) params.deposit_id = parseInt(f.deposit_id);
    if (f.start_date) params.start_date = f.start_date;
    if (f.end_date) params.end_date = f.end_date;
    api.get('/stock/balance/', { params })
      .then(res => setBalance(res.data))
      .catch(err => console.error('Erro ao buscar saldo:', err))
      .finally(() => setLoading(false));
  };

  const fetchMovements = (f) => {
    setLoading(true);
    const params = {};
    if (f.deposit_id) params.deposit_id = parseInt(f.deposit_id);
    if (f.start_date) params.start_date = f.start_date;
    if (f.end_date) params.end_date = f.end_date;
    api.get('/stock/report/', { params })
      .then(res => setMovements(res.data))
      .catch(err => console.error('Erro ao buscar movimentações:', err))
      .finally(() => setLoading(false));
  };

  const handleSearch = () => {
    if (activeTab === 'balance' || activeTab === 'synthetic') fetchBalance(filters);
    else fetchMovements(filters);
  };

  const depositName = deposits.find(d => d.id === parseInt(filters.deposit_id))?.name || 'Todos';

  const formatDate = (d) => {
    if (!d) return '';
    return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');
  };
  const periodStr = filters.start_date && filters.end_date
    ? `${formatDate(filters.start_date)} a ${formatDate(filters.end_date)}`
    : filters.start_date
    ? `A partir de ${formatDate(filters.start_date)}`
    : filters.end_date
    ? `Até ${formatDate(filters.end_date)}`
    : 'Todos';

  const totalEntries = balance.reduce((s, b) => s + b.quantity_entries, 0);
  const totalExits = balance.reduce((s, b) => s + b.quantity_exits, 0);
  const totalBalance = balance.reduce((s, b) => s + b.balance, 0);
  const totalValueIn = balance.reduce((s, b) => s + b.total_value_entries, 0);
  const totalValueOut = balance.reduce((s, b) => s + b.total_value_exits, 0);

  const getAvgPrice = (b) => b.quantity_entries > 0 ? b.total_value_entries / b.quantity_entries : 0;
  const syntheticTotal = balance.reduce((s, b) => s + b.total_value_entries, 0);

  const balanceColumnsFull = [
    { header: 'Produto', accessor: r => r.product_name, width: 30, align: 'left' },
    { header: 'Entradas', accessor: r => r.quantity_entries, width: 12, align: 'right' },
    { header: 'Saídas', accessor: r => r.quantity_exits, width: 12, align: 'right' },
    { header: 'Saldo', accessor: r => r.balance, width: 12, align: 'right' },
    { header: 'Valor Entradas', accessor: r => formatCurrency(r.total_value_entries), width: 18, align: 'right' },
    { header: 'Valor Saídas', accessor: r => formatCurrency(r.total_value_exits), width: 18, align: 'right' },
  ];

  const balanceColumnsNoFin = [
    { header: 'Produto', accessor: r => r.product_name, width: 30, align: 'left' },
    { header: 'Entradas', accessor: r => r.quantity_entries, width: 15, align: 'right' },
    { header: 'Saídas', accessor: r => r.quantity_exits, width: 15, align: 'right' },
    { header: 'Saldo', accessor: r => r.balance, width: 15, align: 'right' },
  ];

  const syntheticColumnsFull = [
    { header: 'Produto', accessor: r => r.product_name, width: 30, align: 'left' },
    { header: 'Qtd', accessor: r => r.balance, width: 12, align: 'right' },
    { header: 'Preço Unit.', accessor: r => formatCurrency(getAvgPrice(r)), width: 14, align: 'right' },
    { header: 'Total', accessor: r => formatCurrency(r.total_value_entries), width: 18, align: 'right' },
  ];

  const syntheticColumnsNoFin = [
    { header: 'Produto', accessor: r => r.product_name, width: 30, align: 'left' },
    { header: 'Qtd', accessor: r => r.balance, width: 15, align: 'right' },
  ];

  const movementColumns = [
    { header: 'Data', accessor: r => r.movement_date ? new Date(r.movement_date).toLocaleDateString('pt-BR') : '-', width: 14, align: 'left' },
    { header: 'Depósito', accessor: r => r.deposit_name, width: 20, align: 'left' },
    { header: 'Produto', accessor: r => r.product_name, width: 25, align: 'left' },
    { header: 'Tipo', accessor: r => r.movement_type === 'entrada' ? 'Entrada' : 'Saída', width: 10, align: 'center' },
    { header: 'Qtd', accessor: r => r.quantity, width: 8, align: 'right' },
    { header: 'Preço Unit.', accessor: r => formatCurrency(r.unit_price || 0), width: 14, align: 'right' },
    { header: 'Total', accessor: r => formatCurrency(r.total_value || 0), width: 14, align: 'right' },
    { header: 'Motivo', accessor: r => r.reason || '-', width: 20, align: 'left' },
  ];

  const getBalanceCols = () => financialData ? balanceColumnsFull : balanceColumnsNoFin;
  const getSyntheticCols = () => financialData ? syntheticColumnsFull : syntheticColumnsNoFin;
  const getMovementCols = () => movementColumns;

  const handleExport = () => {
    if (activeTab === 'balance') exportToExcel(balance, getBalanceCols(), `saldo_estoque_${depositName}`);
    else if (activeTab === 'synthetic') exportToExcel(balance, getSyntheticCols(), `saldo_sintetico_${depositName}`);
    else exportToExcel(movements, getMovementCols(), `movimentacoes_${depositName}`);
  };

  const handlePrint = () => {
    if (activeTab === 'balance') {
      setPrinting({
        title: `Relatório de Estoque - Saldo\nDepósito: ${depositName}\nPeríodo: ${periodStr}`,
        content: (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="p-3 text-left">Produto</th>
                <th className="p-3 text-right">Entradas</th>
                <th className="p-3 text-right">Saídas</th>
                <th className="p-3 text-right">Saldo</th>
                {financialData && <th className="p-3 text-right">Valor Entradas</th>}
                {financialData && <th className="p-3 text-right">Valor Saídas</th>}
              </tr>
            </thead>
            <tbody>
              {balance.map(b => (
                <tr key={b.product_id} className="border-t">
                  <td className="p-3">{b.product_name}</td>
                  <td className="p-3 text-right">{b.quantity_entries}</td>
                  <td className="p-3 text-right">{b.quantity_exits}</td>
                  <td className="p-3 text-right">{b.balance}</td>
                  {financialData && <td className="p-3 text-right">{formatCurrency(b.total_value_entries)}</td>}
                  {financialData && <td className="p-3 text-right">{formatCurrency(b.total_value_exits)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        ),
      });
    } else if (activeTab === 'synthetic') {
      setPrinting({
        title: `Relatório de Estoque - Saldo\nDepósito: ${depositName}\nPeríodo: ${periodStr}`,
        content: (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="p-3 text-left">Produto</th>
                <th className="p-3 text-right">Qtd</th>
                {financialData && <th className="p-3 text-right">Preço Unit.</th>}
                {financialData && <th className="p-3 text-right">Total</th>}
              </tr>
            </thead>
            <tbody>
              {balance.map(b => (
                <tr key={b.product_id} className="border-t">
                  <td className="p-3">{b.product_name}</td>
                  <td className="p-3 text-right">{b.balance}</td>
                  {financialData && <td className="p-3 text-right">{formatCurrency(getAvgPrice(b))}</td>}
                  {financialData && <td className="p-3 text-right">{formatCurrency(b.total_value_entries)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        ),
      });
    } else {
      setPrinting({
        title: `Movimentações de Estoque\nDepósito: ${depositName}\nPeríodo: ${periodStr}`,
        content: (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="p-3 text-left">Data</th>
                <th className="p-3 text-left">Depósito</th>
                <th className="p-3 text-left">Produto</th>
                <th className="p-3 text-center">Tipo</th>
                <th className="p-3 text-right">Qtd</th>
                <th className="p-3 text-right">Preço Unit.</th>
                <th className="p-3 text-right">Total</th>
                <th className="p-3 text-left">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {movements.map(m => (
                <tr key={m.id} className="border-t">
                  <td className="p-3">{m.movement_date ? new Date(m.movement_date).toLocaleDateString('pt-BR') : '-'}</td>
                  <td className="p-3">{m.deposit_name}</td>
                  <td className="p-3">{m.product_name}</td>
                  <td className="p-3 text-center">{m.movement_type === 'entrada' ? 'Entrada' : 'Saída'}</td>
                  <td className="p-3 text-right">{m.quantity}</td>
                  <td className="p-3 text-right">{formatCurrency(m.unit_price || 0)}</td>
                  <td className="p-3 text-right">{formatCurrency(m.total_value || 0)}</td>
                  <td className="p-3">{m.reason || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ),
      });
    }
  };

  const hasData = (activeTab === 'balance' || activeTab === 'synthetic') ? balance.length > 0 : movements.length > 0;

  const tabs = [
    { key: 'balance', label: 'Saldo Detalhado', icon: List },
    { key: 'synthetic', label: 'Saldo Sintético', icon: AlignJustify },
    { key: 'movements', label: 'Movimentações', icon: FileText },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Relatórios de Estoque</h1>
        <div className="flex gap-2">
          {hasData && (
            <>
              <button onClick={handleExport} className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
                <Download size={16} /> Excel
              </button>
              <button onClick={handlePrint} className="flex items-center gap-2 px-3 py-2 bg-gray-600 text-white rounded-lg text-sm hover:bg-gray-700">
                <Printer size={16} /> Imprimir
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === t.key ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50 shadow-sm'
              }`}>
              <Icon size={16} /> {t.label}
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div>
            <label htmlFor="stock-report-deposit" className="block text-xs text-gray-500 mb-1">Depósito</label>
            <select id="stock-report-deposit" value={filters.deposit_id}
              onChange={e => setFilters({...filters, deposit_id: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg text-sm">
              <option value="">Todos</option>
              {deposits.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Data Início</label>
            <input type="date" value={filters.start_date}
              onChange={e => setFilters({...filters, start_date: e.target.value})}
              max={filters.end_date || undefined}
              className="w-full px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Data Fim</label>
            <input type="date" value={filters.end_date}
              onChange={e => setFilters({...filters, end_date: e.target.value})}
              min={filters.start_date || undefined}
              className="w-full px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Dados Financeiros</label>
            <select value={financialData ? 'sim' : 'nao'}
              onChange={e => setFinancialData(e.target.value === 'sim')}
              className="w-full px-3 py-2 border rounded-lg text-sm">
              <option value="sim">Com dados financeiros</option>
              <option value="nao">Sem dados financeiros</option>
            </select>
          </div>
          <button onClick={handleSearch}
            className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700 font-medium">
            Consultar
          </button>
        </div>
      </div>

      {loading && <p className="text-gray-400 text-sm py-4 text-center">Carregando...</p>}

      {activeTab === 'balance' && !loading && (
        <>
          {financialData && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
              <div className="bg-white rounded-xl shadow-sm p-4 text-center">
                <p className="text-xs text-gray-500">Entradas</p>
                <p className="text-xl font-bold text-green-600">{totalEntries}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4 text-center">
                <p className="text-xs text-gray-500">Saídas</p>
                <p className="text-xl font-bold text-red-600">{totalExits}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4 text-center">
                <p className="text-xs text-gray-500">Saldo</p>
                <p className="text-xl font-bold text-brand-600">{totalBalance}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4 text-center">
                <p className="text-xs text-gray-500">Valor Entradas</p>
                <p className="text-xl font-bold text-green-600">{formatCurrency(totalValueIn)}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4 text-center">
                <p className="text-xs text-gray-500">Valor Saídas</p>
                <p className="text-xl font-bold text-red-600">{formatCurrency(totalValueOut)}</p>
              </div>
            </div>
          )}

          {!financialData && (
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-white rounded-xl shadow-sm p-4 text-center">
                <p className="text-xs text-gray-500">Entradas</p>
                <p className="text-xl font-bold text-green-600">{totalEntries}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4 text-center">
                <p className="text-xs text-gray-500">Saídas</p>
                <p className="text-xl font-bold text-red-600">{totalExits}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4 text-center">
                <p className="text-xs text-gray-500">Saldo</p>
                <p className="text-xl font-bold text-brand-600">{totalBalance}</p>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="text-sm" style={{ width: 'auto' }}>
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3 whitespace-nowrap">Produto</th>
                  <th className="text-right p-3 whitespace-nowrap">Entradas</th>
                  <th className="text-right p-3 whitespace-nowrap">Saídas</th>
                  <th className="text-right p-3 whitespace-nowrap">Saldo</th>
                  {financialData && <th className="text-right p-3 whitespace-nowrap">Valor Entradas</th>}
                  {financialData && <th className="text-right p-3 whitespace-nowrap">Valor Saídas</th>}
                </tr>
              </thead>
              <tbody>
                {balance.map(b => (
                  <tr key={b.product_id} className="border-t hover:bg-gray-50">
                    <td className="p-3 font-medium whitespace-nowrap">{b.product_name}</td>
                    <td className="p-3 text-right text-green-600 whitespace-nowrap">{b.quantity_entries}</td>
                    <td className="p-3 text-right text-red-600 whitespace-nowrap">{b.quantity_exits}</td>
                    <td className="p-3 text-right font-bold whitespace-nowrap">{b.balance}</td>
                    {financialData && <td className="p-3 text-right whitespace-nowrap">{formatCurrency(b.total_value_entries)}</td>}
                    {financialData && <td className="p-3 text-right whitespace-nowrap">{formatCurrency(b.total_value_exits)}</td>}
                  </tr>
                ))}
                {balance.length === 0 && (
                  <tr><td colSpan={financialData ? 6 : 4} className="p-8 text-center text-gray-400">Nenhum dado encontrado</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'synthetic' && !loading && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b bg-gray-50">
            <p className="text-sm font-medium text-gray-700">Relatório de estoque - Saldo</p>
            <p className="text-xs text-gray-500">Depósito: {depositName} | Período: {periodStr}</p>
          </div>
          <table className="text-sm" style={{ width: 'auto' }}>
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3 whitespace-nowrap">Produto</th>
                <th className="text-right p-3 whitespace-nowrap">Qtd</th>
                {financialData && <th className="text-right p-3 whitespace-nowrap">Preço Unit.</th>}
                {financialData && <th className="text-right p-3 whitespace-nowrap">Total</th>}
              </tr>
            </thead>
            <tbody>
              {balance.map(b => (
                <tr key={b.product_id} className="border-t hover:bg-gray-50">
                  <td className="p-3 font-medium whitespace-nowrap">{b.product_name}</td>
                  <td className="p-3 text-right whitespace-nowrap">{b.balance}</td>
                    {financialData && <td className="p-3 text-right whitespace-nowrap">{formatCurrency(getAvgPrice(b))}</td>}
                    {financialData && <td className="p-3 text-right whitespace-nowrap">{formatCurrency(b.total_value_entries)}</td>}
                </tr>
              ))}
              {financialData && balance.length > 0 && (
                <tr className="border-t-2 font-bold bg-gray-50">
                  <td className="p-3 whitespace-nowrap">Total</td>
                  <td className="p-3 text-right whitespace-nowrap">{totalBalance}</td>
                  <td className="p-3 text-right whitespace-nowrap"></td>
                  <td className="p-3 text-right whitespace-nowrap">{formatCurrency(syntheticTotal)}</td>
                </tr>
              )}
              {!financialData && balance.length > 0 && (
                <tr className="border-t-2 font-bold bg-gray-50">
                  <td className="p-3 whitespace-nowrap">Total</td>
                  <td className="p-3 text-right whitespace-nowrap">{totalBalance}</td>
                </tr>
              )}
              {balance.length === 0 && (
                <tr><td colSpan={financialData ? 4 : 2} className="p-8 text-center text-gray-400">Nenhum dado encontrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'movements' && !loading && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="text-sm" style={{ width: 'auto' }}>
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3 whitespace-nowrap">Data</th>
                <th className="text-left p-3 whitespace-nowrap">Depósito</th>
                <th className="text-left p-3 whitespace-nowrap">Produto</th>
                <th className="text-center p-3 whitespace-nowrap">Tipo</th>
                <th className="text-right p-3 whitespace-nowrap">Qtd</th>
                <th className="text-right p-3 whitespace-nowrap">Preço Unit.</th>
                <th className="text-right p-3 whitespace-nowrap">Total</th>
                <th className="text-left p-3 whitespace-nowrap">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {movements.map(m => (
                <tr key={m.id} className="border-t hover:bg-gray-50">
                  <td className="p-3 text-gray-600 whitespace-nowrap">{m.movement_date ? new Date(m.movement_date).toLocaleDateString('pt-BR') : '-'}</td>
                  <td className="p-3 whitespace-nowrap">{m.deposit_name}</td>
                  <td className="p-3 font-medium whitespace-nowrap">{m.product_name}</td>
                  <td className="p-3 text-center whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                      m.movement_type === 'entrada' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {m.movement_type === 'entrada' ? <ArrowDownCircle size={12} /> : <ArrowUpCircle size={12} />}
                      {m.movement_type === 'entrada' ? 'Entrada' : 'Saída'}
                    </span>
                  </td>
                  <td className="p-3 text-right font-medium whitespace-nowrap">{m.quantity}</td>
                  <td className="p-3 text-right whitespace-nowrap">{formatCurrency(m.unit_price || 0)}</td>
                  <td className="p-3 text-right whitespace-nowrap">{formatCurrency(m.total_value || 0)}</td>
                  <td className="p-3 text-gray-500 text-xs whitespace-nowrap">{m.reason || '-'}</td>
                </tr>
              ))}
              {movements.length === 0 && (
                <tr><td colSpan={8} className="p-8 text-center text-gray-400">Nenhuma movimentação encontrada</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {printing && (
        <PrintPreview title={printing.title} onClose={() => setPrinting(null)} autoPrint>
          {printing.content}
        </PrintPreview>
      )}
    </div>
  );
}
