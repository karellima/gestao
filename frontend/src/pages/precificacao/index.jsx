import { useState, useEffect, useMemo, useRef } from 'react';
import api from '../../services/api';
import { useNotificacao } from '../../contexts/NotificacaoContext';
import { confirmar } from '../../utils/confirmar';
import { Calculator } from 'lucide-react';
import {
  currencyToDigits, formatDigitsToCurrency, parseCurrencyToNumber, formatNumberToCurrency,
  maskPercentInput, unitDecimals,
} from '../../services/masks';
import { defaultForm, saveBasePercents } from './percentuais-salvos';
import { toPayload, fromConfig, maskInt } from './conversao';
import BuscaDeProduto from './BuscaDeProduto';
import FormularioDeCustos from './FormularioDeCustos';
import ResultadoPrecificacao from './ResultadoPrecificacao';
import TabelaPrecificacoes from './TabelaPrecificacoes';

export default function Pricing() {
  const { notificar } = useNotificacao();
  const [products, setProducts] = useState([]);
  const [pricings, setPricings] = useState([]);
  const [search, setSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [form, setForm] = useState(defaultForm);
  const [decimals, setDecimals] = useState(2);
  const [result, setResult] = useState(null);
  const [calcLoading, setCalcLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const timer = useRef(null);
  const priceRef = useRef(null);

  const loadPricings = () => api.get('/pricing/').then(res => setPricings(res.data)).catch(() => {});
  const loadProducts = () => api.get('/products/').then(res => setProducts(res.data)).catch(() => {});
  useEffect(() => {
    loadProducts();
    loadPricings();
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return products.filter(p => (p.display_name || p.name).toLowerCase().includes(q));
  }, [products, search]);

  const selected = useMemo(() => products.find(p => String(p.id) === String(selectedProductId)) || null, [products, selectedProductId]);

  const handleSelectProduct = (p) => {
    setSelectedProductId(String(p.id));
    setSearch(p.display_name || p.name);
    setShowDropdown(false);
    setDecimals(unitDecimals(p.unit));
    const config = pricings.find(c => String(c.product_id) === String(p.id));
    if (config) {
      setForm(fromConfig(config, unitDecimals(p.unit)));
    } else {
      const f = defaultForm();
      const cost = p.cost_price ?? p.price ?? 0;
      if (cost) f.acquisition_price = formatNumberToCurrency(cost, unitDecimals(p.unit));
      setForm(f);
    }
    setMsg(null);
    setTimeout(() => priceRef.current?.focus(), 50);
  };

  const handleClearSelection = () => {
    setSelectedProductId('');
    setSearch('');
    setShowDropdown(false);
    setDecimals(2);
    setMsg(null);
  };

  useEffect(() => {
    const acquisition = parseCurrencyToNumber(form.acquisition_price, decimals);
    if (!acquisition || acquisition <= 0) { setResult(null); return; }
    setCalcLoading(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const res = await api.post('/pricing/calculate', toPayload(form, decimals));
        setResult(res.data);
      } catch { setResult(null); }
      finally { setCalcLoading(false); }
    }, 300);
    return () => clearTimeout(timer.current);
  }, [form, decimals]);

  const handleSave = async () => {
    if (!selectedProductId) { notificar.aviso('Selecione um produto'); return; }
    try {
      const payload = toPayload(form, decimals);
      payload.product_id = parseInt(selectedProductId, 10);
      await api.post('/pricing/', payload);
      loadPricings();
      loadProducts();
      setMsg('Precificação salva. Custo, markup e preço de venda atualizados no cadastro do produto.');
    } catch (err) { notificar.erro(err.response?.data?.detail || 'Erro ao salvar'); }
  };

  const handleDelete = async (pid) => {
    if (!confirmar('Remover esta precificação?')) return;
    try { await api.delete(`/pricing/${pid}`); loadPricings(); } catch (err) { notificar.erro(err.response?.data?.detail || 'Erro ao remover'); }
  };

  const handleEdit = (p) => {
    setSelectedProductId(String(p.product_id));
    setSearch(p.display_name || p.product_name || '');
    const prod = products.find(x => String(x.id) === String(p.product_id));
    const d = prod ? unitDecimals(prod.unit) : 2;
    setDecimals(d);
    setForm(fromConfig(p, d));
    setResult(null);
    setShowDropdown(false);
    setMsg(null);
    setTimeout(() => priceRef.current?.focus(), 50);
  };

  const setLote = (e) => {
    setForm(f => ({ ...f, lote: maskInt(e.target.value) }));
  };

  const setCurrency = (e) => {
    setForm(f => ({ ...f, acquisition_price: formatDigitsToCurrency(currencyToDigits(e.target.value), decimals) }));
  };

  const setPercent = (k) => (e) => {
    setForm(f => {
      const nf = { ...f, [k]: maskPercentInput(e.target.value) };
      saveBasePercents(nf);
      return nf;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Calculator size={28} className="text-brand-600" />
        <h1 className="text-2xl font-bold">Precificação de Produtos</h1>
      </div>

      <BuscaDeProduto
        search={search}
        setSearch={setSearch}
        showDropdown={showDropdown}
        setShowDropdown={setShowDropdown}
        selectedProductId={selectedProductId}
        selected={selected}
        filtered={filtered}
        onSelect={handleSelectProduct}
        onClear={handleClearSelection}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FormularioDeCustos
          form={form}
          decimals={decimals}
          result={result}
          calcLoading={calcLoading}
          priceRef={priceRef}
          onCurrencyChange={setCurrency}
          onLoteChange={setLote}
          onPercentChange={setPercent}
        />
        <ResultadoPrecificacao
          form={form}
          result={result}
          selectedProductId={selectedProductId}
          msg={msg}
          onPercentChange={setPercent}
          onSave={handleSave}
        />
      </div>

      <TabelaPrecificacoes
        pricings={pricings}
        products={products}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    </div>
  );
}
