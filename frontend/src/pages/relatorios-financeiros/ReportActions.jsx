import { Download, Printer } from 'lucide-react';
import { exportToExcel } from '../../utils/reportExport';

export default function ReportActions({ title, columns, data, filename, onPrint }) {
  return (
    <div className="flex justify-end gap-2 mb-3 no-print">
      <button onClick={() => exportToExcel({ title, columns, rows: data, filename: filename || title })}
        className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
        <Download size={16} /> Excel
      </button>
      <button onClick={onPrint}
        className="flex items-center gap-2 px-3 py-2 bg-gray-600 text-white rounded-lg text-sm hover:bg-gray-700">
        <Printer size={16} /> Imprimir
      </button>
    </div>
  );
}
