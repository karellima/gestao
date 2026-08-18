import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useNotificacao } from '../contexts/NotificacaoContext';
import { Plus, Edit, Printer, Share2, Trash2 } from 'lucide-react';

export default function SalesList() {
  const { notificar } = useNotificacao();
  const [sales, setSales] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/sales/').then(res => setSales(res.data)).catch(() => {});
  }, []);

  const handleDelete = async (s) => {
    if (!confirm(`Remover o lançamento #${s.id} de ${s.contact_name || '-'}?`)) return;
    try { await api.delete(`/sales/${s.id}`); setSales(sales.filter(x => x.id !== s.id)); }
    catch (err) { notificar.erro(err.response?.data?.detail || 'Erro ao remover lançamento'); }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Lançamentos</h1>
        <button onClick={() => navigate('/sales/new')}
          className="bg-brand-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-brand-700">
          <Plus size={18} /> Novo Lançamento
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3">#</th>
              <th className="text-left p-3">Cliente</th>
              <th className="text-left p-3">Tipo</th>
              <th className="text-right p-3">Valor</th>
              <th className="text-center p-3">Status</th>
              <th className="text-center p-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {sales.map(s => (
              <tr key={s.id} className="border-t hover:bg-gray-50">
                <td className="p-3 text-gray-400">{s.id}</td>
                <td className="p-3 font-medium">{s.contact_name || '-'}</td>
                <td className="p-3">{s.sale_type_name || '-'}</td>
                <td className="p-3 text-right font-medium">R$ {s.total_amount?.toFixed(2)}</td>
                <td className="p-3 text-center">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    s.status === 'aberto' ? 'bg-yellow-100 text-yellow-700' :
                    s.status === 'concluido' ? 'bg-green-100 text-green-700' :
                    'bg-gray-100 text-gray-500'
                  }`}>{s.status}</span>
                </td>
                <td className="p-3 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button onClick={() => navigate(`/sales/${s.id}`)}
                      className="text-brand-600 hover:text-brand-800" title="Editar"><Edit size={16} /></button>
                    <button onClick={() => window.open(`/sales/${s.id}/print`, '_blank')}
                      className="text-gray-600 hover:text-gray-800" title="Imprimir"><Printer size={16} /></button>
                    <button onClick={async () => {
                      if (!s.items || s.items.length === 0) { notificar.aviso('Nenhum item para compartilhar'); return; }
                      try {
                        const { jsPDF } = await import('jspdf');
                        const autoTable = (await import('jspdf-autotable')).default;
                        const doc = new jsPDF();
                        doc.setFontSize(16);
                        doc.text(`Pedido #${s.id}`, 14, 20);
                        doc.setFontSize(9);
                        doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, 14, 27);
                        doc.setFontSize(11);
                        doc.text(`Cliente: ${s.contact_name || '-'}`, 14, 35);
                        doc.text(`Tipo: ${s.sale_type_name || '-'}`, 14, 42);
                        doc.text(`Status: ${s.status}`, 14, 49);
                        const rows = s.items.map(it => [it.product_name, it.quantity, `R$ ${it.unit_price?.toFixed(2)}`, `R$ ${it.total_price?.toFixed(2)}`]);
                        autoTable(doc, { startY: 56, head: [['Produto', 'Qtd', 'Valor Unit.', 'Total']], body: rows, foot: [['', '', 'Total:', `R$ ${s.total_amount?.toFixed(2)}`]], footStyles: { fontStyle: 'bold' }, styles: { fontSize: 9 }, headStyles: { fillColor: [59, 130, 246] } });
                        if (s.notes) {
                          const finalY = doc.lastAutoTable.finalY || 100;
                          doc.text(`Obs: ${s.notes}`, 14, finalY + 10);
                        }
                        const blob = doc.output('blob');
                        const file = new File([blob], `pedido-${s.id}.pdf`, { type: 'application/pdf' });
                        try {
                          if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: `Pedido #${s.id}` }); return; }
                          if (navigator.share) { await navigator.share({ title: `Pedido #${s.id}`, text: `Pedido #${s.id} - ${s.contact_name || ''}`, url: window.location.origin + `/sales/${s.id}/print` }); return; }
                        } catch { /* compartilhamento nativo indisponível; salva o PDF */ }
                        doc.save(`pedido-${s.id}.pdf`);
                        if (/Mobi|Android|iPhone|iPad|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
                          setTimeout(() => notificar.sucesso('PDF baixado! Compartilhe pelo app de arquivos.'), 500);
                        }
                      } catch (err) { notificar.erro('Erro ao gerar PDF: ' + (err.message || 'erro desconhecido')); }
                    }} className="text-gray-600 hover:text-gray-800" title="Compartilhar"><Share2 size={16} /></button>
                    <button onClick={() => handleDelete(s)}
                      className="text-red-600 hover:text-red-800" title="Excluir"><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {sales.length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center text-gray-500">Nenhum lançamento encontrado</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
