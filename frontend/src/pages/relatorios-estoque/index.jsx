import { useEffect, useState } from 'react';
import api from '../../services/api';
import { exportToExcel } from '../../utils/reportExport';
import CabecalhoRelatorioEstoque from './CabecalhoRelatorioEstoque';
import FiltrosDeEstoque from './FiltrosDeEstoque';
import { getBalanceCols, getMovementCols, getSyntheticCols } from './colunas';
import PainelRelatorioEstoque from './PainelRelatorioEstoque';

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

  const handleExport = () => {
    if (activeTab === 'balance') exportToExcel(balance, getBalanceCols(financialData), `saldo_estoque_${depositName}`);
    else if (activeTab === 'synthetic') exportToExcel(balance, getSyntheticCols(financialData), `saldo_sintetico_${depositName}`);
    else exportToExcel(movements, getMovementCols(), `movimentacoes_${depositName}`);
  };

  const handlePrint = () => {
    setPrinting({ activeTab, balance, movements, financialData, depositName, periodStr });
  };

  const hasData = (activeTab === 'balance' || activeTab === 'synthetic') ? balance.length > 0 : movements.length > 0;
  const balanceColumns = getBalanceCols(financialData);
  const syntheticColumns = getSyntheticCols(financialData);
  const movementColumns = getMovementCols();

  return (
    <div>
      <CabecalhoRelatorioEstoque activeTab={activeTab} setActiveTab={setActiveTab}
        hasData={hasData} onExport={handleExport} onPrint={handlePrint} />

      <FiltrosDeEstoque deposits={deposits} filters={filters} setFilters={setFilters}
        financialData={financialData} setFinancialData={setFinancialData} onSearch={handleSearch} />
      <PainelRelatorioEstoque activeTab={activeTab} loading={loading} balance={balance} movements={movements}
        financialData={financialData} balanceColumns={balanceColumns} syntheticColumns={syntheticColumns}
        movementColumns={movementColumns} depositName={depositName} periodStr={periodStr}
        printing={printing} onClosePrint={() => setPrinting(null)} />
    </div>
  );
}
