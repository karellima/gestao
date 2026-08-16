import {
  parseCurrencyToNumber,
  formatNumberToCurrency,
  parseDecimal,
} from '../../services/masks';

export default function ProdutoCamposPreco({
  form, onCostChange, onMarkupChange, onMarkupBlur, onPriceChange, formatDecimal, formDecimals,
}) {
  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Preço de Custo</label>
          <input type="text" inputMode="decimal" placeholder="R$ 0,00" value={form.cost_price}
            onChange={e => onCostChange(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Markup</label>
          <input type="text" inputMode="decimal" placeholder="Ex.: 1,5000" value={form.markup}
            onChange={e => onMarkupChange(e.target.value)} onBlur={onMarkupBlur}
            className="w-full px-3 py-2 border rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Preço de Venda</label>
          <input type="text" inputMode="decimal" placeholder="R$ 0,00" value={form.price}
            onChange={e => onPriceChange(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-sm" />
        </div>
      </div>
      {form.cost_price && (form.markup || form.price) && (
        <p className="text-xs text-gray-400">
          {form.markup && form.cost_price ? `Preço de venda = custo × markup → R$ ${formatNumberToCurrency(parseCurrencyToNumber(form.cost_price, formDecimals) * parseDecimal(form.markup), formDecimals)}` : ''}
          {form.price && form.cost_price && !form.markup ? `Markup = venda ÷ custo → ${formatDecimal(parseCurrencyToNumber(form.price, formDecimals) / parseCurrencyToNumber(form.cost_price, formDecimals))}` : ''}
        </p>
      )}
    </>
  );
}
