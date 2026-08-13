import ImpressaoEstoque from './ImpressaoEstoque';
import TabelaMovimentacoes from './TabelaMovimentacoes';
import TabelaSaldoDetalhado from './TabelaSaldoDetalhado';
import TabelaSaldoSintetico from './TabelaSaldoSintetico';

export default function PainelRelatorioEstoque({ activeTab, loading, balance, movements, financialData, balanceColumns, syntheticColumns, movementColumns, depositName, periodStr, printing, onClosePrint }) {
  return (
    <>
      {loading && <p className="text-gray-400 text-sm py-4 text-center">Carregando...</p>}

      {activeTab === 'balance' && !loading && (
        <TabelaSaldoDetalhado balance={balance} financialData={financialData} columns={balanceColumns} />
      )}

      {activeTab === 'synthetic' && !loading && (
        <TabelaSaldoSintetico balance={balance} financialData={financialData} columns={syntheticColumns}
          depositName={depositName} periodStr={periodStr} />
      )}

      {activeTab === 'movements' && !loading && (
        <TabelaMovimentacoes movements={movements} columns={movementColumns} />
      )}

      {printing && <ImpressaoEstoque {...printing} onClose={onClosePrint} />}
    </>
  );
}
