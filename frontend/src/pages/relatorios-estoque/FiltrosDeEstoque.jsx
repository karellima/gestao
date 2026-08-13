export default function FiltrosDeEstoque({ deposits, filters, setFilters, financialData, setFinancialData, onSearch }) {
  return (
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
        <button onClick={onSearch}
          className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700 font-medium">
          Consultar
        </button>
      </div>
    </div>
  );
}
