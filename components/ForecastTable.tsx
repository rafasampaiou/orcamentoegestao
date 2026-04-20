
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { getForecastData, getDynamicForecastData } from '../services/mockData';
import { Download, ListFilter, LayoutList, Settings2, ChevronUp, Activity, TrendingUp, Lock, LockOpen, CheckCircle2, X } from 'lucide-react';
import { ExpenseDriver, ImportedRow, Account, CostPackage, Hotel, ForecastRow, ForecastConfig, ForecastOperator, ColumnVisibility, UserRole } from '../types';
import { evaluateFormula } from '../utils/formulaEngine';
import { supabaseService } from '../services/supabaseService';

interface ForecastTableProps {
    selectedMonth?: number;
    selectedYear?: number;
    financialData?: ImportedRow[];
    selectedHotel?: string;
    // New props for dynamic structure
    accounts: Account[];
    packages: CostPackage[];
    hotels: Hotel[];

    // Month Status Props
    isMonthClosed?: boolean;
    realOccupancyData?: Record<string, Record<string, number>>;

    // Budget Props
    activeRealVersionId?: string;
    activeBudgetVersionId?: string;
    budgetOccupancyData?: Record<string, number[]>;

    // Projections & Validation
    activeProjectionType?: import('../types').ProjectionType;
    setActiveProjectionType?: React.Dispatch<React.SetStateAction<import('../types').ProjectionType>>;
    validations?: import('../types').ValidationRecord[];
    setValidations?: React.Dispatch<React.SetStateAction<import('../types').ValidationRecord[]>>;
    currentUser?: import('../types').User;
    dreConfigs?: Record<string, import('../types').DreSection[]>;
}

const ForecastTable: React.FC<ForecastTableProps> = ({
    selectedMonth,
    selectedYear,
    financialData,
    selectedHotel,
    accounts,
    packages,
    hotels,
    isMonthClosed = false,
    realOccupancyData = {},
    budgetOccupancyData = {},
    activeRealVersionId,
    activeBudgetVersionId,
    activeProjectionType,
    setActiveProjectionType,
    validations,
    setValidations,
    currentUser,
    dreConfigs
}) => {
    // Initialize state passing selectedHotel and dynamic structures
    const [data, setData] = useState<ForecastRow[]>(() => {
        const forecastStructure = dreConfigs?.['Forecast'] || [];
        const initialData = getDynamicForecastData(forecastStructure, selectedMonth, selectedYear, financialData, selectedHotel, hotels, realOccupancyData, activeRealVersionId, activeBudgetVersionId, accounts, packages, budgetOccupancyData);
        // Initialize previaConfig if missing
        const initializedData = initialData.map(row => ({
            ...row,
            previaConfig: row.previaConfig || { method: 'Fixed', manualValue: row.previa }
        }));
        return recalculateTotals(initializedData, packages, accounts);
    });
    const [showDetails, setShowDetails] = useState(false);
    const [calculationBase, setCalculationBase] = useState<'forecast' | 'previa'>('forecast');
    const [kpiBasis, setKpiBasis] = useState<'with_tax' | 'no_tax'>('with_tax');

    const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>({
        previa: true,
        real: true,
        budget: true,
        deltaPreviaBudget: true,
        deltaPreviaBudgetPct: true,
        deltaBudget: true,
        deltaBudgetPct: true,
        lastYear: true,
        deltaLY: true,
        deltaLYPct: true,
    });
    const [showColumnSettings, setShowColumnSettings] = useState(false);

    // Column Resizing State
    const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
        description: 300,
        previa: 120,
        real: 120,
        budget: 120,
        deltaPreviaBudget: 120,
        deltaPreviaBudgetPct: 120,
        lastYear: 120,
        deltaLY: 120,
        deltaLYPct: 120,
    });

    const [resizingColumn, setResizingColumn] = useState<string | null>(null);
    const [startX, setStartX] = useState(0);
    const [startWidth, setStartWidth] = useState(0);
    const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

    const handleKeyDown = (e: React.KeyboardEvent, rowId: string, field: 'real' | 'previa') => {
        if (e.key === 'Tab') {
            e.preventDefault();
            const direction = e.shiftKey ? -1 : 1;
            const currentIndex = visibleData.findIndex(r => r.id === rowId);
            let nextIndex = currentIndex + direction;

            while (nextIndex >= 0 && nextIndex < visibleData.length) {
                const nextRow = visibleData[nextIndex];
                const nextInputId = `input-${field}-${nextRow.id}`;
                const nextInput = inputRefs.current[nextInputId];

                if (nextInput) {
                    nextInput.focus();
                    nextInput.select();
                    break;
                }
                nextIndex += direction;
            }
        }
    };

    const handleResizeStart = (e: React.MouseEvent, columnId: string) => {
        e.preventDefault();
        setResizingColumn(columnId);
        setStartX(e.pageX);
        setStartWidth(columnWidths[columnId]);
        document.body.style.cursor = 'col-resize';
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!resizingColumn) return;
            const diff = e.pageX - startX;
            const newWidth = Math.max(80, startWidth + diff);
            setColumnWidths(prev => ({ ...prev, [resizingColumn]: newWidth }));
        };

        const handleMouseUp = () => {
            setResizingColumn(null);
            document.body.style.cursor = 'default';
        };

        if (resizingColumn) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [resizingColumn, startX, startWidth]);

    // State to track which parameter rows are expanded (showing full controls) vs minimized
    const [expandedConfigRows, setExpandedConfigRows] = useState<Set<string>>(new Set());

    // Validation Modal State
    const [showValidationModal, setShowValidationModal] = useState(false);
    const [justifications, setJustifications] = useState<Record<string, string>>({});

    // Effect: When dependencies change, regenerate the Forecast rows using current state props
    // We use useMemo to avoid the linter warning about setState in effect, 
    // and we only update state when the derived data actually changes from props.
    const derivedData = useMemo(() => {
        const forecastStructure = dreConfigs?.['Forecast'] || [];

        let newData: ForecastRow[];
        if (forecastStructure.length > 0) {
            newData = getDynamicForecastData(forecastStructure, selectedMonth, selectedYear, financialData, selectedHotel, hotels, realOccupancyData, activeRealVersionId, activeBudgetVersionId, accounts, packages, budgetOccupancyData);
        } else {
            newData = getForecastData(selectedMonth, selectedYear, financialData, selectedHotel, hotels, realOccupancyData, activeRealVersionId, activeBudgetVersionId, accounts, packages, budgetOccupancyData);
        }

        const initializedData = newData.map(row => ({
            ...row,
            previaConfig: row.previaConfig || { method: 'Fixed', manualValue: row.previa }
        }));
        return recalculateTotals(initializedData, packages, accounts);
    }, [selectedMonth, selectedYear, financialData, selectedHotel, packages, accounts, hotels, realOccupancyData, activeRealVersionId, activeBudgetVersionId, budgetOccupancyData, dreConfigs]);

    useEffect(() => {
        setData(derivedData);
    }, [derivedData]);

    const isSpecialEditableRow = (id: string) => {
        return ['REV-APT-LAZER', 'REV-APT-EVENTOS', 'REV-EXTRA-LAZER', 'REV-EXTRA-EVENTOS', 'REV-TIME', 'REV-ISS', 'REV-IMP'].includes(id);
    };




    // --- STATE HANDLERS ---

    const toggleConfigRow = (id: string) => {
        setExpandedConfigRows(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleConfigChange = (rowId: string, updates: Partial<ForecastConfig>) => {
        setData(prevData => {
            const newData = prevData.map(row => {
                if (row.id !== rowId) return row;

                const currentConfig = calculationBase === 'forecast' ? row.forecastConfig : (row.previaConfig || { method: 'Fixed' });
                const newConfig = { ...currentConfig, ...updates };

                // Reset manual value if switching to Variable (optional, but keeps clean)
                let newValue = calculationBase === 'forecast' ? row.real : row.previa;

                if (updates.method === 'Fixed') {
                    // Ensure manualValue is set to current value if not present
                    newConfig.manualValue = updates.manualValue !== undefined ? updates.manualValue : newValue;
                    newValue = newConfig.manualValue || 0;
                }

                // We update the config
                const updatedRow = {
                    ...row,
                    [calculationBase === 'forecast' ? 'forecastConfig' : 'previaConfig']: newConfig
                };

                if (updates.method === 'Variable' || (currentConfig.method === 'Variable' && !updates.method)) {
                    // We immediately calculate the new value based on this config
                    const calculated = calculateRowValue(newConfig, prevData, calculationBase);
                    if (calculationBase === 'forecast') updatedRow.real = calculated;
                    else updatedRow.previa = calculated;
                } else {
                    if (calculationBase === 'forecast') updatedRow.real = newValue;
                    else updatedRow.previa = newValue;
                }

                return updatedRow;
            });

            return recalculateTotals(newData, packages, accounts);
        });
    };

    const handleManualValueChange = (rowId: string, field: 'real' | 'previa', value: number) => {
        setData(prevData => {
            const newData = prevData.map(row => {
                if (row.id !== rowId) return row;

                // Sync Forecast with Prévia for Occupancy Indicators
                if (field === 'previa' && (row.id === 'IND-1' || row.id === 'IND-2')) {
                    return { ...row, previa: value, real: value, isManualPreviaOverride: true, isManualOverride: true };
                }

                if (field === 'real') {
                    return { ...row, real: value, isManualOverride: true };
                } else if (field === 'previa') {
                    return { ...row, previa: value, isManualPreviaOverride: true };
                }
                return { ...row, [field]: value };
            });
            return recalculateTotals(newData, packages, accounts);
        });
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>, startRowId: string, field: 'real' | 'previa') => {
        const pasteData = e.clipboardData.getData('text');
        if (!pasteData) return;

        const lines = pasteData.split(/\r?\n/).filter(line => line.trim() !== '');
        if (lines.length <= 1) return; // Let default behavior handle single value paste

        e.preventDefault();

        setData(prevData => {
            const newData = [...prevData];
            const startIndex = newData.findIndex(r => r.id === startRowId);
            if (startIndex === -1) return prevData;

            let lineIndex = 0;

            for (let i = startIndex; i < newData.length && lineIndex < lines.length; i++) {
                const row = newData[i];

                if (row.isHeader || row.isTotal || row.category === 'Spacer') continue;

                const isIndicator = row.id.startsWith('IND-');
                const isManualRow = ['IND-MO-2', 'IND-MO-3'].includes(row.id);
                const isInputIndicator = ['IND-1', 'IND-LZ-2', 'IND-LZ-4', 'IND-LZ-5', 'IND-EV-2', 'IND-EV-4', 'IND-EV-5'].includes(row.id);
                const canEditReal = !isMonthClosed && (!row.isHeader || isSpecialEditableRow(row.id)) && !row.isTotal && (row.forecastConfig.method === 'Fixed' || isSpecialEditableRow(row.id));
                const canEditPrevia = !isMonthClosed && (!row.isHeader || isSpecialEditableRow(row.id)) && !row.isTotal && ((row.previaConfig?.method || 'Fixed') === 'Fixed' || isSpecialEditableRow(row.id));

                let canEdit = false;
                if (!isIndicator) {
                    canEdit = field === 'real' ? canEditReal : canEditPrevia;
                } else if (isInputIndicator || isManualRow) {
                    canEdit = true;
                }

                if (canEdit) {
                    const valStr = lines[lineIndex].replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '');
                    const val = parseFloat(valStr);

                    if (!isNaN(val)) {
                        if (!isIndicator) {
                            if (field === 'real') {
                                row.forecastConfig = { ...row.forecastConfig, method: 'Fixed', manualValue: val };
                                row.real = val;
                                row.isManualOverride = true;
                            } else {
                                row.previaConfig = { ...(row.previaConfig || { method: 'Fixed' }), method: 'Fixed', manualValue: val };
                                row.previa = val;
                                row.isManualPreviaOverride = true;
                            }
                        } else {
                            if (isManualRow) {
                                if (field === 'real') {
                                    row.real = val;
                                    row.isManualOverride = true;
                                } else {
                                    row.previa = val;
                                    row.isManualPreviaOverride = true;
                                }
                            } else {
                                if (field === 'real') {
                                    row.forecastConfig = { ...row.forecastConfig, method: 'Fixed', manualValue: val };
                                    row.real = val;
                                    row.isManualOverride = true;
                                } else {
                                    row.previaConfig = { ...(row.previaConfig || { method: 'Fixed' }), method: 'Fixed', manualValue: val };
                                    row.previa = val;
                                    row.isManualPreviaOverride = true;
                                }
                            }
                        }
                    }
                    lineIndex++;
                }
            }

            return recalculateTotals(newData, packages, accounts);
        });
    };

    // Function moved to end of file to avoid hoisting issues


    // Filter data based on view mode
    const visibleData = useMemo(() => {
        return data.filter(row => {
            // 1. Sempre manter Spacers e Indicadores
            if (row.category === 'Spacer' || row.category === 'Indicators') return true;

            // 2. Sempre mostrar agrupadores (Mestres e Pacotes)
            // A propriedade isHeader é true para todas as linhas totalizadoras do mock
            if (row.isHeader) return true;

            // 3. Controlar visibilidade das Contas (Linhas de detalhe)
            if (!row.isHeader) {
                // EXCEÇÃO: Mostrar sempre as linhas de drill-down de TI/Marketing
                if (row.id.includes('p-drill-')) return true;

                // Se o botão "Mostrar Contas" estiver ativado, mostra todas as contas
                if (showDetails) return true;
            }

            return false;
        });
    }, [data, showDetails]);

    const formatValue = (val: number | undefined, format: 'currency' | 'percent' | 'integer' | 'decimal' = 'currency') => {
        if (val === undefined || val === null) return '-';
        if (isNaN(val)) return '0';

        if (format === 'percent') {
            return `${val.toFixed(2)}%`;
        }
        if (format === 'integer') {
            return new Intl.NumberFormat('pt-BR', { style: 'decimal', maximumFractionDigits: 0 }).format(val);
        }
        if (format === 'decimal') {
            return new Intl.NumberFormat('pt-BR', { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
        }
        // Currency default: No decimals
        return new Intl.NumberFormat('pt-BR', { style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);
    };

    const formatPercentDiff = (val: number | undefined) => {
        if (val === undefined) return '-';
        if (val > 999) return '>999%';
        if (val < -999) return '<-999%';
        if (isNaN(val)) return '-';
        return `${val > 0 ? '+' : ''}${val.toFixed(1)}%`;
    };

    const blueRowIds = ['REV-TOTAL', 'REV-NET', 'CST-HEAD', 'RES-OP', 'RES-PCT', 'REV-IMP', 'RES-OP-SEM-IMP', 'RES-OP-COM-IMP'];

    const monthName = new Date(selectedYear || 2024, (selectedMonth || 1) - 1).toLocaleString('pt-BR', { month: 'long' });

    // Custom Input Class to remove spinners and dashed lines
    const inputClass = "w-full text-right bg-transparent border border-transparent hover:bg-gray-50 focus:bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 rounded px-1 text-indigo-900 font-semibold outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

    const FormattedInput = ({ inputRef, value, onChange, onKeyDown, onPaste, formatType, className }: any) => {
        const [isFocused, setIsFocused] = useState(false);
        const [localValue, setLocalValue] = useState("");

        useEffect(() => {
            if (!isFocused) {
                setLocalValue(value === 0 ? '' : value.toString().replace('.', ','));
            }
        }, [value, isFocused]);

        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const valStr = e.target.value;
            if (/^[0-9.,-]*$/.test(valStr)) {
                setLocalValue(valStr);
                const cleanStr = valStr.replace(/\./g, '').replace(',', '.');
                const num = parseFloat(cleanStr);
                if (!isNaN(num) || valStr === '' || valStr === '-') {
                    onChange(isNaN(num) ? 0 : num);
                }
            }
        };

        return (
            <input
                ref={inputRef}
                type="text"
                className={className}
                value={isFocused ? (localValue === '0' && value === 0 ? '' : localValue) : (value === 0 ? '' : formatValue(value, formatType))}
                onFocus={() => {
                    setIsFocused(true);
                    setLocalValue(value === 0 ? '' : value.toString().replace('.', ','));
                }}
                onBlur={() => setIsFocused(false)}
                onChange={handleChange}
                onKeyDown={onKeyDown}
                onPaste={onPaste}
            />
        );
    };

    return (
        <div className="flex flex-col h-full w-full">
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 flex flex-col h-full overflow-hidden font-sans w-full">
                <div className="px-5 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center shrink-0 gap-8">
                    <div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2 capitalize">
                                Demonstrativo de Resultados (DRE) - {monthName} {selectedYear}
                            </h2>
                            {setActiveProjectionType && activeProjectionType && (
                                <select
                                    className="bg-indigo-50 border border-indigo-200 text-indigo-700 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 p-1.5 font-bold"
                                    value={activeProjectionType}
                                    onChange={(e) => setActiveProjectionType(e.target.value as import('../types').ProjectionType)}
                                >
                                    <option value="Reunião de Ritmo">Reunião de Ritmo</option>
                                    <option value="FCA N1">FCA N1</option>
                                    <option value="FCA N2">FCA N2</option>
                                    <option value="Fechamento oficial">Fechamento oficial</option>
                                </select>
                            )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                            Visão consolidada por plano de contas e gestão matricial ({selectedHotel}).
                        </p>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* KPI BASIS SELECTOR */}
                        <div className="flex items-center bg-gray-100 rounded-lg p-1 border border-gray-200">
                            <button
                                onClick={() => setKpiBasis('with_tax')}
                                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${kpiBasis === 'with_tax'
                                    ? 'bg-white text-indigo-700 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700'
                                    }`}
                                title="Calcular Reatividade/Transformação com GOP Com Impostos"
                            >
                                GOP C/ Imp.
                            </button>
                            <button
                                onClick={() => setKpiBasis('no_tax')}
                                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${kpiBasis === 'no_tax'
                                    ? 'bg-white text-indigo-700 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700'
                                    }`}
                                title="Calcular Reatividade/Transformação com GOP Sem Impostos"
                            >
                                GOP S/ Imp.
                            </button>
                        </div>

                        {isMonthClosed ? (
                            <span className="flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold border border-red-200">
                                <Lock size={12} /> Mês Fechado
                            </span>
                        ) : (
                            <span className="flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold border border-emerald-200">
                                <LockOpen size={12} /> Mês Aberto
                            </span>
                        )}
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={() => setShowColumnSettings(!showColumnSettings)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-base font-bold transition-colors border ${showColumnSettings
                                ? 'bg-orange-100 text-orange-700 border-orange-200'
                                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50 shadow-sm'
                                }`}
                            title="Configurar colunas visíveis"
                        >
                            <Settings2 size={20} />
                            Colunas
                        </button>
                        <button
                            onClick={() => setShowDetails(!showDetails)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-base font-bold transition-colors border ${!showDetails
                                ? 'bg-indigo-100 text-indigo-700 border-indigo-200'
                                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50 shadow-sm'
                                }`}
                            title={showDetails ? "Ocultar contas contábeis" : "Mostrar contas contábeis"}
                        >
                            {showDetails ? <ListFilter size={20} /> : <LayoutList size={20} />}
                            {showDetails ? 'Ocultar Contas' : 'Mostrar Contas'}
                        </button>
                        <button
                            onClick={() => setShowValidationModal(true)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-md text-base font-bold"
                        >
                            <CheckCircle2 size={20} />
                            Validar projeção
                        </button>
                        <button className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shadow-md text-base font-bold">
                            <Download size={20} />
                            Exportar Excel
                        </button>
                    </div>
                </div>

                <div className="overflow-auto flex-1 bg-white relative">
                    {/* COLUMN SETTINGS PANEL */}
                    {showColumnSettings && (
                        <div className="absolute right-4 top-4 z-50 bg-white border border-gray-200 shadow-xl rounded-xl p-4 w-64 animate-in fade-in slide-in-from-top-2">
                            <div className="flex justify-between items-center mb-3">
                                <h4 className="font-bold text-gray-800 text-sm">Visibilidade das Colunas</h4>
                                <button onClick={() => setShowColumnSettings(false)} className="text-gray-400 hover:text-gray-600">
                                    <ChevronUp size={16} />
                                </button>
                            </div>
                            <div className="space-y-2">
                                {[
                                    { key: 'previa', label: 'Prévia' },
                                    { key: 'real', label: 'Forecast (Real)' },
                                    { key: 'budget', label: 'Meta (Budget)' },
                                    { key: 'deltaPreviaBudget', label: 'Δ Prévia - Meta R$' },
                                    { key: 'deltaPreviaBudgetPct', label: 'Δ Prévia - Meta %' },
                                    { key: 'lastYear', label: 'Last Year' },
                                    { key: 'deltaLY', label: 'Δ 2026 x Last Year R$' },
                                    { key: 'deltaLYPct', label: 'Δ 2026 x Last Year %' },
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

                    <table className="text-base text-left border-collapse table-fixed w-max">
                        <thead className="bg-sky-100 sticky top-0 z-30 shadow-sm font-bold text-sky-900 uppercase tracking-tight text-sm">
                            <tr>


                                {/* Description - Flexible Width */}
                                <th
                                    style={{ width: columnWidths.description }}
                                    className="px-2 py-3 border-b border-sky-200 bg-sky-100 text-sky-900 truncate group relative z-40 sticky left-0 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]"
                                >
                                    Descrição
                                    <div
                                        onMouseDown={(e) => handleResizeStart(e, 'description')}
                                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize bg-sky-300 opacity-0 group-hover:opacity-100 transition-opacity z-50"
                                    />
                                </th>

                                {/* PRÉVIA */}
                                {columnVisibility.previa && (
                                    <th
                                        style={{ width: columnWidths.previa }}
                                        className="px-2 py-3 text-center bg-sky-100 text-sky-900 border-b border-sky-200 border-l border-sky-200 group relative"
                                    >
                                        {isMonthClosed ? 'REAL' : 'PRÉVIA'}
                                        <div
                                            onMouseDown={(e) => handleResizeStart(e, 'previa')}
                                            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize bg-sky-300 opacity-0 group-hover:opacity-100 transition-opacity z-50"
                                        />
                                    </th>
                                )}

                                {/* FORECAST */}
                                {columnVisibility.real && (
                                    <th
                                        style={{ width: columnWidths.real }}
                                        className="px-2 py-3 text-center bg-sky-100 text-sky-900 border-b border-sky-200 border-l border-sky-200 group relative"
                                    >
                                        FORECAST
                                        <div
                                            onMouseDown={(e) => handleResizeStart(e, 'real')}
                                            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize bg-sky-300 opacity-0 group-hover:opacity-100 transition-opacity z-50"
                                        />
                                    </th>
                                )}

                                {/* META */}
                                {columnVisibility.budget && (
                                    <th
                                        style={{ width: columnWidths.budget }}
                                        className="px-2 py-3 text-center bg-sky-100 text-sky-900 border-b border-sky-200 group relative"
                                    >
                                        META
                                        <div
                                            onMouseDown={(e) => handleResizeStart(e, 'budget')}
                                            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize bg-sky-300 opacity-0 group-hover:opacity-100 transition-opacity z-50"
                                        />
                                    </th>
                                )}

                                {/* Δ Prévia - Meta R$ */}
                                {columnVisibility.deltaPreviaBudget && (
                                    <th
                                        style={{ width: columnWidths.deltaPreviaBudget }}
                                        className="px-2 py-3 text-center bg-sky-100 text-sky-900 border-b border-sky-200 whitespace-pre-line leading-tight group relative"
                                    >
                                        Δ<br />{isMonthClosed ? 'REAL' : 'PRÉVIA'} - META
                                        <div
                                            onMouseDown={(e) => handleResizeStart(e, 'deltaPreviaBudget')}
                                            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize bg-sky-300 opacity-0 group-hover:opacity-100 transition-opacity z-50"
                                        />
                                    </th>
                                )}

                                {/* Δ Prévia - Meta % */}
                                {columnVisibility.deltaPreviaBudgetPct && (
                                    <th
                                        style={{ width: columnWidths.deltaPreviaBudgetPct }}
                                        className="px-2 py-3 text-center bg-sky-100 text-sky-900 border-b border-sky-200 border-r border-sky-200 whitespace-pre-line leading-tight group relative"
                                    >
                                        Δ %<br />{isMonthClosed ? 'REAL' : 'PRÉVIA'} - META
                                        <div
                                            onMouseDown={(e) => handleResizeStart(e, 'deltaPreviaBudgetPct')}
                                            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize bg-sky-300 opacity-0 group-hover:opacity-100 transition-opacity z-50"
                                        />
                                    </th>
                                )}

                                {/* LAST YEAR */}
                                {columnVisibility.lastYear && (
                                    <th
                                        style={{ width: columnWidths.lastYear }}
                                        className="px-2 py-3 text-center bg-sky-100 text-sky-900 border-b border-sky-200 group relative"
                                    >
                                        Last Year
                                        <div
                                            onMouseDown={(e) => handleResizeStart(e, 'lastYear')}
                                            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize bg-sky-300 opacity-0 group-hover:opacity-100 transition-opacity z-50"
                                        />
                                    </th>
                                )}

                                {/* Δ PRÉVIA X LY R$ */}
                                {columnVisibility.deltaLY && (
                                    <th
                                        style={{ width: columnWidths.deltaLY }}
                                        className="px-2 py-3 text-center bg-sky-100 text-sky-900 border-b border-sky-200 whitespace-pre-line leading-tight group relative"
                                    >
                                        Δ<br />{isMonthClosed ? 'REAL' : 'PRÉVIA'} - LY
                                        <div
                                            onMouseDown={(e) => handleResizeStart(e, 'deltaLY')}
                                            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize bg-sky-300 opacity-0 group-hover:opacity-100 transition-opacity z-50"
                                        />
                                    </th>
                                )}

                                {/* Δ PRÉVIA X LY % */}
                                {columnVisibility.deltaLYPct && (
                                    <th
                                        style={{ width: columnWidths.deltaLYPct }}
                                        className="px-2 py-3 text-center bg-sky-100 text-sky-900 border-b border-sky-200 whitespace-pre-line leading-tight group relative"
                                    >
                                        Δ %<br />{isMonthClosed ? 'REAL' : 'PRÉVIA'} - LY
                                        <div
                                            onMouseDown={(e) => handleResizeStart(e, 'deltaLYPct')}
                                            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize bg-sky-300 opacity-0 group-hover:opacity-100 transition-opacity z-50"
                                        />
                                    </th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {visibleData.map((row, idx) => {
                                // --- SPECIAL RENDER FOR TRANSFORMATION / REACTIVITY CARDS ---
                                if (row.id === 'KPI-TRANS-BUDGET' || row.id === 'KPI-TRANS-LY') {
                                    const isTransformation = row.label.includes('Transformação');
                                    return (
                                        <tr key={row.id}>
                                            <td colSpan={12} className="px-4 py-2 border-b border-gray-100 bg-white">
                                                <div className={`flex items-center gap-3 p-3 rounded-lg border shadow-sm max-w-lg mx-auto ${isTransformation ? 'bg-emerald-50 border-emerald-100' : 'bg-blue-50 border-blue-100'}`}>
                                                    <div className={`p-2 rounded-full ${isTransformation ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
                                                        {isTransformation ? <TrendingUp size={20} /> : <Activity size={20} />}
                                                    </div>
                                                    <div className="flex-1">
                                                        <h4 className={`text-sm font-bold ${isTransformation ? 'text-emerald-800' : 'text-blue-800'}`}>
                                                            {row.label}
                                                        </h4>
                                                        <p className="text-xs text-gray-500">Indicador de eficiência operacional sobre variação de receita.</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className={`text-xl font-bold ${isTransformation ? 'text-emerald-700' : 'text-blue-700'}`}>
                                                            {formatValue(row.real, 'percent')}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                }

                                // --- SPACER LOGIC ---
                                if (row.category === 'Spacer') {
                                    return (
                                        <tr key={row.id} className="bg-gray-100/50">
                                            <td colSpan={12} className="h-6 border-y border-gray-200"></td>
                                        </tr>
                                    );
                                }

                                const isIndicator = row.category === 'Indicators';
                                const isSectionHeader = row.isHeader && row.indentLevel === 0; // Level 0 (Receitas, Custos)
                                const isGroupHeader = row.isHeader && row.indentLevel === 1;   // Level 1 (Pacotes)
                                const isSubGroupHeader = row.isHeader && row.indentLevel === 2; // Level 2 (Sub-pacotes - Raro agora)
                                const isTotal = row.isTotal;
                                const isBlueHighlight = blueRowIds.includes(row.id);

                                // Identify Special Revenue Rows for Styling
                                // REMOVED REV-TIME from this list to allow manual editing
                                const isSpecialRevenue = ['REV-HOSP', 'REV-EXTRA', 'REV-ISS', 'REV-APT'].includes(row.id);

                                const formatType = row.rowConfig?.format || 'currency';

                                // --- COMMON FINANCIAL CELLS RENDERER ---
                                const renderFinancialCells = (isHeaderOrTotal = false, customBg = "") => {
                                    const effectiveBg = row.bgColor || (isBlueHighlight ? 'bg-sky-100 border-sky-200' : (customBg || 'bg-blue-50/20 border-r border-blue-50'));
                                    const effectiveText = row.textColor || (isBlueHighlight ? 'text-sky-900' : (isHeaderOrTotal ? 'text-black' : 'text-slate-800'));
                                    const previaBg = isBlueHighlight ? 'bg-sky-100 text-sky-800' : 'bg-purple-50/20 text-slate-500';
                                    const textStyle = {
                                        color: row.textColor || undefined,
                                        fontWeight: row.isBold || isHeaderOrTotal ? 'bold' : 'normal',
                                        fontStyle: row.isItalic ? 'italic' : 'normal'
                                    };

                                    // FORECAST (REAL) CELL LOGIC
                                    let realCellContent: React.ReactNode = formatValue(row.real, formatType);
                                    let previaCellContent: React.ReactNode = formatValue(row.previa, formatType);

                                    // Identify Manual Edit Rows (CLT / Extra Quantity)
                                    const isManualRow = ['IND-MO-2', 'IND-MO-3'].includes(row.id);

                                    const isEditableCost = row.category === 'Costs';
                                    const isEditableSpecial = isSpecialEditableRow(row.id);
                                    if (!isIndicator && (!isHeaderOrTotal || isEditableCost || isEditableSpecial)) {
                                        if (isMonthClosed) {
                                            // CLOSED MONTH: Read Only Standard
                                            realCellContent = <span className="text-gray-800 font-medium">{formatValue(row.real, formatType)}</span>;
                                            previaCellContent = <span className="text-gray-800 font-medium">{formatValue(row.previa, formatType)}</span>;
                                        } else {
                                            // FORECAST (REAL) EDITING
                                            if (row.forecastConfig.method === 'Fixed' || isEditableCost || isEditableSpecial) {
                                                realCellContent = (
                                                    <FormattedInput
                                                        inputRef={(el: any) => { inputRefs.current[`input-real-${row.id}`] = el; }}
                                                        className={inputClass}
                                                        value={row.real}
                                                        formatType={formatType}
                                                        onChange={(val: number) => handleManualValueChange(row.id, 'real', val)}
                                                        onKeyDown={(e: any) => handleKeyDown(e, row.id, 'real')}
                                                        onPaste={(e: any) => handlePaste(e, row.id, 'real')}
                                                    />
                                                );
                                            } else {
                                                realCellContent = (
                                                    <div className="flex items-center justify-end gap-1 cursor-help" title={`Calculado: ${row.forecastConfig.driver} ${row.forecastConfig.operator === 'divide' ? '/' : 'x'} ${row.forecastConfig.factor}`}>
                                                        <span className="text-orange-800 font-medium">{formatValue(row.real, formatType)}</span>
                                                    </div>
                                                );
                                            }

                                            // PREVIA EDITING
                                            if ((row.previaConfig?.method || 'Fixed') === 'Fixed' || isEditableCost || isEditableSpecial) {
                                                previaCellContent = (
                                                    <FormattedInput
                                                        inputRef={(el: any) => { inputRefs.current[`input-previa-${row.id}`] = el; }}
                                                        className={inputClass}
                                                        value={row.previa}
                                                        formatType={formatType}
                                                        onChange={(val: number) => handleManualValueChange(row.id, 'previa', val)}
                                                        onKeyDown={(e: any) => handleKeyDown(e, row.id, 'previa')}
                                                        onPaste={(e: any) => handlePaste(e, row.id, 'previa')}
                                                    />
                                                );
                                            } else {
                                                previaCellContent = (
                                                    <div className="flex items-center justify-end gap-1 cursor-help" title={`Calculado: ${row.previaConfig?.driver} ${row.previaConfig?.operator === 'divide' ? '/' : 'x'} ${row.previaConfig?.factor}`}>
                                                        <span className="text-orange-800 font-medium">{formatValue(row.previa, formatType)}</span>
                                                    </div>
                                                );
                                            }
                                        }
                                    } else if (isIndicator) {
                                        // Special handling for Indicators that should be inputs (Fixed)
                                        const isInputIndicator = ['IND-1', 'IND-2', 'IND-ADULTOS', 'IND-CHD', 'IND-LZ-2', 'IND-LZ-4', 'IND-LZ-5', 'IND-EV-2', 'IND-EV-4', 'IND-EV-5'].includes(row.id);

                                        if ((isInputIndicator || isManualRow) && !isMonthClosed) {
                                            realCellContent = (
                                                <FormattedInput
                                                    inputRef={(el: any) => { inputRefs.current[`input-real-${row.id}`] = el; }}
                                                    className={inputClass}
                                                    value={row.real}
                                                    formatType={formatType}
                                                    onChange={(val: number) => {
                                                        if (isManualRow) {
                                                            handleManualValueChange(row.id, 'real', val);
                                                        } else {
                                                            handleConfigChange(row.id, { method: 'Fixed', manualValue: val });
                                                        }
                                                    }}
                                                    onKeyDown={(e: any) => handleKeyDown(e, row.id, 'real')}
                                                    onPaste={(e: any) => handlePaste(e, row.id, 'real')}
                                                />
                                            );

                                            previaCellContent = (
                                                <FormattedInput
                                                    inputRef={(el: any) => { inputRefs.current[`input-previa-${row.id}`] = el; }}
                                                    className={inputClass}
                                                    value={row.previa}
                                                    formatType={formatType}
                                                    onChange={(val: number) => {
                                                        handleManualValueChange(row.id, 'previa', val);
                                                        // Sync Forecast with Prévia for indicators
                                                        if (isInputIndicator) {
                                                            setData(prevData => {
                                                                const newData = prevData.map(r => {
                                                                    if (r.id !== row.id) return r;
                                                                    return {
                                                                        ...r,
                                                                        real: val,
                                                                        forecastConfig: { ...r.forecastConfig, method: 'Fixed' as const, manualValue: val }
                                                                    };
                                                                });
                                                                return recalculateTotals(newData, packages, accounts);
                                                            });
                                                        }
                                                    }}
                                                    onKeyDown={(e: any) => handleKeyDown(e, row.id, 'previa')}
                                                    onPaste={(e: any) => handlePaste(e, row.id, 'previa')}
                                                />
                                            );
                                        } else if ((isInputIndicator || isManualRow) && isMonthClosed) {
                                            realCellContent = <span className="font-medium">{formatValue(row.real, formatType)}</span>;
                                            previaCellContent = <span className="font-medium">{formatValue(row.previa, formatType)}</span>;
                                        }
                                    }

                                    // Calculate Previa vs Last Year %
                                    const previaLYVal = (row.previa || 0) - (row.lastYear || 0);
                                    const previaLYPct = row.lastYear && row.lastYear !== 0
                                        ? (previaLYVal / row.lastYear) * 100
                                        : 0;

                                    const previaLYColor = previaLYPct < 0 ? 'text-rose-600' : 'text-emerald-600';
                                    const previaLYValColor = previaLYVal < 0 ? 'text-rose-600' : 'text-emerald-600';

                                    return (
                                        <>
                                            {/* PRÉVIA */}
                                            {columnVisibility.previa && (
                                                <td
                                                    style={textStyle}
                                                    className={`px-2 py-1 text-right border-r border-gray-100 tabular-nums ${previaBg} truncate`}
                                                >
                                                    {previaCellContent}
                                                </td>
                                            )}

                                            {/* FORECAST */}
                                            {columnVisibility.real && (
                                                <td
                                                    style={textStyle}
                                                    className={`px-2 py-1 text-right border-l border-gray-200 tabular-nums ${effectiveText} ${effectiveBg} truncate`}
                                                >
                                                    {realCellContent}
                                                </td>
                                            )}

                                            {/* META */}
                                            {columnVisibility.budget && (
                                                <td
                                                    style={textStyle}
                                                    className={`px-2 py-1 text-right border-r border-gray-100 tabular-nums ${isBlueHighlight ? 'text-sky-900' : 'text-slate-500'} truncate`}
                                                >
                                                    {formatValue(row.budget, formatType)}
                                                </td>
                                            )}

                                            {/* Δ Prévia - Meta R$ */}
                                            {columnVisibility.deltaPreviaBudget && (
                                                <td className={`px-2 py-1 text-right border-r border-gray-100 tabular-nums font-medium ${row.deltaPreviaBudgetVal && row.deltaPreviaBudgetVal < 0 ? 'text-rose-600' : 'text-emerald-600'} truncate`}>
                                                    {formatValue(row.deltaPreviaBudgetVal || 0, isIndicator && formatType !== 'percent' ? formatType : 'currency')}
                                                </td>
                                            )}

                                            {/* Δ Prévia - Meta % */}
                                            {columnVisibility.deltaPreviaBudgetPct && (
                                                <td className={`px-2 py-1 text-right border-r border-gray-200 tabular-nums ${row.deltaPreviaBudgetPct && row.deltaPreviaBudgetPct < 0 ? 'text-rose-600' : 'text-emerald-600'} truncate`}>
                                                    {formatPercentDiff(row.deltaPreviaBudgetPct)}
                                                </td>
                                            )}

                                            {/* LAST YEAR */}
                                            {columnVisibility.lastYear && (
                                                <td
                                                    style={textStyle}
                                                    className={`px-2 py-1 text-right tabular-nums border-r border-gray-100 bg-orange-50/20 text-slate-500 truncate`}
                                                >
                                                    {formatValue(row.lastYear, formatType)}
                                                </td>
                                            )}

                                            {/* PRÉVIA X LY R$ */}
                                            {columnVisibility.deltaLY && (
                                                <td className={`px-2 py-1 text-right border-r border-gray-100 tabular-nums font-medium ${previaLYValColor} truncate`}>
                                                    {formatValue(previaLYVal, isIndicator && formatType !== 'percent' ? formatType : 'currency')}
                                                </td>
                                            )}

                                            {/* PRÉVIA X LY % */}
                                            {columnVisibility.deltaLYPct && (
                                                <td className={`px-2 py-1 text-right tabular-nums ${previaLYColor} ${isBlueHighlight ? 'bg-sky-100' : 'bg-orange-50/10'} truncate`}>
                                                    {formatPercentDiff(previaLYPct)}
                                                </td>
                                            )}
                                        </>
                                    );
                                };

                                // --- INDICATOR DATA ROWS (MODIFIED FOR GROUPING) ---
                                if (isIndicator) {
                                    return (
                                        <tr key={row.id} className="border-b border-gray-100 hover:bg-sky-50/30 transition-colors h-8">

                                            <td className="px-2 py-1 border-r border-gray-100 align-middle sticky left-0 z-20 bg-white">
                                                <div className="truncate text-xs font-bold text-slate-700 pl-4">
                                                    {row.label}
                                                </div>
                                            </td>
                                            {renderFinancialCells(false, "bg-sky-50/30")}
                                        </tr>
                                    )
                                }

                                // --- STANDARD DRE HEADERS ---
                                if (isSectionHeader) {
                                    const rowClass = isBlueHighlight
                                        ? "bg-sky-100 hover:bg-sky-200 transition-colors border-y border-sky-200"
                                        : "bg-slate-100 hover:bg-slate-200 transition-colors border-y border-slate-200";

                                    const stickyClass = isBlueHighlight ? "bg-sky-100 border-r border-sky-300" : "bg-slate-100 border-r border-slate-300";
                                    const textClass = isBlueHighlight ? "text-sky-900" : "text-slate-800";

                                    return (
                                        <tr key={row.id} className={rowClass}>

                                            <td className={`px-2 py-3 text-sm font-bold ${textClass} uppercase tracking-wide flex items-center truncate sticky left-0 z-20 ${stickyClass}`}>
                                                {!isBlueHighlight && <div className="w-1 h-4 bg-indigo-500 mr-2 rounded-full"></div>}
                                                {row.label}
                                            </td>

                                            {renderFinancialCells(true)}
                                        </tr>
                                    );
                                }

                                // --- LEVEL 1: MASTER PACKAGES OR SPECIAL REVENUE ROWS ---
                                // Applying unified Gray Style to Group Headers AND Special Revenue Rows (REV-HOSP, REV-EXTRA, etc.)
                                if (isGroupHeader || isSpecialRevenue) {
                                    return (
                                        <tr key={row.id} className="bg-gray-50 text-gray-800 font-bold border-b border-gray-200 hover:bg-gray-100 transition-colors">

                                            <td className="px-2 py-2 text-sm uppercase align-middle border-r border-gray-200 sticky left-0 z-20 bg-gray-50">
                                                <div style={{ paddingLeft: `${(row.indentLevel || 0) * 16}px` }} className="truncate">
                                                    {row.label}
                                                </div>
                                            </td>
                                            {renderFinancialCells(true, "bg-gray-50 border-r border-gray-200")}
                                        </tr>
                                    );
                                }

                                // --- LEVEL 2: PACKAGES ---
                                if (isSubGroupHeader) {
                                    return (
                                        <tr key={row.id} className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200 hover:bg-gray-100 transition-colors">

                                            <td className="px-2 py-2 text-sm uppercase pl-8 truncate sticky left-0 z-20 bg-gray-50 border-r border-gray-200">
                                                {row.label}
                                            </td>
                                            {renderFinancialCells(true, "bg-gray-50 border-r border-gray-200")}
                                        </tr>
                                    );
                                }

                                // --- STANDARD DATA ROW ---
                                // Format Label if it looks like an unformatted account code (e.g. 64104 -> 64.104)
                                let displayLabel = row.label;
                                if (displayLabel && /^\d{5}$/.test(displayLabel.trim())) {
                                    displayLabel = displayLabel.trim().replace(/^(\d{2})(\d{3})$/, '$1.$2');
                                }

                                const rowTextStyle = {
                                    color: row.textColor || undefined,
                                    fontWeight: row.isBold ? 'bold' : (isTotal ? 'bold' : 'normal'),
                                    fontStyle: row.isItalic ? 'italic' : 'normal'
                                };

                                return (
                                    <tr
                                        key={row.id}
                                        style={{ backgroundColor: row.bgColor || undefined }}
                                        className={`
                        transition-colors text-slate-700 hover:bg-indigo-50/30
                        ${isTotal ? 'bg-indigo-50 font-bold border-y-2 border-gray-300 text-indigo-900' : 'border-b border-gray-50'}
                        ${row.id === 'REV-IMP' ? 'bg-sky-100 border-y-2 border-sky-300 font-bold text-sky-950 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.5)]' : ''}
                    `}
                                    >
                                        <td
                                            style={rowTextStyle}
                                            className={`px-2 py-1 border-r border-gray-100 align-middle sticky left-0 z-20 ${row.id === 'REV-IMP' ? 'bg-sky-100' : 'bg-white'} group-hover:bg-indigo-50/30 ${isTotal ? 'bg-indigo-50' : ''}`}
                                        >
                                            <div style={{ paddingLeft: `${(row.indentLevel || 0) * 16 + 12}px` }} className={`truncate text-xs ${isTotal ? 'uppercase tracking-wide' : ''}`}>
                                                {displayLabel}
                                            </div>
                                        </td>

                                        {renderFinancialCells(false)}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* VALIDATION MODAL */}
            {showValidationModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
                        <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-indigo-50">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                                    <CheckCircle2 size={24} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-indigo-900">Validar Projeção</h2>
                                    <p className="text-sm text-indigo-700">Justifique os desvios significativos em relação à Meta.</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowValidationModal(false)}
                                className="text-indigo-400 hover:text-indigo-600 transition-colors p-2 hover:bg-indigo-100 rounded-full"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
                            <div className="space-y-4">
                                {data.filter(row => Math.abs(row.deltaPreviaBudgetPct || 0) > 5 && !row.isHeader && !row.isTotal).map(row => (
                                    <div key={row.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                                        <div className="flex items-start justify-between mb-3">
                                            <div>
                                                <h3 className="font-bold text-gray-800">{row.label}</h3>
                                                <p className="text-xs text-gray-500 uppercase tracking-wider">{row.category}</p>
                                            </div>
                                            <div className="flex items-center gap-4 text-sm">
                                                <div className="text-right">
                                                    <span className="block text-xs text-gray-500">Prévia</span>
                                                    <span className="font-medium text-gray-900">
                                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(row.previa || 0)}
                                                    </span>
                                                </div>
                                                <div className="text-right">
                                                    <span className="block text-xs text-gray-500">Meta</span>
                                                    <span className="font-medium text-gray-900">
                                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(row.budget || 0)}
                                                    </span>
                                                </div>
                                                <div className="text-right bg-rose-50 px-3 py-1.5 rounded-md border border-rose-100">
                                                    <span className="block text-xs text-rose-600 font-bold">Desvio</span>
                                                    <span className="font-bold text-rose-700">
                                                        {new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 1 }).format((row.deltaPreviaBudgetPct || 0) / 100)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="mt-2">
                                            <label className="block text-xs font-bold text-gray-700 mb-1">Justificativa do Desvio</label>
                                            <textarea
                                                className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none"
                                                rows={2}
                                                placeholder="Explique o motivo deste desvio em relação à meta..."
                                                value={justifications[row.id] || ''}
                                                onChange={(e) => setJustifications(prev => ({ ...prev, [row.id]: e.target.value }))}
                                            />
                                        </div>
                                    </div>
                                ))}
                                {data.filter(row => Math.abs(row.deltaPreviaBudgetPct || 0) > 5 && !row.isHeader && !row.isTotal).length === 0 && (
                                    <div className="text-center py-12">
                                        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <CheckCircle2 size={32} />
                                        </div>
                                        <h3 className="text-lg font-bold text-gray-800">Nenhum desvio significativo</h3>
                                        <p className="text-gray-500">Todas as projeções estão dentro da margem aceitável (±5%).</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-5 border-t border-gray-100 bg-white flex justify-end gap-3">
                            <button
                                onClick={() => setShowValidationModal(false)}
                                className="px-5 py-2.5 text-gray-600 font-bold hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={async () => {
                                    if (activeProjectionType === 'Fechamento oficial' && currentUser?.role !== UserRole.ADMIN) {
                                        alert('Apenas o ADMIN GERAL pode criar o evento de Fechamento Oficial.');
                                        return;
                                    }

                                    // Gather rows to save
                                    const rowsToSave: { accountName: string; costCenter?: string; value: number; scenario: 'Real' | 'Previa' }[] = [];
                                    data.forEach(row => {
                                        if (row.category === 'Costs' || row.category === 'Indicators' || row.category === 'Revenue') {
                                            // Using an 'override_' prefix combined with row ID to uniquely identify this row's manual edit
                                            rowsToSave.push({ accountName: `override_${row.id}`, value: row.real, scenario: 'Real' });
                                            if (row.previa !== undefined) {
                                                rowsToSave.push({ accountName: `override_${row.id}`, value: row.previa, scenario: 'Previa' });
                                            }
                                        }
                                    });

                                    try {
                                        const hName = hotels?.find(h => h.id === selectedHotel)?.name || '';
                                        if (hName) {
                                            await supabaseService.saveForecastProjections(hName, selectedMonth || 1, selectedYear || 2026, activeRealVersionId || 'default', rowsToSave);
                                        }

                                        const newValidation: import('../types').ValidationRecord = {
                                            id: `val_${Date.now()}`,
                                            hotelId: selectedHotel || '',
                                            userId: currentUser?.id || '',
                                            userName: currentUser?.name || 'Desconhecido',
                                            month: selectedMonth || 1,
                                            year: selectedYear || 2026,
                                            projectionType: activeProjectionType || 'Reunião de Ritmo',
                                            validatedAt: new Date().toISOString(),
                                            status: 'Validado'
                                        };

                                        if (setValidations) {
                                            setValidations(prev => [...prev, newValidation]);
                                        }

                                        const notificationMsg = `A unidade ${selectedHotel} validou a projeção de ${activeProjectionType} para ${monthName}/${selectedYear}. Dados salvos no banco.`;
                                        console.log('Notification sent to Admin:', notificationMsg);

                                        alert(`Projeção validada e dados salvos com sucesso!\n\nNotificação enviada aos administradores: "${notificationMsg}"`);
                                        setShowValidationModal(false);
                                    } catch (err) {
                                        console.error('Failed to save projections:', err);
                                        alert('Ocorreu um erro ao salvar os dados no Supabase. Tente novamente.');
                                    }
                                }}
                                className="px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-lg shadow-md hover:bg-indigo-700 transition-colors flex items-center gap-2"
                            >
                                <CheckCircle2 size={18} />
                                Confirmar Validação
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ForecastTable;

function getDriverValue(driver: ExpenseDriver | undefined, allRows: ForecastRow[], base: 'forecast' | 'previa' = 'forecast'): number {
    if (!driver) return 0;

    // Logic to find the driver value from the "Indicators" or "Revenue" rows
    let targetRowId = '';

    switch (driver) {
        case 'UH Ocupada': targetRowId = 'IND-2'; break; // UH Ocupada
        case 'PAX': targetRowId = 'IND-5'; break; // PAX
        case 'Emocionadores': targetRowId = 'IND-7'; break; // Emocionadores (Mocked)
        case 'Extras': targetRowId = 'IND-8'; break; // Extras (Mocked)
        case 'Receita': targetRowId = 'REV-TOTAL'; break; // Total Revenue (New ID)
        default: return 0;
    }

    const row = allRows.find(r => r.id === targetRowId);
    // Use the appropriate base value of the driver for calculation
    return row ? (base === 'forecast' ? row.real : row.previa) : 0;
}

function calculateRowValue(config: ForecastConfig, allRows: ForecastRow[], base: 'forecast' | 'previa'): number {
    if (!config) return 0;

    if (config.method === 'Fixed') {
        return config.manualValue || 0;
    } else {
        // Variable Calculation
        const driverValue = getDriverValue(config.driver, allRows, base);
        const factor = config.factor || 0;

        if (config.operator === 'divide' && factor !== 0) {
            return driverValue / factor;
        } else {
            // Default multiply
            return driverValue * factor;
        }
    }
}

function recalculateTotals(rows: ForecastRow[], packages: CostPackage[], accounts: Account[]) {
    // 1. CLONE PROFUNDO (Shallow Copy de cada objeto)
    // Isso impede que as atribuições mutem o estado anterior do React
    const clonedRows = rows.map(r => ({ 
        ...r, 
        // Clonar também os configs para garantir segurança térmica total
        forecastConfig: { ...r.forecastConfig },
        previaConfig: r.previaConfig ? { ...r.previaConfig } : undefined 
    }));

    // 2. Use as linhas clonadas para os mapas
    const rowMap = new Map(clonedRows.map(r => [r.id, r]));
    const nameMap = new Map(clonedRows.map(r => [r.label.trim(), r]));

    // 3. RESET CALCULATED VALUES: Prevent "Self-Reference" or "Cumulative" multiplication bug
    // Every recalculation should start from 0 for values derived from formulas
    clonedRows.forEach(r => {
        if (r.isCalculated) {
            r.real = 0;
            if (r.previaConfig?.method !== 'Fixed') {
                r.previa = 0;
            }
        }
    });

    const sumAndSet = (targetId: string, sources: { id: string }[], fieldToSet: 'real' | 'budget' | 'lastYear' | 'previa') => {
        let total = 0;
        sources.forEach(src => {
            const row = rowMap.get(src.id);
            if (row) total += row[fieldToSet] || 0;
        });
        const target = rowMap.get(targetId);
        if (target) target[fieldToSet] = total; // Agora mutar aqui é seguro, pois é um clone!
    };

    const runFormulas = (field: 'real' | 'budget' | 'lastYear' | 'previa') => {
        const context = {
            getValue: (name: string) => nameMap.get(name.trim())?.[field] || 0
        };

        clonedRows.forEach(row => {
            if (row.isCalculated && row.formula) {
                row[field] = evaluateFormula(row.formula, context);
            }
        });
    };

    // --- REVENUE CALCULATIONS ---
    ['real', 'budget', 'lastYear', 'previa'].forEach(f => {
        const field = f as 'real' | 'budget' | 'lastYear' | 'previa';

        // REV-APT = Lazer + Eventos + Inclusas
        sumAndSet('REV-APT', [{ id: 'REV-APT-LAZER' }, { id: 'REV-APT-EVENTOS' }, { id: 'REV-APT-INCLUSAS' }], field);

        // REV-EXTRA = Extra Lazer + Extra Eventos
        sumAndSet('REV-EXTRA', [{ id: 'REV-EXTRA-LAZER' }, { id: 'REV-EXTRA-EVENTOS' }], field);

        // REV-TOTAL = REV-APT + REV-EXTRA
        sumAndSet('REV-TOTAL', [{ id: 'REV-APT' }, { id: 'REV-EXTRA' }], field);

        // REV-NET = REV-TOTAL - REV-TIME - REV-ISS - REV-IMP
        const revTotal = rowMap.get('REV-TOTAL')?.[field] || 0;
        const revTime = rowMap.get('REV-TIME')?.[field] || 0;
        const revIss = rowMap.get('REV-ISS')?.[field] || 0;
        const revImp = rowMap.get('REV-IMP')?.[field] || 0;
        const revNet = rowMap.get('REV-NET');
        if (revNet) revNet[field] = revTotal - revTime - revIss - revImp;

        // KPI: DM e RevPAR (Real time updates)
        const avail = rowMap.get('IND-1')?.[field] || 0;
        const occ = rowMap.get('IND-2')?.[field] || 0;
        const revApt = rowMap.get('REV-APT')?.[field] || 0;
        const revExtra = rowMap.get('REV-EXTRA')?.[field] || 0;

        const dm = rowMap.get('IND-4');
        if (dm) dm[field] = occ > 0 ? revApt / occ : 0;

        const revpar = rowMap.get('IND-6');
        if (revpar) revpar[field] = avail > 0 ? revApt / avail : 0;

        const trevpor = rowMap.get('IND-TREVPOR');
        if (trevpor) trevpor[field] = occ > 0 ? (revApt + revExtra) / occ : 0;

        const trevpar = rowMap.get('IND-TREVPAR');
        if (trevpar) trevpar[field] = avail > 0 ? (revApt + revExtra) / avail : 0;

        // Run Dynamic Formulas from Intelligent DRE
        runFormulas(field);
    });

    // --- VARIABLE CALCULATIONS FOR INDIVIDUAL ACCOUNTS ---
    const updatedRows = Array.from(rowMap.values());
    updatedRows.forEach(row => {
        if (row.forecastConfig.method === 'Variable') {
            row.real = calculateRowValue(row.forecastConfig, updatedRows, 'forecast');
        }
        if (row.previaConfig?.method === 'Variable') {
            row.previa = calculateRowValue(row.previaConfig, updatedRows, 'previa');
        }
    });

    // --- COSTS HIERARCHICAL AGGREGATION ---
    // 1. Sum Accounts (Level 2) into Packages (Level 1)
    const pkgRows = updatedRows.filter(r => r.category === 'Costs' && r.id.startsWith('p-'));
    pkgRows.forEach(pkgRow => {
        // pkgRow.id is "p-${masterName}-${pkgName}"
        const parts = pkgRow.id.split('-');
        const masterName = parts[1];
        const pkgName = pkgRow.label;

        // Find children accounts. Account IDs might have suffixes (e.g. accId-Martech)
        const children = updatedRows.filter(r => {
            if (r.category !== 'Costs' || r.indentLevel !== 2) return false;
            
            // Inclusion of special drill-down rows (p-drill-master-pkg-sub)
            if (r.id.startsWith('p-drill-')) {
                // Pattern matches: p-drill-${masterName}-${pkgName}-...
                const matchesMaster = r.id.includes(`-${masterName}-`);
                // For pkgName, we check both the label and the possible ID part (parts[2])
                const matchesPkg = (parts[2] && r.id.includes(`-${parts[2]}-`)) || r.id.includes(`-${pkgName}-`);
                if (matchesMaster && matchesPkg) return true;
            }

            const originalAccId = r.id.split('-')[0];
            const acc = accounts.find(a => a.id === originalAccId);
            return (acc?.package === pkgName && acc?.masterPackage === masterName) ||
                   (parts[2] && acc?.package === parts[2] && acc?.masterPackage === masterName);
        });

        if (children.length > 0) {
            if (!pkgRow.isManualOverride) {
                pkgRow.real = children.reduce((sum, c) => sum + c.real, 0);
            }
            pkgRow.budget = children.reduce((sum, c) => sum + c.budget, 0);
            pkgRow.lastYear = children.reduce((sum, c) => sum + c.lastYear, 0);
            if (!pkgRow.isManualPreviaOverride) {
                pkgRow.previa = children.reduce((sum, c) => sum + (c.previa || 0), 0);
            }
        }
    });

    // 2. Sum Packages (Level 1) directly into CUSTOS E DESPESAS OPERACIONAIS (Level 0)
    // We skip Master Packages (Level 1) as they are no longer in the list
    const cstHead = rowMap.get('CST-HEAD');
    if (cstHead) {
        cstHead.real = pkgRows.reduce((sum, p) => sum + p.real, 0);
        cstHead.budget = pkgRows.reduce((sum, p) => sum + p.budget, 0);
        cstHead.lastYear = pkgRows.reduce((sum, p) => sum + p.lastYear, 0);
        cstHead.previa = pkgRows.reduce((sum, p) => sum + (p.previa || 0), 0);
    }

    // --- REVENUE & RESULTS CALCULATIONS ---
    ['real', 'budget', 'lastYear', 'previa'].forEach(f => {
        const field = f as 'real' | 'budget' | 'lastYear' | 'previa';

        const revTotal = rowMap.get('REV-TOTAL')?.[field] || 0;
        const revIss = rowMap.get('REV-ISS')?.[field] || 0;
        const revImp = rowMap.get('REV-IMP')?.[field] || 0;
        const cstHeadVal = rowMap.get('CST-HEAD')?.[field] || 0;

        const resOpSemImp = rowMap.get('RES-OP-SEM-IMP');
        if (resOpSemImp) resOpSemImp[field] = revTotal - revIss - cstHeadVal;

        const resOpComImp = rowMap.get('RES-OP-COM-IMP');
        if (resOpComImp) resOpComImp[field] = revTotal - revIss - revImp - cstHeadVal;
    });

    // --- DELTAS CALCULATIONS ---
    Array.from(rowMap.values()).forEach(row => {
        row.deltaBudgetVal = row.real - row.budget;
        row.deltaBudgetPct = row.budget === 0 ? 0 : ((row.real - row.budget) / Math.abs(row.budget)) * 100;

        row.deltaLYVal = (row.previa || 0) - row.lastYear;
        row.deltaLYPct = row.lastYear === 0 ? 0 : (((row.previa || 0) - row.lastYear) / Math.abs(row.lastYear)) * 100;

        row.deltaPreviaVal = row.real - (row.previa || 0);
        row.deltaPreviaPct = (row.previa || 0) === 0 ? 0 : ((row.real - (row.previa || 0)) / Math.abs(row.previa || 0)) * 100;

        row.deltaPreviaBudgetVal = (row.previa || 0) - row.budget;
        row.deltaPreviaBudgetPct = row.budget === 0 ? 0 : (((row.previa || 0) - row.budget) / Math.abs(row.budget)) * 100;
    });

    // --- TRANSFORMATION / REACTIVITY KPIs ---
    const kpiBudget = rowMap.get('KPI-TRANS-BUDGET');
    const kpiLY = rowMap.get('KPI-TRANS-LY');
    const revTotalRow = rowMap.get('REV-TOTAL');
    const gopRow = rowMap.get('RES-OP-COM-IMP');
    const costHead = rowMap.get('CST-HEAD');

    if (kpiBudget && revTotalRow && gopRow && costHead) {
        const deltaRev = revTotalRow.real - revTotalRow.budget;
        const deltaGop = gopRow.real - gopRow.budget;
        const deltaCost = costHead.real - costHead.budget;

        if (deltaRev > 0 && deltaGop > 0) {
            kpiBudget.real = (deltaGop / deltaRev) * 100;
        } else if (deltaRev < 0 && deltaCost < 0) {
            kpiBudget.real = (deltaCost / deltaRev) * 100;
        } else {
            kpiBudget.real = 0;
        }
    }

    if (kpiLY && revTotalRow && gopRow && costHead) {
        const deltaRevLY = revTotalRow.real - revTotalRow.lastYear;
        const deltaGopLY = gopRow.real - gopRow.lastYear;
        const deltaCostLY = costHead.real - costHead.lastYear;

        if (deltaRevLY > 0 && deltaGopLY > 0) {
            kpiLY.real = (deltaGopLY / deltaRevLY) * 100;
        } else if (deltaRevLY < 0 && deltaCostLY < 0) {
            kpiLY.real = (deltaCostLY / deltaRevLY) * 100;
        } else {
            kpiLY.real = 0;
        }
    }

    return Array.from(rowMap.values());
}
