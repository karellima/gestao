import RequisicaoActions from './RequisicaoActions';

function displayValue(value) {
  return value || '-';
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString('pt-BR') : '-';
}

export default function RequisicaoRow({ requisicao, statusLabels, statusColors, permissions, handlers }) {
  return (
    <tr className="border-t hover:bg-gray-50">
      <td className="p-3 font-medium">{requisicao.id}</td>
      <td className="p-3">{displayValue(requisicao.requester_name)}</td>
      <td className="p-3">{requisicao.deposit_requesting_name}</td>
      <td className="p-3">{requisicao.deposit_fulfilling_name}</td>
      <td className="p-3 text-center">{requisicao.items.length}</td>
      <td className="p-3 text-center">
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[requisicao.status]}`}>
          {statusLabels[requisicao.status]}
        </span>
      </td>
      <td className="p-3 text-gray-500 text-xs">{formatDate(requisicao.created_at)}</td>
      <td className="p-3 text-center">
        <div className="flex items-center justify-center gap-1">
          <RequisicaoActions requisicao={requisicao} permissions={permissions} handlers={handlers} />
        </div>
      </td>
    </tr>
  );
}
