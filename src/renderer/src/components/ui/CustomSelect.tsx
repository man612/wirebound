import React, { useState, useEffect, useRef } from 'react';
import { Check, ChevronDown } from 'lucide-react';

interface CustomSelectProps {
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
}

const CustomSelect: React.FC<CustomSelectProps> = ({ value, onChange, options }) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selected = options.find(o => o.value === value) || options[0];

  return (
    <div className="relative w-48 text-sm" ref={selectRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`group flex items-center justify-between w-full bg-bg-surface border transition-all duration-200 outline-none rounded-sm h-8 px-2 py-1 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-accent-blue/50 ${isOpen ? 'border-accent-blue/50 shadow-sm' : 'border-border-subtle hover:border-border-focus'}`}
      >
        <span className="truncate text-text-primary">{selected.label}</span>
        <ChevronDown size={14} className={`text-text-muted transition-transform duration-300 ease-out ${isOpen ? 'rotate-180 text-accent-blue' : 'group-hover:translate-y-px'}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-[calc(100%+4px)] z-[60] w-full bg-bg-surface border border-border-subtle shadow-xl rounded-sm py-1 animate-dropdown">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setIsOpen(false); }}
              className={`group/item w-full text-left px-2 py-1.5 flex items-center justify-between transition-colors duration-150 ${value === opt.value ? 'bg-accent-blue/10 text-accent-blue' : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'}`}
            >
              <span className="truncate transition-transform duration-200 group-hover/item:translate-x-1">{opt.label}</span>
              {value === opt.value && <Check size={14} className="animate-dropdown text-accent-blue" />}
            </button>
          ))}
        </div>
      )}
    </div>

  );
};

export default CustomSelect;
