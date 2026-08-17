import SearchableSelect from '../../components/SearchableSelect';

export default function SelecaoDaVenda({ contacts, saleTypes, contactId, saleTypeId, onContactChange, onSaleTypeChange }) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
          <SearchableSelect options={contacts.map(c => ({ value: c.id, label: c.name }))} value={contactId ? parseInt(contactId) : ''} onChange={onContactChange} placeholder="Selecione o cliente..." />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Lançamento</label>
          <SearchableSelect options={saleTypes.map(t => ({ value: t.id, label: t.name }))} value={saleTypeId ? parseInt(saleTypeId) : ''} onChange={onSaleTypeChange} placeholder="Selecione o tipo..." />
        </div>
      </div>
    </div>
  );
}
