import { Save } from 'lucide-react';
import { CaseTextarea } from '../../components/CaseInput';

export default function RodapeDaVenda({ notes, onNotesChange, onCancel }) {
  return (
    <>
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <CaseTextarea placeholder="Observações" value={notes} rows={3} onChange={onNotesChange} className="w-full px-3 py-2 border rounded-lg text-sm" />
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-6 py-2 border rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
        <button type="submit" className="px-6 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700 flex items-center gap-2"><Save size={16} /> Salvar</button>
      </div>
    </>
  );
}
