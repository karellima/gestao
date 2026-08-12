import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowRightLeft, BarChart3, Calendar, Clock, FileText, Landmark, TrendingUp } from 'lucide-react';
import api from '../../services/api';
import ByAccountReport from './ByAccountReport';
import ByCategoryReport from './ByCategoryReport';
import ByContactReport from './ByContactReport';
import CashFlowReport from './CashFlowReport';
import DPEReport from './DPEReport';
import ForecastReport from './ForecastReport';
import MonthlySummaryReport from './MonthlySummaryReport';
import OverdueReport from './OverdueReport';
import PayableReceivableReport from './PayableReceivableReport';
import PeriodComparisonReport from './PeriodComparisonReport';

const reports = [
  { id: 'payable-receivable', label: 'Contas a Pagar/Receber', icon: FileText },
  { id: 'cash-flow', label: 'Fluxo de Caixa', icon: ArrowRightLeft },
  { id: 'monthly-summary', label: 'Resumo Mensal', icon: BarChart3 },
  { id: 'by-category', label: 'Por Categoria', icon: TrendingUp },
  { id: 'by-account', label: 'Por Conta', icon: Landmark },
  { id: 'by-contact', label: 'Extrato por Fornecedor/Cliente', icon: FileText },
  { id: 'dre', label: 'DRE', icon: TrendingUp },
  { id: 'overdue', label: 'Inadimplência', icon: AlertTriangle },
  { id: 'forecast', label: 'Previsão de Pagamentos', icon: Clock },
  { id: 'period-comparison', label: 'Comparativo Períodos', icon: Calendar },
];

const reportComponents = {
  'payable-receivable': PayableReceivableReport,
  'cash-flow': CashFlowReport,
  'monthly-summary': MonthlySummaryReport,
  'by-category': ByCategoryReport,
  'by-account': ByAccountReport,
  'by-contact': ByContactReport,
  dre: DPEReport,
  overdue: OverdueReport,
  forecast: ForecastReport,
  'period-comparison': PeriodComparisonReport,
};

export default function FinancialReports() {
  const [activeReport, setActiveReport] = useState('payable-receivable');
  const [contacts, setContacts] = useState([]);
  const ReportComponent = reportComponents[activeReport];

  useEffect(() => { api.get('/contacts/').then(res => setContacts(res.data)); }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Relatórios Financeiros</h1>
      <div className="flex flex-wrap gap-2 mb-6">
        {reports.map(r => {
          const Icon = r.icon;
          return <button key={r.id} onClick={() => setActiveReport(r.id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeReport === r.id ? 'bg-brand-600 text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}><Icon size={16} />{r.label}</button>;
        })}
      </div>
      <ReportComponent contacts={contacts} />
    </div>
  );
}
