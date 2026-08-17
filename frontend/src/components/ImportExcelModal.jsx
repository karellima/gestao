import { useRef, useState } from 'react';
import { Download, FileSpreadsheet, X } from 'lucide-react';
import api from '../services/api';
import AreaDeUpload from './AreaDeUpload';
import ResultadoDaImportacao from './ResultadoDaImportacao';
import { baixarModeloDaPlanilha } from './baixar-modelo';

export default function ImportExcelModal({ open, onClose, onImported }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const inputRef = useRef(null);

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true); setResult(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await api.post('/products/import-excel', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(res.data);
      onImported();
    } catch (err) {
      setResult({ imported: 0, errors: [err.response?.data?.detail || 'Erro no upload'] });
    } finally {
      setLoading(false);
    }
  };

  const closeAndReset = () => {
    setFile(null);
    setResult(null);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <FileSpreadsheet size={20} className="text-green-600" /> Importar Planilha
          </h2>
          <button onClick={closeAndReset} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <button onClick={baixarModeloDaPlanilha}
          className="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-800 mb-4">
          <Download size={14} /> Baixar modelo da planilha
        </button>

        {!result && (
          <AreaDeUpload file={file} setFile={setFile} inputRef={inputRef} />
        )}

        {file && !result && (
          <div className="flex gap-2 mt-4">
            <button onClick={() => setFile(null)} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50 flex-1">Cancelar</button>
            <button onClick={handleUpload} disabled={loading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50 flex-1">
              {loading ? 'Importando...' : 'Importar'}
            </button>
          </div>
        )}

        {result && <ResultadoDaImportacao result={result} onClose={closeAndReset} />}
      </div>
    </div>
  );
}
