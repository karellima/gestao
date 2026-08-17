import { Trash2 } from 'lucide-react';
import { currencyToDigits, formatDigitsToCurrency, parseCurrencyToNumber, qtyStep, roundQty } from '../../services/masks';

export default function TabelaDeItens({ items, qtyRefs, unitOf, total, onUpdateItem, onRemove }) {
  if (items.length === 0) return <p className="text-sm text-gray-400 text-center py-4">Nenhum produto adicionado</p>;

  return (
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
            <td className="p-2"><input type="number" min={qtyStep(unitOf(it))} step={qtyStep(unitOf(it))} value={it.quantity} ref={el => { qtyRefs.current[it.productId] = el; }} onChange={e => onUpdateItem(it.productId, 'quantity', roundQty(e.target.value, unitOf(it)))} className="w-16 px-2 py-1 border rounded text-sm text-center" /></td>
            <td className="p-2"><input type="text" inputMode="decimal" value={it.unitPrice} onChange={e => onUpdateItem(it.productId, 'unitPrice', formatDigitsToCurrency(currencyToDigits(e.target.value), 2))} className="w-24 px-2 py-1 border rounded text-sm text-right" /></td>
            <td className="p-2 text-right font-medium">R$ {(it.quantity * parseCurrencyToNumber(it.unitPrice, 2)).toFixed(2)}</td>
            <td className="p-2 text-center"><button type="button" onClick={() => onRemove(it.productId)} className="text-red-500"><Trash2 size={16} /></button></td>
          </tr>
        ))}
      </tbody>
      <tfoot className="bg-gray-50 font-bold"><tr>
        <td colSpan={3} className="p-2 text-right">Total:</td>
        <td className="p-2 text-right">R$ {total.toFixed(2)}</td>
        <td></td>
      </tr></tfoot>
    </table>
  );
}
