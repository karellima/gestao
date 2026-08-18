import { useEffect } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

const config = {
  erro: { icon: AlertCircle, title: 'Erro', classes: 'border-red-200 bg-red-50 text-red-800' },
  sucesso: { icon: CheckCircle2, title: 'Sucesso', classes: 'border-green-200 bg-green-50 text-green-800' },
  aviso: { icon: Info, title: 'Aviso', classes: 'border-brand-200 bg-brand-50 text-brand-800' },
};

export default function Notificacao({ id, type, message, onClose }) {
  const item = config[type] || config.aviso;
  const Icon = item.icon;

  useEffect(() => {
    if (type === 'erro') return undefined;
    const timer = setTimeout(() => onClose(id), 4000);
    return () => clearTimeout(timer);
  }, [id, onClose, type]);

  return (
    <div className={`flex items-start gap-3 rounded-xl border p-4 shadow-lg ${item.classes}`} role="status">
      <Icon size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{item.title}</p>
        <p className="text-sm">{message}</p>
      </div>
      <button type="button" onClick={() => onClose(id)} aria-label="Fechar notificação" className="shrink-0">
        <X size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
