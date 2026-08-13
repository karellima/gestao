import { formatCurrency } from '../../services/format';

export const getAvgPrice = b => b.quantity_entries > 0 ? b.total_value_entries / b.quantity_entries : 0;

const balanceColumnsFull = [
  { key: 'product_name', header: 'Produto', accessor: r => r.product_name, width: 30, align: 'left' },
  { key: 'quantity_entries', header: 'Entradas', accessor: r => r.quantity_entries, width: 12, align: 'right' },
  { key: 'quantity_exits', header: 'Saídas', accessor: r => r.quantity_exits, width: 12, align: 'right' },
  { key: 'balance', header: 'Saldo', accessor: r => r.balance, width: 12, align: 'right' },
  { key: 'total_value_entries', header: 'Valor Entradas', accessor: r => formatCurrency(r.total_value_entries), width: 18, align: 'right' },
  { key: 'total_value_exits', header: 'Valor Saídas', accessor: r => formatCurrency(r.total_value_exits), width: 18, align: 'right' },
];

const balanceColumnsNoFin = [
  balanceColumnsFull[0],
  { ...balanceColumnsFull[1], width: 15 },
  { ...balanceColumnsFull[2], width: 15 },
  { ...balanceColumnsFull[3], width: 15 },
];

const syntheticColumnsFull = [
  { key: 'product_name', header: 'Produto', accessor: r => r.product_name, width: 30, align: 'left' },
  { key: 'balance', header: 'Qtd', accessor: r => r.balance, width: 12, align: 'right' },
  { key: 'average_price', header: 'Preço Unit.', accessor: r => formatCurrency(getAvgPrice(r)), width: 14, align: 'right' },
  { key: 'total_value_entries', header: 'Total', accessor: r => formatCurrency(r.total_value_entries), width: 18, align: 'right' },
];

const syntheticColumnsNoFin = [syntheticColumnsFull[0], { ...syntheticColumnsFull[1], width: 15 }];

const movementColumns = [
  { key: 'movement_date', header: 'Data', accessor: r => r.movement_date ? new Date(r.movement_date).toLocaleDateString('pt-BR') : '-', width: 14, align: 'left' },
  { key: 'deposit_name', header: 'Depósito', accessor: r => r.deposit_name, width: 20, align: 'left' },
  { key: 'product_name', header: 'Produto', accessor: r => r.product_name, width: 25, align: 'left' },
  { key: 'movement_type', header: 'Tipo', accessor: r => r.movement_type === 'entrada' ? 'Entrada' : 'Saída', width: 10, align: 'center' },
  { key: 'quantity', header: 'Qtd', accessor: r => r.quantity, width: 8, align: 'right' },
  { key: 'unit_price', header: 'Preço Unit.', accessor: r => formatCurrency(r.unit_price || 0), width: 14, align: 'right' },
  { key: 'total_value', header: 'Total', accessor: r => formatCurrency(r.total_value || 0), width: 14, align: 'right' },
  { key: 'reason', header: 'Motivo', accessor: r => r.reason || '-', width: 20, align: 'left' },
];

export const getBalanceCols = financialData => financialData ? balanceColumnsFull : balanceColumnsNoFin;
export const getSyntheticCols = financialData => financialData ? syntheticColumnsFull : syntheticColumnsNoFin;
export const getMovementCols = () => movementColumns;
