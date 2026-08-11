import { ChevronDown, ChevronRight, Edit, Trash2 } from 'lucide-react';

function sortByName(categories) {
  return [...categories].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

export default function CategoryTree({
  rootCategories,
  allCategories,
  expanded,
  onToggle,
  onEdit,
  onDelete,
  showType = false,
}) {
  const getSubcategories = (parentId) => sortByName(
    allCategories.filter(category => category.parent_id === parentId),
  );

  const renderCategory = (category, level = 0) => {
    const subcategories = getSubcategories(category.id);
    const isExpanded = expanded[category.id];
    return (
      <div key={category.id}>
        <div
          className={`flex items-center gap-2 p-3 border-b hover:bg-gray-50 ${level > 0 ? 'bg-gray-25' : ''}`}
          style={{ paddingLeft: `${12 + level * 24}px` }}
        >
          {subcategories.length > 0 ? (
            <button onClick={() => onToggle(category.id)} className="text-gray-400 hover:text-gray-600">
              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          ) : <div className="w-4" />}
          {showType && (
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${category.type === 'receita' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {category.type === 'receita' ? 'Receita' : 'Despesa'}
            </span>
          )}
          <span className={level > 0 ? 'text-sm' : 'font-medium'}>{category.name}</span>
          {subcategories.length > 0 && (
            <span className={`text-xs text-gray-400 ${showType ? 'ml-1' : 'ml-2'}`}>
              ({subcategories.length}{showType ? '' : ' sub'})
            </span>
          )}
          <div className="flex-1" />
          <button onClick={() => onEdit(category)} className="text-brand-600 hover:text-brand-800 mr-2">
            <Edit size={14} />
          </button>
          <button onClick={() => onDelete(category.id)} className="text-red-600 hover:text-red-800">
            <Trash2 size={14} />
          </button>
        </div>
        {isExpanded && subcategories.map(subcategory => renderCategory(subcategory, level + 1))}
      </div>
    );
  };

  return sortByName(rootCategories).map(category => renderCategory(category));
}
