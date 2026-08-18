import { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../services/api';
import { useNotificacao } from '../contexts/NotificacaoContext';
import { BarChart3, ArrowRightLeft, AlertTriangle, TrendingUp, Printer } from 'lucide-react';
import PrintPreview from '../components/PrintPreview';

const localDateStr = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const toUTC = (dateStr, endOfDay) => {
  if (!dateStr) return undefined;
  const d = endOfDay ? new Date(`${dateStr}T23:59:59.999`) : new Date(`${dateStr}T00:00:00`);
  return d.toISOString();
};

export default function TransferReport() {
  const { notificar } = useNotificacao();
  const [deposits, setDeposits] = useState([]);
  const [report, setReport] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterDeposit, setFilterDeposit] = useState('');
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    return localDateStr(new Date(now.getFullYear(), now.getMonth(), 1));
  });
  const [endDate, setEndDate] = useState(() => localDateStr(new Date()));
  const [printing, setPrinting] = useState(null);

  useEffect(() => {
    api.get('/deposits/mine').then(res => setDeposits(res.data)).catch(() => {});
  }, []);

  const subDeposits = useMemo(() => deposits.filter(d => d.parent_id), [deposits]);
  const parentDeposits = useMemo(() => deposits.filter(d => !d.parent_id), [deposits]);

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterDeposit) params.deposit_id = filterDeposit;
      const startUTC = toUTC(startDate, false);
      const endUTC = toUTC(endDate, true);
      if (startUTC) params.start_date = startUTC;
      if (endUTC) params.end_date = endUTC;
      const res = await api.get('/stock/transfer-report/', { params });
      setReport(res.data);
    } catch (err) {
      notificar.erro(err.response?.data?.detail || 'Erro ao carregar relatório');
    } finally { setLoading(false); }
  }, [filterDeposit, startDate, endDate, notificar]);

  useEffect(() => { loadReport(); }, [loadReport]);

  const summaries = useMemo(() => {
    const byDeposit = {};
    report.forEach(r => {
      if (!byDeposit[r.deposit_id]) byDeposit[r.deposit_id] = {
        deposit_name: r.deposit_name,
        abastecimento_qty: 0, devolucao_qty: 0, avaria_qty: 0, venda_qty: 0, venda_total: 0,
      };
      byDeposit[r.deposit_id].abastecimento_qty += r.abastecimento_qty;
      byDeposit[r.deposit_id].devolucao_qty += r.devolucao_qty;
      byDeposit[r.deposit_id].avaria_qty += r.avaria_qty;
      byDeposit[r.deposit_id].venda_qty += r.venda_qty;
      byDeposit[r.deposit_id].venda_total += r.venda_total;
    });
    return Object.values(byDeposit);
  }, [report]);

  const formatDate = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '-';

  const handlePrint = () => {
    const filterLabel = deposits.find(d => String(d.id) === String(filterDeposit))?.name || 'Todos';
    setPrinting({
      title: 'Relatório de Abastecimento x Devolução x Vendas',
      content: (
        <div>
          <div className="mb-4 text-sm">
            <p>Depósito: <span className="font-medium">{filterLabel}</span></p>
            <p>Período: <span className="font-medium">{formatDate(startDate)} a {formatDate(endDate)}</span></p>
          </div>
          {summaries.length > 0 && (
            <table className="w-full text-sm border-collapse mb-6">
              <thead>
                <tr className="bg-gray-50">
                  <th className="p-3 text-left">Depósito</th>
                  <th className="p-3 text-right">Abastecimento</th>
                  <th className="p-3 text-right">Devolução</th>
                  <th className="p-3 text-right">Avaria</th>
                  <th className="p-3 text-right">Venda</th>
                  <th className="p-3 text-right">Total R$</th>
                </tr>
              </thead>
              <tbody>
                {summaries.map(s => (
                  <tr key={s.deposit_name} className="border-t">
                    <td className="p-3">{s.deposit_name}</td>
                    <td className="p-3 text-right">{s.abastecimento_qty}</td>
                    <td className="p-3 text-right">{s.devolucao_qty}</td>
                    <td className="p-3 text-right">{s.avaria_qty}</td>
                    <td className="p-3 text-right font-bold">{s.venda_qty}</td>
                    <td className="p-3 text-right">R$ {s.venda_total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="p-3 text-left">Depósito</th>
                  <th className="p-3 text-left">Produto</th>
                  <th className="p-3 text-center">Abast.</th>
                <th className="p-3 text-center">Devol.</th>
                <th className="p-3 text-center">Avaria</th>
                <th className="p-3 text-center">Venda</th>
                <th className="p-3 text-right">Total R$</th>
              </tr>
            </thead>
            <tbody>
              {report.map((r, i) => (
                <tr key={`${r.deposit_id}-${r.product_id}-${i}`} className="border-t">
                  <td className="p-3">{r.deposit_name}</td>
                  <td className="p-3">{r.product_name}</td>
                  <td className="p-3 text-center">{r.abastecimento_qty}</td>
                  <td className="p-3 text-center">{r.devolucao_qty}</td>
                  <td className="p-3 text-center">{r.avaria_qty}</td>
                  <td className="p-3 text-center font-bold">{r.venda_qty}</td>
                  <td className="p-3 text-right">R$ {r.venda_total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ),
    });
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <BarChart3 size={28} className="text-brand-600" />
        <h1 className="text-2xl font-bold">Relatório de Abastecimento x Devolução x Vendas</h1>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Depósito</label>
            <select value={filterDeposit} onChange={e => setFilterDeposit(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm">
              <option value="">Todos</option>
              {parentDeposits.length > 0 && (
                <optgroup label="Depósitos">
                  {parentDeposits.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </optgroup>
              )}
              <optgroup label="Sub-depósitos">
                {subDeposits.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </optgroup>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Data Início</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Data Fim</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm" />
          </div>
          {report.length > 0 && (
            <button onClick={handlePrint}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg text-sm hover:bg-gray-700 flex items-center gap-2">
              <Printer size={16} /> Imprimir
            </button>
          )}
        </div>
      </div>

      {summaries.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {summaries.map(s => (
            <div key={s.deposit_name} className="bg-white rounded-xl shadow-sm p-4">
              <h3 className="font-semibold text-sm mb-2">{s.deposit_name}</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-brand-600">Abastecimento</span><span className="font-medium">{s.abastecimento_qty}</span></div>
                <div className="flex justify-between"><span className="text-orange-600">Devolução</span><span className="font-medium">{s.devolucao_qty}</span></div>
                <div className="flex justify-between"><span className="text-red-600">Avarias</span><span className="font-medium">{s.avaria_qty}</span></div>
                <div className="flex justify-between border-t pt-1 mt-1"><span className="text-green-600 font-semibold">Vendas</span><span className="font-bold text-green-600">{s.venda_qty}</span></div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Total R$</span><span className="font-medium">R$ {s.venda_total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3">Depósito</th>
              <th className="text-left p-3">Produto</th>
              <th className="text-center p-3">
                <span className="flex items-center justify-center gap-1"><ArrowRightLeft size={12} className="text-brand-600" /> Abast.</span>
              </th>
              <th className="text-center p-3">
                <span className="flex items-center justify-center gap-1"><ArrowRightLeft size={12} className="text-orange-600" /> Devol.</span>
              </th>
              <th className="text-center p-3">
                <span className="flex items-center justify-center gap-1"><AlertTriangle size={12} className="text-red-600" /> Avaria</span>
              </th>
              <th className="text-center p-3">
                <span className="flex items-center justify-center gap-1"><TrendingUp size={12} className="text-green-600" /> Venda</span>
              </th>
              <th className="text-right p-3">Total R$</th>
            </tr>
          </thead>
          <tbody>
            {report.map((r, i) => (
              <tr key={`${r.deposit_id}-${r.product_id}-${i}`} className="border-t hover:bg-gray-50">
                <td className="p-3">{r.deposit_name}</td>
                <td className="p-3 font-medium">{r.product_name}</td>
                <td className="p-3 text-center text-brand-600 font-medium">{r.abastecimento_qty}</td>
                <td className="p-3 text-center text-orange-600 font-medium">{r.devolucao_qty}</td>
                <td className="p-3 text-center text-red-600 font-medium">{r.avaria_qty}</td>
                <td className="p-3 text-center text-green-600 font-bold">{r.venda_qty}</td>
                <td className="p-3 text-right font-medium">R$ {r.venda_total.toFixed(2)}</td>
              </tr>
            ))}
            {report.length === 0 && !loading && (
              <tr><td colSpan={7} className="p-8 text-center text-gray-400">
                {filterDeposit
                  ? 'Nenhum dado de abastecimento, devolução ou avaria para este depósito no período.'
                  : 'Nenhum dado de abastecimento, devolução ou avaria no período selecionado.'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
      {printing && (
        <PrintPreview title={printing.title} onClose={() => setPrinting(null)} autoPrint>
          {printing.content}
        </PrintPreview>
      )}
    </div>
  );
}
