import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { PieChart, Settings, Columns, Rows, Check, X, Eye, Table as TableIcon, Layers, BarChart, Hash, ChevronRight, ChevronDown, Copy, Plus, Minus } from 'lucide-react';
import { Account, CostCenter } from '../types';
import { supabaseService } from '../services/supabaseService';
import { toast } from 'react-hot-toast'; // Assuming toast is available for feedback

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const EditableCell: React.FC<{ 
    value: number, 
    onChange: (val: number) => void, 
    onDragStart?: () => void, 
    onDragEnter?: () => void, 
    className?: string, 
    copyToAll?: () => void, 
    onPaste?: (e: React.ClipboardEvent<HTMLInputElement>) => void 
}> = ({ value, onChange, onDragStart, onDragEnter, className, copyToAll, onPaste }) => {
    const [localValue, setLocalValue] = useState(value === 0 ? '' : value.toLocaleString('pt-BR', { useGrouping: false, minimumFractionDigits: 0, maximumFractionDigits: 2 }));
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        if (!isEditing) {
            setLocalValue(value === 0 ? '' : value.toLocaleString('pt-BR', { useGrouping: false, minimumFractionDigits: 0, maximumFractionDigits: 2 }));
        }
    }, [value, isEditing]);

    return (
        <div className="flex items-center gap-1 group/cell relative w-full h-full" onMouseEnter={onDragEnter}>
            {onDragStart && (
                <div 
                    className="w-1 h-full cursor-col-resize opacity-0 group-hover/cell:opacity-100 bg-indigo-400/50 rounded-full hover:bg-indigo-600 transition-all absolute left-0 z-30"
                    onMouseDown={onDragStart}
                    title="Arraste para preencher outros meses"
                />
            )}
            <input 
                type="text"
                value={isEditing ? localValue : (value === 0 ? '' : value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}
                placeholder="0,00"
                onFocus={(e) => {
                    setIsEditing(true);
                    setLocalValue(value === 0 ? '' : value.toLocaleString('pt-BR', { useGrouping: false, minimumFractionDigits: 0, maximumFractionDigits: 2 }));
                    const target = e.target;
                    setTimeout(() => target.select(), 0);
                }}
                onBlur={() => {
                    setIsEditing(false);
                    // Em pt-BR, o decimal é vírgula. Para o parseFloat, precisamos de ponto.
                    const normalized = localValue.replace(/\./g, '').replace(',', '.');
                    const parsed = parseFloat(normalized);
                    onChange(isNaN(parsed) ? 0 : parsed);
                }}
                onChange={(e) => {
                    // Permitir apenas números, vírgula e sinal de negativo no início
                    let val = e.target.value.replace(/[^0-9,\-]/g, '');
                    const parts = val.split(',');
                    if (parts.length > 2) val = parts[0] + ',' + parts.slice(1).join('');
                    val = val.replace(/(?!^)-/g, '');
                    setLocalValue(val);
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.currentTarget.blur();
                    }
                }}
                onPaste={onPaste}
                className={className || "w-full bg-transparent border-b border-indigo-200 text-right focus:border-indigo-500 outline-none px-1 font-bold text-indigo-700 relative z-10"}
                autoComplete="off"
                spellCheck={false}
            />
            {copyToAll && (
                <button 
                    onClick={copyToAll}
                    className="p-1 text-indigo-300 hover:text-indigo-600 hover:bg-indigo-100 rounded opacity-0 group-hover/cell:opacity-100 transition-opacity relative z-20"
                    title="Replicar para todos os meses"
                >
                    <Copy size={10} />
                </button>
            )}
        </div>
    );
};

interface BudgetDREViewProps {
    accounts: Account[];
    costCenters: CostCenter[];
    sidebarCollapsed?: boolean;
    onToggleSidebar?: () => void;
}

interface ComparativeConfig {
    rows: ('masterPackages' | 'packages' | 'accounts' | 'sectors')[];
    columns: ('months' | 'budget' | 'real' | 'variance')[];
    active: boolean;
    varianceMode: 'monthly' | 'total';
}

interface CalculationStep {
    id: string;
    type: 'manual' | 'account';
    value?: number;
    monthlyValues?: number[];
    accountId?: string;
    percentage?: number;
    operator: '*' | '+' | '-' | '/';
}

interface CalculationMemory {
    steps: CalculationStep[];
}

const ROW_DIMENSIONS_ORDER = ['masterPackages', 'packages', 'accounts', 'sectors'] as const;

const BudgetDREView: React.FC<BudgetDREViewProps> = ({ accounts, costCenters, sidebarCollapsed, onToggleSidebar }) => {
    const focusRef = useRef<HTMLDivElement>(null);

    const [selectedSectorType, setSelectedSectorType] = useState<'Todos' | 'CR' | 'PDV'>('Todos');
    const [selectedCostCenter, setSelectedCostCenter] = useState<string>('Todos');
    const [selectedDepartment, setSelectedDepartment] = useState<string>('Todos');
    const [startMonth, setStartMonth] = useState<string>('Jan');
    const [endMonth, setEndMonth] = useState<string>('Dez');
    const [decimalPlaces, setDecimalPlaces] = useState<number>(2);
    const [isBuildingComparative, setIsBuildingComparative] = useState<boolean>(false);
    const [isEditMode, setIsEditMode] = useState<boolean>(false);
    const [focusedItem, setFocusedItem] = useState<{ type: 'package' | 'account', id: string, label: string, master?: string } | null>(null);
    const [calculationMemories, setCalculationMemories] = useState<Record<string, CalculationMemory>>({});
    const [isBuildingCalculation, setIsBuildingCalculation] = useState<boolean>(false);
    const [expandedCalculations, setExpandedCalculations] = useState<Record<string, boolean>>({});
    const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
    const [comparativeConfig, setComparativeConfig] = useState<ComparativeConfig>({
        rows: ['masterPackages', 'packages', 'accounts'],
        columns: ['months', 'budget'],
        active: true,
        varianceMode: 'monthly'
    });
    const [searchTerm, setSearchTerm] = useState<string>('');

    const [tempConfig, setTempConfig] = useState<ComparativeConfig>({ ...comparativeConfig });

    const filterFactor = useMemo(() => {
        if (selectedCostCenter === 'Todos') return 1;
        // Deterministic random factor based on name
        let hash = 0;
        for (let i = 0; i < selectedCostCenter.length; i++) {
            hash = selectedCostCenter.charCodeAt(i) + ((hash << 5) - hash);
        }
        return 0.1 + (Math.abs(hash % 90) / 100); // 10% to 100%
    }, [selectedCostCenter]);

    // Real data state
    const [accountConfigs, setAccountConfigs] = useState<Record<string, {
        values: number[]
    }>>({});

    const [isLoadingData, setIsLoadingData] = useState(false);

    // FETCH REAL DATA FROM SUPABASE
    useEffect(() => {
        if (selectedCostCenter === 'Todos') {
            // Reset or keep mock? If 'Todos', maybe we don't allow editing or show aggregate
            setAccountConfigs({});
            return;
        }

        const fetchData = async () => {
            setIsLoadingData(true);
            try {
                const newConfigs: Record<string, { values: number[] }> = {};
                
                // Fetch in parallel for better performance if many accounts
                // In a production app, we might want a single query for all accounts in a cost center
                await Promise.all(accounts.map(async (acc) => {
                    try {
                        const values = await supabaseService.getBudgetData(acc.id, selectedCostCenter, 2025); // Year hardcoded for now or from props
                        newConfigs[acc.id] = { values };
                    } catch (e) {
                        newConfigs[acc.id] = { values: Array(12).fill(0) };
                    }
                }));

                setAccountConfigs(newConfigs);
            } catch (error) {
                console.error('Error fetching budget data:', error);
            } finally {
                setIsLoadingData(false);
            }
        };

        fetchData();
    }, [selectedCostCenter, accounts]);

    const handleSaveData = async () => {
        if (selectedCostCenter === 'Todos') {
            toast.error('Selecione um Centro de Custo específico para salvar');
            return;
        }

        setIsLoadingData(true);
        try {
            await Promise.all(Object.entries(accountConfigs).map(async ([accId, config]) => {
                await supabaseService.saveBudgetData(accId, selectedCostCenter, 2025, config.values);
            }));
            toast.success('Dados salvos com sucesso!');
        } catch (error) {
            console.error('Error saving budget data:', error);
            toast.error('Erro ao salvar dados');
        } finally {
            setIsLoadingData(false);
        }
    };

    const isSpecificFilterSelected = useMemo(() => {
        return selectedDepartment !== 'Todos' && 
               selectedSectorType !== 'Todos' && 
               selectedCostCenter !== 'Todos';
    }, [selectedDepartment, selectedSectorType, selectedCostCenter]);

    useEffect(() => {
        if (!isSpecificFilterSelected && isEditMode) {
            setIsEditMode(false);
        }
    }, [isSpecificFilterSelected, isEditMode]);

    useEffect(() => {
        if (focusedItem && focusRef.current) {
            focusRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, [focusedItem]);

    const [dragging, setDragging] = useState<{
        accId: string;
        startIdx: number;
        value: number;
    } | null>(null);

    const handleDragStart = (accId: string, idx: number, val: number) => {
        setDragging({ accId, startIdx: idx, value: val });
    };

    const handleDragEnter = (accId: string, idx: number) => {
        if (!dragging || dragging.accId !== accId) return;
        
        const start = Math.min(dragging.startIdx, idx);
        const end = Math.max(dragging.startIdx, idx);
        
        setAccountConfigs(prev => {
            const currentValues = prev[accId]?.values || Array(12).fill(0);
            const newValues = [...currentValues];
            for (let i = start; i <= end; i++) {
                newValues[i] = dragging.value;
            }
            return {
                ...prev,
                [accId]: { values: newValues }
            };
        });
    };

    useEffect(() => {
        const handleMouseUp = () => setDragging(null);
        window.addEventListener('mouseup', handleMouseUp);
        return () => window.removeEventListener('mouseup', handleMouseUp);
    }, []);

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>, accId: string, startMonthIdx: number) => {
        const pasteData = e.clipboardData.getData('text');
        if (!pasteData) return;

        const lines = pasteData.split(/\r?\n/).filter(line => line.trim() !== '');
        if (lines.length === 0) return;

        // If it's a single line with tabs, it's likely a row of data
        const values = lines[0].split(/\t/).map(v => parseFloat(v.replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '')));
        
        if (values.length > 1) {
            e.preventDefault();
            setAccountConfigs(prev => {
                const newConfigs = { ...prev };
                const currentValues = [...(newConfigs[accId]?.values || Array(12).fill(0))];
                
                for (let i = 0; i < values.length && (startMonthIdx + i) < 12; i++) {
                    if (!isNaN(values[i])) {
                        currentValues[startMonthIdx + i] = values[i] / filterFactor;
                    }
                }
                
                newConfigs[accId] = { values: currentValues };
                return newConfigs;
            });
        }
    };

    const copyToAllMonths = (accId: string, value: number) => {
        setAccountConfigs(prev => ({
            ...prev,
            [accId]: { values: Array(12).fill(value) }
        }));
    };

    // Map accounts to their packages and masters using account fields from Supabase
    const accountPackageMap = useMemo(() => {
        const map: Record<string, { package: string, master: string }> = {};
        
        accounts.forEach(acc => {
            map[acc.id] = { 
                package: acc.package || 'Outros', 
                master: acc.masterPackage || 'OUTROS' 
            };
        });
        return map;
    }, [accounts]);

    const departments = Array.from(new Set(costCenters.map(cc => cc.department))).filter(Boolean);

    const filteredCostCenters = costCenters.filter(cc => 
        (selectedDepartment === 'Todos' || cc.department === selectedDepartment) &&
        (selectedSectorType === 'Todos' || cc.type === selectedSectorType)
    );

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('pt-BR', { 
            style: 'currency', 
            currency: 'BRL',
            minimumFractionDigits: decimalPlaces,
            maximumFractionDigits: decimalPlaces
        }).format(val);
    };

    const calculateTotal = (values: number[], indices: number[] = MONTHS.map((_, i) => i)) => {
        return indices.reduce((a, idx) => a + (values[idx] || 0), 0);
    };

    const startIndex = MONTHS.indexOf(startMonth);
    const endIndex = MONTHS.indexOf(endMonth);
    
    const visibleMonthIndices = useMemo(() => {
        const indices = [];
        const start = Math.min(startIndex, endIndex);
        const end = Math.max(startIndex, endIndex);
        for (let i = start; i <= end; i++) {
            indices.push(i);
        }
        return indices;
    }, [startIndex, endIndex]);

    const visibleMonths = useMemo(() => visibleMonthIndices.map(idx => MONTHS[idx]), [visibleMonthIndices]);

    const searchedAccounts = useMemo(() => {
        if (!searchTerm) return accounts;
        const term = searchTerm.toLowerCase();
        return accounts.filter(a => 
            a.name.toLowerCase().includes(term) || 
            a.code.toLowerCase().includes(term)
        );
    }, [accounts, searchTerm]);

    const calculateMonthlyGroupTotals = useCallback((prefix: string) => {
        const groupAccounts = searchedAccounts.filter(a => a.code.startsWith(prefix));
        const totals = Array(12).fill(0);
        groupAccounts.forEach(acc => {
            const config = accountConfigs[acc.id];
            if (config) {
                config.values.forEach((v, i) => {
                    totals[i] += v * filterFactor;
                });
            }
        });
        return totals;
    }, [searchedAccounts, accountConfigs, filterFactor]);

    const monthlyReceitas = useMemo(() => calculateMonthlyGroupTotals('1'), [calculateMonthlyGroupTotals]);
    const monthlyImpostos = useMemo(() => calculateMonthlyGroupTotals('2'), [calculateMonthlyGroupTotals]);
    const monthlyDespesas = useMemo(() => calculateMonthlyGroupTotals('3'), [calculateMonthlyGroupTotals]);

    // Calculate totals based on current accountConfigs
    const totalRevenue = accounts.filter(a => a.code.startsWith('1')).reduce((sum, acc) => {
        const config = accountConfigs[acc.id];
        return sum + (config ? calculateTotal(config.values, visibleMonthIndices) : 0);
    }, 0) * filterFactor;

    const totalTax = accounts.filter(a => a.code.startsWith('2')).reduce((sum, acc) => {
        const config = accountConfigs[acc.id];
        return sum + (config ? calculateTotal(config.values, visibleMonthIndices) : 0);
    }, 0) * filterFactor;

    const totalExpense = accounts.filter(a => a.code.startsWith('3')).reduce((sum, acc) => {
        const config = accountConfigs[acc.id];
        return sum + (config ? calculateTotal(config.values, visibleMonthIndices) : 0);
    }, 0) * filterFactor;

    const netRevenue = totalRevenue - totalTax;
    const gop = netRevenue - totalExpense;
    const gopPercent = netRevenue > 0 ? (gop / netRevenue) * 100 : 0;

    const renderLevel = (
        prefix: string, 
        levelIndex: number, 
        filters: { master?: string, pkg?: string, acc?: string } = {}, 
        parentId: string = ''
    ): React.ReactNode => {
        const { rows } = comparativeConfig;
        if (levelIndex >= rows.length) return null;

        const currentDimension = rows[levelIndex];
        const isRevenue = prefix === '1';
        const filteredAccounts = searchedAccounts.filter(a => a.code.startsWith(prefix));

        let items: { label: string, id: string, code?: string, values: number[], nextFilters: { master?: string, pkg?: string, acc?: string } }[] = [];

        if (currentDimension === 'masterPackages') {
            const masters = Array.from(new Set(Object.values(accountPackageMap).map(m => m.master)));
            items = masters.map(m => {
                const accs = filteredAccounts.filter(a => accountPackageMap[a.id]?.master === m);
                const values = Array(12).fill(0);
                accs.forEach(a => {
                    const config = accountConfigs[a.id];
                    if (config) config.values.forEach((v, i) => values[i] += v * filterFactor);
                });
                return { 
                    label: m, 
                    id: `${parentId}-master-${m}`, 
                    values,
                    nextFilters: { ...filters, master: m }
                };
            });
        } else if (currentDimension === 'packages') {
            const pkgs = Array.from(new Set(
                Object.values(accountPackageMap)
                    .filter(m => !filters.master || m.master === filters.master)
                    .map(m => m.package)
            ));
            items = pkgs.map(p => {
                const accs = filteredAccounts.filter(a => 
                    accountPackageMap[a.id]?.package === p &&
                    (!filters.master || accountPackageMap[a.id]?.master === filters.master)
                );
                const values = Array(12).fill(0);
                accs.forEach(a => {
                    const config = accountConfigs[a.id];
                    if (config) config.values.forEach((v, i) => values[i] += v * filterFactor);
                });
                return { 
                    label: p, 
                    id: `${parentId}-pkg-${p}`, 
                    values,
                    nextFilters: { ...filters, pkg: p }
                };
            });
        } else if (currentDimension === 'accounts') {
            const accsToRender = filteredAccounts.filter(a => 
                (!filters.master || accountPackageMap[a.id]?.master === filters.master) &&
                (!filters.pkg || accountPackageMap[a.id]?.package === filters.pkg)
            );
            items = accsToRender.map(a => {
                const config = accountConfigs[a.id];
                const values = config ? config.values.map(v => v * filterFactor) : Array(12).fill(0);
                return { 
                    label: a.name, 
                    id: `${parentId}-acc-${a.id}`, 
                    code: a.code, 
                    values,
                    nextFilters: { ...filters, acc: a.id }
                };
            });
        } else if (currentDimension === 'sectors') {
            items = filteredCostCenters.map(cc => {
                // Deterministic values for sectors based on ID
                const seed = cc.id.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
                const values = Array(12).fill(0).map((_, i) => {
                    const monthSeed = (seed + i) % 100;
                    return (1000 + monthSeed * 40) * filterFactor;
                });
                return { 
                    label: cc.name, 
                    id: `${parentId}-sector-${cc.id}`, 
                    code: cc.code, 
                    values,
                    nextFilters: { ...filters }
                };
            });
        }

        return items.map(item => {
            const isExpanded = expandedRows[item.id];
            const isCalculationExpanded = expandedCalculations[item.nextFilters.acc || item.id];
            const hasChildren = levelIndex < rows.length - 1;
            const indent = (levelIndex + 1) * 20;
            const totalVal = calculateTotal(item.values, visibleMonthIndices);
            const hasMemory = calculationMemories[item.nextFilters.acc || '']?.steps.length > 0;

            return (
                <React.Fragment key={item.id}>
                    <tr className={`hover:bg-gray-50 group border-b border-gray-50 ${focusedItem?.id === item.id ? 'bg-indigo-50' : ''}`}>
                        <td 
                            className="px-4 py-2 sticky left-0 bg-white z-10 text-gray-700 group-hover:bg-gray-50 transition-colors flex items-center"
                            style={{ paddingLeft: `${indent + 16}px` }}
                        >
                            {hasChildren && (
                                <button onClick={() => toggleRow(item.id)} className="mr-2 text-gray-400 hover:text-indigo-600">
                                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                </button>
                            )}
                            {currentDimension === 'accounts' && (
                                <button 
                                    onClick={() => {
                                        const id = item.nextFilters.acc || item.id;
                                        setExpandedCalculations(prev => ({ ...prev, [id]: !prev[id] }));
                                    }}
                                    className={`mr-2 p-0.5 rounded transition-colors ${hasMemory ? 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100' : 'text-gray-300 hover:text-gray-400'}`}
                                    title={hasMemory ? "Ver Memória de Cálculo" : "Sem Memória de Cálculo"}
                                >
                                    {isCalculationExpanded ? <Minus size={12} /> : <Plus size={12} />}
                                </button>
                            )}
                            {item.code && <span className="text-[9px] text-gray-400 font-mono mr-2">{item.code}</span>}
                            <span className={`text-xs ${levelIndex === 0 ? 'font-bold text-gray-800' : 'text-gray-600'}`}>{item.label}</span>
                            
                            {(currentDimension === 'packages' || currentDimension === 'accounts') && (
                                <button 
                                    onClick={() => setFocusedItem({ 
                                        type: currentDimension === 'packages' ? 'package' : 'account', 
                                        id: item.nextFilters.acc || item.id, 
                                        label: item.label,
                                        master: item.nextFilters.master
                                    })}
                                    className="ml-2 opacity-0 group-hover:opacity-100 p-1 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-all"
                                    title="Evidenciar (Modo Foco)"
                                >
                                    <Eye size={12} />
                                </button>
                            )}
                        </td>
                        {comparativeConfig.columns.includes('months') && (
                            visibleMonthIndices.map((monthIdx) => {
                                const val = item.values[monthIdx] || 0;
                                const real = val * (isRevenue ? 0.95 : 1.05);
                                const variance = val > 0 ? ((real - val) / val) * 100 : 0;
                                return (
                                    <React.Fragment key={monthIdx}>
                                        {comparativeConfig.columns.includes('budget') && (
                                            <td 
                                                className={`px-2 py-2 text-right text-[11px] transition-all ${isEditMode && currentDimension === 'accounts' ? 'bg-indigo-50/50' : 'text-gray-500'}`}
                                                onMouseEnter={() => {
                                                    if (isEditMode && currentDimension === 'accounts' && item.nextFilters.acc) {
                                                        handleDragEnter(item.nextFilters.acc, monthIdx);
                                                    }
                                                }}
                                            >
                                                {isEditMode && currentDimension === 'accounts' ? (
                                                    <EditableCell
                                                        key={`${item.nextFilters.acc || item.id}-${monthIdx}`}
                                                        value={val}
                                                        onChange={(newVal) => {
                                                            const accId = item.nextFilters.acc;
                                                            if (accId) {
                                                                const newValues = [...(accountConfigs[accId]?.values || Array(12).fill(0))];
                                                                newValues[monthIdx] = newVal / filterFactor;
                                                                setAccountConfigs(prev => ({
                                                                    ...prev,
                                                                    [accId]: { values: newValues }
                                                                }));
                                                            }
                                                        }}
                                                        onPaste={(e) => {
                                                            const accId = item.nextFilters.acc;
                                                            if (accId) handlePaste(e, accId, monthIdx);
                                                        }}
                                                        onDragStart={() => {
                                                            if (item.nextFilters.acc) {
                                                                handleDragStart(item.nextFilters.acc, monthIdx, val / filterFactor);
                                                            }
                                                        }}
                                                        copyToAll={() => {
                                                            if (item.nextFilters.acc) {
                                                                copyToAllMonths(item.nextFilters.acc, val / filterFactor);
                                                            }
                                                        }}
                                                    />
                                                ) : formatCurrency(val)}
                                            </td>
                                        )}
                                        {comparativeConfig.columns.includes('real') && <td className="px-2 py-2 text-right text-[11px] text-gray-400">{formatCurrency(real)}</td>}
                                        {comparativeConfig.columns.includes('variance') && comparativeConfig.varianceMode === 'monthly' && (
                                            <td className={`px-2 py-2 text-right text-[11px] font-bold ${isRevenue ? (variance >= 0 ? 'text-emerald-600' : 'text-rose-600') : (variance <= 0 ? 'text-emerald-600' : 'text-rose-600')}`}>
                                                {variance >= 0 ? '+' : ''}{variance.toFixed(1)}%
                                            </td>
                                        )}
                                    </React.Fragment>
                                );
                            })
                        )}
                        <td className="px-4 py-2 text-right text-[11px] font-bold text-gray-700 border-l border-gray-200 bg-gray-50/30">{formatCurrency(totalVal)}</td>
                        {comparativeConfig.columns.includes('real') && <td className="px-4 py-2 text-right text-[11px] font-bold text-gray-600 bg-gray-50/30">{formatCurrency(totalVal * (isRevenue ? 0.95 : 1.05))}</td>}
                        {comparativeConfig.columns.includes('variance') && (comparativeConfig.varianceMode === 'total' || !comparativeConfig.columns.includes('months')) && (() => {
                            const totalReal = totalVal * (isRevenue ? 0.95 : 1.05);
                            const totalVariance = totalVal > 0 ? ((totalReal - totalVal) / totalVal) * 100 : 0;
                            return (
                                <td className={`px-4 py-2 text-right text-[11px] font-bold ${isRevenue ? (totalVariance >= 0 ? 'text-emerald-600' : 'text-rose-600') : (totalVariance <= 0 ? 'text-emerald-600' : 'text-rose-600')}`}>
                                    {totalVariance >= 0 ? '+' : ''}{totalVariance.toFixed(1)}%
                                </td>
                            );
                        })()}
                    </tr>
                    {isCalculationExpanded && hasMemory && (
                        <tr className="bg-indigo-50/30">
                            <td 
                                colSpan={100} 
                                className="px-4 py-3 border-b border-indigo-100"
                                style={{ paddingLeft: `${indent + 40}px` }}
                            >
                                <div className="flex flex-col gap-3">
                                    <div className="flex items-center gap-2 text-[10px] font-bold text-indigo-400 uppercase tracking-widest">
                                        <Plus size={10} /> Memória de Cálculo (Mês a Mês)
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full text-[10px]">
                                            <thead>
                                                <tr className="text-gray-400 border-b border-indigo-100">
                                                    <th className="text-left py-1">Mês</th>
                                                    <th className="text-left py-1">Cálculo</th>
                                                    <th className="text-right py-1">Resultado</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-indigo-50">
                                                {MONTHS.map((m, mIdx) => {
                                                    const memory = item.nextFilters.acc ? calculationMemories[item.nextFilters.acc] : null;
                                                    if (!memory) return null;
                                                    let calculationStr = '';
                                                    memory.steps.forEach((step, sIdx) => {
                                                        if (sIdx > 0) calculationStr += ` ${step.operator} `;
                                                        if (step.type === 'manual') {
                                                            const val = step.monthlyValues ? step.monthlyValues[mIdx] : (step.value || 0);
                                                            calculationStr += formatCurrency(val);
                                                        } else {
                                                            const accName = accounts.find(a => a.id === step.accountId)?.name || 'Conta';
                                                            const baseVal = (accountConfigs[step.accountId!]?.values[mIdx] || 0) * filterFactor;
                                                            calculationStr += `${accName} (${formatCurrency(baseVal)})`;
                                                            if (step.percentage && step.percentage !== 100) {
                                                                calculationStr += ` x ${step.percentage}%`;
                                                            }
                                                        }
                                                    });
                                                    const result = item.values[mIdx];
                                                    return (
                                                        <tr key={m}>
                                                            <td className="py-1 font-bold text-gray-500">{m}</td>
                                                            <td className="py-1 text-gray-400 italic">{calculationStr}</td>
                                                            <td className="py-1 text-right font-bold text-indigo-600">{formatCurrency(result)}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </td>
                        </tr>
                    )}
                    {hasChildren && isExpanded && renderLevel(prefix, levelIndex + 1, item.nextFilters, item.id)}
                </React.Fragment>
            );
        });
    };

    const renderTotalizer = () => {
        // Mock previous year data (10% lower)
        const prevTotalRevenue = totalRevenue * 0.9;
        const prevTotalTax = totalTax * 0.9;
        const prevTotalExpense = totalExpense * 0.9;
        const prevNetRevenue = prevTotalRevenue - prevTotalTax;
        const prevGop = prevNetRevenue - prevTotalExpense;
        const prevGopPercent = prevNetRevenue > 0 ? (prevGop / prevNetRevenue) * 100 : 0;

        const renderCard = (title: string, current: number, previous: number, isPercent = false) => {
            const diffVal = current - previous;
            const diffPct = previous !== 0 ? (diffVal / Math.abs(previous)) * 100 : 0;
            
            const isExpense = title.includes('Despesa') || title.includes('Imposto');
            const isGood = isExpense ? diffVal <= 0 : diffVal >= 0;

            return (
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="text-[10px] text-gray-400 font-bold uppercase mb-1 tracking-wider">{title}</div>
                    <div className={`text-xl font-black ${isExpense ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {isPercent ? `${current.toFixed(2)}%` : formatCurrency(current)}
                    </div>
                    
                    <div className="mt-3 pt-3 border-t border-gray-50 space-y-1.5">
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] text-gray-400">Ano Ant.</span>
                            <span className="text-[10px] font-bold text-gray-500">
                                {isPercent ? `${previous.toFixed(2)}%` : formatCurrency(previous)}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] text-gray-400">{isPercent ? 'DIF p.p.' : 'DIF R$'}</span>
                            <span className={`text-[10px] font-bold ${isGood ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {isPercent ? `${diffVal >= 0 ? '+' : ''}${diffVal.toFixed(2)} p.p.` : formatCurrency(diffVal)}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] text-gray-400">VAR %</span>
                            <span className={`text-[10px] font-bold ${isGood ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {diffPct >= 0 ? '+' : ''}{diffPct.toFixed(2)}%
                            </span>
                        </div>
                    </div>
                </div>
            );
        };

        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
                {renderCard("Receita Total", totalRevenue, prevTotalRevenue)}
                {renderCard("Impostos", totalTax, prevTotalTax)}
                {renderCard("Despesas", totalExpense, prevTotalExpense)}
                {renderCard("GOP R$", gop, prevGop)}
                {renderCard("GOP %", gopPercent, prevGopPercent, true)}
            </div>
        );
    };

    const collapseAll = () => {
        setExpandedRows({});
    };

    const toggleRow = (id: string) => {
        setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const applyCalculationMemory = useCallback((accountId: string, memory: CalculationMemory) => {
        if (!memory.steps.length) return;

        const newValues = Array(12).fill(0);
        
        for (let monthIdx = 0; monthIdx < 12; monthIdx++) {
            let result = 0;
            
            memory.steps.forEach((step, stepIdx) => {
                let stepValue = 0;
                if (step.type === 'manual') {
                    if (step.monthlyValues) {
                        stepValue = step.monthlyValues[monthIdx] || 0;
                    } else {
                        stepValue = step.value || 0;
                    }
                } else if (step.accountId) {
                    const baseValue = (accountConfigs[step.accountId]?.values[monthIdx] || 0);
                    stepValue = baseValue * ((step.percentage || 100) / 100);
                }

                if (stepIdx === 0) {
                    result = stepValue;
                } else {
                    switch (step.operator) {
                        case '+': result += stepValue; break;
                        case '-': result -= stepValue; break;
                        case '*': result *= stepValue; break;
                        case '/': result = stepValue !== 0 ? result / stepValue : 0; break;
                    }
                }
            });
            
            newValues[monthIdx] = result;
        }

        setAccountConfigs(prev => ({
            ...prev,
            [accountId]: { values: newValues }
        }));
    }, [accountConfigs]);

    const renderCalculationMemoryBuilder = () => {
        if (!isBuildingCalculation || !focusedItem || focusedItem.type !== 'account') return null;

        const memory = calculationMemories[focusedItem.id] || { steps: [] };

        const addStep = (type: 'manual' | 'account') => {
            const newStep: CalculationStep = {
                id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11),
                type,
                operator: '*',
                value: type === 'manual' ? 0 : undefined,
                accountId: type === 'account' ? accounts[0].id : undefined
            };
            setCalculationMemories(prev => ({
                ...prev,
                [focusedItem.id]: { steps: [...memory.steps, newStep] }
            }));
        };

        const removeStep = (id: string) => {
            setCalculationMemories(prev => ({
                ...prev,
                [focusedItem.id]: { steps: memory.steps.filter(s => s.id !== id) }
            }));
        };

        const updateStep = (id: string, updates: Partial<CalculationStep>) => {
            setCalculationMemories(prev => ({
                ...prev,
                [focusedItem.id]: { steps: memory.steps.map(s => s.id === id ? { ...s, ...updates } : s) }
            }));
        };

        return (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                        <div>
                            <h3 className="text-xl font-bold text-gray-900">Memória de Cálculo</h3>
                            <p className="text-sm text-gray-500">Construa o cálculo mensal para {focusedItem.label}</p>
                        </div>
                        <button onClick={() => setIsBuildingCalculation(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                        {memory.steps.length === 0 ? (
                            <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-2xl">
                                <p className="text-gray-400 text-sm">Nenhum passo de cálculo definido.</p>
                            </div>
                        ) : (
                            memory.steps.map((step, idx) => (
                                <div key={step.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                                    <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs">
                                        {idx + 1}
                                    </div>
                                    
                                    <select 
                                        value={step.operator}
                                        onChange={(e) => updateStep(step.id, { operator: e.target.value as CalculationStep['operator'] })}
                                        className="bg-white border border-gray-200 rounded-lg px-2 py-1 text-xs font-bold"
                                    >
                                        <option value="*">x</option>
                                        <option value="+">+</option>
                                        <option value="-">-</option>
                                        <option value="/">/</option>
                                    </select>

                                    {step.type === 'manual' ? (
                                        <div className="flex-1 flex flex-col gap-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs text-gray-500 font-bold uppercase">Valor Manual</span>
                                                <button 
                                                    onClick={() => updateStep(step.id, { 
                                                        monthlyValues: step.monthlyValues ? undefined : Array(12).fill(step.value || 0) 
                                                    })}
                                                    className={`text-[10px] px-2 py-0.5 rounded border transition-all ${step.monthlyValues ? 'bg-indigo-100 border-indigo-200 text-indigo-600' : 'bg-gray-100 border-gray-200 text-gray-500'}`}
                                                >
                                                    {step.monthlyValues ? 'Usar Valor Fixo' : 'Usar Valores Mensais'}
                                                </button>
                                            </div>
                                            {!step.monthlyValues ? (
                                                <input 
                                                    type="text"
                                                    value={(step.value || 0).toLocaleString('pt-BR', { useGrouping: false, minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                                    onChange={(e) => {
                                                        let valStr = e.target.value.replace(/[^0-9,]/g, '');
                                                        const parts = valStr.split(',');
                                                        if (parts.length > 2) valStr = parts[0] + ',' + parts.slice(1).join('');
                                                        
                                                        const newVal = parseFloat(valStr.replace(',', '.'));
                                                        if (!isNaN(newVal)) {
                                                            updateStep(step.id, { value: newVal });
                                                        }
                                                    }}
                                                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1 text-sm font-bold"
                                                    placeholder="0,00"
                                                />
                                            ) : (
                                                <div className="grid grid-cols-6 gap-1">
                                                    {MONTHS.map((m, mIdx) => (
                                                        <div key={m} className="flex flex-col gap-0.5">
                                                            <span className="text-[8px] text-gray-400 font-bold uppercase text-center">{m}</span>
                                                            <input 
                                                                type="text"
                                                                value={step.monthlyValues![mIdx].toLocaleString('pt-BR', { useGrouping: false, minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                                                onChange={(e) => {
                                                                    let valStr = e.target.value.replace(/[^0-9,]/g, '');
                                                                    const parts = valStr.split(',');
                                                                    if (parts.length > 2) valStr = parts[0] + ',' + parts.slice(1).join('');
                                                                    
                                                                    const newVal = parseFloat(valStr.replace(',', '.'));
                                                                    if (!isNaN(newVal)) {
                                                                        const newMonthly = [...step.monthlyValues!];
                                                                        newMonthly[mIdx] = newVal;
                                                                        updateStep(step.id, { monthlyValues: newMonthly });
                                                                    }
                                                                }}
                                                                className="w-full bg-white border border-gray-100 rounded px-1 py-0.5 text-[10px] font-bold text-center"
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex-1 flex flex-col gap-2">
                                            <select 
                                                value={step.accountId}
                                                onChange={(e) => updateStep(step.id, { accountId: e.target.value })}
                                                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1 text-sm font-bold"
                                            >
                                                {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>)}
                                            </select>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-gray-400 font-bold uppercase">Multiplicar por %:</span>
                                                <input 
                                                    type="number"
                                                    value={step.percentage || 100}
                                                    onChange={(e) => updateStep(step.id, { percentage: parseFloat(e.target.value) })}
                                                    className="w-20 bg-white border border-gray-200 rounded-lg px-3 py-1 text-sm font-bold"
                                                />
                                                <span className="text-xs font-bold text-gray-500">%</span>
                                            </div>
                                        </div>
                                    )}

                                    <button onClick={() => removeStep(step.id)} className="p-2 text-rose-400 hover:bg-rose-50 rounded-lg transition-colors">
                                        <X size={16} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
                        <div className="flex gap-2">
                            <button 
                                onClick={() => addStep('manual')}
                                className="px-4 py-2 rounded-lg bg-white border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-2"
                            >
                                + Valor Manual
                            </button>
                            <button 
                                onClick={() => addStep('account')}
                                className="px-4 py-2 rounded-lg bg-white border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-2"
                            >
                                + Outra Conta
                            </button>
                        </div>
                        <button 
                            onClick={() => {
                                applyCalculationMemory(focusedItem.id, memory);
                                setIsBuildingCalculation(false);
                            }}
                            className="px-8 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all"
                        >
                            Salvar Memória
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const renderFocusMode = () => {
        if (!focusedItem) return null;

        const isAccount = focusedItem.type === 'account';
        const memory = calculationMemories[focusedItem.id] || { steps: [] };
        const hasMemory = memory.steps.length > 0;
        const itemValues = isAccount 
            ? (accountConfigs[focusedItem.id]?.values || Array(12).fill(0))
            : (() => {
                // Aggregate accounts in this package
                const pkgAccounts = accounts.filter(a => accountPackageMap[a.id]?.package === focusedItem.label);
                const totals = Array(12).fill(0);
                pkgAccounts.forEach(acc => {
                    const config = accountConfigs[acc.id];
                    if (config) {
                        config.values.forEach((v, i) => totals[i] += v);
                    }
                });
                return totals;
            })();

        return (
            <div ref={focusRef} className="mb-8 bg-indigo-900 rounded-2xl p-6 shadow-xl border border-indigo-700 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                    <Eye size={120} className="text-white" />
                </div>
                
                <div className="flex justify-between items-start mb-6 relative z-10">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <div className="px-2 py-0.5 bg-indigo-500 text-white text-[10px] font-black rounded uppercase tracking-widest">Modo Foco</div>
                            {focusedItem.master && <span className="text-indigo-300 text-[10px] font-bold uppercase tracking-widest">{focusedItem.master}</span>}
                        </div>
                        <h3 className="text-2xl font-bold text-white">{focusedItem.label}</h3>
                    </div>
                    <div className="flex gap-3">
                        {isAccount && (
                            <button 
                                onClick={() => {
                                    if (!isSpecificFilterSelected) return;
                                    setIsBuildingCalculation(true);
                                }}
                                disabled={!isSpecificFilterSelected}
                                className={`px-4 py-2 text-xs font-bold rounded-lg border transition-all flex items-center gap-2 ${!isSpecificFilterSelected ? 'bg-gray-500/20 text-gray-400 border-gray-400/20 cursor-not-allowed' : 'bg-indigo-500/30 hover:bg-indigo-500/50 text-white border-indigo-400/30'}`}
                                title={!isSpecificFilterSelected ? "Selecione um Departamento, Tipo de Setor e Setor para editar" : ""}
                            >
                                <Settings size={14} />
                                Construir Memória de Cálculo
                            </button>
                        )}
                        <button 
                            onClick={() => {
                                if (focusedItem.type === 'account') {
                                    setExpandedCalculations(prev => ({ ...prev, [focusedItem.id]: true }));
                                }
                                setFocusedItem(null);
                            }}
                            className="px-6 py-2 bg-white text-indigo-900 text-xs font-bold rounded-lg shadow-lg hover:bg-indigo-50 transition-all flex items-center gap-2"
                        >
                            <Check size={16} /> Concluir
                        </button>
                    </div>
                </div>

                <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/10 overflow-hidden relative z-10">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="bg-white/5 text-indigo-200 font-bold border-b border-white/10 uppercase text-[10px]">
                            <tr>
                                <th className="px-4 py-3">Mês</th>
                                {MONTHS.map(m => <th key={m} className="px-2 py-3 text-right">{m}</th>)}
                                <th className="px-4 py-3 text-right border-l border-white/10">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {hasMemory && memory.steps.map((step, sIdx) => (
                                <tr key={step.id} className="text-indigo-300 border-t border-white/5 bg-white/5">
                                    <td className="px-4 py-3 text-[10px] font-bold uppercase flex items-center gap-2">
                                        <span className="w-4 text-center">{sIdx === 0 ? '' : step.operator}</span>
                                        <span className="truncate max-w-[150px]">
                                            {step.type === 'manual' ? 'Valor Manual' : (accounts.find(a => a.id === step.accountId)?.name || 'Conta')}
                                        </span>
                                    </td>
                                    {MONTHS.map((m, mIdx) => {
                                        const val = step.type === 'manual' 
                                            ? (step.monthlyValues ? step.monthlyValues[mIdx] : (step.value || 0))
                                            : (accountConfigs[step.accountId!]?.values[mIdx] || 0) * filterFactor;
                                        
                                        return (
                                            <td key={mIdx} className="px-2 py-3 text-right text-[10px]">
                                                {step.type === 'manual' && isEditMode ? (
                                                    <input 
                                                        type="text"
                                                        value={step.monthlyValues ? step.monthlyValues[mIdx].toLocaleString('pt-BR', { useGrouping: false, minimumFractionDigits: 0, maximumFractionDigits: 2 }) : (step.value || 0).toLocaleString('pt-BR', { useGrouping: false, minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                                        onChange={(e) => {
                                                            let valStr = e.target.value.replace(/[^0-9,]/g, '');
                                                            const parts = valStr.split(',');
                                                            if (parts.length > 2) valStr = parts[0] + ',' + parts.slice(1).join('');
                                                            
                                                            const newVal = parseFloat(valStr.replace(',', '.'));
                                                            if (isNaN(newVal)) return;

                                                            const newMemory = { ...memory };
                                                            const newSteps = [...newMemory.steps];
                                                            if (step.monthlyValues) {
                                                                const newMonthly = [...step.monthlyValues];
                                                                newMonthly[mIdx] = newVal;
                                                                newSteps[sIdx] = { ...step, monthlyValues: newMonthly };
                                                            } else {
                                                                newSteps[sIdx] = { ...step, value: newVal };
                                                            }
                                                            setCalculationMemories(prev => ({
                                                                ...prev,
                                                                [focusedItem.id]: { steps: newSteps }
                                                            }));
                                                            // Also apply to account values
                                                            applyCalculationMemory(focusedItem.id, { steps: newSteps });
                                                        }}
                                                        className="w-full bg-transparent border-b border-indigo-400/30 focus:border-white text-right outline-none py-0.5 text-[10px] font-bold text-white"
                                                    />
                                                ) : formatCurrency(val)}
                                            </td>
                                        );
                                    })}
                                    <td className="px-4 py-3 text-right text-[10px] border-l border-white/10">
                                        {/* Row Total */}
                                    </td>
                                </tr>
                            ))}
                            <tr className="text-white border-t-2 border-indigo-500/50 bg-indigo-500/10">
                                <td className="px-4 py-4 font-bold text-indigo-200">Resultado Final</td>
                                {itemValues.map((val, idx) => (
                                    <td 
                                        key={idx} 
                                        className={`px-2 py-4 text-right transition-all relative ${isAccount ? 'bg-white/5' : ''}`}
                                        onMouseEnter={() => isAccount && isEditMode && handleDragEnter(focusedItem.id, idx)}
                                    >
                                        <div className="flex flex-col items-end gap-1 group/focus-cell relative w-full h-full">
                                            {isAccount && isEditMode && !hasMemory && focusedItem ? (
                                                <EditableCell
                                                    key={`focus-${focusedItem.id}-${idx}`}
                                                    value={val}
                                                    onChange={(newVal) => {
                                                        const newValues = [...itemValues];
                                                        newValues[idx] = newVal;
                                                        setAccountConfigs(prev => ({
                                                            ...prev,
                                                            [focusedItem.id]: { values: newValues }
                                                        }));
                                                    }}
                                                    onPaste={(e) => handlePaste(e, focusedItem.id, idx)}
                                                    onDragStart={() => handleDragStart(focusedItem.id, idx, val)}
                                                    copyToAll={() => copyToAllMonths(focusedItem.id, val)}
                                                    className={`w-full bg-transparent border-b border-indigo-400/30 focus:border-white text-right outline-none py-1 text-xs font-bold text-white relative z-10`}
                                                />
                                            ) : (
                                                <span className="w-full text-right py-1 text-xs font-bold text-white cursor-default">
                                                    {val === 0 ? '-' : formatCurrency(val)}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                ))}
                                <td className="px-4 py-4 text-right font-black text-indigo-100 border-l border-white/10 bg-white/10">
                                    {formatCurrency(itemValues.reduce((a, b) => a + b, 0))}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    const renderComparativeBuilder = () => {
        if (!isBuildingComparative) return null;

        const presets: { name: string; rows: ComparativeConfig['rows']; columns: ComparativeConfig['columns'] }[] = [
            { name: 'Visão Mensal Orçada', rows: ['accounts'], columns: ['months', 'budget'] },
            { name: 'Real x Orçado (Total)', rows: ['accounts'], columns: ['budget', 'real', 'variance'] },
            { name: 'Por Setor e Pacote', rows: ['sectors', 'packages'], columns: ['budget'] },
        ];

        return (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                        <div>
                            <h3 className="text-xl font-bold text-gray-900">Montar Comparativo</h3>
                            <p className="text-sm text-gray-500">Configure as dimensões da sua visualização USALI</p>
                        </div>
                        <button onClick={() => setIsBuildingComparative(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 md:grid-cols-2 gap-12">
                        <div className="space-y-8">
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">Presets Sugeridos</label>
                                <div className="grid grid-cols-1 gap-2">
                                    {presets.map(p => (
                                        <button 
                                            key={p.name}
                                            onClick={() => setTempConfig({ ...tempConfig, rows: p.rows, columns: p.columns })}
                                            className="text-left p-3 rounded-xl border border-gray-100 hover:border-indigo-300 hover:bg-indigo-50 transition-all flex items-center gap-3 group"
                                        >
                                            <div className="p-2 bg-gray-100 group-hover:bg-indigo-100 rounded-lg text-gray-500 group-hover:text-indigo-600">
                                                <TableIcon size={16} />
                                            </div>
                                            <span className="text-sm font-medium text-gray-700">{p.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <Rows size={14} /> Linhas (Dimensões)
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {(['masterPackages', 'packages', 'accounts', 'sectors'] as const).map(opt => (
                                            <button
                                                key={opt}
                                                onClick={() => {
                                                    const rows = tempConfig.rows.includes(opt)
                                                        ? tempConfig.rows.filter(r => r !== opt)
                                                        : [...tempConfig.rows, opt];
                                                    
                                                    // Sort rows based on fixed hierarchy
                                                    const sortedRows = ROW_DIMENSIONS_ORDER.filter(r => rows.includes(r as typeof ROW_DIMENSIONS_ORDER[number]));
                                                    setTempConfig({ ...tempConfig, rows: sortedRows as ('masterPackages' | 'packages' | 'accounts' | 'sectors')[] });
                                                }}
                                                className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${tempConfig.rows.includes(opt) ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                            >
                                                {opt === 'masterPackages' ? 'Pacotes Master' : opt === 'packages' ? 'Pacotes' : opt === 'accounts' ? 'Contas' : 'Setores'}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <Columns size={14} /> Modo de Visualização
                                    </label>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => {
                                                const columns = (tempConfig.columns.includes('months')
                                                    ? tempConfig.columns
                                                    : ['months', ...tempConfig.columns]) as ComparativeConfig['columns'];
                                                setTempConfig({ ...tempConfig, columns });
                                            }}
                                            className={`flex-1 px-4 py-3 rounded-xl text-xs font-bold transition-all border ${tempConfig.columns.includes('months') ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                                        >
                                            Mês a Mês
                                        </button>
                                        <button
                                            onClick={() => {
                                                const columns = tempConfig.columns.filter(c => c !== 'months') as ComparativeConfig['columns'];
                                                setTempConfig({ ...tempConfig, columns });
                                            }}
                                            className={`flex-1 px-4 py-3 rounded-xl text-xs font-bold transition-all border ${!tempConfig.columns.includes('months') ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                                        >
                                            Só Acumulado
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <Columns size={14} /> Colunas (Métricas)
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {(['budget', 'real', 'variance'] as const).map(opt => (
                                            <button
                                                key={opt}
                                                onClick={() => {
                                                    const newColumns = (tempConfig.columns.includes(opt)
                                                        ? tempConfig.columns.filter(c => c !== opt)
                                                        : [...tempConfig.columns, opt]) as ComparativeConfig['columns'];
                                                    setTempConfig({ ...tempConfig, columns: newColumns });
                                                }}
                                                className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${tempConfig.columns.includes(opt) ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                            >
                                                {opt === 'budget' ? 'Orçado' : opt === 'real' ? 'Real' : 'Desvio'}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <BarChart size={14} /> Modo de Desvio
                                    </label>
                                    <div className="flex gap-2">
                                        {(['monthly', 'total'] as const).map(mode => (
                                            <button
                                                key={mode}
                                                onClick={() => setTempConfig({ ...tempConfig, varianceMode: mode })}
                                                className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${tempConfig.varianceMode === mode ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                            >
                                                {mode === 'monthly' ? 'Mês a Mês' : 'Apenas no Total'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 flex flex-col">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <Eye size={14} /> Pré-visualização Realista
                            </label>
                            <div className="flex-1 bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm flex flex-col">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-[10px] text-left border-collapse">
                                        <thead className="bg-gray-50 border-b border-gray-200">
                                            <tr>
                                                <th className="px-2 py-2 font-bold text-gray-400 uppercase">
                                                    {tempConfig.rows.map(r => r === 'accounts' ? 'Conta' : r === 'packages' ? 'Pacote' : r === 'masterPackages' ? 'Pacote Master' : 'Setor').join(' / ')}
                                                </th>
                                                {tempConfig.columns.includes('months') ? (
                                                    ['Jan', 'Fev'].map(m => (
                                                        <React.Fragment key={m}>
                                                            {tempConfig.columns.includes('budget') && <th className="px-2 py-2 text-right text-gray-400">Orc. {m}</th>}
                                                            {tempConfig.columns.includes('real') && <th className="px-2 py-2 text-right text-indigo-400">Real {m}</th>}
                                                            {tempConfig.columns.includes('variance') && tempConfig.varianceMode === 'monthly' && <th className="px-2 py-2 text-right text-amber-400">Var. {m}</th>}
                                                        </React.Fragment>
                                                    ))
                                                ) : null}
                                                <th className="px-2 py-2 text-right text-gray-400 border-l border-gray-200">Total</th>
                                                {tempConfig.columns.includes('variance') && tempConfig.varianceMode === 'total' && <th className="px-2 py-2 text-right text-amber-400">Desvio</th>}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {[1, 2, 3].map(i => (
                                                <tr key={i}>
                                                    <td className="px-2 py-2 font-medium text-gray-600">
                                                        {tempConfig.rows.includes('masterPackages') ? 'Exemplo Master' : tempConfig.rows.includes('packages') ? 'Pacote' : tempConfig.rows.includes('accounts') ? 'Conta' : 'Setor'}
                                                    </td>
                                                    {tempConfig.columns.includes('months') ? (
                                                        [1, 2].map(m => (
                                                            <React.Fragment key={m}>
                                                                {tempConfig.columns.includes('budget') && <td className="px-2 py-2 text-right text-gray-400">R$ 1.250</td>}
                                                                {tempConfig.columns.includes('real') && <td className="px-2 py-2 text-right text-indigo-300">R$ 1.100</td>}
                                                                {tempConfig.columns.includes('variance') && tempConfig.varianceMode === 'monthly' && <td className="px-2 py-2 text-right text-rose-400">-12%</td>}
                                                            </React.Fragment>
                                                        ))
                                                    ) : null}
                                                    <td className="px-2 py-2 text-right text-gray-400 border-l border-gray-200">R$ 2.500</td>
                                                    {tempConfig.columns.includes('variance') && tempConfig.varianceMode === 'total' && <td className="px-2 py-2 text-right text-rose-400">-12%</td>}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="mt-auto p-4 bg-indigo-50/50 border-t border-indigo-100/50">
                                    <p className="text-[10px] text-indigo-400 italic leading-relaxed">
                                        Esta é uma simulação da estrutura. Os dados reais serão processados para o período de <strong>{startMonth}</strong> a <strong>{endMonth}</strong>.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                        <button 
                            onClick={() => setIsBuildingComparative(false)}
                            className="px-6 py-2 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-200 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={() => {
                                setComparativeConfig({ ...tempConfig, active: true });
                                setIsBuildingComparative(false);
                            }}
                            className="px-8 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center gap-2"
                        >
                            <Check size={18} /> Concluir
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full">
            {/* Header Bar connected to menu */}
            <div className="bg-slate-900 px-8 py-4 flex justify-between items-center shrink-0 border-b border-slate-800">
                <div className="flex items-center gap-4">
                    {onToggleSidebar && (
                        <button 
                            onClick={onToggleSidebar}
                            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"
                            title={sidebarCollapsed ? "Mostrar Menu" : "Ocultar Menu"}
                        >
                            <Layers size={20} className={sidebarCollapsed ? "text-indigo-400" : ""} />
                        </button>
                    )}
                    <div>
                        <h2 className="text-2xl font-bold text-white tracking-tight">USALI</h2>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-0.5">Orçamento</p>
                    </div>
                </div>
                <div className="flex gap-4 items-center">
                    <button
                        onClick={() => {
                            if (!isSpecificFilterSelected) {
                                return;
                            }
                            console.log('Toggling isEditMode:', !isEditMode);
                            setIsEditMode(!isEditMode);
                        }}
                        disabled={!isSpecificFilterSelected}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 border ${!isSpecificFilterSelected ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' : isEditMode ? 'bg-amber-500 text-white border-amber-600 shadow-lg' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'}`}
                        title={!isSpecificFilterSelected ? "Selecione um Departamento, Tipo de Setor e Setor para editar" : ""}
                    >
                        <Settings size={14} className={isEditMode ? "animate-spin" : ""} />
                        {isEditMode ? "Modo Edição Ativo" : "Ativar Modo Edição"}
                    </button>
                    <button
                        onClick={() => setDecimalPlaces((decimalPlaces + 1) % 3)}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg border border-slate-700 transition-all flex items-center gap-2"
                    >
                        <Hash size={14} className="text-indigo-400" />
                        {decimalPlaces} Casas Decimais
                    </button>
                    <button 
                        onClick={() => {
                            setTempConfig({ ...comparativeConfig });
                            setIsBuildingComparative(true);
                        }}
                        className="px-4 py-2 rounded-lg text-xs font-bold shadow-sm transition-all bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-2"
                    >
                        <Settings size={14} />
                        Personalizar Visão
                    </button>
                    <button 
                        onClick={handleSaveData}
                        disabled={isLoadingData || !isSpecificFilterSelected}
                        className={`px-6 py-2 rounded-lg text-xs font-bold shadow-lg transition-all flex items-center gap-2 ${isLoadingData ? 'bg-gray-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200'}`}
                    >
                        {isLoadingData ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <Check size={14} />
                        )}
                        {isLoadingData ? 'Salvando...' : 'Salvar Alterações'}
                    </button>
                </div>
            </div>

            <div className="p-8 w-full overflow-auto flex-1">
                {renderCalculationMemoryBuilder()}
                {renderComparativeBuilder()}
                {renderFocusMode()}
                
                <div className="mb-8 space-y-6">
                    <div className="flex gap-4 items-end">
                        <div className="flex flex-col">
                            <label className="text-[10px] font-bold text-gray-500 uppercase mb-1">Departamento</label>
                            <select 
                                value={selectedDepartment}
                                onChange={(e) => {
                                    setSelectedDepartment(e.target.value);
                                    setSelectedCostCenter('Todos');
                                }}
                                className="bg-white border border-gray-200 rounded-lg px-4 py-2 text-sm font-bold text-gray-700 shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            >
                                <option value="Todos">Todos</option>
                                {departments.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                        <div className="flex flex-col">
                            <label className="text-[10px] font-bold text-gray-500 uppercase mb-1">Tipo de Setor</label>
                            <select 
                                value={selectedSectorType}
                                onChange={(e) => {
                                    setSelectedSectorType(e.target.value as 'Todos' | 'CR' | 'PDV');
                                    setSelectedCostCenter('Todos');
                                }}
                                className="bg-white border border-gray-200 rounded-lg px-4 py-2 text-sm font-bold text-gray-700 shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none min-w-[100px]"
                            >
                                <option value="Todos">Todos</option>
                                <option value="CR">CR</option>
                                <option value="PDV">PDV</option>
                            </select>
                        </div>
                        <div className="flex flex-col">
                            <label className="text-[10px] font-bold text-gray-500 uppercase mb-1">Setor / Centro de Custo</label>
                            <select 
                                value={selectedCostCenter}
                                onChange={(e) => setSelectedCostCenter(e.target.value)}
                                className="bg-white border border-gray-200 rounded-lg px-4 py-2 text-sm font-bold text-gray-700 shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none min-w-[200px]"
                            >
                                <option value="Todos">Todos os Setores</option>
                                {filteredCostCenters.map(cc => (
                                    <option key={cc.id} value={cc.name}>{cc.code} - {cc.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="flex flex-col">
                        <label className="text-[10px] font-bold text-gray-500 uppercase mb-2">Período</label>
                        <div className="flex bg-white border border-gray-200 rounded-xl p-1 shadow-sm overflow-x-auto no-scrollbar">
                            {MONTHS.map((m, idx) => {
                                const isStart = m === startMonth;
                                const isEnd = m === endMonth;
                                const isInRange = visibleMonthIndices.includes(idx);
                                return (
                                    <button
                                        key={m}
                                        onClick={() => {
                                            const clickedIdx = idx;
                                            const startIdx = MONTHS.indexOf(startMonth);
                                            const endIdx = MONTHS.indexOf(endMonth);
                                            
                                            // If clicking the current start or end, we can reset or do nothing
                                            // For simplicity, let's just set start if it's before current start, or set end
                                            if (clickedIdx < startIdx) {
                                                setStartMonth(m);
                                            } else if (clickedIdx > endIdx) {
                                                setEndMonth(m);
                                            } else {
                                                // If clicking inside, set as end
                                                setEndMonth(m);
                                            }
                                        }}
                                        className={`px-4 py-2 text-xs font-bold rounded-lg transition-all min-w-[60px] flex-1 ${
                                            isStart || isEnd 
                                                ? 'bg-indigo-600 text-white shadow-md' 
                                                : isInRange 
                                                    ? 'bg-indigo-50 text-indigo-600' 
                                                    : 'text-gray-400 hover:bg-gray-50'
                                        }`}
                                    >
                                        {m}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {renderTotalizer()}

                <div className="grid grid-cols-1 gap-8">
                    {/* DRE Table */}
                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden inline-block">
                            <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                                <div className="flex items-center gap-4 flex-1">
                                    <h3 className="font-bold text-gray-700 whitespace-nowrap">Plano de Contas do Setor</h3>
                                    <div className="relative flex-1 max-w-md">
                                        <input 
                                            type="text"
                                            placeholder="Buscar conta ou código..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="w-full pl-9 pr-4 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                                        />
                                        <Settings size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={collapseAll}
                                        className="px-3 py-1.5 text-[10px] font-bold text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-gray-200 bg-white"
                                    >
                                        Recolher Tudo
                                    </button>
                                    <button className="p-2 text-gray-400 hover:text-indigo-600 transition-colors">
                                        <PieChart size={18} />
                                    </button>
                                </div>
                            </div>
                            <div className="overflow-x-auto max-h-[70vh]">
                                <table className="w-auto text-sm text-left border-collapse">
                                    <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-200 uppercase text-[10px] sticky top-0 z-30">
                                        <tr>
                                            <th className="px-4 py-3 min-w-[250px] sticky left-0 bg-gray-50 z-10">Conta</th>
                                            {comparativeConfig.columns.includes('months') && (
                                                visibleMonths.map(m => (
                                                    <React.Fragment key={m}>
                                                        {comparativeConfig.columns.includes('budget') && (
                                                            <th className="px-2 py-3 text-right min-w-[100px]">
                                                                <div className="text-[9px] text-gray-400 font-bold">META 2026</div>
                                                                <div className="text-[11px] font-black uppercase tracking-tighter">{m}</div>
                                                            </th>
                                                        )}
                                                        {comparativeConfig.columns.includes('real') && (
                                                            <th className="px-2 py-3 text-right min-w-[100px]">
                                                                <div className="text-[9px] text-gray-400 font-bold uppercase">REAL 2025</div>
                                                                <div className="text-[11px] font-black uppercase tracking-tighter">{m}</div>
                                                            </th>
                                                        )}
                                                        {comparativeConfig.columns.includes('variance') && comparativeConfig.varianceMode === 'monthly' && (
                                                            <th className="px-2 py-3 text-right min-w-[100px]">
                                                                <div className="text-[9px] text-gray-400 font-bold uppercase">DESVIO</div>
                                                                <div className="text-[11px] font-black uppercase tracking-tighter">VAR. {m}</div>
                                                            </th>
                                                        )}
                                                    </React.Fragment>
                                                ))
                                            )}
                                            {/* Always show Total column */}
                                            <th className="px-4 py-3 text-right min-w-[120px] border-l border-gray-200 bg-gray-100/50">
                                                <div className="text-[9px] text-gray-400 font-bold">META 2026</div>
                                                <div className="text-[11px] font-black uppercase tracking-tighter">TOTAL</div>
                                            </th>
                                            {comparativeConfig.columns.includes('real') && (
                                                <th className="px-4 py-3 text-right min-w-[120px] text-indigo-600 bg-indigo-100/30">
                                                    <div className="text-[9px] text-indigo-400 font-bold">REAL 2025</div>
                                                    <div className="text-[11px] font-black uppercase tracking-tighter">TOTAL</div>
                                                </th>
                                            )}
                                            {comparativeConfig.columns.includes('variance') && (comparativeConfig.varianceMode === 'total' || !comparativeConfig.columns.includes('months')) && (
                                                <th className="px-4 py-3 text-right min-w-[120px] text-amber-600">
                                                    <div className="text-[9px] text-amber-400 font-bold">DESVIO</div>
                                                    <div className="text-[11px] font-black uppercase tracking-tighter">TOTAL VAR.</div>
                                                </th>
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {comparativeConfig.active ? (
                                            <>
                                                {['1', '2', '3'].map(prefix => {
                                                    const isRevenue = prefix === '1';
                                                    const isTax = prefix === '2';
                                                    const isExpense = prefix === '3';

                                                    let label = '';
                                                    let bgColor = '';
                                                    let textColor = '';
                                                    let stickyColor = '';
                                                    let groupMonthly = Array(12).fill(0);
                                                    let groupTotal = 0;

                                                    if (isRevenue) {
                                                        label = 'RECEITAS OPERACIONAIS';
                                                        bgColor = 'bg-emerald-50/30';
                                                        textColor = 'text-emerald-900';
                                                        stickyColor = 'bg-emerald-50';
                                                        groupMonthly = monthlyReceitas;
                                                        groupTotal = totalRevenue;
                                                    } else if (isTax) {
                                                        label = '(-) IMPOSTOS';
                                                        bgColor = 'bg-rose-50/10';
                                                        textColor = 'text-rose-800';
                                                        stickyColor = 'bg-rose-50/10';
                                                        groupMonthly = monthlyImpostos;
                                                        groupTotal = totalTax;
                                                    } else {
                                                        label = 'DESPESAS OPERACIONAIS';
                                                        bgColor = 'bg-rose-50/30';
                                                        textColor = 'text-rose-900';
                                                        stickyColor = 'bg-rose-50';
                                                        groupMonthly = monthlyDespesas;
                                                        groupTotal = totalExpense;
                                                    }

                                                    const id = `root-${prefix}`;
                                                    const isExpanded = expandedRows[id];

                                                    return (
                                                        <React.Fragment key={id}>
                                                            {isExpense && (
                                                                <tr className="bg-indigo-50/50 font-black text-indigo-900 border-y-2 border-indigo-100">
                                                                    <td className="px-4 py-3 sticky left-0 bg-indigo-50 z-10 uppercase tracking-wider text-[11px]">RECEITA LÍQUIDA</td>
                                                                    {comparativeConfig.columns.includes('months') && (
                                                                        visibleMonthIndices.map((monthIdx) => {
                                                                            const val = monthlyReceitas[monthIdx] - monthlyImpostos[monthIdx];
                                                                            return (
                                                                                <React.Fragment key={monthIdx}>
                                                                                    {comparativeConfig.columns.includes('budget') && <td className="px-2 py-3 text-right">{formatCurrency(val)}</td>}
                                                                                    {comparativeConfig.columns.includes('real') && <td className="px-2 py-3 text-right text-gray-400">{formatCurrency(val * 0.95)}</td>}
                                                                                    {comparativeConfig.columns.includes('variance') && comparativeConfig.varianceMode === 'monthly' && <td className="px-2 py-3 text-right">-</td>}
                                                                                </React.Fragment>
                                                                            );
                                                                        })
                                                                    )}
                                                                    <td className="px-4 py-3 text-right border-l border-gray-200 bg-gray-100/50">{formatCurrency(netRevenue)}</td>
                                                                    {comparativeConfig.columns.includes('real') && <td className="px-4 py-3 text-right text-gray-400">{formatCurrency(netRevenue * 0.95)}</td>}
                                                                    {comparativeConfig.columns.includes('variance') && (comparativeConfig.varianceMode === 'total' || !comparativeConfig.columns.includes('months')) && <td className="px-4 py-3 text-right">-</td>}
                                                                </tr>
                                                            )}
                                                            <tr className={`${bgColor} font-bold ${textColor}`}>
                                                                <td className={`px-4 py-3 sticky left-0 ${stickyColor} z-10 uppercase tracking-wider text-[11px] flex items-center gap-2`}>
                                                                    <button onClick={() => toggleRow(id)} className="text-gray-400 hover:text-indigo-600">
                                                                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                                    </button>
                                                                    {label}
                                                                </td>
                                                                {comparativeConfig.columns.includes('months') && (
                                                                    visibleMonthIndices.map((monthIdx) => {
                                                                        const val = groupMonthly[monthIdx];
                                                                        const real = val * (isRevenue ? 0.95 : 1.05);
                                                                        const variance = val > 0 ? ((real - val) / val) * 100 : 0;
                                                                        return (
                                                                            <React.Fragment key={monthIdx}>
                                                                                {comparativeConfig.columns.includes('budget') && <td className="px-2 py-3 text-right">{formatCurrency(val)}</td>}
                                                                                {comparativeConfig.columns.includes('real') && <td className="px-2 py-3 text-right text-gray-500">{formatCurrency(real)}</td>}
                                                                                {comparativeConfig.columns.includes('variance') && comparativeConfig.varianceMode === 'monthly' && (
                                                                                    <td className={`px-2 py-3 text-right font-bold ${isRevenue ? (variance >= 0 ? 'text-emerald-600' : 'text-rose-600') : (variance <= 0 ? 'text-emerald-600' : 'text-rose-600')}`}>
                                                                                        {variance >= 0 ? '+' : ''}{variance.toFixed(1)}%
                                                                                    </td>
                                                                                )}
                                                                            </React.Fragment>
                                                                        );
                                                                    })
                                                                )}
                                                                <td className="px-4 py-3 text-right border-l border-gray-200 bg-gray-100/50">{formatCurrency(groupTotal)}</td>
                                                                {comparativeConfig.columns.includes('real') && <td className="px-4 py-3 text-right text-gray-500">{formatCurrency(groupTotal * (isRevenue ? 0.95 : 1.05))}</td>}
                                                                {comparativeConfig.columns.includes('variance') && (comparativeConfig.varianceMode === 'total' || !comparativeConfig.columns.includes('months')) && (() => {
                                                                    const totalReal = groupTotal * (isRevenue ? 0.95 : 1.05);
                                                                    const totalVariance = groupTotal > 0 ? ((totalReal - groupTotal) / groupTotal) * 100 : 0;
                                                                    return (
                                                                        <td className={`px-4 py-3 text-right font-bold ${isRevenue ? (totalVariance >= 0 ? 'text-emerald-600' : 'text-rose-600') : (totalVariance <= 0 ? 'text-emerald-600' : 'text-rose-600')}`}>
                                                                            {totalVariance >= 0 ? '+' : ''}{totalVariance.toFixed(1)}%
                                                                        </td>
                                                                    );
                                                                })()}
                                                            </tr>
                                                            {isExpanded && renderLevel(prefix, 0, {})}
                                                        </React.Fragment>
                                                    );
                                                })}
                                                
                                                {/* GOP Row */}
                                                <tr className="bg-indigo-600 font-black text-white border-t-4 border-indigo-900">
                                                    <td className="px-4 py-4 sticky left-0 bg-indigo-600 z-10 uppercase tracking-widest text-xs">GOP (Gross Operating Profit)</td>
                                                    {comparativeConfig.columns.includes('months') && (
                                                        visibleMonthIndices.map((monthIdx) => {
                                                            const val = (monthlyReceitas[monthIdx] - monthlyImpostos[monthIdx]) - monthlyDespesas[monthIdx];
                                                            return (
                                                                <React.Fragment key={monthIdx}>
                                                                    {comparativeConfig.columns.includes('budget') && <td className="px-2 py-4 text-right">{formatCurrency(val)}</td>}
                                                                    {comparativeConfig.columns.includes('real') && <td className="px-2 py-4 text-right text-indigo-200">{formatCurrency(val * 0.9)}</td>}
                                                                    {comparativeConfig.columns.includes('variance') && comparativeConfig.varianceMode === 'monthly' && <td className="px-2 py-4 text-right">-</td>}
                                                                </React.Fragment>
                                                            );
                                                        })
                                                    )}
                                                    <td className="px-4 py-4 text-right border-l border-indigo-500 bg-indigo-700">{formatCurrency(gop)}</td>
                                                    {comparativeConfig.columns.includes('real') && <td className="px-4 py-4 text-right text-indigo-200 bg-indigo-700">{formatCurrency(gop * 0.9)}</td>}
                                                    {comparativeConfig.columns.includes('variance') && (comparativeConfig.varianceMode === 'total' || !comparativeConfig.columns.includes('months')) && <td className="px-4 py-4 text-right">-</td>}
                                                </tr>
                                            </>
                                        ) : (
                                            <>
                                                {/* Standard DRE rendering */}
                                                <tr className="bg-emerald-50/30 font-bold text-emerald-900">
                                                    <td className="px-4 py-3 sticky left-0 bg-emerald-50 z-10 uppercase tracking-wider text-[11px]">RECEITAS OPERACIONAIS</td>
                                                    {comparativeConfig.columns.includes('months') && (
                                                        visibleMonthIndices.map((monthIdx) => {
                                                            const val = monthlyReceitas[monthIdx];
                                                            const real = val * 0.95; // Mock
                                                            const variance = val > 0 ? ((real - val) / val) * 100 : 0;
                                                            return (
                                                                <React.Fragment key={monthIdx}>
                                                                    {comparativeConfig.columns.includes('budget') && <td className="px-2 py-3 text-right">{formatCurrency(val)}</td>}
                                                                    {comparativeConfig.columns.includes('real') && <td className="px-2 py-3 text-right text-gray-500">{formatCurrency(real)}</td>}
                                                                    {comparativeConfig.columns.includes('variance') && comparativeConfig.varianceMode === 'monthly' && (
                                                                        <td className={`px-2 py-3 text-right font-bold ${variance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{variance >= 0 ? '+' : ''}{variance.toFixed(1)}%</td>
                                                                    )}
                                                                </React.Fragment>
                                                            );
                                                        })
                                                    )}
                                                    <td className="px-4 py-3 text-right border-l border-gray-200 bg-gray-100/50">{formatCurrency(totalRevenue)}</td>
                                                    {comparativeConfig.columns.includes('real') && <td className="px-4 py-3 text-right text-gray-500">{formatCurrency(totalRevenue * 0.95)}</td>}
                                                    {comparativeConfig.columns.includes('variance') && (comparativeConfig.varianceMode === 'total' || !comparativeConfig.columns.includes('months')) && (() => {
                                                        const totalReal = totalRevenue * 0.95;
                                                        const totalVariance = totalRevenue > 0 ? ((totalReal - totalRevenue) / totalRevenue) * 100 : 0;
                                                        return (
                                                            <td className={`px-4 py-3 text-right font-bold ${totalVariance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                                {totalVariance >= 0 ? '+' : ''}{totalVariance.toFixed(1)}%
                                                            </td>
                                                        );
                                                    })()}
                                                </tr>
                                                {accounts.filter(a => a.code.startsWith('1')).map(acc => {
                                                    const config = accountConfigs[acc.id] || { method: 'fixed', values: Array(12).fill(0) };
                                                    const totalVal = calculateTotal(config.values, visibleMonthIndices) * filterFactor;
                                                    return (
                                                        <tr key={acc.id} className={`hover:bg-gray-50 group ${isEditMode ? 'bg-indigo-50/10' : ''}`}>
                                                            <td className="px-8 py-2 sticky left-0 bg-white z-10 text-gray-600 group-hover:bg-gray-50 transition-colors">
                                                                <span className="text-[10px] text-gray-400 mr-2">{acc.code}</span>
                                                                {acc.name}
                                                            </td>
                                                            {comparativeConfig.columns.includes('months') && (
                                                                visibleMonthIndices.map((monthIdx) => {
                                                                    const val = (config.values[monthIdx] || 0) * filterFactor;
                                                                    const real = val * 0.95; // Mock
                                                                    const variance = val > 0 ? ((real - val) / val) * 100 : 0;
                                                                    return (
                                                                        <React.Fragment key={monthIdx}>
                                                                            {comparativeConfig.columns.includes('budget') && (
                                                                                <td 
                                                                                    className={`px-2 py-2 text-right text-[11px] transition-all ${isEditMode ? 'bg-indigo-50/50' : 'text-gray-500'}`}
                                                                                    onMouseEnter={() => isEditMode && handleDragEnter(acc.id, monthIdx)}
                                                                                >
                                                                                    {isEditMode ? (
                                                                                        <EditableCell
                                                                                            value={val}
                                                                                            onChange={(newVal) => {
                                                                                                const newValues = [...(accountConfigs[acc.id]?.values || Array(12).fill(0))];
                                                                                                newValues[monthIdx] = newVal / filterFactor;
                                                                                                setAccountConfigs(prev => ({
                                                                                                    ...prev,
                                                                                                    [acc.id]: { values: newValues }
                                                                                                }));
                                                                                            }}
                                                                                            onPaste={(e) => handlePaste(e, acc.id, monthIdx)}
                                                                                            onDragStart={() => handleDragStart(acc.id, monthIdx, val / filterFactor)}
                                                                                            copyToAll={() => copyToAllMonths(acc.id, val / filterFactor)}
                                                                                        />
                                                                                    ) : formatCurrency(val)}
                                                                                </td>
                                                                            )}
                                                                            {comparativeConfig.columns.includes('real') && <td className="px-2 py-2 text-right text-gray-500">{formatCurrency(real)}</td>}
                                                                            {comparativeConfig.columns.includes('variance') && comparativeConfig.varianceMode === 'monthly' && (
                                                                                <td className={`px-2 py-2 text-right font-bold ${variance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{variance >= 0 ? '+' : ''}{variance.toFixed(1)}%</td>
                                                                            )}
                                                                        </React.Fragment>
                                                                    );
                                                                })
                                                            )}
                                                            <td className="px-4 py-2 text-right font-bold text-gray-700 border-l border-gray-200 bg-gray-50/30">{formatCurrency(totalVal)}</td>
                                                            {comparativeConfig.columns.includes('real') && <td className="px-4 py-2 text-right font-bold text-gray-700 bg-gray-50/30">{formatCurrency(totalVal * 0.95)}</td>}
                                                            {comparativeConfig.columns.includes('variance') && (comparativeConfig.varianceMode === 'total' || !comparativeConfig.columns.includes('months')) && (() => {
                                                                const totalReal = totalVal * 0.95;
                                                                const totalVariance = totalVal > 0 ? ((totalReal - totalVal) / totalVal) * 100 : 0;
                                                                return (
                                                                    <td className={`px-4 py-2 text-right font-bold ${totalVariance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                                        {totalVariance >= 0 ? '+' : ''}{totalVariance.toFixed(1)}%
                                                                    </td>
                                                                );
                                                            })()}
                                                        </tr>
                                                    );
                                                })}
                                                
                                                {/* DESPESAS OPERACIONAIS */}
                                                <tr className="bg-rose-50/30 font-bold text-rose-900">
                                                    <td className="px-4 py-3 sticky left-0 bg-rose-50 z-10 uppercase tracking-wider text-[11px]">DESPESAS OPERACIONAIS</td>
                                                    {comparativeConfig.columns.includes('months') && (
                                                        visibleMonthIndices.map((monthIdx) => {
                                                            const val = monthlyDespesas[monthIdx];
                                                            const real = val * 1.05; // Mock
                                                            const variance = val > 0 ? ((real - val) / val) * 100 : 0;
                                                            return (
                                                                <React.Fragment key={monthIdx}>
                                                                    {comparativeConfig.columns.includes('budget') && <td className="px-2 py-3 text-right">{formatCurrency(val)}</td>}
                                                                    {comparativeConfig.columns.includes('real') && <td className="px-2 py-3 text-right text-gray-500">{formatCurrency(real)}</td>}
                                                                    {comparativeConfig.columns.includes('variance') && comparativeConfig.varianceMode === 'monthly' && (
                                                                        <td className={`px-2 py-3 text-right font-bold ${variance <= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{variance >= 0 ? '+' : ''}{variance.toFixed(1)}%</td>
                                                                    )}
                                                                </React.Fragment>
                                                            );
                                                        })
                                                    )}
                                                    <td className="px-4 py-3 text-right border-l border-gray-200 bg-gray-100/50">{formatCurrency(totalExpense)}</td>
                                                    {comparativeConfig.columns.includes('real') && <td className="px-4 py-3 text-right text-gray-500">{formatCurrency(totalExpense * 1.05)}</td>}
                                                    {comparativeConfig.columns.includes('variance') && (comparativeConfig.varianceMode === 'total' || !comparativeConfig.columns.includes('months')) && (() => {
                                                        const totalReal = totalExpense * 1.05;
                                                        const totalVariance = totalExpense > 0 ? ((totalReal - totalExpense) / totalExpense) * 100 : 0;
                                                        return (
                                                            <td className={`px-4 py-3 text-right font-bold ${totalVariance <= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                                {totalVariance >= 0 ? '+' : ''}{totalVariance.toFixed(1)}%
                                                            </td>
                                                        );
                                                    })()}
                                                </tr>

                                                {accounts.filter(a => a.code.startsWith('3')).map(acc => {
                                                    const config = accountConfigs[acc.id] || { method: 'fixed', values: Array(12).fill(0) };
                                                    const totalVal = calculateTotal(config.values, visibleMonthIndices) * filterFactor;
                                                    const hasMemory = calculationMemories[acc.id]?.steps.length > 0;
                                                    const isExpanded = expandedCalculations[acc.id];
                                                    
                                                    return (
                                                        <React.Fragment key={acc.id}>
                                                            <tr className={`hover:bg-gray-50 group ${isEditMode ? 'bg-indigo-50/10' : ''}`}>
                                                                <td className="px-8 py-2 sticky left-0 bg-white z-10 text-gray-600 group-hover:bg-gray-50 transition-colors flex items-center gap-2">
                                                                    {hasMemory && (
                                                                        <button 
                                                                            onClick={() => setExpandedCalculations(prev => ({ ...prev, [acc.id]: !prev[acc.id] }))}
                                                                            className="p-1 hover:bg-indigo-100 rounded text-indigo-600 transition-colors"
                                                                        >
                                                                            {isExpanded ? <X size={12} /> : <Plus size={12} />}
                                                                        </button>
                                                                    )}
                                                                    <span className="text-[10px] text-gray-400 mr-2">{acc.code}</span>
                                                                    {acc.name}
                                                                </td>
                                                                {comparativeConfig.columns.includes('months') && (
                                                                    visibleMonthIndices.map((monthIdx) => {
                                                                        const val = (config.values[monthIdx] || 0) * filterFactor;
                                                                        const real = val * 1.05; // Mock
                                                                        const variance = val > 0 ? ((real - val) / val) * 100 : 0;
                                                                        return (
                                                                            <React.Fragment key={monthIdx}>
                                                                                {comparativeConfig.columns.includes('budget') && (
                                                                                    <td 
                                                                                        className={`px-2 py-2 text-right text-[11px] transition-all relative ${isEditMode ? 'bg-indigo-50/50' : 'text-gray-500'}`}
                                                                                        onMouseEnter={() => isEditMode && handleDragEnter(acc.id, monthIdx)}
                                                                                    >
                                                                                        {isEditMode ? (
                                                                                            <EditableCell
                                                                                                value={val}
                                                                                                onChange={(newVal) => {
                                                                                                    const newValues = [...(accountConfigs[acc.id]?.values || Array(12).fill(0))];
                                                                                                    newValues[monthIdx] = newVal / filterFactor;
                                                                                                    setAccountConfigs(prev => ({
                                                                                                        ...prev,
                                                                                                        [acc.id]: { values: newValues }
                                                                                                    }));
                                                                                                }}
                                                                                                onPaste={(e) => handlePaste(e, acc.id, monthIdx)}
                                                                                                onDragStart={() => handleDragStart(acc.id, monthIdx, val / filterFactor)}
                                                                                                copyToAll={() => acc.id && copyToAllMonths(acc.id, val / filterFactor)}
                                                                                            />
                                                                                        ) : formatCurrency(val)}
                                                                                    </td>
                                                                                )}
                                                                                {comparativeConfig.columns.includes('real') && <td className="px-2 py-2 text-right text-gray-500">{formatCurrency(real)}</td>}
                                                                                {comparativeConfig.columns.includes('variance') && comparativeConfig.varianceMode === 'monthly' && (
                                                                                    <td className={`px-2 py-2 text-right font-bold ${variance <= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{variance >= 0 ? '+' : ''}{variance.toFixed(1)}%</td>
                                                                                )}
                                                                            </React.Fragment>
                                                                        );
                                                                    })
                                                                )}
                                                                <td className="px-4 py-2 text-right font-bold text-gray-700 border-l border-gray-200 bg-gray-50/30">{formatCurrency(totalVal)}</td>
                                                                {comparativeConfig.columns.includes('real') && <td className="px-4 py-2 text-right font-bold text-gray-700 bg-gray-50/30">{formatCurrency(totalVal * 1.05)}</td>}
                                                                {comparativeConfig.columns.includes('variance') && (comparativeConfig.varianceMode === 'total' || !comparativeConfig.columns.includes('months')) && (() => {
                                                                    const totalReal = totalVal * 1.05;
                                                                    const totalVariance = totalVal > 0 ? ((totalReal - totalVal) / totalVal) * 100 : 0;
                                                                    return (
                                                                        <td className={`px-4 py-2 text-right font-bold ${totalVariance <= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                                            {totalVariance >= 0 ? '+' : ''}{totalVariance.toFixed(1)}%
                                                                        </td>
                                                                    );
                                                                })()}
                                                            </tr>
                                                            {isExpanded && hasMemory && calculationMemories[acc.id].steps.map((step, sIdx) => (
                                                                <tr key={`${acc.id}-step-${sIdx}`} className="bg-indigo-50/30 text-[10px] italic text-indigo-600">
                                                                    <td className="px-12 py-1 sticky left-0 bg-indigo-50/30 z-10">
                                                                        {step.operator} {step.type === 'manual' ? `Manual: ${step.value}` : `Conta: ${accounts.find(a => a.id === step.accountId)?.name} (${step.percentage}%)`}
                                                                    </td>
                                                                    {comparativeConfig.columns.includes('months') && (
                                                                        visibleMonthIndices.map((monthIdx) => {
                                                                            let stepVal = 0;
                                                                            if (step.type === 'manual') {
                                                                                stepVal = step.value || 0;
                                                                            } else {
                                                                                const refAcc = accounts.find(a => a.id === step.accountId);
                                                                                const refValues = accountConfigs[refAcc?.id || '']?.values || Array(12).fill(0);
                                                                                stepVal = (refValues[monthIdx] || 0) * ((step.percentage || 100) / 100);
                                                                            }
                                                                            return (
                                                                                <React.Fragment key={monthIdx}>
                                                                                    {comparativeConfig.columns.includes('budget') && <td className="px-2 py-1 text-right">{formatCurrency(stepVal * filterFactor)}</td>}
                                                                                    {comparativeConfig.columns.includes('real') && <td className="px-2 py-1 text-right">-</td>}
                                                                                    {comparativeConfig.columns.includes('variance') && comparativeConfig.varianceMode === 'monthly' && <td className="px-2 py-1 text-right">-</td>}
                                                                                </React.Fragment>
                                                                            );
                                                                        })
                                                                    )}
                                                                    <td className="px-4 py-1 text-right border-l border-gray-200">-</td>
                                                                    {comparativeConfig.columns.includes('real') && <td className="px-4 py-1 text-right">-</td>}
                                                                    {comparativeConfig.columns.includes('variance') && (comparativeConfig.varianceMode === 'total' || !comparativeConfig.columns.includes('months')) && <td className="px-4 py-1 text-right">-</td>}
                                                                </tr>
                                                            ))}
                                                        </React.Fragment>
                                                    );
                                                })}
                                            </>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BudgetDREView;
