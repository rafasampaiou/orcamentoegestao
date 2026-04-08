import React, { useState, useEffect } from 'react';

import { Settings2, ChevronUp, Save, Trash2, CheckCircle } from 'lucide-react';
import { ColumnVisibility, ImportedRow } from '../types';

// --- Types ---
interface OccupancyViewProps {
    isBudget: boolean;
    budgetData?: Record<string, number[]>;
    setBudgetData?: React.Dispatch<React.SetStateAction<Record<string, number[]>>>;
    onSaveOccupancy?: () => void;
    onClearOccupancy?: () => void;
    
    // Real Mode Props
    selectedMonth?: number;
    selectedYear?: number;
    selectedHotel?: string;
    realOccupancyData?: Record<string, Record<string, number>>;
    setRealOccupancyData?: React.Dispatch<React.SetStateAction<Record<string, Record<string, number>>>>;
    financialData?: ImportedRow[];
}

interface BudgetRow {
  id: string;
  label: string;
  isHeader?: boolean;
  isSpacer?: boolean;
  indent?: boolean;
  format?: 'currency' | 'percent' | 'integer' | 'decimal';
  isInput?: boolean; // Can be edited/pasted in Budget mode
  isCalculated?: boolean; // Calculated from other rows in Budget mode
  isManualReal?: boolean; // NEW: Can be edited in Real/Forecast mode
  forceWhite?: boolean; // Force white background even if calculated
  section?: 'Geral' | 'Lazer' | 'Eventos';
}

// --- Constants ---
const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// --- Helper Functions ---
const formatValue = (val: number | undefined, format: 'currency' | 'percent' | 'integer' | 'decimal' = 'currency', decimals?: number) => {
  if (val === undefined || val === null || isNaN(val)) return '-';
  
  if (format === 'percent') {
      return `${val.toFixed(decimals ?? 2)}%`;
  }
  
  const d = decimals ?? (format === 'integer' ? 0 : 2);
  
  return new Intl.NumberFormat('pt-BR', { 
    style: 'decimal', 
    minimumFractionDigits: d, 
    maximumFractionDigits: d 
  }).format(val);
};

// --- Budget Table Component ---
const BudgetOccupancyTable: React.FC<{ 
    title: string, 
    rows: BudgetRow[], 
    data: Record<string, number[]>, 
    onUpdate: (rowId: string, monthIndex: number, value: number) => void,
    decimalOverrides: Record<string, number>,
    onToggleDecimals: (rowId: string) => void
}> = ({ title, rows, data, onUpdate, decimalOverrides, onToggleDecimals }) => {

    const handlePaste = (e: React.ClipboardEvent, startRowId: string, startMonthIndex: number) => {
        e.preventDefault();
        const clipboardData = e.clipboardData.getData('text');
        const pastedLines = clipboardData.split(/\r?\n/).filter(row => row.trim() !== '');

        const startRowIndex = rows.findIndex(r => r.id === startRowId);
        if (startRowIndex === -1) return;

        pastedLines.forEach((rowStr, rIdx) => {
            const currentRow = rows[startRowIndex + rIdx];
            if (!currentRow || !currentRow.isInput) return;

            const cells = rowStr.split('\t');
            cells.forEach((cellStr, cIdx) => {
                const targetMonthIndex = startMonthIndex + cIdx;
                if (targetMonthIndex < 12) {
                    let cleanStr = cellStr.trim();
                    
                    // Robust Brazilian Number Parsing
                    // 1. If has both dot and comma (e.g. 1.203,50), remove dot and change comma to dot
                    if (cleanStr.includes('.') && cleanStr.includes(',')) {
                        cleanStr = cleanStr.replace(/\./g, '').replace(',', '.');
                    } 
                    // 2. If has ONLY comma (e.g. 203,50), change to dot
                    else if (cleanStr.includes(',')) {
                        cleanStr = cleanStr.replace(',', '.');
                    }
                    // 3. If has ONLY dot AND looks like thousands (e.g. 203.500), remove dot
                    // We assume it's a thousands separator if there are 3 digits after the dot at the end 
                    // or if the number is large.
                    else if (cleanStr.includes('.')) {
                        const parts = cleanStr.split('.');
                        if (parts[parts.length - 1].length === 3 || parseFloat(cleanStr.replace(/\./g, '')) > 999) {
                            cleanStr = cleanStr.replace(/\./g, '');
                        }
                    }

                    const val = parseFloat(cleanStr);
                    if (!isNaN(val)) {
                        onUpdate(currentRow.id, targetMonthIndex, val);
                    }
                }
            });
        });
    };

    const [focusedCell, setFocusedCell] = useState<{rowId: string, colIdx: number} | null>(null);

    return (
        <div className="mb-8 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-bold text-gray-800">{title}</h3>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                    <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
                        <tr>
                            <th className="px-4 py-3 w-64 sticky left-0 bg-gray-50 z-10 border-r border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">Indicador</th>
                            {MONTHS.map(m => (
                                <th key={m} className="px-2 py-3 text-center min-w-[80px] border-r border-gray-100">{m}</th>
                            ))}
                            <th className="px-2 py-3 text-center min-w-[80px] bg-gray-100 font-bold text-gray-800">Total</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {rows.map((row) => {
                            if (row.isSpacer) {
                                return <tr key={row.id} className="h-4 bg-gray-50/50"><td colSpan={14}></td></tr>;
                            }
                            if (row.isHeader) {
                                return (
                                    <tr key={row.id} className="bg-gray-50 font-bold text-gray-800">
                                        <td className="px-4 py-2 sticky left-0 bg-gray-50 z-10 border-r border-gray-200">{row.label}</td>
                                        <td colSpan={13}></td>
                                    </tr>
                                );
                            }

                            const rowValues = data[row.id] || Array(12).fill(0);
                            const total = rowValues.reduce((sum, v) => sum + (v || 0), 0);
                            
                            // Styling: Input OR forceWhite = White, Calculated = Gray-200
                            const isWhite = row.isInput || row.forceWhite;
                            const rowBgClass = isWhite ? 'bg-white' : 'bg-gray-200';
                            const stickyBgClass = isWhite ? 'bg-white group-hover:bg-gray-50' : 'bg-gray-200 group-hover:bg-gray-300';

                            return (
                                <tr key={row.id} className={`hover:bg-gray-50 transition-colors group ${rowBgClass}`}>
                                    <td className={`px-4 py-2 sticky left-0 z-10 border-r border-gray-200 ${stickyBgClass} flex items-center justify-between gap-2 overflow-hidden`}>
                                        <span className={`${row.indent ? 'pl-4 text-gray-500' : 'text-gray-700 font-medium'} truncate`}>
                                            {row.label}
                                        </span>
                                        <button 
                                            onClick={() => onToggleDecimals(row.id)}
                                            className="opacity-0 group-hover:opacity-100 flex items-center justify-center w-6 h-6 rounded bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-all text-[10px] font-bold shrink-0 shadow-sm border border-indigo-200"
                                            title="Mudar casas decimais"
                                        >
                                            .{decimalOverrides[row.id] ?? (row.format === 'integer' ? 0 : 2)}
                                        </button>
                                    </td>
                                    {MONTHS.map((_, idx) => (
                                        <td key={idx} className="px-1 py-1 border-r border-gray-100 text-center">
                                            {row.isInput ? (
                                                <input
                                                    type="text"
                                                    className={`w-full text-center bg-transparent focus:bg-indigo-50 focus:outline-none focus:ring-1 focus:ring-indigo-300 rounded px-1 text-xs ${
                                                        focusedCell?.rowId === row.id && focusedCell?.colIdx === idx ? 'text-black' : 'text-gray-700 font-medium'
                                                    }`}
                                                    value={
                                                        focusedCell?.rowId === row.id && focusedCell?.colIdx === idx 
                                                        ? (rowValues[idx] || '') 
                                                        : formatValue(rowValues[idx], row.format, decimalOverrides[row.id])
                                                    }
                                                    onFocus={() => setFocusedCell({ rowId: row.id, colIdx: idx })}
                                                    onBlur={() => setFocusedCell(null)}
                                                    onChange={(e) => {
                                                        let cleanVal = e.target.value;
                                                        // If it contains both dot and comma, it's definitely Brazilian formatted
                                                        if (cleanVal.includes('.') && cleanVal.includes(',')) {
                                                            cleanVal = cleanVal.replace(/\./g, '').replace(',', '.');
                                                        } 
                                                        // If it ONLY contains comma, change to dot
                                                        else if (cleanVal.includes(',')) {
                                                            cleanVal = cleanVal.replace(',', '.');
                                                        }
                                                        
                                                        const val = parseFloat(cleanVal);
                                                        if (!isNaN(val)) onUpdate(row.id, idx, val);
                                                        else if (e.target.value === '') onUpdate(row.id, idx, 0);
                                                    }}
                                                    onPaste={(e) => handlePaste(e, row.id, idx)}
                                                />
                                            ) : (
                                                <span className="text-xs text-gray-600 font-medium">
                                                    {formatValue(rowValues[idx], row.format, decimalOverrides[row.id])}
                                                </span>
                                            )}
                                        </td>
                                    ))}
                                    <td className="px-2 py-2 text-center bg-gray-50 font-bold text-gray-800 text-xs border-l border-gray-200">
                                        {formatValue(total, row.format, decimalOverrides[row.id])}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};


// --- Main Component ---
const OccupancyView: React.FC<OccupancyViewProps> = ({ 
    isBudget, 
    budgetData: propBudgetData, 
    setBudgetData: propSetBudgetData,
    onSaveOccupancy,
    onClearOccupancy,
    selectedMonth,
    selectedYear,
    selectedHotel,
    realOccupancyData,
    setRealOccupancyData,
    financialData
}) => {
  
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>({
      previa: true,
      real: true,
      budget: true,
      deltaBudget: true,
      deltaBudgetPct: true,
      deltaPreviaBudget: true,
      deltaPreviaBudgetPct: true,
      lastYear: true,
      deltaLY: true,
      deltaLYPct: true,
  });
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [decimalOverrides, setDecimalOverrides] = useState<Record<string, number>>({});

  const toggleDecimals = (rowId: string) => {
      setDecimalOverrides(prev => {
          const current = prev[rowId] ?? -1;
          const allRows = [...geralRows, ...lazerRows, ...eventRows];
          const found = allRows.find(r => r.id === rowId);
          const standard = found?.format === 'integer' ? 0 : 2;
          
          let next;
          if (current === -1) {
              next = (standard + 1) % 5;
          } else {
              next = (current + 1) % 5;
          }
          return { ...prev, [rowId]: next };
      });
  };

  const recalculateReal = (currentData: Record<string, number>) => {
      const newData = { ...currentData };
      const get = (key: string) => newData[key] || 0;
      const set = (key: string, val: number) => { newData[key] = val; };

      const suffixes = ['forecast', 'previa'];
      const monthIdx = (selectedMonth || 1) - 1;

      suffixes.forEach(s => {
          // Force values from Budget as requested: days_month, capacity, and availability
          set(`days_month_${s}`, budgetData['days_month']?.[monthIdx] || 0);
          set(`geral_capacity_${s}`, budgetData['geral_capacity']?.[monthIdx] || 0);
          set(`geral_avail_${s}`, budgetData['geral_avail']?.[monthIdx] || 0);
          
          set(`lazer_capacity_${s}`, budgetData['lazer_capacity']?.[monthIdx] || 0);
          set(`lazer_avail_${s}`, budgetData['lazer_avail']?.[monthIdx] || 0);
          
          set(`event_capacity_${s}`, budgetData['event_capacity']?.[monthIdx] || 0);
          set(`event_avail_${s}`, budgetData['event_avail']?.[monthIdx] || 0);

          const lzSold = get(`lazer_sold_${s}`);
          const lzAvail = get(`lazer_avail_${s}`);
          const lzAd = get(`lazer_adults_${s}`);
          const lzChd = get(`lazer_chd_${s}`);
          const lzDmFap = get(`lazer_dm_fap_${s}`);
          
          const lzPax = lzAd + lzChd;
          const lzRevFap = lzDmFap * lzSold;
          
          set(`lazer_pax_${s}`, lzPax);
          set(`lazer_occ_pct_${s}`, lzAvail > 0 ? (lzSold / lzAvail) * 100 : 0);
          set(`lazer_coef_total_${s}`, lzSold > 0 ? lzPax / lzSold : 0);
          set(`lazer_coef_ad_${s}`, lzSold > 0 ? lzAd / lzSold : 0);
          set(`lazer_coef_chd_${s}`, lzSold > 0 ? lzChd / lzSold : 0);
          set(`lazer_rev_fap_${s}`, lzRevFap);
          set(`lazer_revpar_${s}`, lzAvail > 0 ? lzRevFap / lzAvail : 0);

          const evSold = get(`event_sold_${s}`);
          const evAvail = get(`event_avail_${s}`);
          const evAd = get(`event_adults_${s}`);
          const evChd = get(`event_chd_${s}`);
          const evDmFap = get(`event_dm_fap_${s}`);
          
          const evPax = evAd + evChd;
          const evRevFap = evDmFap * evSold;
          
          set(`event_pax_${s}`, evPax);
          set(`event_occ_pct_${s}`, evAvail > 0 ? (evSold / evAvail) * 100 : 0);
          set(`event_coef_total_${s}`, evSold > 0 ? evPax / evSold : 0);
          set(`event_coef_ad_${s}`, evSold > 0 ? evAd / evSold : 0);
          set(`event_coef_chd_${s}`, evSold > 0 ? evChd / evSold : 0);
          set(`event_rev_fap_${s}`, evRevFap);
          set(`event_revpar_${s}`, evAvail > 0 ? evRevFap / evAvail : 0);

          // Geral
          const gSold = lzSold + evSold;
          const gAd = lzAd + evAd;
          const gChd = lzChd + evChd;
          const gPax = gAd + gChd;
          const gRevFap = lzRevFap + evRevFap;
          const gAvail = get(`geral_avail_${s}`);

          set(`geral_sold_${s}`, gSold);
          set(`geral_occ_pct_${s}`, gAvail > 0 ? (gSold / gAvail) * 100 : 0);
          set(`geral_pax_${s}`, gPax);
          set(`geral_coef_total_${s}`, gSold > 0 ? gPax / gSold : 0);
          set(`geral_adults_${s}`, gAd);
          set(`geral_coef_ad_${s}`, gSold > 0 ? gAd / gSold : 0);
          set(`geral_chd_${s}`, gChd);
          set(`geral_coef_chd_${s}`, gSold > 0 ? gChd / gSold : 0);
          set(`geral_rev_fap_${s}`, gRevFap);
          set(`geral_dm_fap_${s}`, gSold > 0 ? gRevFap / gSold : 0);
          set(`geral_revpar_${s}`, gAvail > 0 ? gRevFap / gAvail : 0);
      });

      return newData;
  };

  // --- State resolution ---
  // In Budget mode: ALWAYS use the parent's prop. Never fall back to localBudgetData,
  // because that would make the table ignore hotel-filter changes from the parent.
  // In Real mode: the prop isn't used for budget data, so localBudgetData is fine.
  const [localBudgetData, setLocalBudgetData] = useState<Record<string, number[]>>({});

  const budgetData: Record<string, number[]> = isBudget
      ? (propBudgetData || {})
      : (propBudgetData || localBudgetData);

  const setBudgetData = propSetBudgetData || setLocalBudgetData;

  // Show a spinner only when the parent explicitly hasn't provided data yet (undefined)
  const isDataReady = !isBudget || propBudgetData !== undefined;

  useEffect(() => {
      if (!isDataReady) return;
      const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      if (!budgetData['days_month']) {
          setBudgetData(prev => ({
              ...prev,
              'days_month': daysInMonth
          }));
      }
  }, [isDataReady, budgetData, setBudgetData]);

  const handleUpdate = (rowId: string, monthIndex: number, value: number) => {
      setBudgetData(prev => {
          const newRowData = [...(prev[rowId] || Array(12).fill(0))];
          newRowData[monthIndex] = value;
          const newData = { ...prev, [rowId]: newRowData };
          return recalculateBudget(newData);
      });
  };

  const recalculateBudget = (data: Record<string, number[]>) => {
      const newData = { ...data };
      const months = Array.from({ length: 12 }, (_, i) => i);

      // Helper to safe get
      const get = (key: string, idx: number) => newData[key]?.[idx] || 0;
      const set = (key: string, idx: number, val: number) => {
          if (!newData[key]) {
              // Array doesn't exist yet — create a fresh one
              newData[key] = Array(12).fill(0);
          } else if (newData[key] === data[key]) {
              // Still pointing to the original array from state — clone it first
              // to avoid mutating React state directly (breaks change detection)
              newData[key] = [...newData[key]];
          }
          newData[key][idx] = val;
      };

      months.forEach(i => {
          const days = get('days_month', i);

          // --- LAZER CALCULATIONS ---
          const lzCap = get('lazer_capacity', i);
          const lzAvail = lzCap * days;
          set('lazer_avail', i, lzAvail);

          const lzSold = get('lazer_sold', i);
          const lzAd = get('lazer_adults', i);
          const lzChd = get('lazer_chd', i);
          const lzRateAd = get('lazer_rate_ad', i);
          const lzRateChd = get('lazer_rate_chd', i);

          const lzPax = lzAd + lzChd;
          const lzRevFap = get('lazer_rev_fap', i); // Manual Input
          
          // Formula: Receita SEM rateios = Receita COM rateios - (ADULTOS * FAP ADULTOS) - (CHD * FAP CHD)
          const lzRevHosp = lzRevFap - (lzAd * lzRateAd) - (lzChd * lzRateChd);

          set('lazer_occ_pct', i, lzAvail > 0 ? (lzSold / lzAvail) * 100 : 0);
          set('lazer_pax', i, lzPax);
          set('lazer_coef_total', i, lzSold > 0 ? lzPax / lzSold : 0);
          set('lazer_coef_ad', i, lzSold > 0 ? lzAd / lzSold : 0);
          set('lazer_coef_chd', i, lzSold > 0 ? lzChd / lzSold : 0);
          set('lazer_rev_fap', i, lzRevFap);
          set('lazer_rev_hosp', i, lzRevHosp);
          set('lazer_dm_fap', i, lzSold > 0 ? lzRevFap / lzSold : 0);
          set('lazer_dm_hosp', i, lzSold > 0 ? lzRevHosp / lzSold : 0);
          set('lazer_revpar', i, lzAvail > 0 ? lzRevFap / lzAvail : 0);

          // --- EVENTOS CALCULATIONS ---
          const evCap = get('event_capacity', i);
          const evAvail = evCap * days;
          set('event_avail', i, evAvail);

          const evSold = get('event_sold', i);
          const evAd = get('event_adults', i);
          const evChd = get('event_chd', i);
          const evRateAd = get('event_rate_ad', i);
          const evRateChd = get('event_rate_chd', i);

          const evPax = evAd + evChd;
          const evRevFap = get('event_rev_fap', i); // Manual Input
          
          // Formula: Receita SEM rateios = Receita COM rateios - (ADULTOS * FAP ADULTOS) - (CHD * FAP CHD)
          const evRevHosp = evRevFap - (evAd * evRateAd) - (evChd * evRateChd);

          set('event_occ_pct', i, evAvail > 0 ? (evSold / evAvail) * 100 : 0);
          set('event_pax', i, evPax);
          set('event_coef_total', i, evSold > 0 ? evPax / evSold : 0);
          set('event_pax', i, evPax); 
          set('event_coef_ad', i, evSold > 0 ? evAd / evSold : 0);
          set('event_coef_chd', i, evSold > 0 ? evChd / evSold : 0);
          set('event_rev_fap', i, evRevFap);
          set('event_rev_hosp', i, evRevHosp);
          set('event_dm_fap', i, evSold > 0 ? evRevFap / evSold : 0);
          set('event_dm_hosp', i, evSold > 0 ? evRevHosp / evSold : 0);
          set('event_revpar', i, evAvail > 0 ? evRevFap / evAvail : 0);

          // --- GERAL CALCULATIONS ---
          const gCap = get('geral_capacity', i);
          const gAvail = gCap * days;
          set('geral_avail', i, gAvail);

          // Sums
          const gSold = lzSold + evSold;
          const gAd = lzAd + evAd;
          const gChd = lzChd + evChd;
          const gPax = gAd + gChd;
          const gRevFap = lzRevFap + evRevFap;
          const gRevHosp = lzRevHosp + evRevHosp;
          
          // Inputs for Geral
          // gAvail already declared above as gCap * days

          set('geral_sold', i, gSold);
          set('geral_occ_pct', i, gAvail > 0 ? (gSold / gAvail) * 100 : 0);
          set('geral_pax', i, gPax);
          set('geral_coef_total', i, gSold > 0 ? gPax / gSold : 0);
          set('geral_adults', i, gAd);
          set('geral_coef_ad', i, gSold > 0 ? gAd / gSold : 0);
          set('geral_chd', i, gChd);
          set('geral_coef_chd', i, gSold > 0 ? gChd / gSold : 0);
          
          // Avg Rates for Geral
          set('geral_rate_ad', i, gAd > 0 ? ( (lzAd * lzRateAd) + (evAd * evRateAd) ) / gAd : 0);
          set('geral_rate_chd', i, gChd > 0 ? ( (lzChd * lzRateChd) + (evChd * evRateChd) ) / gChd : 0);

          set('geral_dm_fap', i, gSold > 0 ? gRevFap / gSold : 0);
          set('geral_dm_hosp', i, gSold > 0 ? gRevHosp / gSold : 0);
          set('geral_revpar', i, gAvail > 0 ? gRevFap / gAvail : 0);
          set('geral_trevpor', i, gSold > 0 ? gRevFap / gSold : 0); // Assuming Total Rev = Rev FAP for now
          set('geral_trevpar', i, gAvail > 0 ? gRevFap / gAvail : 0);
          
          set('geral_rev_fap', i, gRevFap);
          set('geral_rev_hosp', i, gRevHosp);
      });

      return newData;
  };

  // --- Row Definitions ---
  const geralRows: BudgetRow[] = [
      { id: 'days_month', label: 'Dias do mês', isInput: true, format: 'integer' },
      { id: 'geral_capacity', label: 'Aptos Hotel', isInput: true, format: 'integer' },
      { id: 'geral_avail', label: 'APTOS DISPONIVEIS', isCalculated: true, format: 'integer' },
      { id: 'geral_sold', label: 'APTO VENDIDOS', isCalculated: true, forceWhite: true, format: 'integer' },
      { id: 'geral_occ_pct', label: '% DE OCUPAÇÃO', isCalculated: true, format: 'percent' },
      { id: 'geral_pax', label: 'N° DE HOSPEDES', isCalculated: true, forceWhite: true, format: 'integer' },
      { id: 'geral_coef_total', label: 'Coef. Occ Geral', isCalculated: true, format: 'decimal' },
      { id: 'geral_adults', label: 'ADULTOS', isCalculated: true, forceWhite: true, format: 'integer' },
      { id: 'geral_coef_ad', label: 'Coef. Occ Adultos', isCalculated: true, format: 'decimal' },
      { id: 'geral_chd', label: 'CHD', isCalculated: true, forceWhite: true, format: 'integer' },
      { id: 'geral_coef_chd', label: 'Coef. Occ CHD', isCalculated: true, format: 'decimal' },
      { id: 'geral_rate_ad', label: 'Valor FAP Adulto', isCalculated: true, forceWhite: true, format: 'currency' },
      { id: 'geral_rate_chd', label: 'Valor FAP Criança', isCalculated: true, forceWhite: true, format: 'currency' },
      { id: 'geral_dm_fap', label: 'DM LÍQ COM FAP', isCalculated: true, format: 'currency' },
      { id: 'geral_dm_hosp', label: 'DM LÍQ HOSPEDAGEM', isCalculated: true, format: 'currency' },
      { id: 'geral_revpar', label: 'REVPAR', isCalculated: true, format: 'currency' },
      { id: 'geral_trevpor', label: 'TREVPOR', isCalculated: true, format: 'currency' },
      { id: 'geral_trevpar', label: 'TREVPAR', isCalculated: true, format: 'currency' },
      { id: 'geral_rev_fap', label: 'Receita COM rateios', isCalculated: true, format: 'currency' },
      { id: 'geral_rev_hosp', label: 'Receita SEM rateios', isCalculated: true, format: 'currency' },
  ];

  const lazerRows: BudgetRow[] = [
      { id: 'lazer_capacity', label: 'Aptos Hotel', isInput: true, format: 'integer' },
      { id: 'lazer_avail', label: 'APTOS DISPONIVEIS', isCalculated: true, format: 'integer' },
      { id: 'lazer_sold', label: 'APTO VENDIDOS', isInput: true, isManualReal: true, format: 'integer' },
      { id: 'lazer_occ_pct', label: '% DE OCUPAÇÃO', isCalculated: true, format: 'percent' },
      { id: 'lazer_pax', label: 'N° DE HOSPEDES', isCalculated: true, format: 'integer' },
      { id: 'lazer_coef_total', label: 'Coef. Occ Geral', isCalculated: true, format: 'decimal' },
      { id: 'lazer_adults', label: 'ADULTOS', isInput: true, isManualReal: true, format: 'integer' },
      { id: 'lazer_coef_ad', label: 'Coef. Occ Adultos', isCalculated: true, format: 'decimal' },
      { id: 'lazer_chd', label: 'CHD', isInput: true, isManualReal: true, format: 'integer' },
      { id: 'lazer_coef_chd', label: 'Coef. Occ CHD', isCalculated: true, format: 'decimal' },
      { id: 'lazer_rate_ad', label: 'Valor FAP Adulto', isInput: true, format: 'currency' },
      { id: 'lazer_rate_chd', label: 'Valor FAP Criança', isInput: true, format: 'currency' },
      { id: 'lazer_dm_fap', label: 'DM LÍQ COM FAP', isCalculated: true, isManualReal: true, format: 'currency' },
      { id: 'lazer_dm_hosp', label: 'DM LÍQ HOSPEDAGEM', isCalculated: true, format: 'currency' },
      { id: 'lazer_revpar', label: 'REVPAR', isCalculated: true, format: 'currency' },
      { id: 'lazer_rev_fap', label: 'Receita COM rateios', isInput: true, format: 'currency' },
      { id: 'lazer_rev_hosp', label: 'Receita SEM rateios', isCalculated: true, format: 'currency' },
  ];

  const eventRows: BudgetRow[] = [
      { id: 'event_capacity', label: 'Aptos Hotel', isInput: true, format: 'integer' },
      { id: 'event_avail', label: 'APTOS DISPONIVEIS', isCalculated: true, format: 'integer' },
      { id: 'event_sold', label: 'APTO VENDIDOS', isInput: true, isManualReal: true, format: 'integer' },
      { id: 'event_occ_pct', label: '% DE OCUPAÇÃO', isCalculated: true, format: 'percent' },
      { id: 'event_pax', label: 'N° DE HOSPEDES', isCalculated: true, format: 'integer' },
      { id: 'event_coef_total', label: 'Coef. Occ Geral', isCalculated: true, format: 'decimal' },
      { id: 'event_adults', label: 'ADULTOS', isInput: true, isManualReal: true, format: 'integer' },
      { id: 'event_coef_ad', label: 'Coef. Occ Adultos', isCalculated: true, format: 'decimal' },
      { id: 'event_chd', label: 'CHD', isInput: true, isManualReal: true, format: 'integer' },
      { id: 'event_coef_chd', label: 'Coef. Occ CHD', isCalculated: true, format: 'decimal' },
      { id: 'event_rate_ad', label: 'Valor FAP Adulto', isInput: true, format: 'currency' },
      { id: 'event_rate_chd', label: 'Valor FAP Criança', isInput: true, format: 'currency' },
      { id: 'event_dm_fap', label: 'DM LÍQ COM FAP', isCalculated: true, isManualReal: true, format: 'currency' },
      { id: 'event_dm_hosp', label: 'DM LÍQ HOSPEDAGEM', isCalculated: true, format: 'currency' },
      { id: 'event_revpar', label: 'REVPAR', isCalculated: true, format: 'currency' },
      { id: 'event_rev_fap', label: 'Receita COM rateios', isInput: true, format: 'currency' },
      { id: 'event_rev_hosp', label: 'Receita SEM rateios', isCalculated: true, format: 'currency' },
  ];

  // --- Real View ---
  if (!isBudget) {
      const contextKey = `${selectedHotel}_${selectedYear}_${selectedMonth}`;
      const currentRealData = realOccupancyData?.[contextKey] || {};

      const handleRealUpdate = (rowId: string, col: 'forecast' | 'previa', value: number) => {
          if (setRealOccupancyData) {
              setRealOccupancyData(prev => {
                  const contextData = prev[contextKey] || {};
                  const newData = { ...contextData, [`${rowId}_${col}`]: value };
                  const recalculated = recalculateReal(newData);
                  return {
                      ...prev,
                      [contextKey]: recalculated
                  };
              });
          }
      };

      const getLYValue = (accountName: string) => {
          if (!financialData || !selectedMonth || !selectedYear) return 0;
          const lyYear = (selectedYear - 1).toString();
          const targetMonth = selectedMonth.toString();
          const targetName = accountName.trim().toLowerCase();
          
          return financialData
              .filter(row => 
                  row.ano === lyYear && 
                  row.mes === targetMonth && 
                  row.cenario === 'REAL' && 
                  row.conta.trim().toLowerCase() === targetName
              )
              .reduce((sum, row) => sum + (parseFloat(row.valor) || 0), 0);
      };

      const getRowData = (rowId: string) => {
          const monthIdx = (selectedMonth || 1) - 1;
          const meta = budgetData?.[rowId]?.[monthIdx] || 0;
          
          // These fields must always match Meta as per user request
          const fixedFields = ['days_month', 'geral_capacity', 'lazer_capacity', 'event_capacity', 'geral_avail', 'lazer_avail', 'event_avail'];
          
          let forecast = currentRealData[`${rowId}_forecast`];
          let previa = currentRealData[`${rowId}_previa`];

          if (fixedFields.includes(rowId)) {
              forecast = meta;
              previa = meta;
          } else {
              forecast = forecast || 0;
              previa = previa || 0;
          }
          
          // Map rowId to LY account name
          const lyMap: Record<string, string> = {
              'lazer_avail': 'Lazer - UH Disponível',
              'lazer_sold': 'Lazer - UH Ocupada',
              'lazer_pax': 'Lazer - PAX',
              'event_avail': 'Eventos - UH Disponível',
              'event_sold': 'Eventos - UH Ocupada',
              'event_pax': 'Eventos - PAX',
          };
          
          let ly = 0;
          if (lyMap[rowId]) {
              ly = getLYValue(lyMap[rowId]);
          } else if (rowId === 'geral_avail') {
              ly = getLYValue('Lazer - UH Disponível'); // Assuming Geral Avail = Lazer Avail
          } else if (rowId === 'geral_sold') {
              ly = getLYValue('Lazer - UH Ocupada') + getLYValue('Eventos - UH Ocupada');
          } else if (rowId === 'geral_pax') {
              ly = getLYValue('Lazer - PAX') + getLYValue('Eventos - PAX');
          }

          const deltaBudgetVal = forecast - meta;
          const deltaBudgetPct = meta !== 0 ? (deltaBudgetVal / meta) * 100 : 0;
          const deltaLYVal = forecast - ly;
          const deltaLYPct = ly !== 0 ? (deltaLYVal / ly) * 100 : 0;

          return { forecast, meta, ly, previa, deltaBudgetVal, deltaBudgetPct, deltaLYVal, deltaLYPct };
      };

      const formatPercentDiff = (val: number) => {
          if (val > 999) return '>999%';
          if (val < -999) return '<-999%';
          return `${val > 0 ? '+' : ''}${val.toFixed(1)}%`;
      };

      const renderRealTable = (title: string, rows: BudgetRow[]) => (
          <div className="mb-8 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                  <h3 className="text-lg font-bold text-gray-800">{title}</h3>
              </div>
              <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse">
                      <thead className="bg-sky-100 font-bold text-sky-900 uppercase tracking-tight text-xs border-b border-sky-200">
                          <tr>
                              <th className="px-4 py-3 w-64 sticky left-0 bg-sky-100 z-10 border-r border-sky-200">Indicador</th>
                              {columnVisibility.previa && <th className="px-2 py-3 text-right w-24 bg-purple-50/50 text-purple-900 border-r border-gray-100">PRÉVIA</th>}
                              {columnVisibility.real && <th className="px-2 py-3 text-right w-24 bg-sky-100 text-sky-900 border-r border-gray-100">FORECAST</th>}
                              {columnVisibility.budget && <th className="px-2 py-3 text-right w-24 border-r border-gray-100">META</th>}
                              {columnVisibility.deltaBudget && <th className="px-2 py-3 text-right w-24 border-r border-gray-100">Δ META R$</th>}
                              {columnVisibility.deltaBudgetPct && <th className="px-2 py-3 text-right w-24 border-r border-gray-100">Δ %</th>}
                              {columnVisibility.lastYear && <th className="px-2 py-3 text-right w-24 bg-orange-50/50 text-orange-900 border-r border-gray-100">LAST YEAR</th>}
                              {columnVisibility.deltaLY && <th className="px-2 py-3 text-right w-24 border-r border-gray-100">Δ LY R$</th>}
                              {columnVisibility.deltaLYPct && <th className="px-2 py-3 text-right w-24">Δ %</th>}
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                          {rows.map(row => {
                              const { forecast, meta, ly, previa, deltaBudgetVal, deltaBudgetPct, deltaLYVal, deltaLYPct } = getRowData(row.id);
                              const deltaColor = deltaBudgetVal < 0 ? 'text-rose-600' : 'text-emerald-600';
                              const lyColor = deltaLYVal < 0 ? 'text-rose-600' : 'text-emerald-600';

                              return (
                                  <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                                      <td className={`px-4 py-2 sticky left-0 bg-white z-10 border-r border-gray-200 ${row.indent ? 'pl-8 text-gray-500' : 'text-gray-700 font-medium'}`}>
                                          {row.label}
                                          <button 
                                              onClick={() => toggleDecimals(row.id)}
                                              className="ml-2 text-[10px] text-gray-400 hover:text-indigo-600 font-bold"
                                          >
                                              .{decimalOverrides[row.id] ?? 0}
                                          </button>
                                      </td>
                                      {columnVisibility.previa && (
                                          <td className="px-2 py-2 text-right bg-purple-50/20 text-purple-800 font-medium border-r border-gray-100">
                                              {row.isManualReal ? (
                                                  <input 
                                                      type="number"
                                                      className="w-full text-right bg-transparent focus:bg-white focus:ring-1 focus:ring-purple-300 rounded px-1 outline-none font-bold text-purple-900"
                                                      value={previa || ''}
                                                      onChange={(e) => handleRealUpdate(row.id, 'previa', parseFloat(e.target.value) || 0)}
                                                  />
                                              ) : (
                                                  <span className="font-bold text-purple-900">{formatValue(previa, row.format, decimalOverrides[row.id])}</span>
                                              )}
                                          </td>
                                      )}
                                      {columnVisibility.real && (
                                          <td className="px-2 py-2 text-right bg-sky-50/30 border-r border-gray-100">
                                              {row.isManualReal ? (
                                                  <input 
                                                      type="number"
                                                      className="w-full text-right bg-transparent focus:bg-white focus:ring-1 focus:ring-sky-300 rounded px-1 outline-none font-bold text-sky-900"
                                                      value={forecast || ''}
                                                      onChange={(e) => handleRealUpdate(row.id, 'forecast', parseFloat(e.target.value) || 0)}
                                                  />
                                              ) : (
                                                  <span className="font-bold text-sky-900">{formatValue(forecast, row.format, decimalOverrides[row.id])}</span>
                                              )}
                                          </td>
                                      )}
                                      {columnVisibility.budget && (
                                          <td className="px-2 py-2 text-right text-gray-500 border-r border-gray-100">
                                              {formatValue(meta, row.format, decimalOverrides[row.id])}
                                          </td>
                                      )}
                                      {columnVisibility.deltaBudget && (
                                          <td className={`px-2 py-2 text-right font-medium border-r border-gray-100 ${deltaColor}`}>
                                              {formatValue(deltaBudgetVal, row.format, decimalOverrides[row.id])}
                                          </td>
                                      )}
                                      {columnVisibility.deltaBudgetPct && (
                                          <td className={`px-2 py-2 text-right font-bold border-r border-gray-100 ${deltaColor}`}>
                                              {formatPercentDiff(deltaBudgetPct)}
                                          </td>
                                      )}
                                      {columnVisibility.lastYear && (
                                          <td className="px-2 py-2 text-right bg-orange-50/20 text-orange-800 border-r border-gray-100">
                                              {formatValue(ly, row.format, decimalOverrides[row.id])}
                                          </td>
                                      )}
                                      {columnVisibility.deltaLY && (
                                          <td className={`px-2 py-2 text-right font-medium border-r border-gray-100 ${lyColor}`}>
                                              {formatValue(deltaLYVal, row.format, decimalOverrides[row.id])}
                                          </td>
                                      )}
                                      {columnVisibility.deltaLYPct && (
                                          <td className={`px-2 py-2 text-right font-bold ${lyColor}`}>
                                              {formatPercentDiff(deltaLYPct)}
                                          </td>
                                      )}
                                  </tr>
                              );
                          })}
                      </tbody>
                  </table>
              </div>
          </div>
      );

      return (
          <div className="p-8 w-full">
              <div className="mb-6 flex justify-between items-center">
                  <div>
                      <h2 className="text-2xl font-bold text-gray-900">Ocupação (Real)</h2>
                      <p className="text-gray-500 mt-1">Análise detalhada de ocupação por segmento para {selectedMonth}/{selectedYear}.</p>
                  </div>
                  <div className="flex gap-3 relative">
                      <button 
                          onClick={() => setShowColumnSettings(!showColumnSettings)}
                          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-base font-bold transition-all border ${
                              showColumnSettings ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50 shadow-sm'
                          }`}
                      >
                          <Settings2 size={20} />
                          Configurar Colunas
                      </button>

                      {showColumnSettings && (
                          <div className="absolute right-0 top-12 z-50 bg-white border border-gray-200 shadow-xl rounded-xl p-4 w-64 animate-in fade-in slide-in-from-top-2">
                              <div className="flex justify-between items-center mb-3">
                                  <h4 className="font-bold text-gray-800 text-sm">Colunas Visíveis</h4>
                                  <button onClick={() => setShowColumnSettings(false)} className="text-gray-400 hover:text-gray-600">
                                      <ChevronUp size={16} />
                                  </button>
                              </div>
                              <div className="space-y-2">
                                  {[
                                      { key: 'previa', label: 'Prévia' },
                                      { key: 'real', label: 'Forecast' },
                                      { key: 'budget', label: 'Meta (Budget)' },
                                      { key: 'deltaBudget', label: 'Δ Meta R$' },
                                      { key: 'deltaBudgetPct', label: 'Δ Meta %' },
                                      { key: 'lastYear', label: 'Last Year' },
                                      { key: 'deltaLY', label: 'Δ LY R$' },
                                      { key: 'deltaLYPct', label: 'Δ LY %' },
                                  ].map(col => (
                                      <label key={col.key} className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-1.5 rounded transition-colors">
                                          <input 
                                              type="checkbox" 
                                              checked={columnVisibility[col.key as keyof ColumnVisibility]} 
                                              onChange={() => setColumnVisibility(prev => ({ ...prev, [col.key]: !prev[col.key as keyof ColumnVisibility] }))}
                                              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                          />
                                          <span className="text-xs font-medium text-gray-700">{col.label}</span>
                                      </label>
                                  ))}
                              </div>
                          </div>
                      )}
                  </div>
              </div>

              {renderRealTable("Geral", geralRows)}
              {renderRealTable("Lazer", lazerRows)}
              {renderRealTable("Eventos", eventRows)}
          </div>
      );
  }

  // State for confirmation modal and save feedback
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [savedIndicator, setSavedIndicator] = useState(false);

  const handleManualSave = () => {
      if (onSaveOccupancy) {
          onSaveOccupancy();
      }
      setSavedIndicator(true);
      setTimeout(() => setSavedIndicator(false), 2500);
  };

  const handleConfirmClear = () => {
      if (setBudgetData) {
          setBudgetData({});
      }
      if (onClearOccupancy) {
          onClearOccupancy();
      }
      setShowClearConfirm(false);
  };

  // --- Budget View Loading Guard ---
  if (isBudget && !isDataReady) {
      return (
          <div className="flex items-center justify-center h-96">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500" />
          </div>
      );
  }

  // --- Budget View ---
  return (
    <div className="p-8 max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
            <div>
                <h2 className="text-2xl font-bold text-gray-900">Or&ccedil;amento de Ocupa&ccedil;&atilde;o</h2>
                <p className="text-gray-500 mt-1">Proje&ccedil;&atilde;o mensal de ocupa&ccedil;&atilde;o e receitas (Lazer e Eventos).</p>
            </div>
            <div className="flex items-center gap-3">
                {/* Save Button */}
                <button
                    onClick={handleManualSave}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all shadow-sm border ${
                        savedIndicator
                            ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                            : 'bg-indigo-600 text-white border-indigo-700 hover:bg-indigo-700'
                    }`}
                >
                    {savedIndicator ? <CheckCircle size={16} /> : <Save size={16} />}
                    {savedIndicator ? 'Salvo!' : 'Salvar Ocupação'}
                </button>

                {/* Clear Button */}
                <button
                    onClick={() => setShowClearConfirm(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold border border-red-200 bg-white text-red-600 hover:bg-red-50 transition-all shadow-sm"
                >
                    <Trash2 size={16} />
                    Limpar Dados de Ocupação
                </button>
            </div>
        </div>

        {/* Confirm Clear Modal */}
        {showClearConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 border border-red-100">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                            <Trash2 size={24} className="text-red-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-900">Limpar dados de ocupa&ccedil;&atilde;o?</h3>
                            <p className="text-sm text-gray-500 mt-1">Esta a&ccedil;&atilde;o ir&aacute; apagar todos os valores inseridos neste or&ccedil;amento de ocupa&ccedil;&atilde;o. N&atilde;o &eacute; poss&iacute;vel desfazer.</p>
                        </div>
                    </div>
                    <div className="flex justify-end gap-3">
                        <button
                            onClick={() => setShowClearConfirm(false)}
                            className="px-5 py-2.5 rounded-lg border border-gray-200 text-gray-600 font-semibold hover:bg-gray-50 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleConfirmClear}
                            className="px-5 py-2.5 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700 transition-colors shadow-sm"
                        >
                            Sim, limpar tudo
                        </button>
                    </div>
                </div>
            </div>
        )}

        <BudgetOccupancyTable title="Geral" rows={geralRows} data={budgetData} onUpdate={handleUpdate} decimalOverrides={decimalOverrides} onToggleDecimals={toggleDecimals} />
        <BudgetOccupancyTable title="Lazer" rows={lazerRows} data={budgetData} onUpdate={handleUpdate} decimalOverrides={decimalOverrides} onToggleDecimals={toggleDecimals} />
        <BudgetOccupancyTable title="Eventos" rows={eventRows} data={budgetData} onUpdate={handleUpdate} decimalOverrides={decimalOverrides} onToggleDecimals={toggleDecimals} />
    </div>
  );
};

export default OccupancyView;
