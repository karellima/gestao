import { AlignJustify, Download, FileText, List, Printer } from 'lucide-react';

const tabs = [
  { key: 'balance', label: 'Saldo Detalhado', icon: List },
  { key: 'synthetic', label: 'Saldo Sintético', icon: AlignJustify },
  { key: 'movements', label: 'Movimentações', icon: FileText },
];

export default function CabecalhoRelatorioEstoque({ activeTab, setActiveTab, hasData, onExport, onPrint }) {
  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Relatórios de Estoque</h1>
        <div className="flex gap-2">
          {hasData && (
            <>
              <button onClick={onExport} className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
                <Download size={16} /> Excel
              </button>
              <button onClick={onPrint} className="flex items-center gap-2 px-3 py-2 bg-gray-600 text-white rounded-lg text-sm hover:bg-gray-700">
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
    </>
  );
}
