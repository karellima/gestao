export default function ReportFilters({ startDate, setStartDate, endDate, setEndDate, contactFilter, setContactFilter, contacts, showType, filter, setFilter, showContact = true }) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Data Inicial</label>
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
          max={endDate || undefined}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Data Final</label>
        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
          min={startDate || undefined}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
      </div>
      {showType && (
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Tipo</label>
          <select value={filter} onChange={e => setFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
            <option value="">Todos</option>
            <option value="despesa">Despesas</option>
            <option value="receita">Receitas</option>
          </select>
        </div>
      )}
      {showContact && (
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Fornecedor/Cliente</label>
          <select value={contactFilter} onChange={e => setContactFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm min-w-[160px]">
            <option value="">Todos</option>
            {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}
    </div>
  );
}
