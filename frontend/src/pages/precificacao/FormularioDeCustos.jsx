import { Tag, Percent, TrendingUp } from 'lucide-react';
import { PERCENT_FIELDS, PERCENT_LABELS } from './percentuais-salvos';
import { fmtMoney } from './conversao';

const inputCls = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500';
const labelCls = 'block text-xs font-medium text-slate-600 mb-1';

export default function FormularioDeCustos({
  form,
  decimals,
  result,
  calcLoading,
  priceRef,
  onCurrencyChange,
  onLoteChange,
  onPercentChange,
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-5">
      <h3 className="font-semibold text-sm flex items-center gap-2"><Tag size={16} className="text-brand-600" /> Custos Diretos & Deduções Variáveis</h3>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Preço de Aquisição (R$)</label>
          <input ref={priceRef} type="text" inputMode="decimal" value={form.acquisition_price} onChange={onCurrencyChange} className={inputCls} placeholder={decimals === 3 ? '0,000' : '0,00'} />
        </div>
        <div>
          <label className={labelCls}>Lote (quantidade)</label>
          <input type="text" inputMode="numeric" value={form.lote} onChange={onLoteChange} className={inputCls} placeholder="1" />
        </div>
      </div>

      <div className={`rounded-2xl p-4 flex items-center justify-between gap-3 ${result && result.preco_venda > 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-slate-50 border border-slate-200'}`}>
        <div>
          <div className={`text-xs font-semibold uppercase tracking-wide ${result && result.preco_venda > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>Valor de Venda</div>
          {calcLoading ? (
            <p className="text-sm text-slate-400 mt-1">Calculando...</p>
          ) : result && result.preco_venda > 0 ? (
            <div className="text-3xl font-bold text-emerald-700 mt-1">R$ {fmtMoney(result.preco_venda)}</div>
          ) : (
            <p className="text-sm text-slate-400 mt-1">Informe o preço de aquisição.</p>
          )}
        </div>
        <TrendingUp size={28} className={result && result.preco_venda > 0 ? 'text-emerald-500' : 'text-slate-300'} />
      </div>

      <div>
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Deduções Variáveis (%)</div>
        <div className="grid grid-cols-2 gap-3">
          {PERCENT_FIELDS.slice(0, 7).map(k => (
            <div key={k}>
              <label className={labelCls}>{PERCENT_LABELS[k]}</label>
              <div className="relative">
                <input type="text" inputMode="decimal" value={form[k]} onChange={onPercentChange(k)} className={inputCls + ' pr-7'} />
                <Percent size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
