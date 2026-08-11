import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { CaseInput, CaseTextarea } from '../components/CaseInput';
import { Plus, ClipboardList, CheckCircle, XCircle, Truck, Printer, Edit, Trash2, ArrowUpCircle } from 'lucide-react';
import PrintPreview from '../components/PrintPreview';
import { qtyStep, qtyMin, roundQty, currencyToDigits, formatDigitsToCurrency, parseCurrencyToNumber, formatNumberToCurrency } from '../services/masks';

const statusLabels = {
  pendente: 'Pendente',
  aprovado: 'Liberada',
  atendido: 'Atendida',
  recebido: 'Recebida',
  cancelado: 'Cancelada',
};
const statusColors = {
  pendente: 'bg-yellow-100 text-yellow-700',
  aprovado: 'bg-brand-100 text-brand-700',
  atendido: 'bg-green-100 text-green-700',
  recebido: 'bg-teal-100 text-teal-700',
  cancelado: 'bg-red-100 text-red-700',
};

function SearchInput({ products, onSelect, searchRef }) {
  const [q, setQ] = useState('');
  const results = useMemo(() => {
    if (q.length < 1) return [];
    const lq = q.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(lq) || (p.sku && p.sku.toLowerCase().includes(lq))).slice(0, 8);
  }, [q, products]);
  return (
    <div className="relative">
      <input ref={searchRef} type="text" placeholder="Buscar produto..." value={q} autoFocus
        onChange={e => setQ(e.target.value)}
        className="w-full px-3 py-2.5 border rounded-lg text-sm" />
      {results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 border rounded-lg bg-white shadow-lg z-10 max-h-40 overflow-y-auto">
          {results.map(p => (
            <button key={p.id} type="button" onClick={() => { onSelect(p); setQ(''); }}
              className="w-full text-left px-3 py-2.5 text-sm hover:bg-brand-50 border-b last:border-0 flex justify-between">
              <span>{p.name}{p.unit?.abbreviation ? ` ${p.unit.abbreviation}` : ''}</span>
              <span className="text-gray-400 text-xs">{p.sku}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Requisicoes() {
  const { user } = useAuth();
  const [requisicoes, setRequisicoes] = useState([]);
  const [products, setProducts] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [users, setUsers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [printing, setPrinting] = useState(null);
  const [fulfilling, setFulfilling] = useState(null);
  const [fulfillQty, setFulfillQty] = useState({});
  const [parentBalance, setParentBalance] = useState({});
  const [receiving, setReceiving] = useState(null);
  const [receiveQty, setReceiveQty] = useState({});

  const isAdmin = user?.role === 'admin';
  const canManage = (r) => isAdmin || user?.id === r.requester_id;
  const canFulfill = (r) => isAdmin || (user?.deposit_ids || []).includes(r.deposit_fulfilling_id);
  const canReceive = (r) => isAdmin || user?.id === r.requester_id || (user?.deposit_ids || []).includes(r.deposit_requesting_id);

  const [form, setForm] = useState({
    deposit_requesting_id: '',
    deposit_fulfilling_id: '',
    reason: '',
    notes: '',
    items: [],
  });
  const searchRef = useRef(null);
  const [focusQtyId, setFocusQtyId] = useState(null);
  const qtyRefs = useRef({});

  useEffect(() => {
    if (focusQtyId != null && qtyRefs.current[focusQtyId]) {
      qtyRefs.current[focusQtyId].focus();
      qtyRefs.current[focusQtyId].select();
      setFocusQtyId(null);
    }
  }, [focusQtyId, form.items]);

  const load = useCallback(() => {
    const params = {};
    if (statusFilter) params.status = statusFilter;
    api.get('/requisicoes/', { params })
      .then(res => setRequisicoes(res.data))
      .catch(() => {});
  }, [statusFilter]);
  useEffect(() => {
    api.get('/products/').then(res => setProducts(res.data)).catch(() => {});
    api.get('/deposits/mine').then(res => setDeposits(res.data)).catch(() => {});
    api.get('/auth/users').then(res => setUsers(res.data)).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const prodLabel = (p) => p.unit?.abbreviation ? `${p.name} ${p.unit.abbreviation}` : p.name;

  const productUnitMap = useMemo(() => {
    const m = {};
    products.forEach(p => m[p.id] = p.unit?.abbreviation || '');
    return m;
  }, [products]);

  const unitOf = (it) => productUnitMap[it.product_id] || it.unit_abbr || '';


  const userMap = useMemo(() => {
    const m = {};
    users.forEach(u => m[u.id] = u.name);
    return m;
  }, [users]);

  const addItem = (product) => {
    if (form.items.find(it => it.product_id === product.id)) return;
    setForm(f => ({ ...f, items: [...f.items, { product_id: product.id, product_name: prodLabel(product), quantity_requested: 1, unit_abbr: product.unit?.abbreviation || '', unit_price: formatNumberToCurrency(product.price || 0, 2) }] }));
    setFocusQtyId(product.id);
  };

  const removeItem = (pid) => setForm(f => ({ ...f, items: f.items.filter(it => it.product_id !== pid) }));
  const updateItem = (pid, field, value) => setForm(f => ({ ...f, items: f.items.map(it => it.product_id === pid ? { ...it, [field]: value } : it) }));

  const resetForm = () => {
    setForm({ deposit_requesting_id: '', deposit_fulfilling_id: '', reason: '', notes: '', items: [] });
    setEditing(null);
  };

  const handleEdit = (r) => {
    setEditing(r);
    setForm({
      deposit_requesting_id: String(r.deposit_requesting_id),
      deposit_fulfilling_id: String(r.deposit_fulfilling_id),
      reason: r.reason || '',
      notes: r.notes || '',
      items: r.items.map(it => ({
        product_id: it.product_id,
        product_name: it.product_name,
        quantity_requested: it.quantity_requested,
        unit_price: it.unit_price ? formatNumberToCurrency(it.unit_price, 2) : '',
      })),
    });
    setShowModal(true);
  };

  const handleApprove = async (r) => {
    const itens = r.items.map(it => ({
      product_id: it.product_id,
      quantity_approved: it.quantity_approved || it.quantity_requested,
    }));
    const totals = itens.reduce((s, it) => s + it.quantity_approved, 0);
    if (!confirm(`Liberar requisição #${r.id} (${totals} ite${totals === 1 ? 'm' : 'ns'}) para atendimento?`)) return;
    try {
      await api.put(`/requisicoes/${r.id}/approve`, { items: itens });
      load();
    } catch (err) {
      alert(err.response?.data?.detail || 'Erro ao liberar');
    }
  };

  const openFulfill = async (r) => {
    const qty = {};
    const bal = {};
    try {
      const res = await api.get(`/stock/balance/?deposit_id=${r.deposit_fulfilling_id}`);
      (res.data || []).forEach(b => { bal[b.product_id] = b.balance; });
    } catch { /* saldo indisponível não bloqueia */ }
    r.items.forEach(it => {
      const approved = it.quantity_approved || it.quantity_requested || 0;
      const b = bal[it.product_id];
      qty[it.product_id] = b > 0 ? Math.min(approved, b) : approved;
    });
    setParentBalance(bal);
    setFulfillQty(qty);
    setFulfilling(r);
  };

  const handleFulfill = async () => {
    const r = fulfilling;
    if (!r) return;
    const items = r.items.map(it => ({
      product_id: it.product_id,
      quantity_fulfilled: roundQty(fulfillQty[it.product_id] ?? 0, unitOf(it)),
    }));
    const exceed = r.items.filter(it => (fulfillQty[it.product_id] || 0) > (it.quantity_approved || it.quantity_requested));
    if (exceed.length > 0) {
      const msg = exceed.map(it => `${it.product_name}: entregar ${fulfillQty[it.product_id]} (solicitado ${it.quantity_requested})`).join('\n');
      if (!confirm(`Atenção! A quantidade de alguns itens é MAIOR que a solicitada:\n\n${msg}\n\nDeseja continuar mesmo assim?`)) return;
    } else if (!confirm(`Confirmar atendimento da requisição #${r.id}? Isso criará movimentações de saída no estoque.`)) return;
    try {
      await api.put(`/requisicoes/${r.id}/fulfill`, { items });
      setFulfilling(null);
      load();
    } catch (err) {
      alert(err.response?.data?.detail || 'Erro ao atender');
    }
  };

  const openReceive = (r) => {
    const qty = {};
    r.items.forEach(it => { qty[it.product_id] = it.quantity_fulfilled || it.quantity_approved || it.quantity_requested || 0; });
    setReceiveQty(qty);
    setReceiving(r);
  };

  const handleReceive = async () => {
    const r = receiving;
    if (!r) return;
    const items = r.items.map(it => ({
      product_id: it.product_id,
      quantity_received: roundQty(receiveQty[it.product_id] ?? 0, unitOf(it)),
    }));
    if (!confirm(`Confirmar recebimento da requisição #${r.id} no depósito? Isso criará movimentações de entrada no estoque.`)) return;
    try {
      await api.put(`/requisicoes/${r.id}/receive`, { items });
      setReceiving(null);
      load();
    } catch (err) {
      alert(err.response?.data?.detail || 'Erro ao receber');
    }
  };

  const handleCancel = async (r) => {
    if (!confirm(`Cancelar requisição #${r.id}?`)) return;
    try {
      await api.put(`/requisicoes/${r.id}/cancel`);
      load();
    } catch (err) {
      alert(err.response?.data?.detail || 'Erro ao cancelar');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Remover esta requisição?')) return;
    try {
      await api.delete(`/requisicoes/${id}`);
      load();
    } catch (err) {
      alert(err.response?.data?.detail || 'Erro ao remover');
    }
  };

  const handlePrint = (r) => {
    const d = (v) => v ? new Date(v).toLocaleDateString('pt-BR') : '-';
    setPrinting({
      title: `Requisição #${r.id}`,
      content: (
        <div>
          <div className="text-center mb-6">
            <h1 className="text-xl font-bold">Requisição de Estoque #{r.id}</h1>
            <p className="text-sm text-gray-500">Sistema de Gestão</p>
            <p className="text-xs text-gray-400">Gerado em {new Date().toLocaleString('pt-BR')}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm mb-6">
            <div><span className="font-medium">Solicitante:</span> {userMap[r.requester_id] || '-'}</div>
            <div className="text-right"><span className="font-medium">Status:</span> {statusLabels[r.status]}</div>
            <div><span className="font-medium">Depósito Solicitante:</span> {r.deposit_requesting_name}</div>
            <div className="text-right"><span className="font-medium">Depósito Atendimento:</span> {r.deposit_fulfilling_name}</div>
            <div><span className="font-medium">Data:</span> {d(r.created_at)}</div>
            {r.approver_name && <div className="text-right"><span className="font-medium">Aprovador:</span> {r.approver_name}</div>}
          </div>
          {r.reason && <p className="text-sm mb-4"><span className="font-medium">Motivo:</span> {r.reason}</p>}
          {r.notes && <p className="text-sm mb-4"><span className="font-medium">Observações:</span> {r.notes}</p>}
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="p-3 text-left">Produto</th>
                <th className="p-3 text-right">Solicitado</th>
                {r.status !== 'pendente' && <th className="p-3 text-right">Aprovado</th>}
                {(r.status === 'atendido' || r.status === 'recebido') && <th className="p-3 text-right">Enviado</th>}
                {r.status === 'recebido' && <th className="p-3 text-right">Recebido</th>}
                {(r.status === 'atendido' || r.status === 'recebido') && <th className="p-3 text-right">Preço Unit.</th>}
              </tr>
            </thead>
            <tbody>
              {r.items.map(it => (
                <tr key={it.id || it.product_id} className="border-t">
                  <td className="p-3">{it.product_name}</td>
                  <td className="p-3 text-right">{it.quantity_requested}</td>
                  {r.status !== 'pendente' && <td className="p-3 text-right">{it.quantity_approved || it.quantity_requested}</td>}
                  {(r.status === 'atendido' || r.status === 'recebido') && <td className="p-3 text-right">{it.quantity_fulfilled ?? '-'}</td>}
                  {r.status === 'recebido' && <td className="p-3 text-right">{it.quantity_received ?? '-'}</td>}
                  {(r.status === 'atendido' || r.status === 'recebido') && <td className="p-3 text-right">{it.unit_price ? `R$ ${it.unit_price.toFixed(2)}` : '-'}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ),
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.deposit_requesting_id) { alert('Selecione o depósito solicitante'); return; }
    if (!form.deposit_fulfilling_id) { alert('Selecione o depósito de atendimento'); return; }
    if (form.items.length === 0) { alert('Adicione pelo menos um produto'); return; }
    try {
      const data = {
        deposit_requesting_id: parseInt(form.deposit_requesting_id),
        deposit_fulfilling_id: parseInt(form.deposit_fulfilling_id),
        reason: form.reason || null,
        notes: form.notes || null,
        items: form.items.map(it => {
          const u = unitOf(it);
          const q = roundQty(it.quantity_requested, u);
          return {
            product_id: it.product_id,
            quantity_requested: q > 0 ? q : qtyMin(u),
            unit_price: it.unit_price ? parseCurrencyToNumber(it.unit_price, 2) : null,
          };
        }),
      };
      if (editing) {
        await api.put(`/requisicoes/${editing.id}`, data);
      } else {
        await api.post('/requisicoes/', data);
      }
      setShowModal(false); resetForm(); load();
    } catch (err) {
      alert(err.response?.data?.detail || 'Erro ao salvar requisição');
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <ClipboardList size={28} className="text-orange-600" />
          <h1 className="text-2xl font-bold">Requisições de Estoque</h1>
        </div>
        <div className="flex gap-2">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
            <option value="">Todos os status</option>
            <option value="pendente">Pendentes</option>
            <option value="aprovado">Liberadas</option>
            <option value="atendido">Atendidas</option>
            <option value="recebido">Recebidas</option>
            <option value="cancelado">Canceladas</option>
          </select>
          <button onClick={() => { resetForm(); setShowModal(true); }}
            className="bg-orange-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-orange-700 text-sm">
            <Plus size={18} /> Nova Requisição
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3">#</th>
              <th className="text-left p-3">Solicitante</th>
              <th className="text-left p-3">Dep. Solicitante</th>
              <th className="text-left p-3">Dep. Atendimento</th>
              <th className="text-center p-3">Itens</th>
              <th className="text-center p-3">Status</th>
              <th className="text-left p-3">Data</th>
              <th className="text-center p-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {requisicoes.map(r => (
              <tr key={r.id} className="border-t hover:bg-gray-50">
                <td className="p-3 font-medium">{r.id}</td>
                <td className="p-3">{r.requester_name || '-'}</td>
                <td className="p-3">{r.deposit_requesting_name}</td>
                <td className="p-3">{r.deposit_fulfilling_name}</td>
                <td className="p-3 text-center">{r.items.length}</td>
                <td className="p-3 text-center">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[r.status]}`}>
                    {statusLabels[r.status]}
                  </span>
                </td>
                <td className="p-3 text-gray-500 text-xs">{r.created_at ? new Date(r.created_at).toLocaleDateString('pt-BR') : '-'}</td>
                <td className="p-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button onClick={() => handlePrint(r)} className="p-1 text-gray-600 hover:text-gray-800" title="Imprimir"><Printer size={15} /></button>
                    {r.status === 'pendente' && canManage(r) && (
                      <>
                        <button onClick={() => handleEdit(r)} className="p-1 text-brand-600 hover:text-brand-800" title="Editar"><Edit size={15} /></button>
                        <button onClick={() => handleApprove(r)} className="p-1 text-brand-600 hover:text-brand-800" title="Liberar"><CheckCircle size={15} /></button>
                        <button onClick={() => handleCancel(r)} className="p-1 text-red-600 hover:text-red-800" title="Cancelar"><XCircle size={15} /></button>
                      </>
                    )}
                    {r.status === 'aprovado' && canFulfill(r) && (
                      <button onClick={() => openFulfill(r)} className="p-1 text-green-600 hover:text-green-800" title="Atender (saída)"><Truck size={15} /></button>
                    )}
                    {r.status === 'aprovado' && canManage(r) && (
                      <button onClick={() => handleCancel(r)} className="p-1 text-red-600 hover:text-red-800" title="Cancelar"><XCircle size={15} /></button>
                    )}
                    {r.status === 'atendido' && canReceive(r) && (
                      <button onClick={() => openReceive(r)} className="p-1 text-teal-600 hover:text-teal-800" title="Confirmar recebimento (entrada)"><ArrowUpCircle size={15} /></button>
                    )}
                    {(r.status === 'pendente' || r.status === 'cancelado') && canManage(r) && (
                      <button onClick={() => handleDelete(r.id)} className="p-1 text-red-600 hover:text-red-800" title="Remover"><Trash2 size={15} /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {requisicoes.length === 0 && (
              <tr><td colSpan={8} className="p-8 text-center text-gray-400">Nenhuma requisição encontrada</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3 sticky top-0 bg-white">
              <div className="p-2 rounded-xl bg-orange-100 text-orange-600">
                <ClipboardList size={20} />
              </div>
              <h2 className="text-lg font-bold">{editing ? 'Editar' : 'Nova'} Requisição</h2>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="px-6 py-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Depósito Solicitante *</label>
                    <select value={form.deposit_requesting_id}
                      onChange={e => setForm({...form, deposit_requesting_id: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" required>
                      <option value="">Selecione</option>
                      {deposits.filter(d => !d.parent_id).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Depósito Atendimento *</label>
                    <select value={form.deposit_fulfilling_id}
                      onChange={e => setForm({...form, deposit_fulfilling_id: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" required>
                      <option value="">Selecione</option>
                      {deposits.filter(d => !d.parent_id).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-2">Produtos</label>
                  <SearchInput products={products} onSelect={addItem} searchRef={searchRef} />
                  {form.items.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-6 mt-2">Busque e adicione produtos acima</p>
                  ) : (
                    <div className="space-y-2 mt-3">
                      {form.items.map(it => (
                        <div key={it.product_id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                          <span className="text-sm font-medium flex-1">{it.product_name}</span>
                          <div className="flex items-center gap-1.5">
                            <button type="button" onClick={() => updateItem(it.product_id, 'quantity_requested', Math.max(qtyMin(unitOf(it)), roundQty((it.quantity_requested || qtyMin(unitOf(it))) - qtyStep(unitOf(it)), unitOf(it))))}
                              className="w-8 h-8 rounded-full bg-white border flex items-center justify-center text-gray-600 text-lg hover:bg-gray-100">−</button>
                            <input type="number" min={qtyMin(unitOf(it))} step={qtyStep(unitOf(it))} value={it.quantity_requested}
                              ref={el => { qtyRefs.current[it.product_id] = el; }}
                              onChange={e => {
                                if (e.target.value === '') return;
                                const n = parseFloat(e.target.value);
                                if (isNaN(n)) return;
                                updateItem(it.product_id, 'quantity_requested', Math.max(qtyMin(unitOf(it)), roundQty(n, unitOf(it))));
                              }}
                              className="w-16 text-center font-bold text-sm border border-gray-200 rounded-lg py-1" />
                            <button type="button" onClick={() => updateItem(it.product_id, 'quantity_requested', roundQty((it.quantity_requested || qtyMin(unitOf(it))) + qtyStep(unitOf(it)), unitOf(it)))}
                              className="w-8 h-8 rounded-full bg-white border flex items-center justify-center text-gray-600 text-lg hover:bg-gray-100">+</button>
                            <span className="text-gray-300 mx-1">|</span>
                            <span className="text-xs text-gray-500">R$</span>
                            <input type="text" inputMode="decimal" value={it.unit_price}
                              onChange={e => updateItem(it.product_id, 'unit_price', formatDigitsToCurrency(currencyToDigits(e.target.value), 2))}
                              className="w-16 px-1 py-1 border rounded text-sm text-right" />
                            <button type="button" onClick={() => removeItem(it.product_id)}
                              className="ml-1 text-red-400 hover:text-red-600"><Trash2 size={15} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Motivo / Destino</label>
                  <CaseInput placeholder="Ex: Uso interno, Transferência, Cliente" value={form.reason}
                    onChange={e => setForm({...form, reason: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Observações</label>
                  <CaseTextarea placeholder="Observações" value={form.notes} rows={2}
                    onChange={e => setForm({...form, notes: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
              </div>
              <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2 bg-gray-50 rounded-b-2xl">
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }}
                  className="px-5 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100">Cancelar</button>
                <button type="submit"
                  className="px-5 py-2.5 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 shadow-sm">
                  {editing ? 'Salvar Alterações' : 'Criar Requisição'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {fulfilling && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3 sticky top-0 bg-white">
              <div className="p-2 rounded-xl bg-green-100 text-green-600">
                <Truck size={20} />
              </div>
              <h2 className="text-lg font-bold">Atender Requisição #{fulfilling.id}</h2>
              <span className="ml-auto text-sm text-gray-500">Liberada por {fulfilling.approver_name || '-'}</span>
            </div>
            <div className="px-6 py-4 space-y-2">
              <p className="text-sm text-gray-500 mb-3">Informe a quantidade entregue de cada item (parcial ou completa). Se informar mais que o solicitado, será pedida uma confirmação.</p>
              {fulfilling.items.map(it => {
                const u = unitOf(it);
                const approved = it.quantity_approved || it.quantity_requested;
                const bal = parentBalance[it.product_id];
                const balLabel = bal === undefined ? null : Math.max(0, bal);
                const over = bal > 0 && (fulfillQty[it.product_id] || 0) > bal;
                return (
                  <div key={it.product_id} className="bg-gray-50 rounded-lg px-3 py-2">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="text-sm font-medium truncate">{it.product_name}</div>
                        <div className="text-xs text-gray-500">
                          Solicitado: {it.quantity_requested}
                          {balLabel !== null ? ` · Saldo no Pai: ${balLabel}` : ''}
                        </div>
                        {over && <div className="text-xs text-red-600 mt-0.5">Atenção: quantidade maior que o saldo no depósito pai ({bal})</div>}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button type="button" onClick={() => setFulfillQty(q => ({ ...q, [it.product_id]: Math.max(0, roundQty((q[it.product_id] || 0) - qtyStep(u), u)) }))}
                          className="w-8 h-8 rounded-full bg-white border flex items-center justify-center text-gray-600 text-lg hover:bg-gray-100">−</button>
                        <input type="number" min="0" step={qtyStep(u)} value={fulfillQty[it.product_id] ?? 0}
                          onChange={e => {
                            if (e.target.value === '') return;
                            const n = parseFloat(e.target.value);
                            if (isNaN(n)) return;
                            const max = bal > 0 ? bal : approved;
                            setFulfillQty(q => ({ ...q, [it.product_id]: Math.max(0, Math.min(max, roundQty(n, u))) }));
                          }}
                          className="w-16 text-center font-bold text-sm border border-gray-200 rounded-lg py-1" />
                        <button type="button" onClick={() => setFulfillQty(q => ({ ...q, [it.product_id]: Math.min(bal > 0 ? bal : approved, roundQty((q[it.product_id] || 0) + qtyStep(u), u)) }))}
                          className="w-8 h-8 rounded-full bg-white border flex items-center justify-center text-gray-600 text-lg hover:bg-gray-100">+</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2 bg-gray-50 rounded-b-2xl">
              <button type="button" onClick={() => setFulfilling(null)}
                className="px-5 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100">Cancelar</button>
              <button type="button" onClick={handleFulfill}
                className="px-5 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 shadow-sm">Confirmar Atendimento</button>
            </div>
          </div>
        </div>
      )}

      {receiving && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3 sticky top-0 bg-white">
              <div className="p-2 rounded-xl bg-teal-100 text-teal-600">
                <ArrowUpCircle size={20} />
              </div>
              <h2 className="text-lg font-bold">Conferir Recebimento #{receiving.id}</h2>
              <span className="ml-auto text-sm text-gray-500">Enviado por {receiving.deposit_fulfilling_name || '-'}</span>
            </div>
            <div className="px-6 py-4 space-y-2">
              <p className="text-sm text-gray-500 mb-3">Confira a quantidade enviada e informe a quantidade realmente recebida de cada item.</p>
              {receiving.items.map(it => {
                const u = unitOf(it);
                const sent = it.quantity_fulfilled || it.quantity_approved || it.quantity_requested || 0;
                return (
                  <div key={it.product_id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                    <span className="text-sm font-medium flex-1">{it.product_name}</span>
                    <span className="text-xs text-gray-500 mr-2">Enviado: {sent}</span>
                    <div className="flex items-center gap-1.5">
                      <button type="button" onClick={() => setReceiveQty(q => ({ ...q, [it.product_id]: Math.max(0, roundQty((q[it.product_id] ?? 0) - qtyStep(u), u)) }))}
                        className="w-8 h-8 rounded-full bg-white border flex items-center justify-center text-gray-600 text-lg hover:bg-gray-100">−</button>
                      <input type="number" min="0" max={sent} step={qtyStep(u)} value={receiveQty[it.product_id] ?? 0}
                        onChange={e => {
                          if (e.target.value === '') return;
                          const n = parseFloat(e.target.value);
                          if (isNaN(n)) return;
                          setReceiveQty(q => ({ ...q, [it.product_id]: Math.max(0, Math.min(sent, roundQty(n, u))) }));
                        }}
                        className="w-16 text-center font-bold text-sm border border-gray-200 rounded-lg py-1" />
                      <button type="button" onClick={() => setReceiveQty(q => ({ ...q, [it.product_id]: Math.min(sent, roundQty((q[it.product_id] ?? 0) + qtyStep(u), u)) }))}
                        className="w-8 h-8 rounded-full bg-white border flex items-center justify-center text-gray-600 text-lg hover:bg-gray-100">+</button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2 bg-gray-50 rounded-b-2xl">
              <button type="button" onClick={() => setReceiving(null)}
                className="px-5 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100">Cancelar</button>
              <button type="button" onClick={handleReceive}
                className="px-5 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 shadow-sm">Confirmar Recebimento</button>
            </div>
          </div>
        </div>
      )}

      {printing && (
        <PrintPreview title={printing.title} onClose={() => setPrinting(null)} autoPrint>
          {printing.content}
        </PrintPreview>
      )}
    </div>
  );
}
