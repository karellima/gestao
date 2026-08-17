import { AlertCircle, CheckCircle } from 'lucide-react';

export default function ResultadoDaImportacao({ result, onClose }) {
  return (
    <div className="mt-4 space-y-3">
      <div className={`flex items-center gap-2 text-sm ${result.imported > 0 ? 'text-green-700' : 'text-red-700'}`}>
        {result.imported > 0 ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
        <span className="font-medium">{result.imported} produto(s) importado(s)</span>
      </div>
      {result.errors?.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 max-h-40 overflow-y-auto">
          <p className="text-xs font-medium text-red-700 mb-1">Erros ({result.errors.length}):</p>
          {result.errors.map((error, index) => <p key={index} className="text-xs text-red-600">{error}</p>)}
        </div>
      )}
      <button onClick={onClose}
        className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300">
        Fechar
      </button>
    </div>
  );
}
