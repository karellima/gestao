import { Printer, Share2, X } from 'lucide-react';

export default function CabecalhoDaVenda({ isNew, id, onPrint, onShare, onClose }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <h1 className="text-2xl font-bold">{isNew ? 'Novo' : 'Editar'} Lançamento {!isNew && `#${id}`}</h1>
      <div className="flex gap-2">
        {!isNew && (
          <>
            <button onClick={onPrint} className="px-3 py-2 border rounded-lg text-sm flex items-center gap-1 hover:bg-gray-50"><Printer size={16} /> Imprimir</button>
            <button onClick={onShare} className="px-3 py-2 border rounded-lg text-sm flex items-center gap-1 hover:bg-gray-50"><Share2 size={16} /> Compartilhar</button>
          </>
        )}
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700"><X size={20} /></button>
      </div>
    </div>
  );
}
