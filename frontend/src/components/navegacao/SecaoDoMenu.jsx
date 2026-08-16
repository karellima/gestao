import { ChevronDown, ChevronRight } from 'lucide-react';
import ItemDoMenu from './ItemDoMenu';
import { getVisibleItems } from './permissoes-do-menu';

export default function SecaoDoMenu({ section, permissions, sidebarOpen, collapsedSections, toggleSection }) {
  const visibleItems = getVisibleItems(section, permissions);
  if (visibleItems.length === 0 && section.label !== 'Geral') return null;

  return (
    <div className="mb-2">
      {sidebarOpen ? (
        <button
          onClick={() => toggleSection(section.label)}
          className="flex items-center justify-between w-full px-3 py-2 rounded-xl text-sm font-medium text-brand-900 hover:bg-brand-100 hover:text-brand-700 transition-colors"
        >
          {section.label}
          {collapsedSections[section.label] ? <ChevronRight size={14} className="text-brand-400" /> : <ChevronDown size={14} className="text-brand-400" />}
        </button>
      ) : (
        <div className="px-3 py-1.5 text-xs font-semibold text-brand-400 text-center mb-1" title={section.label}>
          {section.label.charAt(0)}
        </div>
      )}
      {sidebarOpen && !collapsedSections[section.label] && visibleItems.map(item => (
        <ItemDoMenu key={item.path} item={item} collapsed={false} />
      ))}
      {!sidebarOpen && visibleItems.map(item => (
        <ItemDoMenu key={item.path} item={item} collapsed />
      ))}
    </div>
  );
}
