import React, { useState, useMemo, useRef, useEffect } from 'react';
import { KpiCalculation, KpiFormat } from '../types';
import { DreReferenceOption } from '../utils/dreReferences';

// Wraps a DRE line label as a formula token. Always bracketed so names with spaces,
// parentheses etc. (e.g. "Emocionadores (CLT)") are parsed unambiguously.
const toToken = (label: string) => `@[${label}]`;

interface ReferencePickerProps {
  options: DreReferenceOption[];
  onPick: (label: string) => void;
  onClose: () => void;
}

const ReferencePicker: React.FC<ReferencePickerProps> = ({ options, onPick, onClose }) => {
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? options.filter(o => o.label.toLowerCase().includes(q)) : options;
    const map = new Map<string, DreReferenceOption[]>();
    filtered.slice(0, 200).forEach(o => {
      if (!map.has(o.group)) map.set(o.group, []);
      map.get(o.group)!.push(o);
    });
    return Array.from(map.entries());
  }, [query, options]);

  return (
    <div ref={containerRef} className="absolute z-50 mt-1 w-72 bg-white border border-gray-200 rounded-lg shadow-xl">
      <input
        autoFocus
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Buscar linha da DRE Forecast..."
        className="w-full p-2 text-xs border-b border-gray-100 outline-none rounded-t-lg"
      />
      <div className="max-h-60 overflow-y-auto">
        {groups.length === 0 && <p className="p-3 text-[10px] text-gray-400">Nenhuma linha encontrada.</p>}
        {groups.map(([group, items]) => (
          <div key={group}>
            <div className="px-2 py-1 text-[9px] font-black text-gray-400 uppercase bg-gray-50 sticky top-0">{group}</div>
            {items.map(item => (
              <button
                key={item.label}
                type="button"
                onClick={() => onPick(item.label)}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-indigo-50 truncate"
              >
                {item.label}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

interface KpiCalculationEditorProps {
  value?: KpiCalculation;
  onChange: (calc: KpiCalculation) => void;
  options: DreReferenceOption[];
}

const OPERATOR_BUTTONS: { label: string; insert: string }[] = [
  { label: '+', insert: ' + ' },
  { label: '−', insert: ' - ' },
  { label: '×', insert: ' * ' },
  { label: '÷', insert: ' / ' },
  { label: '(', insert: '(' },
  { label: ')', insert: ')' },
];

const KpiCalculationEditor: React.FC<KpiCalculationEditorProps> = ({ value, onChange, options }) => {
  const formula = value?.formula || '';
  const format: KpiFormat = value?.format || 'number';
  const [showPicker, setShowPicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastSelection = useRef<{ start: number; end: number }>({ start: formula.length, end: formula.length });

  const update = (patch: Partial<KpiCalculation>) => onChange({ formula, format, ...patch });

  const insertAtCursor = (text: string) => {
    const el = inputRef.current;
    const { start, end } = el
      ? { start: el.selectionStart ?? formula.length, end: el.selectionEnd ?? formula.length }
      : lastSelection.current;
    const next = formula.slice(0, start) + text + formula.slice(end);
    update({ formula: next });
    const caret = start + text.length;
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(caret, caret);
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-[9px] font-bold text-gray-400 uppercase">Fórmula</label>
        <select
          value={format}
          onChange={e => update({ format: e.target.value as KpiFormat })}
          className="bg-slate-50 border-none rounded-md px-2 py-1 text-[10px] font-bold focus:ring-2 focus:ring-indigo-500"
        >
          <option value="number">Número</option>
          <option value="percent">Percentual (%)</option>
        </select>
      </div>

      <input
        ref={inputRef}
        type="text"
        value={formula}
        onChange={e => update({ formula: e.target.value })}
        onSelect={e => { lastSelection.current = { start: e.currentTarget.selectionStart || 0, end: e.currentTarget.selectionEnd || 0 }; }}
        placeholder="Ex: @[Hortifrutigranjeiros] / @[Número de PAX]"
        className="w-full bg-slate-50 border-none rounded-lg p-2 text-xs font-mono focus:ring-2 focus:ring-indigo-500"
      />

      <div className="flex flex-wrap items-center gap-1 relative">
        {OPERATOR_BUTTONS.map(btn => (
          <button
            key={btn.label}
            type="button"
            onClick={() => insertAtCursor(btn.insert)}
            className="w-7 h-7 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded text-xs font-bold text-gray-600"
          >
            {btn.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowPicker(v => !v)}
          className="px-2 h-7 flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 rounded text-[10px] font-bold text-indigo-700"
        >
          + Linha da DRE
        </button>
        {showPicker && (
          <ReferencePicker
            options={options}
            onClose={() => setShowPicker(false)}
            onPick={label => { insertAtCursor(toToken(label)); setShowPicker(false); }}
          />
        )}
      </div>

      <p className="text-[9px] text-gray-400 italic">
        Monte a fórmula digitando os operadores acima e clicando em "+ Linha da DRE" para inserir contas, pacotes, indicadores (UH Ocupada, PAX...) ou linhas de Receita/Resultado. Também dá para editar o texto livremente.
      </p>
    </div>
  );
};

export default KpiCalculationEditor;
