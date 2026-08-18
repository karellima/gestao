import { Upload } from 'lucide-react';
import { useState } from 'react';

const MENSAGEM_FORMATO_INVALIDO = 'Formato inválido. Envie um arquivo .xlsx ou .xls.';

export const ehPlanilha = (file) => /\.(xlsx|xls)$/i.test(file?.name || '');

export default function AreaDeUpload({ file, setFile, inputRef }) {
  const [erro, setErro] = useState('');

  const handleFile = (selectedFile) => {
    if (!selectedFile) return;
    if (!ehPlanilha(selectedFile)) {
      setErro(MENSAGEM_FORMATO_INVALIDO);
      if (file) setFile(null);
      return;
    }

    setErro('');
    setFile(selectedFile);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    handleFile(event.dataTransfer.files[0]);
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(event) => event.preventDefault()}
      onClick={() => inputRef.current?.click()}
      className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-brand-400 transition-colors"
    >
      <Upload size={32} className="mx-auto text-gray-400 mb-2" />
      {erro ? (
        <p role="alert" className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700 mb-1">
          {erro}
        </p>
      ) : (
        <p className="text-sm text-gray-600 mb-1">
          {file ? file.name : 'Clique ou arraste o arquivo .xlsx aqui'}
        </p>
      )}
      {!file && <p className="text-xs text-gray-400">Colunas: Nome, SKU, Descrição, Código de Barras, Preço Venda, Preço Custo, Categoria, Subcategoria, Unidade</p>}
      <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden"
        onChange={(event) => handleFile(event.target.files[0])} />
    </div>
  );
}
