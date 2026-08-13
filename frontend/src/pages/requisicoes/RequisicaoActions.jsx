import { ArrowUpCircle, CheckCircle, Edit, Printer, Trash2, Truck, XCircle } from 'lucide-react';

function ActionButton({ icon: Icon, title, className, onClick }) {
  return <button onClick={onClick} className={`p-1 ${className}`} title={title}><Icon size={15} /></button>;
}

function PrintAction({ requisicao, onPrint }) {
  return <ActionButton icon={Printer} title="Imprimir" className="text-gray-600 hover:text-gray-800" onClick={() => onPrint(requisicao)} />;
}

function PendingActions({ requisicao, canManage, onEdit, onApprove, onCancel, onDelete }) {
  if (!canManage) return null;
  return (
    <>
      <ActionButton icon={Edit} title="Editar" className="text-brand-600 hover:text-brand-800" onClick={() => onEdit(requisicao)} />
      <ActionButton icon={CheckCircle} title="Liberar" className="text-brand-600 hover:text-brand-800" onClick={() => onApprove(requisicao)} />
      <ActionButton icon={XCircle} title="Cancelar" className="text-red-600 hover:text-red-800" onClick={() => onCancel(requisicao)} />
      <ActionButton icon={Trash2} title="Remover" className="text-red-600 hover:text-red-800" onClick={() => onDelete(requisicao.id)} />
    </>
  );
}

function ApprovedActions({ requisicao, canFulfill, canManage, onFulfill, onCancel }) {
  return (
    <>
      {canFulfill && <ActionButton icon={Truck} title="Atender (saída)" className="text-green-600 hover:text-green-800" onClick={() => onFulfill(requisicao)} />}
      {canManage && <ActionButton icon={XCircle} title="Cancelar" className="text-red-600 hover:text-red-800" onClick={() => onCancel(requisicao)} />}
    </>
  );
}

function ReceiveAction({ requisicao, canReceive, onReceive }) {
  if (!canReceive) return null;
  return <ActionButton icon={ArrowUpCircle} title="Confirmar recebimento (entrada)" className="text-teal-600 hover:text-teal-800" onClick={() => onReceive(requisicao)} />;
}

function DeleteAction({ requisicao, canManage, onDelete }) {
  if (!canManage) return null;
  return <ActionButton icon={Trash2} title="Remover" className="text-red-600 hover:text-red-800" onClick={() => onDelete(requisicao.id)} />;
}

export default function RequisicaoActions({ requisicao, permissions, handlers }) {
  const Action = {
    pendente: PendingActions,
    aprovado: ApprovedActions,
    atendido: ReceiveAction,
    cancelado: DeleteAction,
  }[requisicao.status];
  const allowed = {
    canManage: permissions.canManage(requisicao),
    canFulfill: permissions.canFulfill(requisicao),
    canReceive: permissions.canReceive(requisicao),
  };
  return (
    <>
      <PrintAction requisicao={requisicao} onPrint={handlers.onPrint} />
      {Action && <Action requisicao={requisicao} {...allowed} {...handlers} />}
    </>
  );
}
