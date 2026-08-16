import { formatCurrency } from '../../services/format';
import PopupList from './PopupList';

export default function OverdueSection({ title, icon, data, bgColor, textColor, borderColor, popupLabel }) {
  return (
    <div className={`p-3 ${bgColor} rounded-lg relative`}>
      <div className="group relative inline-block">
        <span className={`flex items-center gap-1 ${textColor} font-medium cursor-pointer text-sm`}>
          {icon}{title}
        </span>
        <PopupList list={data?.list} borderColor={borderColor} label={popupLabel || 'Top 5 mais atrasados'} />
      </div>
      <div className="flex items-baseline justify-between mt-1">
        <span className="text-lg font-bold">{data ? data.count : 0}</span>
        <span className="font-semibold">{data ? formatCurrency(data.total) : formatCurrency(0)}</span>
      </div>
    </div>
  );
}
