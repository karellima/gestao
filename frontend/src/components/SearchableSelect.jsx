import { useState, useRef, useEffect, useId } from 'react';
import { Search, ChevronDown, X } from 'lucide-react';

function comboboxAccessibility({ ariaLabel, placeholder, disabled, required, open, listboxId }) {
  return {
    role: 'combobox',
    tabIndex: disabled ? -1 : 0,
    'aria-label': ariaLabel || placeholder || 'Seleção',
    'aria-controls': listboxId,
    'aria-expanded': open,
    'aria-haspopup': 'listbox',
    'aria-disabled': disabled,
    'aria-required': required,
  };
}

export default function SearchableSelect({ options, value, onChange, placeholder, required, disabled, renderOption, renderSelected, ariaLabel }) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const ref = useRef(null);
  const inputRef = useRef(null);
  const listboxId = useId();
  const accessibility = comboboxAccessibility({
    ariaLabel, placeholder, disabled, required, open, listboxId,
  });

  const selected = options.find(o => o.value === value);
  const filtered = options.filter(o =>
    String(o.label ?? '').toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (open) {
      setSearch('');
      setHighlighted(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    setHighlighted(0);
  }, [search]);

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted(h => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted(h => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[highlighted]) {
        onChange(filtered[highlighted].value);
        setOpen(false);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const handleTriggerKeyDown = (e) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const select = (val) => {
    onChange(val);
    setOpen(false);
  };

  const clear = (e) => {
    e.stopPropagation();
    onChange('');
  };

  return (
    <div className="relative" ref={ref}>
      <div
        onClick={() => !disabled && setOpen(!open)}
        onKeyDown={handleTriggerKeyDown}
        className={`w-full flex items-center justify-between px-3 py-2 border rounded-lg text-sm cursor-pointer bg-white ${
          disabled ? 'bg-gray-50 text-gray-400' : 'hover:border-gray-400'
        } ${open ? 'border-brand-500 ring-1 ring-brand-500' : 'border-gray-300'}`}
        {...accessibility}
      >
        <span className={selected ? 'text-gray-900 flex items-center gap-2' : 'text-gray-400'}>
          {selected ? (renderSelected ? renderSelected(selected) : selected.label) : (placeholder || 'Selecione...')}
        </span>
        <div className="flex items-center gap-1">
          {selected && !disabled && (
            <X size={14} className="text-gray-400 hover:text-gray-600" onClick={clear} />
          )}
          <ChevronDown size={14} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-auto">
          <div className="sticky top-0 p-2 bg-white border-b">
            <div className="flex items-center gap-2 px-2 py-1 bg-gray-50 rounded">
              <Search size={14} className="text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Pesquisar..."
                className="flex-1 bg-transparent outline-none text-sm"
              />
            </div>
          </div>
          <div id={listboxId} role="listbox" className="py-1">
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-sm text-gray-400">Nenhum resultado</div>
            )}
            {filtered.map((opt, i) => (
              <div
                key={opt.value}
                onClick={() => select(opt.value)}
                role="option"
                aria-selected={opt.value === value}
                className={`px-3 py-2 text-sm cursor-pointer flex items-center gap-2 ${
                  opt.value === value ? 'bg-brand-50 text-brand-700 font-medium' :
                  i === highlighted ? 'bg-gray-100' : 'hover:bg-gray-50'
                }`}
              >
                {renderOption ? renderOption(opt) : opt.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
