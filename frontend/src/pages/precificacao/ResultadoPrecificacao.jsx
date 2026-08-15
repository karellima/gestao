import { Calculator, Percent, Save } from 'lucide-react';
import { PERCENT_FIELDS, PERCENT_LABELS } from './percentuais-salvos';
import { fmtMoney, fmtPct } from './conversao';

const inputCls = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500';
const labelCls = 'block text-xs font-medium text-slate-600 mb-1';

export default function ResultadoPrecificacao({
  form,
  result,
  selectedProductId,
  msg,
  onPercentChange,
  onSave,
}) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Percent size={16} className="text-brand-600" /> Estratégia de Margem & Impostos</h3>
        <div className="grid grid-cols-2 gap-3">
          {PERCENT_FIELDS.slice(7).map(k => (
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

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Calculator size={16} className="text-emerald-600" /> Resultado da Precificação</h3>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">Custo unitário</span><span className="font-medium">R$ {fmtMoney(result?.custo_unitario)}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">% deduções variáveis</span><span className="font-medium">{fmtPct(result?.total_deducoes_pct)}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Custos variáveis</span><span className="font-medium">R$ {fmtMoney(result?.custos_variaveis)}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Total custos</span><span className="font-medium">R$ {fmtMoney(result?.total_custos)}</span></div>
        </div>
        {result && result.preco_venda > 0 && (
          <div className="mt-4 border-t border-slate-100 pt-3 text-sm">
            <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Confronto</h4>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <div className="flex justify-between"><span className="text-slate-500">(-) Custos diretos</span><span className="font-medium">R$ {fmtMoney(result.custos_diretos)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">(-) Despesas variáveis</span><span className="font-medium">R$ {fmtMoney(result.despesas_variaveis)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">(-) Impostos</span><span className="font-medium">R$ {fmtMoney(result.impostos_rs)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">(-) Total custos</span><span className="font-medium">R$ {fmtMoney(result.total_custos_rs)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500 font-medium">(=) Margem R$</span><span className="font-bold text-emerald-600">R$ {fmtMoney(result.margem_rs)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500 font-medium">(=) % Margem</span><span className="font-bold text-emerald-600">{fmtPct(result.margem_pct)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Markup multiplicador</span><span className="font-medium">{result.markup_multiplicador.toFixed(4).replace('.', ',')}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Markup resultado</span><span className="font-medium">R$ {fmtMoney(result.markup_resultado)}</span></div>
            </div>
          </div>
        )}
        <div className="flex gap-2 mt-4">
          <button onClick={onSave} disabled={!selectedProductId}
            className={`px-4 py-2 rounded-lg text-sm flex items-center gap-2 ${selectedProductId
              ? 'bg-brand-700 text-white hover:bg-brand-800'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
            <Save size={16} /> Salvar Precificação
          </button>
        </div>
        {!selectedProductId && <p className="mt-2 text-xs text-slate-400">Selecione um produto para salvar os parâmetros.</p>}
        {msg && <p className="mt-3 text-sm text-emerald-600">{msg}</p>}
      </div>
    </div>
  );
}
