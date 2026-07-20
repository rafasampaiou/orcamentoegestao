import React, { useState, useEffect, useMemo } from 'react';
import { Settings2, ChevronUp, Save, Trash2, CheckCircle, ListFilter, LayoutList } from 'lucide-react';
import { ColumnVisibility, ImportedRow, User, UserRole, Hotel, BudgetVersion, ProjectionType } from '../types';

// A "Versão do Forecast" as selectable in Ocupação — the 5 canonical ProjectionType values
// (shared with DRE Forecast) plus 2 view-only labels with no DRE Forecast equivalent (Meta/Ano
// anterior).
export type OccupancyVersionOption = ProjectionType | 'Meta' | 'Ano anterior';
// Só estas 3 usam a tabela restrita (Aptos vendidos/DM bruta/Coef. Occ) — Fechamento oficial e
// Realizado usam a tabela completa de sempre.
export const MEETING_VERSIONS: OccupancyVersionOption[] = ['Reunião de Ritmo', 'FCA N1', 'FCA N2'];
// Estas 4 têm snapshot isolado (sufixo __versão na chave de contexto); Realizado é o único dos
// 5 que continua no balde original sem sufixo — é o que garante que dado antigo já preenchido
// nunca some.
export const OWN_SNAPSHOT_VERSIONS: OccupancyVersionOption[] = ['Reunião de Ritmo', 'FCA N1', 'FCA N2', 'Fechamento oficial'];

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
    hotels?: Hotel[];
    budgetVersions?: BudgetVersion[];
    budgetOccupancyDataMap?: Record<string, Record<string, number[]>>;
    realOccupancyData?: Record<string, Record<string, number>>;
    setRealOccupancyData?: React.Dispatch<React.SetStateAction<Record<string, Record<string, number>>>>;
    financialData?: ImportedRow[];
    // Naming & type
    activeProjectionType?: import('../types').ProjectionType;
    setActiveProjectionType?: React.Dispatch<React.SetStateAction<import('../types').ProjectionType>>;
    activeRealVersionId?: string;
    activeRealVersionName?: string;
    currentUser?: User;
}

export interface BudgetRow {
    id: string;
    label: string;
    isHeader?: boolean;
    isSpacer?: boolean;
    indent?: boolean;
    format?: 'currency' | 'percent' | 'integer' | 'decimal';
    isInput?: boolean;
    isCalculated?: boolean;
    isManualReal?: boolean;
    forceWhite?: boolean;
    section?: 'Geral' | 'Lazer' | 'Eventos';
}

interface TableInputProps {
    value: number;
    format?: 'currency' | 'percent' | 'integer' | 'decimal';
    decimals?: number;
    onUpdate: (val: number) => void;
    onPaste?: (e: React.ClipboardEvent) => void;
    align?: 'center' | 'right';
    textSizeClass?: string;
    idleColorClass?: string;
    activeColorClass?: string;
    focusRingClass?: string;
    focusBgClass?: string;
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

// --- Subcomponent: Isolated Cell Input ---
// Isso resolve definitivamente o bug do número sumir. Cada célula cuida de si mesma.
export const TableInput: React.FC<TableInputProps> = ({
    value, format, decimals, onUpdate, onPaste,
    align = 'center',
    textSizeClass = 'text-xs',
    idleColorClass = 'text-gray-700 font-medium',
    activeColorClass = 'text-black',
    focusRingClass = 'focus:ring-indigo-300',
    focusBgClass = 'focus:bg-indigo-50'
}) => {
    const [localVal, setLocalVal] = useState('');
    const [isFocused, setIsFocused] = useState(false);

    const handleBlur = () => {
        setIsFocused(false);
        let cleanStr = localVal.trim();

        if (cleanStr.includes('.') && cleanStr.includes(',')) {
            cleanStr = cleanStr.replace(/\./g, '').replace(',', '.');
        } else if (cleanStr.includes(',')) {
            cleanStr = cleanStr.replace(',', '.');
        } else if (cleanStr.includes('.')) {
            const parts = cleanStr.split('.');
            if (parts[parts.length - 1].length === 3 || parseFloat(cleanStr.replace(/\./g, '')) > 999) {
                cleanStr = cleanStr.replace(/\./g, '');
            }
        }

        const parsed = parseFloat(cleanStr);
        if (!isNaN(parsed)) {
            if (parsed !== value) onUpdate(parsed);
        } else if (localVal === '') {
            if (value !== 0) onUpdate(0);
        }
    };

    return (
        <input
            type="text"
            className={`w-full text-${align} bg-transparent ${focusBgClass} focus:outline-none focus:ring-1 ${focusRingClass} rounded px-1 ${textSizeClass} ${isFocused ? activeColorClass : idleColorClass
                }`}
            value={isFocused ? localVal : formatValue(value, format, decimals)}
            onFocus={() => {
                setIsFocused(true);
                setLocalVal(value ? String(value).replace('.', ',') : '');
            }}
            onBlur={handleBlur}
            onChange={(e) => setLocalVal(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            onPaste={onPaste}
        />
    );
};

// --- Budget Table Component ---
export const BudgetOccupancyTable: React.FC<{
    title: string,
    rows: BudgetRow[],
    data: Record<string, number[]>,
    onUpdate: (rowId: string, monthIndex: number, value: number) => void,
    decimalOverrides: Record<string, number>,
    onToggleDecimals: (rowId: string) => void,
    canEdit: boolean,
    isRealMode?: boolean,
    visibleMonths?: number[]
}> = ({ title, rows, data, onUpdate, decimalOverrides, onToggleDecimals, canEdit, isRealMode, visibleMonths }) => {

    const handlePaste = (e: React.ClipboardEvent, startRowId: string, startMonthIndex: number) => {
        e.preventDefault();

        // Desfoca o input atual para garantir que o state dele não sobrescreva a colagem
        if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
        }

        const clipboardData = e.clipboardData.getData('text');
        const pastedLines = clipboardData.split(/\r?\n/).filter(row => row.trim() !== '');

        const startRowIndex = rows.findIndex(r => r.id === startRowId);
        if (startRowIndex === -1) return;

        pastedLines.forEach((rowStr, rIdx) => {
            const currentRow = rows[startRowIndex + rIdx];
            if (!currentRow || !currentRow.isInput) return;
            if (isRealMode && !currentRow.isManualReal) return;

            const cells = rowStr.split('\t');
            cells.forEach((cellStr, cIdx) => {
                const targetMonthIndex = startMonthIndex + cIdx;
                if (targetMonthIndex < 12) {
                    let cleanStr = cellStr.trim();

                    if (cleanStr.includes('.') && cleanStr.includes(',')) {
                        cleanStr = cleanStr.replace(/\./g, '').replace(',', '.');
                    } else if (cleanStr.includes(',')) {
                        cleanStr = cleanStr.replace(',', '.');
                    } else if (cleanStr.includes('.')) {
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

    return (
        <div className="mb-8 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-bold text-gray-800">{title}</h3>
            </div>
            <div className="overflow-x-auto">
                <table className="w-max text-sm text-left border-collapse bg-white">
                    <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
                        <tr>
                            <th className="px-4 py-3 w-64 sticky left-0 bg-gray-50 z-10 border-r border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">Indicador</th>
                            {MONTHS.map((m, idx) => {
                                if (visibleMonths && !visibleMonths.includes(idx)) return null;
                                return <th key={m} className="px-2 py-3 text-center min-w-[80px] w-[80px] border-r border-gray-100">{m}</th>
                            })}
                            <th className="px-2 py-3 text-center min-w-[80px] w-[80px] bg-gray-100 font-bold text-gray-800">Total</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {rows.map((row) => {
                            const visibleCount = visibleMonths ? visibleMonths.length : 12;
                            const totalCols = 1 + visibleCount + 1; // Indicador + months + Total

                            if (row.isSpacer) {
                                return <tr key={row.id} className="h-4 bg-gray-50/50"><td colSpan={totalCols}></td></tr>;
                            }
                            if (row.isHeader) {
                                return (
                                    <tr key={row.id} className="bg-gray-50 font-bold text-gray-800">
                                        <td className="px-4 py-2 sticky left-0 bg-gray-50 z-10 border-r border-gray-200">{row.label}</td>
                                        <td colSpan={totalCols - 1}></td>
                                    </tr>
                                );
                            }

                            // Total is always derived from CLT + Extra at render time, never read from a
                            // stored field — keeps it correct even for budget data saved before this row existed.
                            const rowValues = row.id === 'geral_mo_total'
                                ? Array.from({ length: 12 }, (_, idx) => (data['geral_mo_clt']?.[idx] || 0) + (data['geral_mo_extra']?.[idx] || 0))
                                : (data[row.id] || Array(12).fill(0));

                            let total = rowValues.reduce((sum, v, idx) => sum + ((!visibleMonths || visibleMonths.includes(idx)) ? (v || 0) : 0), 0);
                            const getSum = (id: string) => (data[id] || []).reduce((sum, v, idx) => sum + ((!visibleMonths || visibleMonths.includes(idx)) ? (v || 0) : 0), 0);
                            
                            const parts = row.id.split('_');
                            const prefix = parts[0]; // geral, lazer, event
                            
                            if (row.id.endsWith('_occ_pct')) {
                                const avail = getSum(`${prefix}_avail`);
                                const sold = getSum(`${prefix}_sold`);
                                total = avail > 0 ? (sold / avail) * 100 : 0;
                            } else if (row.id.endsWith('_coef_total')) {
                                const pax = getSum(`${prefix}_pax`);
                                const sold = getSum(`${prefix}_sold`);
                                total = sold > 0 ? (pax / sold) : 0;
                            } else if (row.id.endsWith('_coef_ad')) {
                                const ad = getSum(`${prefix}_adults`);
                                const sold = getSum(`${prefix}_sold`);
                                total = sold > 0 ? (ad / sold) : 0;
                            } else if (row.id.endsWith('_coef_chd')) {
                                const chd = getSum(`${prefix}_chd`);
                                const sold = getSum(`${prefix}_sold`);
                                total = sold > 0 ? (chd / sold) : 0;
                            } else if (row.id.endsWith('_rate_ad')) {
                                const fap = getSum(`${prefix}_rev_fap`);
                                const hosp = getSum(`${prefix}_rev_hosp`);
                                const ad = getSum(`${prefix}_adults`);
                                total = ad > 0 ? (fap - hosp) / ad : 0;
                            } else if (row.id.endsWith('_rate_chd')) {
                                const fap = getSum(`${prefix}_rev_fap`);
                                const hosp = getSum(`${prefix}_rev_hosp`);
                                const chd = getSum(`${prefix}_chd`);
                                total = chd > 0 ? (fap - hosp) / chd : 0;
                            } else if (row.id.endsWith('_dm_fap')) {
                                const fap = getSum(`${prefix}_rev_fap`);
                                const sold = getSum(`${prefix}_sold`);
                                total = sold > 0 ? (fap / sold) : 0;
                            } else if (row.id.endsWith('_dm_hosp')) {
                                const hosp = getSum(`${prefix}_rev_hosp`);
                                const sold = getSum(`${prefix}_sold`);
                                total = sold > 0 ? (hosp / sold) : 0;
                            } else if (row.id.endsWith('_revpar')) {
                                const fap = getSum(`${prefix}_rev_fap`);
                                const avail = getSum(`${prefix}_avail`);
                                total = avail > 0 ? (fap / avail) : 0;
                            } else if (row.id.endsWith('_trevpor')) {
                                const fap = getSum(`${prefix}_rev_fap`);
                                const extra = getSum(`${prefix}_extra_rev`);
                                const orExtras = prefix === 'geral' ? getSum('geral_or_extras') : 0;
                                const orHosp = prefix === 'geral' ? getSum('geral_or_hosp') : 0;
                                const sold = getSum(`${prefix}_sold`);
                                total = sold > 0 ? (fap + extra + orExtras + orHosp) / sold : 0;
                            } else if (row.id.endsWith('_trevpar')) {
                                const fap = getSum(`${prefix}_rev_fap`);
                                const extra = getSum(`${prefix}_extra_rev`);
                                const orExtras = prefix === 'geral' ? getSum('geral_or_extras') : 0;
                                const orHosp = prefix === 'geral' ? getSum('geral_or_hosp') : 0;
                                const avail = getSum(`${prefix}_avail`);
                                total = avail > 0 ? (fap + extra + orExtras + orHosp) / avail : 0;
                            }

                            const isEditable = row.isInput && canEdit && (!isRealMode || row.isManualReal);
                            const isWhite = isEditable || row.forceWhite;
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
                                    {MONTHS.map((_, idx) => {
                                        if (visibleMonths && !visibleMonths.includes(idx)) return null;
                                        return (
                                        <td key={idx} className="px-1 py-1 border-r border-gray-100 text-center">
                                            {isEditable ? (
                                                <TableInput
                                                    value={rowValues[idx]}
                                                    format={row.format}
                                                    decimals={decimalOverrides[row.id]}
                                                    onUpdate={(val) => onUpdate(row.id, idx, val)}
                                                    onPaste={(e) => handlePaste(e, row.id, idx)}
                                                />
                                            ) : (
                                                <span className="text-xs text-gray-600 font-medium">
                                                    {formatValue(rowValues[idx], row.format, decimalOverrides[row.id])}
                                                </span>
                                            )}
                                        </td>
                                        );
                                    })}
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


// --- Row Definitions (Moved outside for performance) ---
export const geralRows: BudgetRow[] = [
    { id: 'days_month', label: 'Dias do mês', isInput: true, isManualReal: true, format: 'integer' },
    { id: 'geral_capacity', label: 'Quartos', isInput: true, isManualReal: true, format: 'integer' },
    { id: 'geral_avail', label: 'Aptos disponíveis', isCalculated: true, format: 'integer' },
    { id: 'geral_sold', label: 'Aptos vendidos', isCalculated: true, forceWhite: true, format: 'integer' },
    { id: 'geral_occ_pct', label: '% de ocupação', isCalculated: true, format: 'percent' },
    { id: 'geral_pax', label: 'N° de hóspedes', isCalculated: true, forceWhite: true, format: 'integer' },
    { id: 'geral_coef_total', label: 'Coef. Occ Geral', isCalculated: true, format: 'decimal' },
    { id: 'geral_adults', label: 'Adultos', isCalculated: true, forceWhite: true, format: 'integer' },
    { id: 'geral_coef_ad', label: 'Coef. Occ Adultos', isCalculated: true, format: 'decimal' },
    { id: 'geral_chd', label: 'CHD', isCalculated: true, forceWhite: true, format: 'integer' },
    { id: 'geral_coef_chd', label: 'Coef. Occ CHD', isCalculated: true, format: 'decimal' },
    { id: 'geral_rate_ad', label: 'Valor FAP Adulto', isCalculated: true, format: 'currency' },
    { id: 'geral_rate_chd', label: 'Valor FAP Criança', isCalculated: true, format: 'currency' },
    { id: 'geral_rev_fap', label: 'Receita COM rateios', isCalculated: true, format: 'integer' },
    { id: 'geral_rev_hosp', label: 'Receita SEM rateios', isCalculated: true, format: 'integer' },
    { id: 'geral_extra_rev', label: 'Receitas Extras', isCalculated: true, format: 'integer' },
    { id: 'geral_iss_rev', label: 'Receita de ISS', isInput: true, isManualReal: true, format: 'integer' },
    { id: 'geral_cancel_ts', label: 'Cancelamento de Time Share', isInput: true, isManualReal: true, format: 'integer' },
    { id: 'geral_impostos', label: 'Impostos', isInput: true, isManualReal: true, format: 'integer' },
    { id: 'geral_or_extras', label: 'OR Extras', isInput: true, isManualReal: true, format: 'integer' },
    { id: 'geral_or_hosp', label: 'OR de Hospedagem', isInput: true, isManualReal: true, format: 'integer' },
    { id: 'geral_dm_fap', label: 'DM bruta (sem iss)', isCalculated: true, format: 'currency' },
    { id: 'geral_dm_hosp', label: 'DM líquida (sem iss)', isCalculated: true, format: 'currency' },
    { id: 'geral_revpar', label: 'REVPAR', isCalculated: true, format: 'currency' },
    { id: 'geral_trevpor', label: 'TREVPOR', isCalculated: true, format: 'currency' },
    { id: 'geral_trevpar', label: 'TREVPAR', isCalculated: true, format: 'currency' },
    { id: 'geral_mo_total', label: 'Mão de obra (Total)', isCalculated: true, forceWhite: true, format: 'integer' },
    { id: 'geral_mo_clt', label: 'Mão de obra (CLT)', isInput: true, isManualReal: true, format: 'integer' },
    { id: 'geral_mo_extra', label: 'Mão de obra (Extra)', isInput: true, isManualReal: true, format: 'integer' },
];

export const lazerRows: BudgetRow[] = [
    { id: 'lazer_capacity', label: 'Quartos', isCalculated: true, format: 'integer' },
    { id: 'lazer_avail', label: 'Aptos disponíveis', isCalculated: true, format: 'integer' },
    { id: 'lazer_sold', label: 'Aptos vendidos', isInput: true, isManualReal: true, format: 'integer' },
    { id: 'lazer_occ_pct', label: '% de ocupação', isCalculated: true, format: 'percent' },
    { id: 'lazer_pax', label: 'N° de hóspedes', isCalculated: true, format: 'integer' },
    { id: 'lazer_coef_total', label: 'Coef. Occ Geral', isCalculated: true, format: 'decimal' },
    { id: 'lazer_adults', label: 'Adultos', isInput: true, isManualReal: true, format: 'integer' },
    { id: 'lazer_coef_ad', label: 'Coef. Occ Adultos', isCalculated: true, format: 'decimal' },
    { id: 'lazer_chd', label: 'CHD', isInput: true, isManualReal: true, format: 'integer' },
    { id: 'lazer_coef_chd', label: 'Coef. Occ CHD', isCalculated: true, format: 'decimal' },
    { id: 'lazer_rate_ad', label: 'Valor FAP Adulto', isCalculated: true, format: 'currency' },
    { id: 'lazer_rate_chd', label: 'Valor FAP Criança', isCalculated: true, format: 'currency' },
    { id: 'lazer_rev_fap', label: 'Receita COM rateios', isInput: true, isManualReal: true, format: 'integer' },
    { id: 'lazer_rev_hosp', label: 'Receita SEM rateios', isInput: true, isManualReal: true, format: 'integer' },
    { id: 'lazer_extra_rev', label: 'Receitas Extras', isInput: true, isManualReal: true, format: 'integer' },
    { id: 'lazer_dm_fap', label: 'DM bruta (sem iss)', isCalculated: true, format: 'currency' },
    { id: 'lazer_dm_hosp', label: 'DM líquida (sem iss)', isCalculated: true, format: 'currency' },
    { id: 'lazer_revpar', label: 'REVPAR', isCalculated: true, format: 'currency' },
    { id: 'lazer_trevpor', label: 'TREVPOR', isCalculated: true, format: 'currency' },
    { id: 'lazer_trevpar', label: 'TREVPAR', isCalculated: true, format: 'currency' },
];

export const eventRows: BudgetRow[] = [
    { id: 'event_capacity', label: 'Quartos', isCalculated: true, format: 'integer' },
    { id: 'event_avail', label: 'Aptos disponíveis', isCalculated: true, format: 'integer' },
    { id: 'event_sold', label: 'Aptos vendidos', isInput: true, isManualReal: true, format: 'integer' },
    { id: 'event_occ_pct', label: '% de ocupação', isCalculated: true, format: 'percent' },
    { id: 'event_pax', label: 'N° de hóspedes', isCalculated: true, format: 'integer' },
    { id: 'event_coef_total', label: 'Coef. Occ Geral', isCalculated: true, format: 'decimal' },
    { id: 'event_adults', label: 'Adultos', isInput: true, isManualReal: true, format: 'integer' },
    { id: 'event_coef_ad', label: 'Coef. Occ Adultos', isCalculated: true, format: 'decimal' },
    { id: 'event_chd', label: 'CHD', isInput: true, isManualReal: true, format: 'integer' },
    { id: 'event_coef_chd', label: 'Coef. Occ CHD', isCalculated: true, format: 'decimal' },
    { id: 'event_rate_ad', label: 'Valor FAP Adulto', isCalculated: true, format: 'currency' },
    { id: 'event_rate_chd', label: 'Valor FAP Criança', isCalculated: true, format: 'currency' },
    { id: 'event_rev_fap', label: 'Receita COM rateios', isInput: true, isManualReal: true, format: 'integer' },
    { id: 'event_rev_hosp', label: 'Receita SEM rateios', isInput: true, isManualReal: true, format: 'integer' },
    { id: 'event_extra_rev', label: 'Receitas Extras', isInput: true, isManualReal: true, format: 'integer' },
    { id: 'event_dm_fap', label: 'DM bruta (sem iss)', isCalculated: true, format: 'currency' },
    { id: 'event_dm_hosp', label: 'DM líquida (sem iss)', isCalculated: true, format: 'currency' },
    { id: 'event_revpar', label: 'REVPAR', isCalculated: true, format: 'currency' },
    { id: 'event_trevpor', label: 'TREVPOR', isCalculated: true, format: 'currency' },
    { id: 'event_trevpar', label: 'TREVPAR', isCalculated: true, format: 'currency' },
];

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
    hotels,
    budgetVersions,
    budgetOccupancyDataMap,
    realOccupancyData,
    setRealOccupancyData,
    financialData,
    activeProjectionType,
    setActiveProjectionType,
    activeRealVersionId,
    activeRealVersionName,
    currentUser
}) => {

    const canEditOccupancy = currentUser?.role === UserRole.ADMIN ||
                            currentUser?.role === UserRole.ENTITY_MANAGER ||
                            currentUser?.role === UserRole.COST_ANALYST;

    const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>({
        otb: false,
        previa: true,
        real: true,
        budget: true,
        deltaBudget: true,
        deltaBudgetPct: true,
        deltaPreviaBudget: true,
        deltaPreviaBudgetPct: true,
        deltaPreviaForecast: true,
        deltaPreviaForecastPct: true,
        lastYear: true,
        deltaLY: true,
        deltaLYPct: true,
        driverOtb: false,
        driverPrevia: false,
        driverForecast: false,
        driverBudget: false,
    });
    const [showColumnSettings, setShowColumnSettings] = useState(false);
    const [decimalOverrides, setDecimalOverrides] = useState<Record<string, number>>({});
    const [visibleMonthsFilter, setVisibleMonthsFilter] = useState<number[]>([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    // "Mostrar/Ocultar Contas" in Comparativo de ocupação — mirrors the same toggle in the DRE
    // Forecast. When hidden, only these indicators stay visible (across Geral/Lazer/Eventos).
    const [showAccountDetails, setShowAccountDetails] = useState(true);
    const ALWAYS_VISIBLE_INDICATOR_SUFFIXES = ['_avail', '_sold', '_occ_pct', '_dm_fap', '_pax', '_revpar', '_trevpor'];
    const isAlwaysVisibleIndicator = (rowId: string) => ALWAYS_VISIBLE_INDICATOR_SUFFIXES.some(suffix => rowId.endsWith(suffix));
    // Hotel filter for Comparativo de ocupação — independent from the global header hotel
    // selector, lets several hotels be summed together (same idea as the month filter).
    const [selectedHotelsFilter, setSelectedHotelsFilter] = useState<string[]>(() => selectedHotel ? [selectedHotel] : []);

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
            const currentDays = currentData[`days_month_${s}`];
            const days = currentDays !== undefined ? currentDays : (budgetData['days_month']?.[monthIdx] || 0);
            set(`days_month_${s}`, days);

            const currentCap = currentData[`geral_capacity_${s}`];
            const baseCap = currentCap !== undefined ? currentCap : (budgetData['geral_capacity']?.[monthIdx] || budgetData['lazer_capacity']?.[monthIdx] || 0);

            const lzCap = baseCap;
            set(`lazer_capacity_${s}`, lzCap);
            const lzAvail = lzCap * days;
            set(`lazer_avail_${s}`, lzAvail);

            const lzSold = get(`lazer_sold_${s}`);
            const lzAd = get(`lazer_adults_${s}`);
            const lzChd = get(`lazer_chd_${s}`);
            
            const lzPax = lzAd + lzChd;
            const lzRevFap = get(`lazer_rev_fap_${s}`);
            let lzRevHosp = get(`lazer_rev_hosp_${s}`);
            if (!lzRevHosp && lzRevHosp !== 0) lzRevHosp = 0;
            
            const lzRateAd = lzAd > 0 ? (lzRevFap - lzRevHosp) / lzAd : 0;
            const lzRateChd = lzChd > 0 ? (lzRevFap - lzRevHosp) / lzChd : 0;

            set(`lazer_occ_pct_${s}`, lzAvail > 0 ? (lzSold / lzAvail) * 100 : 0);
            set(`lazer_pax_${s}`, lzPax);
            set(`lazer_coef_total_${s}`, lzSold > 0 ? lzPax / lzSold : 0);
            set(`lazer_coef_ad_${s}`, lzSold > 0 ? lzAd / lzSold : 0);
            set(`lazer_coef_chd_${s}`, lzSold > 0 ? lzChd / lzSold : 0);
            
            set(`lazer_rate_ad_${s}`, lzRateAd);
            set(`lazer_rate_chd_${s}`, lzRateChd);
            set(`lazer_rev_fap_${s}`, lzRevFap);
            set(`lazer_rev_hosp_${s}`, lzRevHosp);
            set(`lazer_dm_fap_${s}`, lzSold > 0 ? lzRevFap / lzSold : 0);
            set(`lazer_dm_hosp_${s}`, lzSold > 0 ? lzRevHosp / lzSold : 0);
            set(`lazer_revpar_${s}`, lzAvail > 0 ? lzRevFap / lzAvail : 0);

            const evCap = baseCap;
            set(`event_capacity_${s}`, evCap);
            const evAvail = evCap * days;
            set(`event_avail_${s}`, evAvail);

            const evSold = get(`event_sold_${s}`);
            const evAd = get(`event_adults_${s}`);
            const evChd = get(`event_chd_${s}`);
            
            const evPax = evAd + evChd;
            const evRevFap = get(`event_rev_fap_${s}`);
            let evRevHosp = get(`event_rev_hosp_${s}`);
            if (!evRevHosp && evRevHosp !== 0) evRevHosp = 0;
            
            const evRateAd = evAd > 0 ? (evRevFap - evRevHosp) / evAd : 0;
            const evRateChd = evChd > 0 ? (evRevFap - evRevHosp) / evChd : 0;

            set(`event_occ_pct_${s}`, evAvail > 0 ? (evSold / evAvail) * 100 : 0);
            set(`event_pax_${s}`, evPax);
            set(`event_coef_total_${s}`, evSold > 0 ? evPax / evSold : 0);
            set(`event_coef_ad_${s}`, evSold > 0 ? evAd / evSold : 0);
            set(`event_coef_chd_${s}`, evSold > 0 ? evChd / evSold : 0);
            
            set(`event_rate_ad_${s}`, evRateAd);
            set(`event_rate_chd_${s}`, evRateChd);
            set(`event_rev_fap_${s}`, evRevFap);
            set(`event_rev_hosp_${s}`, evRevHosp);
            set(`event_dm_fap_${s}`, evSold > 0 ? evRevFap / evSold : 0);
            set(`event_dm_hosp_${s}`, evSold > 0 ? evRevHosp / evSold : 0);
            set(`event_revpar_${s}`, evAvail > 0 ? evRevFap / evAvail : 0);

            const gCap = baseCap;
            set(`geral_capacity_${s}`, gCap);
            const gAvail = gCap * days;
            set(`geral_avail_${s}`, gAvail);

            const gSold = lzSold + evSold;
            const gAd = lzAd + evAd;
            const gChd = lzChd + evChd;
            const gPax = gAd + gChd;
            const gRevFap = lzRevFap + evRevFap;
            const gRevHosp = lzRevHosp + evRevHosp;

            set(`geral_sold_${s}`, gSold);
            set(`geral_occ_pct_${s}`, gAvail > 0 ? (gSold / gAvail) * 100 : 0);
            set(`geral_pax_${s}`, gPax);
            set(`geral_coef_total_${s}`, gSold > 0 ? gPax / gSold : 0);
            set(`geral_adults_${s}`, gAd);
            set(`geral_coef_ad_${s}`, gSold > 0 ? gAd / gSold : 0);
            set(`geral_chd_${s}`, gChd);
            set(`geral_coef_chd_${s}`, gSold > 0 ? gChd / gSold : 0);

            set(`geral_rate_ad_${s}`, gAd > 0 ? (gRevFap - gRevHosp) / gAd : 0); 
            set(`geral_rate_chd_${s}`, gChd > 0 ? (gRevFap - gRevHosp) / gChd : 0); 

            set(`geral_rev_fap_${s}`, gRevFap);
            set(`geral_rev_hosp_${s}`, gRevHosp);

            const lzExtra = get(`lazer_extra_rev_${s}`);
            const evExtra = get(`event_extra_rev_${s}`);
            const gExtra = lzExtra + evExtra;
            set(`geral_extra_rev_${s}`, gExtra);

            const gOrExtras = get(`geral_or_extras_${s}`);
            const gOrHosp = get(`geral_or_hosp_${s}`);

            set(`geral_dm_fap_${s}`, gSold > 0 ? gRevFap / gSold : 0);
            set(`geral_dm_hosp_${s}`, gSold > 0 ? gRevHosp / gSold : 0);
            set(`geral_revpar_${s}`, gAvail > 0 ? gRevFap / gAvail : 0);
            set(`geral_trevpor_${s}`, gSold > 0 ? (gRevFap + gExtra + gOrExtras + gOrHosp) / gSold : 0);
            set(`geral_trevpar_${s}`, gAvail > 0 ? (gRevFap + gExtra + gOrExtras + gOrHosp) / gAvail : 0);

            set(`lazer_trevpor_${s}`, lzSold > 0 ? (lzRevFap + lzExtra) / lzSold : 0);
            set(`lazer_trevpar_${s}`, lzAvail > 0 ? (lzRevFap + lzExtra) / lzAvail : 0);

            set(`event_trevpor_${s}`, evSold > 0 ? (evRevFap + evExtra) / evSold : 0);
            set(`event_trevpar_${s}`, evAvail > 0 ? (evRevFap + evExtra) / evAvail : 0);

            const gMoClt = get(`geral_mo_clt_${s}`);
            const gMoExtra = get(`geral_mo_extra_${s}`);
            set(`geral_mo_total_${s}`, gMoClt + gMoExtra);
        });

        return newData;
    };

    const [localBudgetData, setLocalBudgetData] = useState<Record<string, number[]>>({});

    useEffect(() => {
        if (propBudgetData !== undefined) {
            setLocalBudgetData(propBudgetData);
        } else {
            setLocalBudgetData({});
        }
    }, [propBudgetData]);

    const defaultBudgetData = useMemo(() => ({}), []);
    const isControlled = propSetBudgetData !== undefined;

    const budgetData: Record<string, number[]> = isControlled
        ? (propBudgetData || defaultBudgetData)
        : localBudgetData;

    const setBudgetData = propSetBudgetData || setLocalBudgetData;
    const isDataReady = !isBudget || propBudgetData !== undefined;

    useEffect(() => {
        if (!isDataReady) return;
        const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        if (!budgetData['days_month']) {
            setBudgetData(prev => {
                const newData = {
                    ...prev,
                    'days_month': daysInMonth
                };
                return recalculateBudget(newData);
            });
        }
    }, [isDataReady, budgetData, setBudgetData]); // Note: recalculateBudget is stable as it's a regular function in the component body

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

        const get = (key: string, idx: number) => newData[key]?.[idx] || 0;
        const set = (key: string, idx: number, val: number) => {
            if (!newData[key]) {
                newData[key] = Array(12).fill(0);
            } else if (newData[key] === data[key]) {
                newData[key] = [...newData[key]];
            }
            newData[key][idx] = val;
        };

        const getDaysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();

        months.forEach(i => {
            const currentDays = get('days_month', i);
            const days = currentDays > 0 ? currentDays : getDaysInMonth(selectedYear, i + 1);
            if (currentDays === 0) {
                set('days_month', i, days);
            }
            const gCap = get('geral_capacity', i);

            const lzCap = gCap;
            const lzAvail = lzCap * days;
            set('lazer_capacity', i, lzCap);
            set('lazer_avail', i, lzAvail);

            const lzSold = get('lazer_sold', i);
            const lzAd = get('lazer_adults', i);
            const lzChd = get('lazer_chd', i);
            const lzRevFap = get('lazer_rev_fap', i);
            const lzPax = lzAd + lzChd;
            let lzRevHosp = get('lazer_rev_hosp', i);
            if (!lzRevHosp && lzRevHosp !== 0) {
                lzRevHosp = 0;
            }
            
            const lzRateAd = lzAd > 0 ? (lzRevFap - lzRevHosp) / lzAd : 0;
            const lzRateChd = lzChd > 0 ? (lzRevFap - lzRevHosp) / lzChd : 0;

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
            set('lazer_rate_ad', i, lzRateAd);
            set('lazer_rate_chd', i, lzRateChd);

            const evCap = gCap;
            const evAvail = evCap * days;
            set('event_capacity', i, evCap);
            set('event_avail', i, evAvail);

            const evSold = get('event_sold', i);
            const evAd = get('event_adults', i);
            const evChd = get('event_chd', i);
            const evRevFap = get('event_rev_fap', i);
            const evPax = evAd + evChd;
            let evRevHosp = get('event_rev_hosp', i);
            if (!evRevHosp && evRevHosp !== 0) {
                evRevHosp = 0;
            }
            
            const evRateAd = evAd > 0 ? (evRevFap - evRevHosp) / evAd : 0;
            const evRateChd = evChd > 0 ? (evRevFap - evRevHosp) / evChd : 0;

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
            set('event_rate_ad', i, evRateAd);
            set('event_rate_chd', i, evRateChd);

            const gAvail = gCap * days;
            set('geral_avail', i, gAvail);

            const gSold = lzSold + evSold;
            const gAd = lzAd + evAd;
            const gChd = lzChd + evChd;
            const gPax = gAd + gChd;
            const gRevFap = lzRevFap + evRevFap;
            const gRevHosp = lzRevHosp + evRevHosp;

            set('geral_sold', i, gSold);
            set('geral_occ_pct', i, gAvail > 0 ? (gSold / gAvail) * 100 : 0);
            set('geral_pax', i, gPax);
            set('geral_coef_total', i, gSold > 0 ? gPax / gSold : 0);
            set('geral_adults', i, gAd);
            set('geral_coef_ad', i, gSold > 0 ? gAd / gSold : 0);
            set('geral_chd', i, gChd);
            set('geral_coef_chd', i, gSold > 0 ? gChd / gSold : 0);

            set('geral_rate_ad', i, gAd > 0 ? (gRevFap - gRevHosp) / gAd : 0); 
            set('geral_rate_chd', i, gChd > 0 ? (gRevFap - gRevHosp) / gChd : 0); 

            set('geral_rev_fap', i, gRevFap);
            set('geral_rev_hosp', i, gRevHosp);

            const lzExtra = get('lazer_extra_rev', i);
            const evExtra = get('event_extra_rev', i);
            const gExtra = lzExtra + evExtra;
            set('geral_extra_rev', i, gExtra);

            const gOrExtras = get('geral_or_extras', i);
            const gOrHosp = get('geral_or_hosp', i);

            set('geral_dm_fap', i, gSold > 0 ? gRevFap / gSold : 0);
            set('geral_dm_hosp', i, gSold > 0 ? gRevHosp / gSold : 0);
            set('geral_revpar', i, gAvail > 0 ? gRevFap / gAvail : 0);
            set('geral_trevpor', i, gSold > 0 ? (gRevFap + gExtra + gOrExtras + gOrHosp) / gSold : 0);
            set('geral_trevpar', i, gAvail > 0 ? (gRevFap + gExtra + gOrExtras + gOrHosp) / gAvail : 0);

            set('lazer_trevpor', i, lzSold > 0 ? (lzRevFap + lzExtra) / lzSold : 0);
            set('lazer_trevpar', i, lzAvail > 0 ? (lzRevFap + lzExtra) / lzAvail : 0);

            set('event_trevpor', i, evSold > 0 ? (evRevFap + evExtra) / evSold : 0);
            set('event_trevpar', i, evAvail > 0 ? (evRevFap + evExtra) / evAvail : 0);

            const gMoClt = get('geral_mo_clt', i);
            const gMoExtra = get('geral_mo_extra', i);
            set('geral_mo_total', i, gMoClt + gMoExtra);
        });

        return newData;
    };

    // --- Real View ---
    if (!isBudget) {
        const contextKey = `${selectedHotel}_${selectedYear}_${selectedMonth}_${activeRealVersionId || ''}`;
        const currentRealData = realOccupancyData?.[contextKey] || {};

        const handleRealUpdate = (rowId: string, col: 'forecast' | 'previa', value: number) => {
            if (setRealOccupancyData) {
                setRealOccupancyData(prev => {
                    const contextData = prev[contextKey] || {};
                    const newData = { ...contextData, [`${rowId}_${col}`]: value };
                    if (col === 'previa') {
                        newData[`${rowId}_forecast`] = value;
                    }
                    const recalculated = recalculateReal(newData);
                    return {
                        ...prev,
                        [contextKey]: recalculated
                    };
                });
            }
        };

        // "Ver acumulado" — Prévia/Forecast/Meta/Ano Anterior sum across every month checked in
        // the filter below (all 12 by default), instead of only the single globally-selected month.
        const accumMonths = visibleMonthsFilter.length > 0 ? visibleMonthsFilter.map(idx => idx + 1) : [selectedMonth || 1];
        // Hotel filter — several hotels can be checked at once and get summed together, same
        // idea as the month filter. Falls back to the global header hotel if none is checked.
        const hotelsToUse = selectedHotelsFilter.length > 0 ? selectedHotelsFilter : (selectedHotel ? [selectedHotel] : []);

        // Editing a specific month's value only makes unambiguous sense when exactly one month
        // and one hotel are selected — with several summed together, cells become read-only.
        // Edits always write to the globally-active hotel's data (handleRealUpdate/contextKey
        // below), so viewing a DIFFERENT hotel from the filter must not offer an edit box that
        // would silently write to the wrong hotel.
        const isSingleMonthView = accumMonths.length === 1 && hotelsToUse.length === 1 && hotelsToUse[0] === selectedHotel;

        // budgetData (Meta) is scoped to whichever budget version is currently active, which
        // only matches ONE hotel (the global one). For any OTHER hotel in the filter, look up
        // that hotel's own "main" budget version to get its Meta figures instead.
        const getBudgetDataForHotel = (hotelName: string): Record<string, number[]> => {
            if (hotelName === selectedHotel) return budgetData || {};
            const hotel = hotels?.find(h => h.name === hotelName);
            const version = budgetVersions?.find(v => v.isMain && (v.hotelId === hotel?.code || v.hotelId === hotel?.id || v.hotel === hotelName));
            return (version && budgetOccupancyDataMap?.[version.id]) || {};
        };

        const sumMetaAcross = (rowId: string, months: number[]) =>
            hotelsToUse.reduce((hotelSum, hotelName) => {
                const hotelBudget = getBudgetDataForHotel(hotelName);
                return hotelSum + months.reduce((sum, m) => sum + (hotelBudget?.[rowId]?.[m - 1] || 0), 0);
            }, 0);

        const sumRealAcross = (rowId: string, suffix: 'forecast' | 'previa', months: number[]) =>
            hotelsToUse.reduce((hotelSum, hotelName) => {
                return hotelSum + months.reduce((sum, m) => {
                    const key = `${hotelName}_${selectedYear}_${m}_${activeRealVersionId || ''}`;
                    const monthData = realOccupancyData?.[key] || {};
                    return sum + (monthData[`${rowId}_${suffix}`] || 0);
                }, 0);
            }, 0);

        // Mirrors BudgetOccupancyTable's own "Total" column ratio logic — a plain sum is wrong
        // for rates/percentages, they must be recomputed from the summed raw components.
        const getMetaAggregate = (rowId: string, months: number[]) => {
            const sum = (id: string) => sumMetaAcross(id, months);
            const prefix = rowId.split('_')[0];

            if (rowId.endsWith('_occ_pct')) {
                const avail = sum(`${prefix}_avail`), sold = sum(`${prefix}_sold`);
                return avail > 0 ? (sold / avail) * 100 : 0;
            }
            if (rowId.endsWith('_coef_total')) {
                const pax = sum(`${prefix}_pax`), sold = sum(`${prefix}_sold`);
                return sold > 0 ? pax / sold : 0;
            }
            if (rowId.endsWith('_coef_ad')) {
                const ad = sum(`${prefix}_adults`), sold = sum(`${prefix}_sold`);
                return sold > 0 ? ad / sold : 0;
            }
            if (rowId.endsWith('_coef_chd')) {
                const chd = sum(`${prefix}_chd`), sold = sum(`${prefix}_sold`);
                return sold > 0 ? chd / sold : 0;
            }
            if (rowId.endsWith('_rate_ad')) {
                const fap = sum(`${prefix}_rev_fap`), hosp = sum(`${prefix}_rev_hosp`), ad = sum(`${prefix}_adults`);
                return ad > 0 ? (fap - hosp) / ad : 0;
            }
            if (rowId.endsWith('_rate_chd')) {
                const fap = sum(`${prefix}_rev_fap`), hosp = sum(`${prefix}_rev_hosp`), chd = sum(`${prefix}_chd`);
                return chd > 0 ? (fap - hosp) / chd : 0;
            }
            if (rowId.endsWith('_dm_fap')) {
                const fap = sum(`${prefix}_rev_fap`), sold = sum(`${prefix}_sold`);
                return sold > 0 ? fap / sold : 0;
            }
            if (rowId.endsWith('_dm_hosp')) {
                const hosp = sum(`${prefix}_rev_hosp`), sold = sum(`${prefix}_sold`);
                return sold > 0 ? hosp / sold : 0;
            }
            if (rowId.endsWith('_revpar')) {
                const fap = sum(`${prefix}_rev_fap`), avail = sum(`${prefix}_avail`);
                return avail > 0 ? fap / avail : 0;
            }
            if (rowId.endsWith('_trevpor') || rowId.endsWith('_trevpar')) {
                const fap = sum(`${prefix}_rev_fap`), extra = sum(`${prefix}_extra_rev`);
                const orExtras = prefix === 'geral' ? sum('geral_or_extras') : 0;
                const orHosp = prefix === 'geral' ? sum('geral_or_hosp') : 0;
                const base = rowId.endsWith('_trevpor') ? sum(`${prefix}_sold`) : sum(`${prefix}_avail`);
                return base > 0 ? (fap + extra + orExtras + orHosp) / base : 0;
            }
            if (rowId === 'lazer_capacity' || rowId === 'event_capacity') return sum('geral_capacity');
            if (rowId === 'lazer_avail' || rowId === 'event_avail') return sum('geral_avail');
            if (rowId === 'geral_mo_total') return sum('geral_mo_clt') + sum('geral_mo_extra');
            return sum(rowId);
        };

        const OCCUPANCY_BASE_FIELDS = [
            'lazer_sold', 'lazer_adults', 'lazer_chd', 'lazer_rev_fap', 'lazer_rev_hosp', 'lazer_extra_rev',
            'event_sold', 'event_adults', 'event_chd', 'event_rev_fap', 'event_rev_hosp', 'event_extra_rev',
            'geral_or_extras', 'geral_or_hosp', 'geral_iss_rev', 'geral_cancel_ts', 'geral_impostos',
            'geral_mo_clt', 'geral_mo_extra'
        ];

        // Real/Prévia aggregate: sum the raw inputs across the selected months, then feed them
        // through the SAME recalculateReal formulas used for a single month — so every derived
        // ratio (occ_pct, dm_fap, revpar, trevpor...) is recomputed from the accumulated totals
        // instead of being (wrongly) summed directly.
        const accumulatedReal = useMemo(() => {
            const agg: Record<string, number> = {};
            (['forecast', 'previa'] as const).forEach(s => {
                // Fixed fields: forecast/previa always mirror the Meta sum, same as the single-month rule.
                agg[`days_month_${s}`] = sumMetaAcross('days_month', accumMonths);
                agg[`geral_capacity_${s}`] = sumMetaAcross('geral_capacity', accumMonths);
                OCCUPANCY_BASE_FIELDS.forEach(f => { agg[`${f}_${s}`] = sumRealAcross(f, s, accumMonths); });
            });
            return recalculateReal(agg);
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [realOccupancyData, budgetData, selectedHotel, selectedYear, activeRealVersionId, JSON.stringify(accumMonths), JSON.stringify(hotelsToUse)]);

        // Ano Anterior — same source and shape as accumulatedReal, but reading realOccupancyData
        // under the PREVIOUS year's context key. This matches exactly how the "Ocupação" tab
        // computes its own "Ano anterior" period, instead of the old (and often empty/mismatched)
        // lookup into imported financial_data rows by hardcoded account-name strings.
        const accumulatedLY = useMemo(() => {
            const lyYear = (selectedYear || 0) - 1;
            const sumRealAcrossLY = (rowId: string, suffix: 'forecast' | 'previa') =>
                hotelsToUse.reduce((hotelSum, hotelName) => {
                    return hotelSum + accumMonths.reduce((sum, m) => {
                        const key = `${hotelName}_${lyYear}_${m}_${activeRealVersionId || ''}`;
                        const monthData = realOccupancyData?.[key] || {};
                        return sum + (monthData[`${rowId}_${suffix}`] || 0);
                    }, 0);
                }, 0);

            const agg: Record<string, number> = {};
            (['forecast', 'previa'] as const).forEach(s => {
                // Same fallback as the "Ocupação" tab: capacity/days reuse the CURRENT year's
                // Meta, since a prior year's Meta isn't tracked as a separate figure here.
                agg[`days_month_${s}`] = sumMetaAcross('days_month', accumMonths);
                agg[`geral_capacity_${s}`] = sumMetaAcross('geral_capacity', accumMonths);
                OCCUPANCY_BASE_FIELDS.forEach(f => { agg[`${f}_${s}`] = sumRealAcrossLY(f, s); });
            });
            return recalculateReal(agg);
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [realOccupancyData, budgetData, selectedHotel, selectedYear, activeRealVersionId, JSON.stringify(accumMonths), JSON.stringify(hotelsToUse)]);

        const getRowData = (rowId: string) => {
            let meta = getMetaAggregate(rowId, accumMonths);

            const fixedFields = ['days_month', 'geral_capacity', 'lazer_capacity', 'event_capacity', 'geral_avail', 'lazer_avail', 'event_avail'];

            let forecast: number;
            let previa: number;

            if (fixedFields.includes(rowId)) {
                forecast = meta;
                previa = meta;
            } else {
                forecast = accumulatedReal[`${rowId}_forecast`] || 0;
                previa = accumulatedReal[`${rowId}_previa`] || 0;
            }

            const ly = fixedFields.includes(rowId) ? meta : (accumulatedLY[`${rowId}_forecast`] || 0);

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
            <div className="mb-8 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative w-fit max-w-full flex">
                <div className="bg-gray-50 border-r border-gray-200 flex items-center justify-center px-1 shrink-0 w-10">
                    <h3 className="text-lg font-bold text-gray-800 whitespace-nowrap" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>{title}</h3>
                </div>
                <div className="overflow-x-auto">
                    {/* table-fixed + no w-full: without this, a w-full table stretches to fill
                        the whole container and redistributes the extra space across columns,
                        making the per-column width classes below meaningless. table-fixed makes
                        them the actual, enforced column widths instead of just hints. */}
                    <table className="table-fixed text-base text-left border-collapse">
                        <thead className="bg-sky-100 font-bold text-sky-900 uppercase tracking-tight text-sm border-b border-sky-200">
                            <tr>
                                <th className="px-2 py-3 w-44 sticky left-0 bg-sky-100 z-10 border-r border-sky-200 text-sm truncate">Indicador</th>
                                {columnVisibility.previa && <th className="px-1 py-3 text-center w-32 truncate text-sm bg-sky-100 text-sky-900 border-r border-gray-100">PRÉVIA</th>}
                                {columnVisibility.real && <th className="px-1 py-3 text-center w-32 truncate text-sm bg-sky-100 text-sky-900 border-r border-gray-100">FORECAST</th>}
                                {columnVisibility.budget && <th className="px-1 py-3 text-center w-32 truncate text-sm border-r border-gray-100">META</th>}
                                {columnVisibility.deltaBudget && <th className="px-1 py-3 text-center w-32 truncate text-sm border-r border-gray-100">Δ META R$</th>}
                                {columnVisibility.deltaBudgetPct && <th className="px-1 py-3 text-center w-32 truncate text-sm border-r border-gray-100">Δ %</th>}
                                {columnVisibility.lastYear && <th className="px-1 py-3 text-center w-32 truncate text-sm bg-sky-100 text-sky-900 border-r border-gray-100">ANO ANTERIOR</th>}
                                {columnVisibility.deltaLY && <th className="px-1 py-3 text-center w-32 truncate text-sm border-r border-gray-100">Δ LY R$</th>}
                                {columnVisibility.deltaLYPct && <th className="px-1 py-3 text-center w-32 truncate text-sm">Δ %</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {rows.map(row => {
                                const { forecast, meta, ly, previa, deltaBudgetVal, deltaBudgetPct, deltaLYVal, deltaLYPct } = getRowData(row.id);
                                const deltaColor = deltaBudgetVal < 0 ? 'text-rose-600' : 'text-emerald-600';
                                const lyColor = deltaLYVal < 0 ? 'text-rose-600' : 'text-emerald-600';

                                return (
                                    <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                                        <td className={`px-2 py-2 text-sm sticky left-0 bg-white z-10 border-r border-gray-200 overflow-hidden whitespace-nowrap ${row.indent ? 'pl-4 text-gray-500' : 'text-gray-700 font-medium'}`}>
                                            <span
                                                onClick={() => toggleDecimals(row.id)}
                                                className="truncate inline-block max-w-full align-middle cursor-pointer"
                                                title={row.label}
                                            >
                                                {row.label}
                                            </span>
                                        </td>
                                        {columnVisibility.previa && (
                                            <td className="px-1 py-2 text-right text-sm truncate bg-sky-50/30 border-r border-gray-100">
                                                {row.isManualReal && canEditOccupancy && isSingleMonthView ? (
                                                    <TableInput
                                                        value={previa || 0}
                                                        format={row.format}
                                                        decimals={decimalOverrides[row.id]}
                                                        onUpdate={(val) => handleRealUpdate(row.id, 'previa', val)}
                                                        align="right"
                                                        textSizeClass=""
                                                        idleColorClass="text-sky-900 font-bold"
                                                        activeColorClass="text-sky-900 font-bold"
                                                        focusRingClass="focus:ring-sky-300"
                                                        focusBgClass="focus:bg-white"
                                                    />
                                                ) : (
                                                    <span className="font-bold text-sky-900">{formatValue(previa, row.format, decimalOverrides[row.id])}</span>
                                                )}
                                            </td>
                                        )}
                                        {columnVisibility.real && (
                                            <td className="px-1 py-2 text-right text-sm truncate bg-sky-50/30 border-r border-gray-100">
                                                {row.isManualReal && canEditOccupancy && isSingleMonthView ? (
                                                    <TableInput
                                                        value={forecast || 0}
                                                        format={row.format}
                                                        decimals={decimalOverrides[row.id]}
                                                        onUpdate={(val) => handleRealUpdate(row.id, 'forecast', val)}
                                                        align="right"
                                                        textSizeClass=""
                                                        idleColorClass="text-sky-900 font-bold"
                                                        activeColorClass="text-sky-900 font-bold"
                                                        focusRingClass="focus:ring-sky-300"
                                                        focusBgClass="focus:bg-white"
                                                    />
                                                ) : (
                                                    <span className="font-bold text-sky-900">{formatValue(forecast, row.format, decimalOverrides[row.id])}</span>
                                                )}
                                            </td>
                                        )}
                                        {columnVisibility.budget && (
                                            <td className="px-1 py-2 text-right text-sm truncate bg-sky-50/30 text-sky-900 font-bold border-r border-gray-100">
                                                {formatValue(meta, row.format, decimalOverrides[row.id])}
                                            </td>
                                        )}
                                        {columnVisibility.deltaBudget && (
                                            <td className={`px-1 py-2 text-right text-sm truncate font-medium border-r border-gray-100 ${deltaColor}`}>
                                                {formatValue(deltaBudgetVal, row.format, decimalOverrides[row.id])}
                                            </td>
                                        )}
                                        {columnVisibility.deltaBudgetPct && (
                                            <td className={`px-1 py-2 text-right text-sm truncate font-bold border-r border-gray-100 ${deltaColor}`}>
                                                {formatPercentDiff(deltaBudgetPct)}
                                            </td>
                                        )}
                                        {columnVisibility.lastYear && (
                                            <td className="px-1 py-2 text-right text-sm truncate bg-sky-50/30 text-sky-900 font-bold border-r border-gray-100">
                                                {formatValue(ly, row.format, decimalOverrides[row.id])}
                                            </td>
                                        )}
                                        {columnVisibility.deltaLY && (
                                            <td className={`px-1 py-2 text-right text-sm truncate font-medium border-r border-gray-100 ${lyColor}`}>
                                                {formatValue(deltaLYVal, row.format, decimalOverrides[row.id])}
                                            </td>
                                        )}
                                        {columnVisibility.deltaLYPct && (
                                            <td className={`px-1 py-2 text-right text-sm truncate font-bold ${lyColor}`}>
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
                        <div className="flex items-center gap-3">
                            <h2 className="text-2xl font-bold text-gray-900">Comparativo de ocupação</h2>
                            {!isBudget && (
                                <span className="bg-indigo-50 border border-indigo-200 text-indigo-700 text-sm rounded-lg py-1 px-3 font-bold">
                                    Fechamento oficial
                                </span>
                            )}
                        </div>
                        <p className="text-gray-500 mt-1">Análise detalhada de ocupação por segmento para {selectedMonth}/{selectedYear}.</p>
                    </div>
                    <div className="flex gap-3 relative">
                        <button
                            onClick={() => setShowAccountDetails(!showAccountDetails)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-base font-bold transition-all border ${!showAccountDetails ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50 shadow-sm'
                                }`}
                            title={showAccountDetails ? "Ocultar contas" : "Mostrar contas"}
                        >
                            {showAccountDetails ? <ListFilter size={20} /> : <LayoutList size={20} />}
                            {showAccountDetails ? 'Ocultar Contas' : 'Mostrar Contas'}
                        </button>
                        <button
                            onClick={() => setShowColumnSettings(!showColumnSettings)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-base font-bold transition-all border ${showColumnSettings ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50 shadow-sm'
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
                                        { key: 'lastYear', label: 'Ano Anterior' },
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

                {hotels && hotels.filter(h => h.type !== 'Administradora').length > 0 && (() => {
                    const filterableHotels = hotels.filter(h => h.type !== 'Administradora');
                    return (
                    <div className="flex flex-wrap gap-1 mb-3 items-center">
                        <span className="text-sm font-bold text-gray-700 mr-2">Hotéis:</span>
                        {filterableHotels.map(h => (
                            <button
                                key={h.id}
                                onClick={() => {
                                    setSelectedHotelsFilter(prev =>
                                        prev.includes(h.name) ? prev.filter(n => n !== h.name) : [...prev, h.name]
                                    );
                                }}
                                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                                    selectedHotelsFilter.includes(h.name)
                                        ? 'bg-indigo-100 text-indigo-700 border border-indigo-200 shadow-sm'
                                        : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
                                }`}
                            >
                                {h.name}
                            </button>
                        ))}
                        <button
                            onClick={() => setSelectedHotelsFilter(selectedHotelsFilter.length === filterableHotels.length ? [] : filterableHotels.map(h => h.name))}
                            className="px-3 py-1 text-xs font-bold rounded-md transition-all bg-gray-100 text-gray-600 hover:bg-gray-200 ml-2 border border-gray-200"
                        >
                            {selectedHotelsFilter.length === filterableHotels.length ? 'Deselecionar Todos' : 'Selecionar Todos'}
                        </button>
                    </div>
                    );
                })()}

                <div className="flex flex-wrap gap-1 mb-6 items-center">
                    <span className="text-sm font-bold text-gray-700 mr-2">Ver acumulado de:</span>
                    {MONTHS.map((m, idx) => (
                        <button
                            key={m}
                            onClick={() => {
                                setVisibleMonthsFilter(prev =>
                                    prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx].sort((a, b) => a - b)
                                );
                            }}
                            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                                visibleMonthsFilter.includes(idx)
                                    ? 'bg-indigo-100 text-indigo-700 border border-indigo-200 shadow-sm'
                                    : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
                            }`}
                        >
                            {m}
                        </button>
                    ))}
                    <button
                        onClick={() => setVisibleMonthsFilter(visibleMonthsFilter.length === 12 ? [] : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])}
                        className="px-3 py-1 text-xs font-bold rounded-md transition-all bg-gray-100 text-gray-600 hover:bg-gray-200 ml-2 border border-gray-200"
                    >
                        {visibleMonthsFilter.length === 12 ? 'Deselecionar Todos' : 'Selecionar Todos'}
                    </button>
                </div>

                {renderRealTable("Geral", showAccountDetails ? geralRows : geralRows.filter(r => isAlwaysVisibleIndicator(r.id)))}
                {renderRealTable("Lazer", showAccountDetails ? lazerRows : lazerRows.filter(r => isAlwaysVisibleIndicator(r.id)))}
                {renderRealTable("Eventos", showAccountDetails ? eventRows : eventRows.filter(r => isAlwaysVisibleIndicator(r.id)))}
            </div>
        );
    }

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


    return (
        <div className="p-8 max-w-[1600px] mx-auto">
            <div className="mb-6 flex items-start justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Orçamento de Ocupação</h2>
                    <p className="text-gray-500 mt-1">Projeção mensal de ocupação e receitas (Lazer e Eventos).</p>
                </div>
            {canEditOccupancy && (
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleManualSave}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all shadow-sm border ${savedIndicator
                            ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                            : 'bg-indigo-600 text-white border-indigo-700 hover:bg-indigo-700'
                            }`}
                    >
                        {savedIndicator ? <CheckCircle size={16} /> : <Save size={16} />}
                        {savedIndicator ? 'Salvo!' : 'Salvar Ocupação'}
                    </button>

                    <button
                        onClick={() => setShowClearConfirm(true)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold border border-red-200 bg-white text-red-600 hover:bg-red-50 transition-all shadow-sm"
                    >
                        <Trash2 size={16} />
                        Limpar Dados de Ocupação
                    </button>
                </div>
            )}
            </div>

            {showClearConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 border border-red-100">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                                <Trash2 size={24} className="text-red-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">Limpar dados de ocupação?</h3>
                                <p className="text-sm text-gray-500 mt-1">Esta ação irá apagar todos os valores inseridos neste orçamento de ocupação. Não é possível desfazer.</p>
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

            <div className="flex flex-wrap gap-1 mt-4 mb-6 items-center">
                <span className="text-sm font-bold text-gray-700 mr-2">Filtrar Meses:</span>
                {MONTHS.map((m, idx) => (
                    <button
                        key={m}
                        onClick={() => {
                            setVisibleMonthsFilter(prev =>
                                prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx].sort((a, b) => a - b)
                            );
                        }}
                        className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                            visibleMonthsFilter.includes(idx)
                                ? 'bg-indigo-100 text-indigo-700 border border-indigo-200 shadow-sm'
                                : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
                        }`}
                    >
                        {m}
                    </button>
                ))}
                <button
                    onClick={() => setVisibleMonthsFilter(visibleMonthsFilter.length === 12 ? [] : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])}
                    className="px-3 py-1 text-xs font-bold rounded-md transition-all bg-gray-100 text-gray-600 hover:bg-gray-200 ml-2 border border-gray-200"
                >
                    {visibleMonthsFilter.length === 12 ? 'Deselecionar Todos' : 'Selecionar Todos'}
                </button>
            </div>

            <div className="space-y-6">
                <BudgetOccupancyTable title="Geral" rows={geralRows} data={budgetData} onUpdate={handleUpdate} decimalOverrides={decimalOverrides} onToggleDecimals={toggleDecimals} canEdit={canEditOccupancy} visibleMonths={visibleMonthsFilter} />
                <BudgetOccupancyTable title="Lazer" rows={lazerRows} data={budgetData} onUpdate={handleUpdate} decimalOverrides={decimalOverrides} onToggleDecimals={toggleDecimals} canEdit={canEditOccupancy} visibleMonths={visibleMonthsFilter} />
                <BudgetOccupancyTable title="Eventos" rows={eventRows} data={budgetData} onUpdate={handleUpdate} decimalOverrides={decimalOverrides} onToggleDecimals={toggleDecimals} canEdit={canEditOccupancy} visibleMonths={visibleMonthsFilter} />
            </div>
        </div>
    );
};

export default OccupancyView;