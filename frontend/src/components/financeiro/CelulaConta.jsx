import { Landmark } from 'lucide-react';

export default function CelulaConta({ transaction, accountTypeIcons, accountTypeColors }) {
  const AccountIcon = transaction.account
    ? accountTypeIcons[transaction.account.account_type] || Landmark
    : null;
  const accountColor = transaction.account
    ? accountTypeColors[transaction.account.account_type] || 'text-gray-600'
    : '';

  return (
    <td className="p-3 text-gray-500 text-xs">
      {transaction.account ? (
        <div className="flex items-center gap-1.5">
          <AccountIcon size={14} className={accountColor} />
          <span className="truncate max-w-[80px]">{transaction.account.name}</span>
        </div>
      ) : '-'}
    </td>
  );
}
