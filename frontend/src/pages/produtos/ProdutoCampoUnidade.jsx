import SearchableSelect from '../../components/SearchableSelect';

export default function ProdutoCampoUnidade({ form, units, onUnitChange }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">Unidade de Medida</label>
      <SearchableSelect options={units.map(u => ({ value: u.id, label: `${u.name} (${u.abbreviation})` }))}
        value={form.unit_id ? parseInt(form.unit_id) : ''}
        onChange={onUnitChange}
        placeholder="Selecione..." />
    </div>
  );
}
