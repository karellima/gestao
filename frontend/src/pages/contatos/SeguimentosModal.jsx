import { Edit, Trash2, Check, X } from 'lucide-react';
import { CaseInput } from '../../components/CaseInput';

export default function SeguimentosModal({
  segments, newSegment, setNewSegment, editSegId, setEditSegId,
  editSegName, setEditSegName, onAdd, onSaveEdit, onDelete, onClose,
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">Seguimentos</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700"><X size={20} /></button>
        </div>
        <div className="flex gap-2 mb-4">
          <CaseInput placeholder="Novo seguimento..." value={newSegment}
            onChange={e => setNewSegment(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onAdd(); } }}
            className="flex-1 px-3 py-2 border rounded-lg text-sm" />
          <button onClick={onAdd} className="px-3 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700">Adicionar</button>
        </div>
        <ul className="space-y-2">
          {segments.map(s => (
            <li key={s.id} className="flex items-center gap-2">
              {editSegId === s.id ? (
                <>
                  <CaseInput value={editSegName} onChange={e => setEditSegName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onSaveEdit(s.id); } }}
                    className="flex-1 px-2 py-1 border rounded-lg text-sm" autoFocus />
                  <button onClick={() => onSaveEdit(s.id)} className="text-green-600 hover:text-green-800"><Check size={16} /></button>
                  <button onClick={() => setEditSegId(null)} className="text-gray-500 hover:text-gray-700"><X size={16} /></button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm">{s.name}</span>
                  <button onClick={() => { setEditSegId(s.id); setEditSegName(s.name); }} className="text-brand-600 hover:text-brand-800"><Edit size={16} /></button>
                  <button onClick={() => onDelete(s.id)} className="text-red-600 hover:text-red-800"><Trash2 size={16} /></button>
                </>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
