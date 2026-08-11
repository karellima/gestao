import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';
import { Plus, Trash2, Save, X, Printer, Share2 } from 'lucide-react';
import SearchableSelect from '../components/SearchableSelect';
import { CaseTextarea } from '../components/CaseInput';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { qtyStep, roundQty, currencyToDigits, formatDigitsToCurrency, parseCurrencyToNumber, formatNumberToCurrency } from '../services/masks';

export default function SaleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [contacts, setContacts] = useState([]);
  const [saleTypes, setSaleTypes] = useState([]);
  const [products, setProducts] = useState([]);
  const [contactId, setContactId] = useState('');
  const [saleTypeId, setSaleTypeId] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('aberto');
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState([]);
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [priceTables, setPriceTables] = useState([]);
  const [tablePrices, setTablePrices] = useState({});
  const [focusQtyId, setFocusQtyId] = useState(null);
  const qtyRefs = useRef({});
  const [loading, setLoading] = useState(true);
  const isNew = !id;
  const prodLabel = (p) => p.unit?.abbreviation ? `${p.name} ${p.unit.abbreviation}` : p.name;

  useEffect(() => {
    const c1 = api.get('/contacts/').then(r => setContacts(r.data.filter(c => c.contact_type === 'cliente' || c.contact_type === 'both'))).catch(() => {});
    const c2 = api.get('/sale-types/').then(r => setSaleTypes(r.data)).catch(() => {});
    const c3 = api.get('/products/').then(r => setProducts(r.data)).catch(() => {});
    const c5 = api.get('/price-tables/').then(r => setPriceTables(r.data)).catch(() => {});
    const c4 = id ? api.get(`/sales/${id}`).then(r => {
      const s = r.data;
      setContactId(String(s.contact_id));
      setSaleTypeId(String(s.sale_type_id));
      setNotes(s.notes || '');
      setStatus(s.status);
      setItems(s.items.map(it => ({
        productId: it.product_id,
        productName: it.product_name,
        quantity: it.quantity,
        unitPrice: formatNumberToCurrency(it.unit_price, 2),
      })));
    }).catch(() => {}) : Promise.resolve();
    Promise.all([c1, c2, c3, c4, c5]).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!contactId) { setTablePrices({}); return; }
    const contact = contacts.find(c => c.id === parseInt(contactId));
    if (!contact || !contact.price_table_id) { setTablePrices({}); return; }
    const table = priceTables.find(t => t.id === contact.price_table_id);
    if (!table) { setTablePrices({}); return; }
    const map = {};
    (table.items || []).forEach(it => { map[it.product_id] = it.price; });
    setTablePrices(map);
  }, [contactId, contacts, priceTables]);

  const total = items.reduce((sum, it) => sum + it.quantity * parseCurrencyToNumber(it.unitPrice, 2), 0);

  const addItem = (product) => {
    const existing = items.find(it => it.productId === product.id);
    if (existing) {
      setItems(items.map(it => it.productId === product.id ? { ...it, quantity: it.quantity + 1 } : it));
    } else {
      setItems([...items, { productId: product.id, productName: prodLabel(product), quantity: 1, unitAbbr: product.unit?.abbreviation || '', unitPrice: formatNumberToCurrency((tablePrices[product.id] ?? product.price) || 0, 2) }]);
    }
    setShowProductSearch(false);
    setProductSearch('');
    setFocusQtyId(product.id);
  };

  useEffect(() => {
    if (focusQtyId != null && qtyRefs.current[focusQtyId]) {
      qtyRefs.current[focusQtyId].focus();
      qtyRefs.current[focusQtyId].select();
      setFocusQtyId(null);
    }
  }, [focusQtyId, items]);

  const removeItem = (pid) => setItems(items.filter(it => it.productId !== pid));
  const updateItem = (pid, field, value) => setItems(items.map(it => it.productId === pid ? { ...it, [field]: value } : it));
  const unitOf = (it) => it.unitAbbr || products.find(p => p.id === it.productId)?.unit?.abbreviation || '';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!contactId) { alert('Selecione um cliente'); return; }
    if (!saleTypeId) { alert('Selecione o tipo'); return; }
    if (items.length === 0) { alert('Adicione pelo menos um produto'); return; }
    const payload = {
      contact_id: parseInt(contactId),
      sale_type_id: parseInt(saleTypeId),
      notes: notes || null,
      items: items.map(it => ({ product_id: it.productId, quantity: roundQty(it.quantity, unitOf(it)), unit_price: parseCurrencyToNumber(it.unitPrice, 2) })),
    };
    try {
      if (isNew) {
        await api.post('/sales/', payload);
      } else {
        await api.put(`/sales/${id}`, payload);
      }
      navigate('/sales');
    } catch (err) {
      alert(err.response?.data?.detail || 'Erro ao salvar');
    }
  };

  const handlePrint = () => window.open(`/sales/${id}/print`, '_blank');
  const handleShare = async () => {
    try {
      const sale = { id: parseInt(id), contact_name: contacts.find(c => c.id === parseInt(contactId))?.name, sale_type_name: saleTypes.find(t => t.id === parseInt(saleTypeId))?.name, total_amount: total, items, status, notes };
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text(`Pedido #${sale.id}`, 14, 20);
      doc.setFontSize(9);
      doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, 14, 27);
      doc.setFontSize(11);
      doc.text(`Cliente: ${sale.contact_name || '-'}`, 14, 35);
      doc.text(`Tipo: ${sale.sale_type_name || '-'}`, 14, 42);
      doc.text(`Status: ${sale.status}`, 14, 49);
      const rows = sale.items.map(it => [it.productName, it.quantity, `R$ ${parseCurrencyToNumber(it.unitPrice, 2).toFixed(2)}`, `R$ ${(it.quantity * parseCurrencyToNumber(it.unitPrice, 2)).toFixed(2)}`]);
      autoTable(doc, { startY: 56, head: [['Produto', 'Qtd', 'Valor Unit.', 'Total']], body: rows, foot: [['', '', 'Total:', `R$ ${sale.total_amount.toFixed(2)}`]], footStyles: { fontStyle: 'bold' }, styles: { fontSize: 9 }, headStyles: { fillColor: [59, 130, 246] } });
      if (sale.notes) {
        const finalY = doc.lastAutoTable.finalY || 100;
        doc.text(`Obs: ${sale.notes}`, 14, finalY + 10);
      }
      const blob = doc.output('blob');
      const file = new File([blob], `pedido-${sale.id}.pdf`, { type: 'application/pdf' });
      try {
        if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: `Pedido #${sale.id}` }); return; }
        if (navigator.share) { await navigator.share({ title: `Pedido #${sale.id}`, text: `Pedido #${sale.id} - ${sale.contact_name || ''}`, url: window.location.origin + `/sales/${sale.id}/print` }); return; }
      } catch { /* compartilhamento nativo indisponível; salva o PDF */ }
      doc.save(`pedido-${sale.id}.pdf`);
      if (/Mobi|Android|iPhone|iPad|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
        setTimeout(() => alert('PDF baixado! Compartilhe pelo app de arquivos.'), 500);
      }
    } catch (err) {
      alert('Erro ao gerar PDF: ' + (err.message || 'erro desconhecido'));
    }
  };

  const searchProducts = (q) => {
    setProductSearch(q);
    if (q.length < 1) { setProductResults([]); return; }
    const lower = q.toLowerCase();
    setProductResults(products.filter(p => p.name.toLowerCase().includes(lower) || (p.sku && p.sku.toLowerCase().includes(lower))).slice(0, 10));
  };

  if (loading) return <p className="text-center text-gray-500 py-8">Carregando...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{isNew ? 'Novo' : `Editar`} Lançamento {!isNew && `#${id}`}</h1>
        <div className="flex gap-2">
          {!isNew && (
            <>
              <button onClick={handlePrint} className="px-3 py-2 border rounded-lg text-sm flex items-center gap-1 hover:bg-gray-50"><Printer size={16} /> Imprimir</button>
              <button onClick={handleShare} className="px-3 py-2 border rounded-lg text-sm flex items-center gap-1 hover:bg-gray-50"><Share2 size={16} /> Compartilhar</button>
            </>
          )}
          <button onClick={() => navigate('/sales')} className="text-gray-500 hover:text-gray-700"><X size={20} /></button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
              <SearchableSelect options={contacts.map(c => ({ value: c.id, label: c.name }))} value={contactId ? parseInt(contactId) : ''} onChange={v => setContactId(String(v))} placeholder="Selecione o cliente..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Lançamento</label>
              <SearchableSelect options={saleTypes.map(t => ({ value: t.id, label: t.name }))} value={saleTypeId ? parseInt(saleTypeId) : ''} onChange={v => setSaleTypeId(String(v))} placeholder="Selecione o tipo..." />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Produtos</h2>
            <button type="button" onClick={() => setShowProductSearch(true)} className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-1 hover:bg-green-700"><Plus size={16} /> Adicionar Produto</button>
          </div>

          {showProductSearch && (
            <div className="mb-4 p-3 border border-brand-200 rounded-lg bg-brand-50">
              <input type="text" placeholder="Buscar produto..." value={productSearch} onChange={e => searchProducts(e.target.value)} autoFocus className="w-full px-3 py-2 border rounded-lg text-sm mb-2" />
              {productResults.length > 0 && (
                <div className="max-h-40 overflow-y-auto border rounded-lg bg-white">
                  {productResults.map(p => (
                    <button key={p.id} type="button" onClick={() => addItem(p)} className="w-full text-left px-3 py-2 text-sm hover:bg-brand-100 border-b flex items-center justify-between">
                      <span>{prodLabel(p)}</span>
                      <span className="text-gray-400 text-xs">{p.sku} - R$ {(tablePrices[p.id] ?? p.price)?.toFixed(2) || '0,00'}</span>
                    </button>
                  ))}
                </div>
              )}
              {productSearch && productResults.length === 0 && <p className="text-xs text-gray-500">Nenhum produto encontrado</p>}
              <button type="button" onClick={() => { setShowProductSearch(false); setProductSearch(''); }} className="text-xs text-gray-500 mt-1">Cancelar</button>
            </div>
          )}

          {items.length === 0 ? <p className="text-sm text-gray-400 text-center py-4">Nenhum produto adicionado</p> : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50"><tr>
                <th className="text-left p-2">Produto</th>
                <th className="text-center p-2 w-20">Qtd</th>
                <th className="text-right p-2 w-28">Valor Unit.</th>
                <th className="text-right p-2 w-28">Total</th>
                <th className="text-center p-2 w-12"></th>
              </tr></thead>
              <tbody>
                {items.map(it => (
                  <tr key={it.productId} className="border-t">
                    <td className="p-2 font-medium">{it.productName}</td>
                    <td className="p-2"><input type="number" min={qtyStep(unitOf(it))} step={qtyStep(unitOf(it))} value={it.quantity} ref={el => { qtyRefs.current[it.productId] = el; }} onChange={e => updateItem(it.productId, 'quantity', roundQty(e.target.value, unitOf(it)))} className="w-16 px-2 py-1 border rounded text-sm text-center" /></td>
                    <td className="p-2"><input type="text" inputMode="decimal" value={it.unitPrice} onChange={e => updateItem(it.productId, 'unitPrice', formatDigitsToCurrency(currencyToDigits(e.target.value), 2))} className="w-24 px-2 py-1 border rounded text-sm text-right" /></td>
                    <td className="p-2 text-right font-medium">R$ {(it.quantity * parseCurrencyToNumber(it.unitPrice, 2)).toFixed(2)}</td>
                    <td className="p-2 text-center"><button type="button" onClick={() => removeItem(it.productId)} className="text-red-500"><Trash2 size={16} /></button></td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 font-bold"><tr>
                <td colSpan={3} className="p-2 text-right">Total:</td>
                <td className="p-2 text-right">R$ {total.toFixed(2)}</td>
                <td></td>
              </tr></tfoot>
            </table>
          )}
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm">
          <CaseTextarea placeholder="Observações" value={notes} rows={3} onChange={e => setNotes(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => navigate('/sales')} className="px-6 py-2 border rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
          <button type="submit" className="px-6 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700 flex items-center gap-2"><Save size={16} /> Salvar</button>
        </div>
      </form>
    </div>
  );
}
