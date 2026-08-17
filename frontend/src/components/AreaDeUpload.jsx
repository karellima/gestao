import { Upload } from 'lucide-react';

export default function AreaDeUpload({ file, setFile, inputRef }) {
  const handleDrop = (event) => {
    event.preventDefault();
    const droppedFile = event.dataTransfer.files[0];
    if (droppedFile && (droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.xls'))) setFile(droppedFile);
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(event) => event.preventDefault()}
      onClick={() => inputRef.current?.click()}
      className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-brand-400 transition-colors"
    >
      <Upload size={32} className="mx-auto text-gray-400 mb-2" />
      <p className="text-sm text-gray-600 mb-1">
        {file ? file.name : 'Clique ou arraste o arquivo .xlsx aqui'}
      </p>
      {!file && <p className="text-xs text-gray-400">Colunas: Nome, SKU, Descrição, Código de Barras, Preço Venda, Preço Custo, Categoria, Subcategoria, Unidade</p>}
      <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden"
        onChange={(event) => { const selectedFile = event.target.files[0]; if (selectedFile) setFile(selectedFile); }} />
    </div>
  );
}
