import PrintPreview from '../../components/PrintPreview';

function PrintCell({ visible, children }) {
  if (!visible) return null;
  return <td className="p-3 text-right">{children}</td>;
}

function RequisicaoImpressaoRow({ item, status }) {
  const hasShipment = ['atendido', 'recebido'].includes(status);

  return (
    <tr className="border-t">
      <td className="p-3">{item.product_name}</td>
      <td className="p-3 text-right">{item.quantity_requested}</td>
      <PrintCell visible={status !== 'pendente'}>{item.quantity_approved || item.quantity_requested}</PrintCell>
      <PrintCell visible={hasShipment}>{item.quantity_fulfilled ?? '-'}</PrintCell>
      <PrintCell visible={status === 'recebido'}>{item.quantity_received ?? '-'}</PrintCell>
      <PrintCell visible={hasShipment}>{item.unit_price ? `R$ ${item.unit_price.toFixed(2)}` : '-'}</PrintCell>
    </tr>
  );
}

function PrintHeaderCell({ visible, children }) {
  if (!visible) return null;
  return <th className="p-3 text-right">{children}</th>;
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString('pt-BR') : '-';
}

function PrintOptionalParagraph({ visible, label, children }) {
  if (!visible) return null;
  return <p className="text-sm mb-4"><span className="font-medium">{label}:</span> {children}</p>;
}

function PrintDetails({ requisicao, userMap, statusLabels }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 text-sm mb-6">
        <div><span className="font-medium">Solicitante:</span> {userMap[requisicao.requester_id] || '-'}</div>
        <div className="text-right"><span className="font-medium">Status:</span> {statusLabels[requisicao.status]}</div>
        <div><span className="font-medium">Depósito Solicitante:</span> {requisicao.deposit_requesting_name}</div>
        <div className="text-right"><span className="font-medium">Depósito Atendimento:</span> {requisicao.deposit_fulfilling_name}</div>
        <div><span className="font-medium">Data:</span> {formatDate(requisicao.created_at)}</div>
        {requisicao.approver_name && <div className="text-right"><span className="font-medium">Aprovador:</span> {requisicao.approver_name}</div>}
      </div>
      <PrintOptionalParagraph visible={Boolean(requisicao.reason)} label="Motivo">{requisicao.reason}</PrintOptionalParagraph>
      <PrintOptionalParagraph visible={Boolean(requisicao.notes)} label="Observações">{requisicao.notes}</PrintOptionalParagraph>
    </>
  );
}

function PrintTableHeader({ status }) {
  const hasShipment = ['atendido', 'recebido'].includes(status);
  return (
    <tr className="bg-gray-50">
      <th className="p-3 text-left">Produto</th>
      <th className="p-3 text-right">Solicitado</th>
      <PrintHeaderCell visible={status !== 'pendente'}>Aprovado</PrintHeaderCell>
      <PrintHeaderCell visible={hasShipment}>Enviado</PrintHeaderCell>
      <PrintHeaderCell visible={status === 'recebido'}>Recebido</PrintHeaderCell>
      <PrintHeaderCell visible={hasShipment}>Preço Unit.</PrintHeaderCell>
    </tr>
  );
}

function PrintTable({ requisicao }) {
  return (
    <table className="w-full text-sm border-collapse">
      <thead><PrintTableHeader status={requisicao.status} /></thead>
      <tbody>
        {requisicao.items.map(item => <RequisicaoImpressaoRow key={item.id || item.product_id} item={item} status={requisicao.status} />)}
      </tbody>
    </table>
  );
}

export default function ImpressaoRequisicao({ requisicao, userMap, statusLabels, onClose }) {

  return (
    <PrintPreview title={`Requisição #${requisicao.id}`} onClose={onClose} autoPrint>
      <div>
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold">Requisição de Estoque #{requisicao.id}</h1>
          <p className="text-sm text-gray-500">Sistema de Gestão</p>
          <p className="text-xs text-gray-400">Gerado em {new Date().toLocaleString('pt-BR')}</p>
        </div>
        <PrintDetails requisicao={requisicao} userMap={userMap} statusLabels={statusLabels} />
        <PrintTable requisicao={requisicao} />
      </div>
    </PrintPreview>
  );
}
