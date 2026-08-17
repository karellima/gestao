import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api';
import { formatNumberToCurrency, parseCurrencyToNumber, roundQty } from '../../services/masks';
import { gerarPdfDoPedido } from './pedido-pdf';
import { compartilharPedido } from './compartilhar';
import CabecalhoDaVenda from './CabecalhoDaVenda';
import BuscaDeProdutos from './BuscaDeProdutos';
import RodapeDaVenda from './RodapeDaVenda';
import SelecaoDaVenda from './SelecaoDaVenda';
import TabelaDeItens from './TabelaDeItens';

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
  const prodLabel = (product) => product.unit?.abbreviation ? `${product.name} ${product.unit.abbreviation}` : product.name;

  useEffect(() => {
    const c1 = api.get('/contacts/').then(r => setContacts(r.data.filter(c => c.contact_type === 'cliente' || c.contact_type === 'both'))).catch(() => {});
    const c2 = api.get('/sale-types/').then(r => setSaleTypes(r.data)).catch(() => {});
    const c3 = api.get('/products/').then(r => setProducts(r.data)).catch(() => {});
    const c5 = api.get('/price-tables/').then(r => setPriceTables(r.data)).catch(() => {});
    const c4 = id ? api.get(`/sales/${id}`).then(r => {
      const sale = r.data;
      setContactId(String(sale.contact_id));
      setSaleTypeId(String(sale.sale_type_id));
      setNotes(sale.notes || '');
      setStatus(sale.status);
      setItems(sale.items.map(item => ({
        productId: item.product_id,
        productName: item.product_name,
        quantity: item.quantity,
        unitPrice: formatNumberToCurrency(item.unit_price, 2),
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
    (table.items || []).forEach(item => { map[item.product_id] = item.price; });
    setTablePrices(map);
  }, [contactId, contacts, priceTables]);

  const total = items.reduce((sum, item) => sum + item.quantity * parseCurrencyToNumber(item.unitPrice, 2), 0);

  const addItem = (product) => {
    const existing = items.find(item => item.productId === product.id);
    if (existing) {
      setItems(items.map(item => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item));
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

  const removeItem = (pid) => setItems(items.filter(item => item.productId !== pid));
  const updateItem = (pid, field, value) => setItems(items.map(item => item.productId === pid ? { ...item, [field]: value } : item));
  const unitOf = (item) => item.unitAbbr || products.find(product => product.id === item.productId)?.unit?.abbreviation || '';

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!contactId) { alert('Selecione um cliente'); return; }
    if (!saleTypeId) { alert('Selecione o tipo'); return; }
    if (items.length === 0) { alert('Adicione pelo menos um produto'); return; }
    const payload = {
      contact_id: parseInt(contactId),
      sale_type_id: parseInt(saleTypeId),
      notes: notes || null,
      items: items.map(item => ({ product_id: item.productId, quantity: roundQty(item.quantity, unitOf(item)), unit_price: parseCurrencyToNumber(item.unitPrice, 2) })),
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

  const handleShare = async () => {
    try {
      const sale = { id: parseInt(id), contact_name: contacts.find(c => c.id === parseInt(contactId))?.name, sale_type_name: saleTypes.find(t => t.id === parseInt(saleTypeId))?.name, total_amount: total, items, status, notes };
      const blob = gerarPdfDoPedido(sale);
      await compartilharPedido({ id: sale.id, blob, contactName: sale.contact_name });
    } catch (err) {
      alert('Erro ao gerar PDF: ' + (err.message || 'erro desconhecido'));
    }
  };

  const searchProducts = (query) => {
    setProductSearch(query);
    if (query.length < 1) { setProductResults([]); return; }
    const lower = query.toLowerCase();
    setProductResults(products.filter(product => product.name.toLowerCase().includes(lower) || (product.sku && product.sku.toLowerCase().includes(lower))).slice(0, 10));
  };

  if (loading) return <p className="text-center text-gray-500 py-8">Carregando...</p>;

  return (
    <div>
      <CabecalhoDaVenda isNew={isNew} id={id} onPrint={() => window.open(`/sales/${id}/print`, '_blank')} onShare={handleShare} onClose={() => navigate('/sales')} />

      <form onSubmit={handleSubmit} className="space-y-6">
        <SelecaoDaVenda
          contacts={contacts}
          saleTypes={saleTypes}
          contactId={contactId}
          saleTypeId={saleTypeId}
          onContactChange={value => setContactId(String(value))}
          onSaleTypeChange={value => setSaleTypeId(String(value))}
        />

        <div className="bg-white rounded-xl p-6 shadow-sm">
          <BuscaDeProdutos
            show={showProductSearch}
            search={productSearch}
            results={productResults}
            tablePrices={tablePrices}
            prodLabel={prodLabel}
            onOpen={() => setShowProductSearch(true)}
            onSearch={searchProducts}
            onAdd={addItem}
            onCancel={() => { setShowProductSearch(false); setProductSearch(''); }}
          />
          <TabelaDeItens items={items} qtyRefs={qtyRefs} unitOf={unitOf} total={total} onUpdateItem={updateItem} onRemove={removeItem} />
        </div>

        <RodapeDaVenda notes={notes} onNotesChange={event => setNotes(event.target.value)} onCancel={() => navigate('/sales')} />
      </form>
    </div>
  );
}
