import React, { useMemo, useState, useEffect, useRef } from 'react';
import { getForecastData, getDynamicForecastData } from '../services/mockData';
import { Upload, ListFilter, LayoutList, Settings2, ChevronUp, Activity, TrendingUp, Lock, LockOpen, CheckCircle2, X, FileSpreadsheet, AlertCircle, CheckCircle, ChevronRight, ChevronDown } from 'lucide-react';
import { ExpenseDriver, ImportedRow, Account, CostPackage, Hotel, ForecastRow, ForecastConfig, ForecastOperator, ColumnVisibility, UserRole, KpiCalculation, hasRole } from '../types';
import { evaluateFormula } from '../utils/formulaEngine';
import { supabaseService } from '../services/supabaseService';
import { VersionInfoBanner } from './VersionInfoBanner';
import { MEETING_VERSIONS } from './OccupancyView';
import OtbProgressTimeline from './OtbProgressTimeline';
import BalanceteImportModal from './BalanceteImportModal';
import { computeOtbProgress } from '../utils/otbProgress';
import toast from 'react-hot-toast';

interface ForecastTableProps {
    selectedMonth?: number;
    selectedYear?: number;
    financialData?: ImportedRow[];
    selectedHotel?: string;
    // New props for dynamic structure
    accounts: Account[];
    packages: CostPackage[];
    packageKpiConfigs?: Record<string, KpiCalculation>;
    hotels: Hotel[];

    // Month Status Props
    isMonthClosed?: boolean;
    realOccupancyData?: Record<string, Record<string, number>>;
    setRealOccupancyData?: React.Dispatch<React.SetStateAction<Record<string, Record<string, number>>>>;

    // Budget Props
    activeRealVersionId?: string;
    activeRealVersionName?: string;
    activeBudgetVersionId?: string;
    budgetOccupancyData?: Record<string, number[]>;

    // Projections & Validation
    activeProjectionType?: import('../types').ProjectionType;
    setActiveProjectionType?: React.Dispatch<React.SetStateAction<import('../types').ProjectionType>>;
    validations?: import('../types').ValidationRecord[];
    setValidations?: React.Dispatch<React.SetStateAction<import('../types').ValidationRecord[]>>;
    currentUser?: import('../types').User;
    dreConfigs?: Record<string, import('../types').DreSection[]>;
    onNavigateToOccupancy?: (otbMode?: boolean) => void;
    onImportData?: (rows: ImportedRow[], mode: 'append' | 'replace') => void;
    onDeleteOtbBalancete?: (hotel: string, year: number, month: number, versionId: string) => void;
    onResetValidation?: (hotelId: string, year: number, month: number, projectionType: import('../types').ProjectionType) => void;
}

// --- UTILITÁRIOS MOVIDOS PARA FORA PARA EVITAR RE-RENDERIZAÇÕES DESNECESSÁRIAS ---

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

// For rows whose own value is already a percentage (GOP %), the "difference" is naturally
// expressed in percentage points ("5,5 p.p."), not as a % change of a %.
const formatPointsDiff = (val: number | undefined) => {
    if (val === undefined || isNaN(val as number)) return '-';
    return `${val > 0 ? '+' : ''}${val.toFixed(1).replace('.', ',')} p.p.`;
};

const blueRowIds = ['REV-TOTAL', 'REV-NET', 'CST-HEAD', 'RES-OP', 'RES-PCT', 'REV-IMP', 'RES-OP-SEM-IMP', 'RES-OP-COM-IMP', 'RES-OP-SEM-IMP-PCT', 'RES-OP-COM-IMP-PCT', 'LABOR-TOTAL'];

// Linhas mostradas no resumo do passo 7 (Validar informações) do timeline OTB — null vira uma
// linha em branco separando os grupos.
const VALIDATION_SUMMARY_ROWS: ({ id: string; label: string; bold?: boolean } | null)[] = [
    { id: 'IND-3', label: '% OCC' },
    { id: 'IND-5', label: 'PAX' },
    { id: 'IND-4', label: 'DM BRUTA' },
    { id: 'IND-6', label: 'REVPAR' },
    null,
    { id: 'LABOR-TOTAL', label: 'MÃO DE OBRA (TOTAL)' },
    null,
    { id: 'REV-TOTAL', label: 'RECEITA BRUTA TOTAL', bold: true },
    { id: 'REV-IMP', label: 'IMPOSTOS' },
    { id: 'CST-HEAD', label: 'CUSTOS E DESPESAS OPERACIONAIS' },
    null,
    { id: 'RES-OP-COM-IMP', label: 'GOP COM DEDUÇÃO DE IMPOSTOS (R$)', bold: true },
    { id: 'RES-OP-COM-IMP-PCT', label: 'GOP COM DEDUÇÃO DE IMPOSTOS (%)' },
    null,
    { id: 'RES-OP-SEM-IMP', label: 'GOP SEM DEDUÇÃO DE IMPOSTOS (R$)', bold: true },
    { id: 'RES-OP-SEM-IMP-PCT', label: 'GOP SEM DEDUÇÃO DE IMPOSTOS (%)' },
];

// For a revenue row, coming in ABOVE the comparison period is good (green). For a cost/tax row
// (Custos e Despesas Operacionais and its packages/accounts, plus the Impostos deduction line —
// which is category 'Revenue' in the data model despite behaving like a cost), it's the opposite:
// a HIGHER value means more expense/tax, which is bad (red).
const isCostLikeRow = (row: ForecastRow) =>
    row.category === 'Costs' || row.category === 'Package' || row.category === 'Account' || row.id === 'REV-IMP';

const getDeltaColorClass = (row: ForecastRow, val: number | undefined) => {
    const isWorse = isCostLikeRow(row) ? (val || 0) > 0 : (val || 0) < 0;
    return isWorse ? 'text-rose-600' : 'text-emerald-600';
};

// Turns a stored KPI formula ("@[Hortifrutigranjeiros] / @[PAX]") into the human-readable
// text shown in the hover tooltip ("Hortifrutigranjeiros / PAX").
const formatKpiFormulaForDisplay = (formula: string | undefined) => {
    if (!formula) return '';
    return formula.replace(/@\[([^\]]+)\]|@([a-zA-Z0-9À-ÿ_.À-ſ\s\-]+)/g, (_match, bracketed, plain) => (bracketed || plain || '').trim());
};

// Mapeamento: Label do template → ID da linha no DRE Forecast
// As colunas do template são: Descrição | Prévia | Forecast | Meta | Last Year
const IMPORT_LABEL_MAP: Record<string, string> = {
    'uh disponível': 'IND-1',
    'uh disponivel': 'IND-1',
    'uh ocupada': 'IND-2',
    'adultos': 'IND-ADULTOS',
    'chd': 'IND-CHD',
    // 'revpar', 'trevpor', 'trevpar' são calculados automaticamente — não importar
    'receita de apartamentos (lazer)': 'REV-APT-LAZER',
    'receita de apartamentos (eventos)': 'REV-APT-EVENTOS',
    'receitas extras (lazer)': 'REV-EXTRA-LAZER',
    'receitas extras (eventos)': 'REV-EXTRA-EVENTOS',
    'cancelamento de time share': 'REV-TIME',
    'receita de iss': 'REV-ISS',
    'impostos': 'REV-IMP',
    // costs - use dynamic IDs via label fallback
    'custo de alimentos': '__label__',
    'custo de bebidas': '__label__',
    'custo de produtos diversos': '__label__',
    'custo de outras receitas': '__label__',
    'despesas administrativas': '__label__',
    'despesas administrativas gerais': '__label__',
    'processamentos de dados e ti (ti)': '__label__',
    'processamentos de dados e ti (martech)': '__label__',
    'processamentos de dados e ti (outros setores)': '__label__',
    'beneficios aos colaboradores': '__label__',
    'despesas com pessoal': '__label__',
    'encargos sociais': '__label__',
    'serviços de terceiros': '__label__',
    'servicos de terceiros temporarios': '__label__',
    'serviço de terceiros recorrente': '__label__',
    'serviços contratados de prestadores pj - mei': '__label__',
    'despesas com vendas e marketing': '__label__',
    'despesas com vendas e marketing (martech)': '__label__',
    'despesas com vendas e marketing (marketing)': '__label__',
    'despesas com vendas e marketing (outros setores)': '__label__',
    'despesas financeiras e bancárias': '__label__',
    'despesas financeiras e bancarias': '__label__',
    'despesas com conservação e limpeza': '__label__',
    'despesas com conservacao e limpeza': '__label__',
    'despesas com manutenção': '__label__',
    'despesas com manutencao': '__label__',
    'despesas com serviços públicos': '__label__',
    'despesas com servicos publicos': '__label__',
    'despesas operacionais': '__label__',
    'arrendamento': '__label__',
    'despesa tributaria': '__label__',
    'outros impostos': '__label__',
    'provisões gerais': '__label__',
    'provisoes gerais': '__label__',
    'provisao de servicos de terceiros temporarios': '__label__',
    'outras provisões': '__label__',
    'outras provisoes': '__label__',
};

export const parseNum = (s: string): number => {
    if (!s || s.trim() === '' || s.trim() === '-') return 0;
    // Handle both comma-decimal (pt-BR) and dot-decimal formats
    const cleaned = s.trim().replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
};

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

// --- COMPONENTE PRINCIPAL ---

const ForecastTable: React.FC<ForecastTableProps> = ({
    selectedMonth,
    selectedYear,
    financialData,
    selectedHotel,
    accounts,
    packages,
    packageKpiConfigs = {},
    hotels,
    isMonthClosed = false,
    realOccupancyData = {},
    setRealOccupancyData,
    budgetOccupancyData = {},
    activeRealVersionId,
    activeRealVersionName,
    activeBudgetVersionId,
    activeProjectionType,
    setActiveProjectionType,
    validations,
    setValidations,
    currentUser,
    dreConfigs,
    onNavigateToOccupancy,
    onImportData,
    onDeleteOtbBalancete,
    onResetValidation
}) => {
    const canEditForecast = hasRole(currentUser, UserRole.ADMIN) ||
        hasRole(currentUser, UserRole.ENTITY_MANAGER) ||
        hasRole(currentUser, UserRole.COST_ANALYST) ||
        hasRole(currentUser, UserRole.PACKAGE_MANAGER);

    const canValidate = hasRole(currentUser, UserRole.ADMIN) ||
        hasRole(currentUser, UserRole.ENTITY_MANAGER) ||
        hasRole(currentUser, UserRole.COST_ANALYST);

    // Selecting "Fechamento" as the Forecast version only swaps labels (Prévia → Real) — it
    // does NOT lock editing by itself. Editing only locks once THIS specific closing has
    // actually been validated/saved (a matching ValidationRecord already exists).
    const isAlreadyValidated = (validations || []).some(v =>
        v.projectionType === 'Fechamento oficial' &&
        v.hotelId === selectedHotel &&
        v.month === selectedMonth &&
        v.year === selectedYear
    );
    // A validated closing can be reopened for editing via the "Resultados validados" button —
    // this local flag lifts the lock for the current period until it's validated again.
    const [forceUnlockValidated, setForceUnlockValidated] = useState(false);
    useEffect(() => {
        setForceUnlockValidated(false);
    }, [selectedHotel, selectedMonth, selectedYear, activeProjectionType]);
    const isLocked = isMonthClosed && isAlreadyValidated && !forceUnlockValidated;

    const [data, setData] = useState<ForecastRow[]>(() => buildForecastRows(
        dreConfigs, selectedMonth, selectedYear, financialData, selectedHotel, hotels,
        realOccupancyData, activeRealVersionId, activeBudgetVersionId, accounts, packages,
        budgetOccupancyData, activeProjectionType
    ));

    const [showDetails, setShowDetails] = useState(false);
    const [expandedPackages, setExpandedPackages] = useState<Set<string>>(new Set());

    const togglePackage = (id: string) => {
        setExpandedPackages(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };
    const [showImportModal, setShowImportModal] = useState(false);
    const [importText, setImportText] = useState('');
    const [importResult, setImportResult] = useState<{ success: number; skipped: string[] } | null>(null);
    const [showImportLines, setShowImportLines] = useState(false);
    const [calculationBase, setCalculationBase] = useState<'forecast' | 'previa'>('forecast');

    const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>({
        otb: true,
        previa: true,
        real: true,
        budget: true,
        deltaPreviaBudget: true,
        deltaPreviaBudgetPct: true,
        deltaPreviaForecast: true,
        deltaPreviaForecastPct: true,
        deltaBudget: true,
        deltaBudgetPct: true,
        lastYear: true,
        deltaLY: true,
        deltaLYPct: true,
        driverOtb: true,
        driverPrevia: true,
        driverForecast: true,
        driverBudget: true,
    });

    const [showColumnSettings, setShowColumnSettings] = useState(false);
    const [showAlertModal, setShowAlertModal] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
        description: 300,
        otb: 120,
        previa: 120,
        real: 120,
        budget: 120,
        deltaPreviaBudget: 120,
        deltaPreviaBudgetPct: 120,
        deltaPreviaForecast: 120,
        deltaPreviaForecastPct: 120,
        lastYear: 120,
        deltaLY: 120,
        deltaLYPct: 120,
        driverOtb: 70,
        driverPrevia: 70,
        driverForecast: 70,
        driverBudget: 70,
    });

    const [resizingColumn, setResizingColumn] = useState<string | null>(null);
    const [startX, setStartX] = useState(0);
    const [startWidth, setStartWidth] = useState(0);
    const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

    const handleKeyDown = (e: React.KeyboardEvent, rowId: string, field: string) => {
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

    const [expandedConfigRows, setExpandedConfigRows] = useState<Set<string>>(new Set());
    const [showValidationModal, setShowValidationModal] = useState(false);
    const [justifications, setJustifications] = useState<Record<string, string>>({});

    // Flags de controle puras da timeline OTB (__otb_day, __forecast_calculated,
    // __validado_manual) moram dentro de realOccupancyData pra ficarem visíveis também na tela
    // de Ocupação, mas nenhuma delas entra no cálculo de getForecastData — por isso não podem
    // disparar um recomputo de derivedData. Sem essa exclusão, marcar "Calcular Forecast"
    // concluído (que grava __forecast_calculated no exato momento em que os valores recém-
    // calculados de Custos acabaram de ser aplicados em `data`) fazia esse mesmo clique disparar
    // um recomputo que sobrescrevia `data` de volta com os valores originais — como se o cálculo
    // nunca tivesse acontecido.
    // IMPORTANTE: __balancete_imposto/__balancete_time_share/__balancete_iss NÃO entram nessa
    // lista — eles alimentam getOtbOccValue (Imposto/Time Share/ISS na coluna OTB), então uma
    // mudança neles precisa disparar o recomputo; excluí-los fazia o valor importado pelo
    // balancete só aparecer depois de recarregar a página.
    const NON_CALC_OCCUPANCY_FLAGS = ['__otb_day', '__forecast_calculated', '__validado_manual'];
    const occupancySignature = useMemo(() => {
        return JSON.stringify(realOccupancyData, (key, value) => (NON_CALC_OCCUPANCY_FLAGS.includes(key) ? undefined : value));
    }, [realOccupancyData]);

    const derivedData = useMemo(() => {
        return buildForecastRows(
            dreConfigs, selectedMonth, selectedYear, financialData, selectedHotel, hotels,
            realOccupancyData, activeRealVersionId, activeBudgetVersionId, accounts, packages,
            budgetOccupancyData, activeProjectionType
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedMonth, selectedYear, financialData, selectedHotel, packages, accounts, hotels, occupancySignature, activeRealVersionId, activeBudgetVersionId, budgetOccupancyData, dreConfigs, isMonthClosed, activeProjectionType]);

    useEffect(() => {
        setData(derivedData);
    }, [derivedData]);

    const isSpecialEditableRow = (id: string) => {
        return ['REV-APT-LAZER', 'REV-APT-EVENTOS', 'REV-EXTRA-LAZER', 'REV-EXTRA-EVENTOS', 'REV-TIME', 'REV-ISS', 'REV-IMP'].includes(id);
    };

    const isRowEditableForUser = (row: ForecastRow) => {
        if (!currentUser) return false;

        // ADMIN Geral, Gerente de Entidade, and Analista de Custos have full edit access
        if (hasRole(currentUser, UserRole.ADMIN) || hasRole(currentUser, UserRole.ENTITY_MANAGER) || hasRole(currentUser, UserRole.COST_ANALYST)) {
            return true;
        }

        // Gerente de Pacotes can only edit accounts under their assigned Pacotes and revenues.
        // responsiblePackages holds Pacote names (see "Pacotes" no formulário de usuário, mesma
        // granularidade que aparece na DRE Forecast) — matched against each account's own
        // package, não o Pacote Master (mais amplo).
        if (hasRole(currentUser, UserRole.PACKAGE_MANAGER)) {
            if (row.category === 'Costs' || row.category === 'Package' || row.category === 'Account') {
                // If it's a package header
                if (row.isHeader && row.indentLevel === 1) {
                    return currentUser.responsiblePackages?.some(p => p.trim().toLowerCase() === row.label.trim().toLowerCase()) || false;
                }
                // If it's an individual account
                const accId = row.id.split('-')[0];
                const acc = accounts.find(a => a.id === accId);
                if (acc && acc.package) {
                    return currentUser.responsiblePackages?.includes(acc.package) || false;
                }
                // Fallback checking label or indicatorSection
                return currentUser.responsiblePackages?.some(p =>
                    row.label.toLowerCase().includes(p.toLowerCase()) ||
                    (row.indicatorSection && row.indicatorSection.toLowerCase().includes(p.toLowerCase()))
                ) || false;
            }

            if (isSpecialEditableRow(row.id)) {
                const revenueMap: Record<string, string> = {
                    'REV-APT-LAZER': 'Receita de Apartamentos (Lazer)',
                    'REV-APT-EVENTOS': 'Receita de Apartamentos (Eventos)',
                    'REV-EXTRA-LAZER': 'Receitas Extras (Lazer)',
                    'REV-EXTRA-EVENTOS': 'Receitas Extras (Eventos)'
                };
                const assignedRevenue = revenueMap[row.id];
                if (assignedRevenue) {
                    return currentUser.responsibleRevenues?.includes(assignedRevenue) || false;
                }
            }
        }

        return false;
    };

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

                let newValue = calculationBase === 'forecast' ? row.real : row.previa;

                if (updates.method === 'Fixed') {
                    newConfig.manualValue = updates.manualValue !== undefined ? updates.manualValue : newValue;
                    newValue = newConfig.manualValue || 0;
                }

                const updatedRow = {
                    ...row,
                    [calculationBase === 'forecast' ? 'forecastConfig' : 'previaConfig']: newConfig
                };

                if (updates.method === 'Variable' || (currentConfig.method === 'Variable' && !updates.method)) {
                    const calculated = calculateRowValue(row, newConfig, prevData, calculationBase);
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

                const isOccupancy = row.id.startsWith('IND-');
                const isRevenue = row.id.startsWith('REV-APT-') || row.id.startsWith('REV-EXTRA-') || row.id === 'REV-TIME' || row.id === 'REV-ISS' || row.id === 'REV-TOTAL' || row.id === 'REV-NET' || row.id === 'REV-APT' || row.id === 'REV-EXTRA';
                const isTaxes = row.id === 'REV-IMP';
                const replicateToReal = isOccupancy || isRevenue || isTaxes;

                if (field === 'previa' && replicateToReal) {
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

    // Typing a new KPI value (e.g. "R$ 12,00 / PAX") back-solves the account's underlying
    // Prévia/Forecast value from the formula's denominator, so adjusting the rate adjusts the result.
    const handleKpiValueChange = (rowId: string, field: 'previa' | 'real', typedKpiValue: number) => {
        setData(prevData => {
            const newData = prevData.map(row => {
                if (row.id !== rowId) return row;

                const calc = row.rowConfig?.kpiCalculation;
                const selfDenominatorLabel = calc ? parseSelfRatioDenominator(calc.formula, row.label) : null;
                const precomputedDenominator = row.rowConfig?.precomputedKpi?.denominator?.[field];

                let denomValue: number | undefined;
                let rawKpi = typedKpiValue;

                if (selfDenominatorLabel) {
                    rawKpi = calc!.format === 'percent' ? typedKpiValue / 100 : typedKpiValue;
                    denomValue = resolveKpiTerm(selfDenominatorLabel, prevData, field);
                } else if (precomputedDenominator) {
                    denomValue = precomputedDenominator;
                }

                if (!denomValue) return row;

                const newValue = rawKpi * denomValue;

                if (field === 'real') return { ...row, real: newValue, isManualOverride: true };
                return { ...row, previa: newValue, isManualPreviaOverride: true };
            });
            return recalculateTotals(newData, packages, accounts);
        });
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>, startRowId: string, field: 'real' | 'previa') => {
        const pasteData = e.clipboardData.getData('text');
        if (!pasteData) return;

        const lines = pasteData.split(/\r?\n/).filter(line => line.trim() !== '');
        if (lines.length <= 1) return;

        e.preventDefault();

        setData(prevData => {
            // CLONE PROFUNDO DA LISTA PARA NÃO MUTAR O ESTADO
            const newData = prevData.map(r => ({
                ...r,
                forecastConfig: { ...r.forecastConfig },
                previaConfig: r.previaConfig ? { ...r.previaConfig } : undefined
            }));

            const startIndex = newData.findIndex(r => r.id === startRowId);
            if (startIndex === -1) return prevData;

            let lineIndex = 0;

            for (let i = startIndex; i < newData.length && lineIndex < lines.length; i++) {
                const row = newData[i];

                if (row.isHeader || row.isTotal || row.category === 'Spacer') continue;

                const isIndicator = row.id.startsWith('IND-');
                const isManualRow = ['IND-MO-2', 'IND-MO-3'].includes(row.id);
                const isInputIndicator = ['IND-1', 'IND-LZ-2', 'IND-LZ-4', 'IND-LZ-5', 'IND-EV-2', 'IND-EV-4', 'IND-EV-5'].includes(row.id);
                const canEditReal = !isLocked && (!row.isHeader || isSpecialEditableRow(row.id)) && !row.isTotal && (row.forecastConfig.method === 'Fixed' || isSpecialEditableRow(row.id)) && isRowEditableForUser(row);
                const canEditPrevia = !isLocked && (!row.isHeader || isSpecialEditableRow(row.id)) && !row.isTotal && ((row.previaConfig?.method || 'Fixed') === 'Fixed' || isSpecialEditableRow(row.id)) && isRowEditableForUser(row);

                let canEdit = false;
                if (!isIndicator) {
                    canEdit = field === 'real' ? canEditReal : canEditPrevia;
                } else if (isInputIndicator || isManualRow) {
                    canEdit = hasRole(currentUser, UserRole.ADMIN) || hasRole(currentUser, UserRole.ENTITY_MANAGER) || hasRole(currentUser, UserRole.COST_ANALYST);
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
                                const isOccupancy = row.id.startsWith('IND-');
                                const isRevenue = row.id.startsWith('REV-APT-') || row.id.startsWith('REV-EXTRA-') || row.id === 'REV-TIME' || row.id === 'REV-ISS';
                                const isTaxes = row.id === 'REV-IMP';
                                if (isOccupancy || isRevenue || isTaxes) {
                                    row.forecastConfig = { ...row.forecastConfig, method: 'Fixed', manualValue: val };
                                    row.real = val;
                                    row.isManualOverride = true;
                                }
                            }
                        } else {
                            if (isManualRow) {
                                if (field === 'real') {
                                    row.real = val;
                                    row.isManualOverride = true;
                                } else {
                                    row.previa = val;
                                    row.isManualPreviaOverride = true;
                                    row.real = val;
                                    row.isManualOverride = true;
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
                                    row.forecastConfig = { ...row.forecastConfig, method: 'Fixed', manualValue: val };
                                    row.real = val;
                                    row.isManualOverride = true;
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

    const visibleData = useMemo(() => {
        let currentPackageExpanded = true;
        return data.filter(row => {
            // Transformação/Reatividade rows are shown as cards below the table, not as rows.
            if (row.id.startsWith('KPI-TRANS-')) return false;
            if (row.category === 'Spacer') return true;
            if (row.category === 'Indicators') {
                if (showDetails) return true;
                // List of indicators to show when "Ocultar Contas" (showDetails is false) is active
                const allowedIndicators = ['IND-1', 'IND-2', 'IND-3', 'IND-4', 'IND-5', 'IND-6', 'IND-TREVPOR'];
                return allowedIndicators.includes(row.id);
            }
            if (row.category === 'Revenue' && !row.isHeader) {
                // Lazer/Eventos/OR breakdown rows under Receita de Apartamentos and Receitas
                // Extras only show with "Mostrar Contas" — the totals themselves (which are
                // header rows) are unaffected and always visible.
                return showDetails;
            }
            if (row.isHeader && row.category === 'Section') {
                return true;
            }
            if (row.isHeader && row.category === 'Package') {
                currentPackageExpanded = expandedPackages.has(row.id);
                return true;
            }
            if (row.isHeader) return true;
            
            if (!row.isHeader) {
                return currentPackageExpanded;
            }
            return false;
        });
    }, [data, showDetails, expandedPackages]);

    const monthName = new Date(selectedYear || 2024, (selectedMonth || 1) - 1).toLocaleString('pt-BR', { month: 'long' });

    // Wizard "On the books" (OTB) — só existe para Reunião de Ritmo/FCA N1/FCA N2, cada versão
    // com seu próprio dia de corte e snapshot isolado (sufixo extra "__OTB" na chave que já
    // isola cada Versão do Forecast).
    const [showOtbWizard, setShowOtbWizard] = useState(false);
    const [otbDayPicked, setOtbDayPicked] = useState<number | null>(null);
    const isMeetingVersion = !!activeProjectionType && MEETING_VERSIONS.includes(activeProjectionType as any);
    const otbContextKey = `${selectedHotel}_${selectedYear}_${selectedMonth}_${activeRealVersionId || ''}__${activeProjectionType}__OTB`;
    const otbDaySaved = realOccupancyData[otbContextKey]?.['__otb_day'];
    const otbColumnLabel = otbDaySaved ? `OTBs ${String(otbDaySaved).padStart(2, '0')}/${String(selectedMonth || 1).padStart(2, '0')}` : 'OTBs';
    const daysInSelectedMonth = new Date(selectedYear || 2024, selectedMonth || 1, 0).getDate();

    const handleIniciarProjecao = () => {
        if (isMeetingVersion && !otbDaySaved) {
            setOtbDayPicked(null);
            setShowOtbWizard(true);
        } else {
            onNavigateToOccupancy?.(isMeetingVersion && !!otbDaySaved);
        }
    };

    const confirmOtbWizard = () => {
        if (otbDayPicked == null || !setRealOccupancyData) return;
        setRealOccupancyData(prev => ({
            ...prev,
            [otbContextKey]: { ...(prev[otbContextKey] || {}), '__otb_day': otbDayPicked }
        }));
        setShowOtbWizard(false);
        onNavigateToOccupancy?.(true);
    };

    // Timeline dos 8 passos de montagem da projeção — só faz sentido pras 3 versões de reunião.
    const [showBalanceteModal, setShowBalanceteModal] = useState(false);
    // Resumo já salvo de uma importação anterior do balancete — quando presente, o modal abre
    // direto na tela de resumo (Revisar) em vez de pedir upload de arquivo de novo.
    const [balanceteReviewData, setBalanceteReviewData] = useState<any | null>(null);
    // Sinaliza (por alguns segundos) a linha de conta contábil por onde começar a preencher a
    // Prévia — usado pelo passo 6 do timeline pra apontar onde o usuário deve ir.
    const [highlightRowId, setHighlightRowId] = useState<string | null>(null);
    // Resumo mostrado no passo 7 (Validar informações) do timeline.
    const [showValidationSummaryModal, setShowValidationSummaryModal] = useState(false);
    const toggleValidadoManual = () => {
        if (!setRealOccupancyData) return;
        setRealOccupancyData(prev => {
            const current = prev[otbContextKey] || {};
            return { ...prev, [otbContextKey]: { ...current, '__validado_manual': current['__validado_manual'] ? 0 : 1 } };
        });
    };
    const otbProgress = isMeetingVersion ? computeOtbProgress({
        realOccupancyData,
        financialData: financialData || [],
        validations: validations || [],
        forecastRows: data,
        hotel: selectedHotel || '',
        year: selectedYear || 0,
        month: selectedMonth || 0,
        versionId: activeRealVersionId || '',
        projectionType: activeProjectionType!,
    }) : [];

    // Nenhum passo é bloqueado por ordem — o usuário pode clicar em qualquer etapa a qualquer
    // momento pra editar/refazer, mesmo fora de sequência.
    const handleOtbStepClick = (index: number) => {
        if (index === 0) {
            // Sempre reabre o wizard (mesmo se o dia já tiver sido escolhido antes) pra dar pra
            // trocar o dia de corte quando quiser.
            setOtbDayPicked(otbDaySaved ?? null);
            setShowOtbWizard(true);
        } else if (index === 1) {
            onNavigateToOccupancy?.(true);
        } else if (index === 2) {
            // Etapa já concluída: busca o resumo salvo dessa importação pra abrir o modal direto
            // na tela de "Revisar" — sem isso, precisaria reimportar o arquivo do zero só pra ver
            // o resumo de novo.
            if (otbProgress[2]) {
                setBalanceteReviewData(null);
                supabaseService.getBalanceteResumo(selectedHotel || '', selectedYear || 0, selectedMonth || 0, activeRealVersionId || '')
                    .then(resumo => setBalanceteReviewData(resumo))
                    .catch(() => setBalanceteReviewData(null))
                    .finally(() => setShowBalanceteModal(true));
            } else {
                setBalanceteReviewData(null);
                setShowBalanceteModal(true);
            }
        } else if (index === 3) {
            onNavigateToOccupancy?.(false);
        } else if (index === 4) {
            handleCalcularForecast();
        } else if (index === 5) {
            // Incluir despesas da prévia — expande os pacotes de Custos, mostra as contas (caso
            // estivessem ocultas), rola até "CUSTOS E DESPESAS OPERACIONAIS" (encostando no
            // cabeçalho) e sinaliza a célula de Prévia da primeira conta contábil, indicando por
            // onde começar a preencher.
            setShowDetails(true);
            const firstAccountRow = data.find(r => r.category === 'Account');
            if (firstAccountRow) {
                const allPackageIds = data.filter(r => r.category === 'Package' && r.isHeader).map(r => r.id);
                setExpandedPackages(new Set(allPackageIds));
                setHighlightRowId(firstAccountRow.id);
                setTimeout(() => {
                    // scrollIntoView({block:'start'}) alinha o topo da linha com o topo do
                    // container — mas o <thead> é sticky e fica por cima dessa mesma faixa, então
                    // "CUSTOS E DESPESAS OPERACIONAIS" ficava escondido atrás dele. Ajusta o
                    // scroll manualmente descontando a altura do cabeçalho, pra ela ficar visível
                    // logo abaixo dele em vez de embaixo.
                    const container = document.getElementById('dre-scroll-container');
                    const target = document.getElementById('dre-row-CST-HEAD');
                    if (container && target) {
                        const headerHeight = container.querySelector('thead')?.getBoundingClientRect().height || 0;
                        const offset = target.getBoundingClientRect().top - container.getBoundingClientRect().top - headerHeight;
                        container.scrollBy({ top: offset, behavior: 'smooth' });
                    }
                }, 50);
                setTimeout(() => setHighlightRowId(prev => (prev === firstAccountRow.id ? null : prev)), 5000);
            }
        } else if (index === 6) {
            // Validar informações — mostra um resumo dos principais indicadores (Prévia/Forecast/
            // Meta/Ano anterior) antes de marcar a etapa como validada.
            setShowValidationSummaryModal(true);
        } else if (index === 7) {
            handleSaveResultsDirectly();
        }
        // Passo 6 (índice 5, despesas da Prévia) não navega — já está nesta mesma tela.
    };

    // "Resetar etapa" — desfaz o que a etapa marca como concluída, pra dar pra refazer do zero.
    const handleOtbStepReset = (index: number) => {
        if (index === 0) {
            if (!setRealOccupancyData) return;
            setRealOccupancyData(prev => {
                const current = { ...(prev[otbContextKey] || {}) };
                delete current['__otb_day'];
                return { ...prev, [otbContextKey]: current };
            });
        } else if (index === 1) {
            // Ocupação On the books — limpa os valores preenchidos, mantendo só as flags internas
            // (que começam com "__", como o dia do OTB) do mesmo bucket.
            if (!setRealOccupancyData) return;
            setRealOccupancyData(prev => {
                const current = prev[otbContextKey] || {};
                const cleaned: Record<string, number> = {};
                Object.keys(current).forEach(k => { if (k.startsWith('__')) cleaned[k] = current[k]; });
                return { ...prev, [otbContextKey]: cleaned };
            });
        } else if (index === 2) {
            onDeleteOtbBalancete?.(selectedHotel || '', selectedYear || 0, selectedMonth || 0, activeRealVersionId || '');
            if (setRealOccupancyData) {
                setRealOccupancyData(prev => {
                    const current = { ...(prev[otbContextKey] || {}) };
                    delete current['__balancete_imposto'];
                    delete current['__balancete_time_share'];
                    delete current['__balancete_iss'];
                    return { ...prev, [otbContextKey]: current };
                });
            }
        } else if (index === 3) {
            // Resetar a ocupação/receita do Forecast invalida qualquer cálculo já feito em cima
            // dela — a flag de "Calcular Forecast" (passo 5) é resetada junto (o próprio popup de
            // confirmação já avisa disso antes de chegar aqui).
            if (!setRealOccupancyData) return;
            const normalKey = `${selectedHotel}_${selectedYear}_${selectedMonth}_${activeRealVersionId || ''}__${activeProjectionType}`;
            setRealOccupancyData(prev => {
                const currentOtb = { ...(prev[otbContextKey] || {}) };
                delete currentOtb['__forecast_calculated'];
                return { ...prev, [normalKey]: {}, [otbContextKey]: currentOtb };
            });
        } else if (index === 4) {
            // Calcular Forecast — zera as despesas de Custos/Contas que foram projetadas por esse
            // cálculo (coluna Forecast), como se o botão nunca tivesse sido clicado.
            setData(prevData => recalculateTotals(prevData.map(row => {
                if ((row.category === 'Costs' || row.category === 'Account') && (row.real || 0) !== 0) {
                    return {
                        ...row,
                        real: 0,
                        isManualOverride: false,
                        forecastConfig: { ...(row.forecastConfig || { method: 'Fixed' as const }), manualValue: 0 }
                    };
                }
                return row;
            }), packages, accounts));
            if (setRealOccupancyData) {
                setRealOccupancyData(prev => {
                    const current = { ...(prev[otbContextKey] || {}) };
                    delete current['__forecast_calculated'];
                    return { ...prev, [otbContextKey]: current };
                });
            }
        } else if (index === 5) {
            // Despesas da Prévia — volta as linhas de Custos/Contas que tinham Prévia preenchida
            // pra zero, como se ainda não tivesse sido preenchida.
            setData(prevData => recalculateTotals(prevData.map(row => {
                if ((row.category === 'Costs' || row.category === 'Account') && (row.previa || 0) !== 0) {
                    return {
                        ...row,
                        previa: 0,
                        isManualPreviaOverride: false,
                        previaConfig: { ...(row.previaConfig || { method: 'Fixed' as const }), manualValue: 0 }
                    };
                }
                return row;
            }), packages, accounts));
        } else if (index === 6) {
            if (!setRealOccupancyData) return;
            setRealOccupancyData(prev => {
                const current = { ...(prev[otbContextKey] || {}) };
                delete current['__validado_manual'];
                return { ...prev, [otbContextKey]: current };
            });
        } else if (index === 7) {
            onResetValidation?.(selectedHotel || '', selectedYear || 0, selectedMonth || 0, activeProjectionType || 'Reunião de Ritmo');
        }
    };

    const handleSaveResultsDirectly = () => {
        setShowConfirmModal(true);
    };

    const confirmSaveResults = async () => {
        setIsSaving(true);

        if ((activeProjectionType === 'Fechamento oficial' || activeProjectionType === 'Realizado') && !hasRole(currentUser, UserRole.ADMIN)) {
            alert('Apenas o ADMIN GERAL pode salvar a versão Fechamento Oficial ou Realizado.');
            return;
        }

        const rowsToSave: { accountName: string; costCenter?: string; value: number; scenario: 'Real' | 'Previa' | 'Meta' }[] = [];
        data.forEach(row => {
            if (row.category === 'Costs' || row.category === 'Account' || row.category === 'Indicators' || row.category === 'Revenue') {
                rowsToSave.push({ accountName: `override_${row.id}`, value: row.real, scenario: 'Real' });
                if (row.previa !== undefined) {
                    rowsToSave.push({ accountName: `override_${row.id}`, value: row.previa, scenario: 'Previa' });
                }
                if (row.budget !== undefined) {
                    rowsToSave.push({ accountName: `override_${row.id}`, value: row.budget, scenario: 'Meta' });
                }
            }
        });

        try {
            const activeHotel = hotels?.find(h => h.id === selectedHotel || h.name === selectedHotel);
            const hName = activeHotel?.name || selectedHotel || '';
            if (hName) {
                await supabaseService.saveForecastProjections(hName, selectedMonth || 1, selectedYear || 2026, activeRealVersionId || 'default', rowsToSave, activeProjectionType);
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

            await supabaseService.saveValidation(newValidation);

            if (setValidations) {
                setValidations(prev => [...prev, newValidation]);
            }
            setForceUnlockValidated(false);

            const notificationMsg = `A unidade ${selectedHotel} salvou os resultados de ${activeProjectionType} para ${monthName}/${selectedYear}. Dados salvos no banco.`;
            console.log('Notification sent to Admin:', notificationMsg);

            setShowDetails(false);
            toast.success((t) => (
                <span>
                    Versão salva!{' '}
                    <button
                        onClick={() => { setShowDetails(true); toast.dismiss(t.id); }}
                        className="underline font-bold"
                    >
                        Clique aqui caso deseje editá-la
                    </button>
                </span>
            ), { duration: 8000 });
        } catch (err) {
            console.error('Failed to save projections:', err);
            toast.error('Ocorreu um erro ao salvar os dados no Supabase. Tente novamente.');
        } finally {
            setIsSaving(false);
            setShowConfirmModal(false);
        }
    };

    const handleCalcularForecast = () => {
        setData(prevData => {
            const newData = prevData.map(row => {
                if (row.isHeader || row.isTotal || row.category === 'Spacer' || row.category === 'Indicators') {
                    return row;
                }
                
                const account = accounts.find(a => a.id === row.id || (a.code && a.code === row.accountCode));

                if (account) {
                    const currentConfig = calculationBase === 'forecast' ? row.forecastConfig : (row.previaConfig || { method: 'Fixed' });
                    // Only a self ÷ denominator formula can be turned into a projection — the
                    // rate itself replicates the Meta's own KPI ratio, but it's reapplied to the
                    // Forecast/Prévia column's OWN indicator value (not Meta's), so the projection
                    // actually varies with whatever occupancy was entered for that column.
                    const selfDenominator = parseSelfRatioDenominator(account.kpiCalculation?.formula, account.name);
                    // Muita conta do Plano de Contas está sem "Tipo de Despesa" salvo (nem
                    // Variável nem Fixo) — a tela de administração já mostra "Fixo" como padrão
                    // visual pra essas, então aqui tratamos qualquer coisa que não seja
                    // explicitamente "Variável" como comportamento Fixo (replica a Meta).
                    const isFixedLike = account.expenseType !== 'Variável';

                    if (account.expenseType === 'Variável' && selfDenominator) {
                        // Looked up directly (not via resolveKpiTerm) so Indicators/Receita Bruta
                        // denominators use their own real Forecast/Prévia value here, instead of
                        // resolveKpiTerm's fallback to Meta for those categories.
                        const denomRow = prevData.find(r => r.label.trim().toLowerCase() === selfDenominator.trim().toLowerCase());
                        const denomMeta = denomRow?.budget || 0;
                        const denomProjected = calculationBase === 'forecast' ? (denomRow?.real || 0) : (denomRow?.previa || 0);
                        const rate = denomMeta !== 0 ? (row.budget || 0) / denomMeta : 0;
                        const projected = rate * denomProjected;

                        const newConfig = { ...currentConfig, method: 'Fixed' as const, manualValue: projected };
                        const updatedRow = {
                            ...row,
                            [calculationBase === 'forecast' ? 'forecastConfig' : 'previaConfig']: newConfig
                        };
                        if (calculationBase === 'forecast') updatedRow.real = projected;
                        else updatedRow.previa = projected;

                        return updatedRow;
                    } else if (isFixedLike && calculationBase === 'forecast') {
                        // Fixed accounts (e explícitas Variável sem driver — não têm proporção
                        // pra projetar) — o Forecast simplesmente replica o que está na Meta.
                        const newConfig = {
                            ...currentConfig,
                            method: 'Fixed' as const,
                            manualValue: row.budget
                        };
                        return {
                            ...row,
                            forecastConfig: newConfig,
                            real: row.budget
                        };
                    } else if (isFixedLike || (account.expenseType === 'Variável' && !selfDenominator)) {
                        // Fixed accounts on the Prévia base, or Variável accounts whose KPI formula
                        // isn't a simple self-referencing ratio, can't be auto-projected — leave for manual entry.
                        const newConfig = {
                            ...currentConfig,
                            method: 'Fixed' as const
                        };
                        return {
                            ...row,
                            [calculationBase === 'forecast' ? 'forecastConfig' : 'previaConfig']: newConfig
                        };
                    }
                }

                return row;
            });
            
            return recalculateTotals(newData, packages, accounts);
        });

        // Marca o passo 6 da timeline OTB como concluído — só um sinalizador (não dá pra inferir
        // "já calculou" a partir dos números, já que um valor calculado e um digitado manualmente
        // ficam idênticos depois).
        if (isMeetingVersion && setRealOccupancyData) {
            setRealOccupancyData(prev => ({
                ...prev,
                [otbContextKey]: { ...(prev[otbContextKey] || {}), '__forecast_calculated': 1 }
            }));
        }

        setShowDetails(true);
        setShowAlertModal(true);
    };

    const visibleBaseCols = 1 + [
        columnVisibility.previa, columnVisibility.real, columnVisibility.budget,
        columnVisibility.deltaPreviaBudget, columnVisibility.deltaPreviaBudgetPct,
        columnVisibility.deltaPreviaForecast, columnVisibility.deltaPreviaForecastPct,
        columnVisibility.lastYear, columnVisibility.deltaLY, columnVisibility.deltaLYPct
    ].filter(Boolean).length;

    return (
        <div className="flex flex-col w-full">
            <VersionInfoBanner versionName={activeRealVersionName} />
            {/* No h-full here: the table renders at its natural full height (no internal
                scrollbar) and the page itself scrolls (via the ancestor <main overflow-auto>
                in App.tsx) to reach the Transformação/Reatividade cards below, instead of the
                table being squeezed to make room for them. */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 flex flex-col overflow-hidden font-sans w-full">
                <div className="px-5 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center shrink-0 gap-8">
                    <div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2 capitalize">
                                Demonstrativo de Resultados (DRE) - {monthName} {selectedYear}
                            </h2>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                            Visão consolidada por plano de contas e gestão matricial ({selectedHotel}).
                        </p>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Versão do Forecast</span>
                            <select
                                value={activeProjectionType || 'Reunião de Ritmo'}
                                onChange={(e) => setActiveProjectionType && setActiveProjectionType(e.target.value as any)}
                                className={`border rounded-md px-2 py-1 text-xs font-bold outline-none ${isMonthClosed ? 'bg-red-50 text-red-700 border-red-200' : 'bg-white border-gray-300 text-gray-700 focus:ring-0 focus:border-indigo-500'}`}
                            >
                                <option value="Reunião de Ritmo">Reunião de Ritmo</option>
                                <option value="FCA N2">FCA N2</option>
                                <option value="FCA N1">FCA N1</option>
                                <option value="Fechamento oficial">Fechamento</option>
                                {hasRole(currentUser, UserRole.ADMIN) && <option value="Realizado">Realizado</option>}
                            </select>
                        </div>
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
                            onClick={() => {
                                if (showDetails) {
                                    setShowDetails(false);
                                    setExpandedPackages(new Set());
                                } else {
                                    setShowDetails(true);
                                    const allPkgIds = new Set(data.filter(r => r.category === 'Package').map(r => r.id));
                                    setExpandedPackages(allPkgIds);
                                }
                            }}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-base font-bold transition-colors border ${!showDetails
                                ? 'bg-indigo-100 text-indigo-700 border-indigo-200'
                                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50 shadow-sm'
                                }`}
                            title={showDetails ? "Ocultar contas contábeis" : "Mostrar contas contábeis"}
                        >
                            {showDetails ? <ListFilter size={20} /> : <LayoutList size={20} />}
                            {showDetails ? 'Ocultar Contas' : 'Mostrar Contas'}
                        </button>

                        {canEditForecast && onNavigateToOccupancy && (
                            <button
                                onClick={handleIniciarProjecao}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-base font-bold transition-colors border bg-white text-gray-600 border-gray-300 hover:bg-gray-50 shadow-sm"
                                title="Ir para a aba Ocupação já filtrada nesta Versão do Forecast"
                            >
                                <TrendingUp size={20} />
                                Iniciar Projeção
                            </button>
                        )}

                        {canEditForecast && (
                            <button
                                onClick={handleCalcularForecast}
                                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shadow-md text-base font-bold"
                            >
                                <Activity size={20} />
                                Calcular Forecast
                            </button>
                        )}

                        {canValidate && (
                            isMonthClosed && isAlreadyValidated && !forceUnlockValidated ? (
                                <button
                                    onClick={() => setForceUnlockValidated(true)}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors shadow-sm text-base font-bold"
                                    title="Clique para reabrir esta versão para edição"
                                >
                                    <Lock size={20} />
                                    Resultados validados (clique aqui caso queira fazer alguma alteração)
                                </button>
                            ) : (
                                <button
                                    onClick={handleSaveResultsDirectly}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-md text-base font-bold"
                                >
                                    <CheckCircle2 size={20} />
                                    {isMonthClosed ? 'Validar fechamento' : 'Salvar Projeção'}
                                </button>
                            )
                        )}
                    </div>
                </div>

                {isMeetingVersion && !!otbDaySaved && (
                    <div className="px-5 py-2 border-b border-gray-200 bg-gray-50/50 shrink-0">
                        <OtbProgressTimeline completed={otbProgress} onStepClick={handleOtbStepClick} onStepReset={handleOtbStepReset} title="Status da prévia" />
                    </div>
                )}

                {/* Bounded height so this box (not the whole page) scrolls internally — that's
                    what lets the sticky <thead> below actually stay pinned while scrolling
                    through rows, no matter how far down (e.g. into Despesas) you are. The
                    Transformação/Reatividade cards sit below this box in normal page flow,
                    still reachable with a simple page scroll. */}
                <div id="dre-scroll-container" className="overflow-auto max-h-[75vh] bg-white relative">
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
                                    ...(isMeetingVersion ? [{ key: 'otb', label: otbColumnLabel }] : []),
                                    { key: 'previa', label: isMonthClosed ? 'Real' : 'Prévia' },
                                    { key: 'real', label: 'Forecast (Real)' },
                                    { key: 'budget', label: 'Meta (Budget)' },
                                    { key: 'deltaPreviaBudget', label: isMonthClosed ? 'Δ Real - Meta R$' : 'Δ Prévia - Meta R$' },
                                    { key: 'deltaPreviaBudgetPct', label: isMonthClosed ? 'Δ Real - Meta %' : 'Δ Prévia - Meta %' },
                                    { key: 'deltaPreviaForecast', label: isMonthClosed ? 'Δ Real - Forecast R$' : 'Δ Prévia - Forecast R$' },
                                    { key: 'deltaPreviaForecastPct', label: isMonthClosed ? 'Δ Real - Forecast %' : 'Δ Prévia - Forecast %' },
                                    { key: 'lastYear', label: 'Ano anterior' },
                                    { key: 'deltaLY', label: `Δ ${selectedYear} x Ano anterior R$` },
                                    { key: 'deltaLYPct', label: `Δ ${selectedYear} x Ano anterior %` },
                                    ...(isMeetingVersion ? [{ key: 'driverOtb', label: 'KPI (OTB)' }] : []),
                                    { key: 'driverPrevia', label: isMonthClosed ? 'Driver (Real)' : 'Driver (Prévia)' },
                                    { key: 'driverForecast', label: 'Driver (Forecast)' },
                                    { key: 'driverBudget', label: 'Driver (Meta)' },
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
                        <thead className="bg-white sticky top-0 z-30 shadow-sm font-bold text-sky-900 uppercase tracking-tight text-sm">
                            <tr>
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

                                {columnVisibility.otb && isMeetingVersion && (
                                    <th
                                        style={{ width: columnWidths.otb }}
                                        className="px-2 py-3 text-center bg-amber-100 text-amber-900 border-b border-amber-200 border-l border-amber-200 group relative"
                                    >
                                        {otbColumnLabel.toUpperCase()}
                                        <div
                                            onMouseDown={(e) => handleResizeStart(e, 'otb')}
                                            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize bg-amber-300 opacity-0 group-hover:opacity-100 transition-opacity z-50"
                                        />
                                    </th>
                                )}

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

                                {columnVisibility.deltaPreviaBudgetPct && (
                                    <th
                                        style={{ width: columnWidths.deltaPreviaBudgetPct }}
                                        className="px-2 py-3 text-center bg-sky-100 text-sky-900 border-b border-sky-200 whitespace-pre-line leading-tight group relative"
                                    >
                                        Δ %<br />{isMonthClosed ? 'REAL' : 'PRÉVIA'} - META
                                        <div
                                            onMouseDown={(e) => handleResizeStart(e, 'deltaPreviaBudgetPct')}
                                            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize bg-sky-300 opacity-0 group-hover:opacity-100 transition-opacity z-50"
                                        />
                                    </th>
                                )}

                                {columnVisibility.deltaPreviaForecast && (
                                    <th
                                        style={{ width: columnWidths.deltaPreviaForecast }}
                                        className="px-2 py-3 text-center bg-sky-100 text-sky-900 border-b border-sky-200 whitespace-pre-line leading-tight group relative"
                                    >
                                        Δ<br />{isMonthClosed ? 'REAL' : 'PRÉVIA'} - Forecast
                                        <div
                                            onMouseDown={(e) => handleResizeStart(e, 'deltaPreviaForecast')}
                                            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize bg-sky-300 opacity-0 group-hover:opacity-100 transition-opacity z-50"
                                        />
                                    </th>
                                )}

                                {columnVisibility.deltaPreviaForecastPct && (
                                    <th
                                        style={{ width: columnWidths.deltaPreviaForecastPct }}
                                        className="px-2 py-3 text-center bg-sky-100 text-sky-900 border-b border-sky-200 border-r border-sky-200 whitespace-pre-line leading-tight group relative"
                                    >
                                        Δ %<br />{isMonthClosed ? 'REAL' : 'PRÉVIA'} - Forecast
                                        <div
                                            onMouseDown={(e) => handleResizeStart(e, 'deltaPreviaForecastPct')}
                                            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize bg-sky-300 opacity-0 group-hover:opacity-100 transition-opacity z-50"
                                        />
                                    </th>
                                )}

                                {columnVisibility.lastYear && (
                                    <th
                                        style={{ width: columnWidths.lastYear }}
                                        className="px-2 py-3 text-center bg-sky-100 text-sky-900 border-b border-sky-200 group relative"
                                    >
                                        Ano anterior
                                        <div
                                            onMouseDown={(e) => handleResizeStart(e, 'lastYear')}
                                            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize bg-sky-300 opacity-0 group-hover:opacity-100 transition-opacity z-50"
                                        />
                                    </th>
                                )}

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

                                {(columnVisibility.driverOtb || columnVisibility.driverPrevia || columnVisibility.driverForecast || columnVisibility.driverBudget) && (
                                    <th className="w-4 bg-white p-0 relative" style={{ borderStyle: 'hidden' }}></th>
                                )}

                                {columnVisibility.driverOtb && isMeetingVersion && (
                                    <th
                                        style={{ width: columnWidths.driverOtb }}
                                        className="px-2 py-3 text-center bg-amber-50 text-amber-900 border-b border-amber-200 border-l border-amber-200 group relative text-xs"
                                    >
                                        KPI<br />(OTB)
                                        <div
                                            onMouseDown={(e) => handleResizeStart(e, 'driverOtb')}
                                            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize bg-amber-300 opacity-0 group-hover:opacity-100 transition-opacity z-50"
                                        />
                                    </th>
                                )}

                                {columnVisibility.driverPrevia && (
                                    <th
                                        style={{ width: columnWidths.driverPrevia }}
                                        className="px-2 py-3 text-center bg-slate-50 text-slate-700 border-b border-slate-200 border-l border-slate-200 group relative text-xs"
                                    >
                                        KPI<br />({isMonthClosed ? 'REAL' : 'PRÉVIA'})
                                        <div
                                            onMouseDown={(e) => handleResizeStart(e, 'driverPrevia')}
                                            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize bg-slate-300 opacity-0 group-hover:opacity-100 transition-opacity z-50"
                                        />
                                    </th>
                                )}

                                {columnVisibility.driverForecast && (
                                    <th
                                        style={{ width: columnWidths.driverForecast }}
                                        className="px-2 py-3 text-center bg-slate-50 text-slate-700 border-b border-slate-200 group relative text-xs"
                                    >
                                        KPI<br />(FORECAST)
                                        <div
                                            onMouseDown={(e) => handleResizeStart(e, 'driverForecast')}
                                            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize bg-slate-300 opacity-0 group-hover:opacity-100 transition-opacity z-50"
                                        />
                                    </th>
                                )}

                                {columnVisibility.driverBudget && (
                                    <th
                                        style={{ width: columnWidths.driverBudget }}
                                        className="px-2 py-3 text-center bg-slate-50 text-slate-700 border-b border-slate-200 border-r border-slate-200 group relative text-xs"
                                    >
                                        KPI<br />(META)
                                        <div
                                            onMouseDown={(e) => handleResizeStart(e, 'driverBudget')}
                                            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize bg-slate-300 opacity-0 group-hover:opacity-100 transition-opacity z-50"
                                        />
                                    </th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {visibleData.map((row, idx) => {

                                if (row.category === 'Spacer') {
                                    return (
                                        <tr key={row.id} className="bg-transparent border-none">
                                            <td colSpan={visibleBaseCols} className="h-6 bg-white"></td>
                                            {(columnVisibility.driverOtb || columnVisibility.driverPrevia || columnVisibility.driverForecast || columnVisibility.driverBudget) && (
                                                <td className="w-4 bg-white p-0 relative" style={{ borderStyle: 'hidden' }}></td>
                                            )}
                                            {columnVisibility.driverOtb && isMeetingVersion && <td className="bg-white" style={{ borderStyle: 'hidden' }}></td>}
                                            {columnVisibility.driverPrevia && <td className="bg-white" style={{ borderStyle: 'hidden' }}></td>}
                                            {columnVisibility.driverForecast && <td className="bg-white" style={{ borderStyle: 'hidden' }}></td>}
                                            {columnVisibility.driverBudget && <td className="bg-white" style={{ borderStyle: 'hidden' }}></td>}
                                        </tr>
                                    );
                                }

                                const isIndicator = row.category === 'Indicators';
                                const isSectionHeader = row.isHeader && row.indentLevel === 0;
                                const isGroupHeader = row.isHeader && row.indentLevel === 1;
                                const isSubGroupHeader = row.isHeader && row.indentLevel === 2;
                                const isTotal = row.isTotal;
                                const isBlueHighlight = blueRowIds.includes(row.id);
                                const isSpecialRevenue = ['REV-HOSP', 'REV-EXTRA', 'REV-ISS', 'REV-APT', 'REV-TIME'].includes(row.id);
                                const formatType = row.rowConfig?.format || 'currency';
                                const isPercentFormatRow = formatType === 'percent';

                                // GOP R$ (com/sem impostos) always show KPI = GOP ÷ UH Disponível, even though
                                // they're otherwise blue/total rows with KPIs hidden. GOP % rows stay blank.
                                const isGopRsRow = row.id === 'RES-OP-COM-IMP' || row.id === 'RES-OP-SEM-IMP';
                                // Impostos ("% de imposto sobre a receita" = Imposto ÷ Receita Bruta Total) also
                                // carries a KPI even though it's a blue/total row — same exception as the GOP rows.
                                const isImpostoKpiRow = row.id === 'REV-IMP';
                                // Receitas Extras (Lazer/Eventos, and their "Receitas Extras" parent total) also
                                // carry a KPI even though category 'Revenue' normally hides it — precomputed in
                                // mockData.ts as Receita ÷ PAX do segmento (see rowConfig.precomputedKpi).
                                const precomputedKpi = row.rowConfig?.precomputedKpi;
                                const hideKpi = (!isGopRsRow && !isImpostoKpiRow && (isSectionHeader || isBlueHighlight || isTotal)) || row.category === 'Indicators' || (row.category === 'Revenue' && !precomputedKpi && !isImpostoKpiRow);
                                // In the KPI columns, the only borders shown are top/bottom on every package
                                // row and on "Custos e Despesas Operacionais" — everywhere else stays borderless.
                                // The table uses border-collapse, where a wider border always wins the conflict
                                // resolution regardless of which element declared it — so a plain 0-width border
                                // on the cell can't suppress the row's own border. `border-style: hidden` is the
                                // one declaration that always wins in that algorithm, guaranteeing no border shows.
                                const showsKpiBorder = row.category === 'Package' || row.id === 'CST-HEAD';
                                const kpiBorderClass = showsKpiBorder ? 'border-y border-gray-200' : '';
                                const kpiBorderStyle: React.CSSProperties = showsKpiBorder ? {} : { borderStyle: 'hidden' };
                                const accountKpiCalc = (row.category === 'Costs' || row.category === 'Account') && row.rowConfig?.expenseType === 'Variável' ? row.rowConfig?.kpiCalculation : undefined;
                                const packageKpiCalc = !hideKpi && row.category === 'Package' ? packageKpiConfigs[row.label.trim()] : undefined;
                                const gopKpiCalc: KpiCalculation | undefined = isGopRsRow ? { formula: `@[${row.label}] / @[UH Disponível]`, format: 'number' } : undefined;
                                const impostoKpiCalc: KpiCalculation | undefined = isImpostoKpiRow ? row.rowConfig?.kpiCalculation : undefined;
                                const rowKpiCalc = accountKpiCalc || packageKpiCalc || gopKpiCalc || impostoKpiCalc;
                                const hasKpi = !!(rowKpiCalc || precomputedKpi);
                                const kpiFormatType = precomputedKpi ? precomputedKpi.format : (rowKpiCalc?.format === 'percent' ? 'percent' : 'decimal');
                                const kpiValue = (field: 'previa' | 'real' | 'budget' | 'otb') => {
                                    if (precomputedKpi) return precomputedKpi[field] || 0;
                                    const raw = evaluateKpiCalculation(rowKpiCalc, data, field);
                                    return rowKpiCalc?.format === 'percent' ? raw * 100 : raw;
                                };
                                const kpiFormulaTooltip = precomputedKpi
                                    ? 'Receita ÷ PAX do segmento'
                                    : (rowKpiCalc ? formatKpiFormulaForDisplay(rowKpiCalc.formula) : undefined);

                                // The KPI can be typed directly (to adjust the underlying result) only when
                                // its formula is a simple self ÷ denominator ratio — the same shape "Calcular
                                // Forecast" already knows how to project, so it's cleanly invertible.
                                const kpiSelfDenominator = accountKpiCalc
                                    ? parseSelfRatioDenominator(accountKpiCalc.formula, row.label)
                                    : (impostoKpiCalc ? parseSelfRatioDenominator(impostoKpiCalc.formula, row.label) : null);
                                const isEditableKpi = !!kpiSelfDenominator && canEditForecast && !isLocked && isRowEditableForUser(row);
                                // Receitas Extras (Lazer/Eventos) KPI Prévia is also invertible (Receita ÷ PAX,
                                // with PAX carried in precomputedKpi.denominator) — but only the Prévia column,
                                // not Forecast, is meant to be editable here.
                                const isEditableKpiPrevia = (isEditableKpi || (!!precomputedKpi?.denominator && canEditForecast && !isLocked && isRowEditableForUser(row)));

                                const renderFinancialCells = (isHeaderOrTotal = false, customBg = "") => {
                                    const effectiveBg = row.bgColor || (isBlueHighlight ? 'bg-sky-100 border-sky-200' : (customBg || 'bg-blue-50/20 border-r border-blue-50'));
                                    const effectiveText = row.textColor || (isBlueHighlight ? 'text-sky-900' : (isHeaderOrTotal ? 'text-black' : 'text-slate-800'));
                                    const previaBg = isBlueHighlight ? 'bg-sky-100 text-sky-800' : 'bg-purple-50/20 text-slate-500';
                                    const textStyle = {
                                        color: row.textColor || undefined,
                                        fontWeight: row.isBold || isHeaderOrTotal ? 'bold' : 'normal',
                                        fontStyle: row.isItalic ? 'italic' : 'normal'
                                    };

                                    let realCellContent: React.ReactNode = formatValue(row.real, formatType);
                                    let previaCellContent: React.ReactNode = formatValue(row.previa, formatType);

                                    const isManualRow = ['IND-MO-2', 'IND-MO-3'].includes(row.id);
                                    const isEditableCost = row.category === 'Costs' || row.category === 'Revenue';
                                    const isEditableSpecial = isSpecialEditableRow(row.id);

                                    const isRowEditable = isRowEditableForUser(row);
                                    const isVariableExpense = row.category === 'Costs' && row.rowConfig?.expenseType === 'Variável';

                                    if (canEditForecast && isRowEditable && !isIndicator && row.category !== 'Labor' && (!isHeaderOrTotal || isEditableCost || isEditableSpecial)) {
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
                                    } else if (isIndicator) {
                                        const isInputIndicator = ['IND-1', 'IND-2', 'IND-ADULTOS', 'IND-CHD', 'IND-LZ-2', 'IND-LZ-4', 'IND-LZ-5', 'IND-EV-2', 'IND-EV-4', 'IND-EV-5'].includes(row.id);
                                        const canEditIndicator = hasRole(currentUser, UserRole.ADMIN) || hasRole(currentUser, UserRole.ENTITY_MANAGER) || hasRole(currentUser, UserRole.COST_ANALYST);

                                        if (canEditIndicator && (isInputIndicator || isManualRow) && !isLocked) {
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
                                        } else if ((isInputIndicator || isManualRow) && (isLocked || !canEditForecast)) {
                                            realCellContent = <span className="font-medium">{formatValue(row.real, formatType)}</span>;
                                            previaCellContent = <span className="font-medium">{formatValue(row.previa, formatType)}</span>;
                                        }
                                    }

                                    const previaLYVal = (row.previa || 0) - (row.lastYear || 0);
                                    const previaLYPct = row.lastYear && row.lastYear !== 0
                                        ? (previaLYVal / row.lastYear) * 100
                                        : 0;

                                    const previaLYColor = getDeltaColorClass(row, previaLYPct);
                                    const previaLYValColor = getDeltaColorClass(row, previaLYVal);

                                    return (
                                        <>
                                            {columnVisibility.otb && isMeetingVersion && (
                                                <td style={textStyle} className="px-2 py-1 text-right border-r border-gray-100 tabular-nums bg-amber-50/30 truncate">
                                                    {row.otb !== undefined ? formatValue(row.otb, formatType) : '-'}
                                                </td>
                                            )}
                                            {columnVisibility.previa && (
                                                <td style={textStyle} className={`px-2 py-1 text-right border-r border-gray-100 tabular-nums truncate ${row.id === highlightRowId ? 'bg-amber-200 ring-2 ring-inset ring-amber-500 animate-pulse' : previaBg}`}>
                                                    {previaCellContent}
                                                </td>
                                            )}

                                            {columnVisibility.real && (
                                                <td style={textStyle} className={`px-2 py-1 text-right border-l border-gray-200 tabular-nums ${effectiveText} ${effectiveBg} truncate`}>
                                                    {realCellContent}
                                                </td>
                                            )}

                                            {columnVisibility.budget && (
                                                <td style={textStyle} className={`px-2 py-1 text-right border-r border-gray-100 tabular-nums ${isBlueHighlight ? 'text-sky-900' : 'text-slate-500'} truncate`}>
                                                    {formatValue(row.budget, formatType)}
                                                </td>
                                            )}

                                            {columnVisibility.deltaPreviaBudget && (
                                                <td className={`px-2 py-1 text-right border-r border-gray-100 tabular-nums font-medium ${getDeltaColorClass(row, row.deltaPreviaBudgetVal)} truncate`}>
                                                    {formatValue(row.deltaPreviaBudgetVal || 0, (isIndicator || row.category === 'Labor') && formatType !== 'percent' ? formatType : 'currency')}
                                                </td>
                                            )}

                                            {columnVisibility.deltaPreviaBudgetPct && (
                                                <td className={`px-2 py-1 text-right tabular-nums ${getDeltaColorClass(row, row.deltaPreviaBudgetPct)} truncate`}>
                                                    {isPercentFormatRow ? formatPointsDiff(row.deltaPreviaBudgetVal) : formatPercentDiff(row.deltaPreviaBudgetPct)}
                                                </td>
                                            )}

                                            {columnVisibility.deltaPreviaForecast && (
                                                <td className={`px-2 py-1 text-right border-r border-gray-100 tabular-nums font-medium ${getDeltaColorClass(row, row.deltaPreviaForecastVal)} truncate`}>
                                                    {formatValue(row.deltaPreviaForecastVal || 0, (isIndicator || row.category === 'Labor') && formatType !== 'percent' ? formatType : 'currency')}
                                                </td>
                                            )}

                                            {columnVisibility.deltaPreviaForecastPct && (
                                                <td className={`px-2 py-1 text-right border-r border-gray-200 tabular-nums ${getDeltaColorClass(row, row.deltaPreviaForecastPct)} truncate`}>
                                                    {isPercentFormatRow ? formatPointsDiff(row.deltaPreviaForecastVal) : formatPercentDiff(row.deltaPreviaForecastPct)}
                                                </td>
                                            )}

                                            {columnVisibility.lastYear && (
                                                <td style={textStyle} className={`px-2 py-1 text-right tabular-nums border-r border-gray-100 truncate ${isBlueHighlight ? 'bg-sky-100 text-sky-900' : 'bg-orange-50/20 text-slate-500'}`}>
                                                    {formatValue(row.lastYear, formatType)}
                                                </td>
                                            )}

                                            {columnVisibility.deltaLY && (
                                                <td className={`px-2 py-1 text-right border-r border-gray-100 tabular-nums font-medium ${previaLYValColor} truncate`}>
                                                    {formatValue(previaLYVal, (isIndicator || row.category === 'Labor') && formatType !== 'percent' ? formatType : 'currency')}
                                                </td>
                                            )}

                                            {columnVisibility.deltaLYPct && (
                                                <td className={`px-2 py-1 text-right tabular-nums ${previaLYColor} ${isBlueHighlight ? 'bg-sky-100' : 'bg-orange-50/10'} truncate`}>
                                                    {isPercentFormatRow ? formatPointsDiff(previaLYVal) : formatPercentDiff(previaLYPct)}
                                                </td>
                                            )}

                                            {(columnVisibility.driverOtb || columnVisibility.driverPrevia || columnVisibility.driverForecast || columnVisibility.driverBudget) && (
                                                <td className="w-4 bg-white p-0 relative" style={{ borderStyle: 'hidden' }}></td>
                                            )}

                                            {columnVisibility.driverOtb && isMeetingVersion && (
                                                <td
                                                    title={!hideKpi ? kpiFormulaTooltip : undefined}
                                                    style={kpiBorderStyle}
                                                    className={`px-1 text-center tabular-nums text-xs truncate ${kpiBorderClass} ${hideKpi || !hasKpi ? 'bg-white text-transparent' : 'text-amber-700 bg-amber-50/40 cursor-help'}`}>
                                                    {!hideKpi && hasKpi ? formatValue(kpiValue('otb'), kpiFormatType) : ''}
                                                </td>
                                            )}

                                            {columnVisibility.driverPrevia && (
                                                <td
                                                    title={!hideKpi ? kpiFormulaTooltip : undefined}
                                                    style={kpiBorderStyle}
                                                    className={`px-1 text-center tabular-nums text-xs truncate ${kpiBorderClass} ${hideKpi || !hasKpi ? 'bg-white text-transparent' : 'text-slate-500 bg-slate-50 cursor-help'}`}>
                                                    {!hideKpi && hasKpi
                                                        ? (isEditableKpiPrevia ? (
                                                            <FormattedInput
                                                                inputRef={(el: any) => { inputRefs.current[`input-kpi-previa-${row.id}`] = el; }}
                                                                className="w-full text-center bg-transparent border border-transparent hover:bg-white focus:bg-white focus:border-indigo-300 focus:ring-1 focus:ring-indigo-100 rounded outline-none py-1"
                                                                value={kpiValue('previa')}
                                                                formatType={kpiFormatType}
                                                                onChange={(val: number) => handleKpiValueChange(row.id, 'previa', val)}
                                                                onKeyDown={(e: any) => handleKeyDown(e, row.id, 'kpi-previa')}
                                                            />
                                                        ) : formatValue(kpiValue('previa'), kpiFormatType))
                                                        : ''}
                                                </td>
                                            )}

                                            {columnVisibility.driverForecast && (
                                                <td
                                                    title={!hideKpi ? kpiFormulaTooltip : undefined}
                                                    style={kpiBorderStyle}
                                                    className={`px-1 text-center tabular-nums text-xs truncate ${kpiBorderClass} ${hideKpi || !hasKpi ? 'bg-white text-transparent' : 'text-slate-500 bg-slate-50 cursor-help'}`}>
                                                    {!hideKpi && hasKpi
                                                        ? (isEditableKpi ? (
                                                            <FormattedInput
                                                                inputRef={(el: any) => { inputRefs.current[`input-kpi-forecast-${row.id}`] = el; }}
                                                                className="w-full text-center bg-transparent border border-transparent hover:bg-white focus:bg-white focus:border-indigo-300 focus:ring-1 focus:ring-indigo-100 rounded outline-none py-1"
                                                                value={kpiValue('real')}
                                                                formatType={kpiFormatType}
                                                                onChange={(val: number) => handleKpiValueChange(row.id, 'real', val)}
                                                                onKeyDown={(e: any) => handleKeyDown(e, row.id, 'kpi-forecast')}
                                                            />
                                                        ) : formatValue(kpiValue('real'), kpiFormatType))
                                                        : ''}
                                                </td>
                                            )}

                                            {columnVisibility.driverBudget && (
                                                <td
                                                    title={!hideKpi ? kpiFormulaTooltip : undefined}
                                                    style={kpiBorderStyle}
                                                    className={`px-2 py-1 text-center tabular-nums text-xs truncate ${kpiBorderClass} ${hideKpi || !hasKpi ? 'bg-white text-transparent' : 'text-slate-500 bg-slate-50 cursor-help'}`}>
                                                    {!hideKpi && hasKpi ? formatValue(kpiValue('budget'), kpiFormatType) : ''}
                                                </td>
                                            )}
                                        </>
                                    );
                                };

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

                                if (isSectionHeader) {
                                    const rowClass = isBlueHighlight
                                        ? "bg-sky-100 hover:bg-sky-200 transition-colors border-y border-sky-200"
                                        : "bg-slate-100 hover:bg-slate-200 transition-colors border-y border-slate-200";
                                    const stickyClass = isBlueHighlight ? "bg-sky-100 border-r border-sky-200" : "bg-slate-100 border-r border-slate-300";
                                    const textClass = isBlueHighlight ? "text-sky-900" : "text-slate-800";

                                    return (
                                        <tr key={row.id} id={`dre-row-${row.id}`} className={rowClass}>
                                            <td className={`px-2 py-3 text-sm font-bold ${textClass} uppercase tracking-wide flex items-center truncate sticky left-0 z-20 ${stickyClass}`}>
                                                {!isBlueHighlight && <div className="w-1 h-4 bg-indigo-500 mr-2 rounded-full"></div>}
                                                {row.label}
                                            </td>
                                            {renderFinancialCells(true)}
                                        </tr>
                                    );
                                }

                                if (isGroupHeader || isSpecialRevenue) {
                                    return (
                                        <tr key={row.id} className="bg-gray-50 text-gray-800 font-bold border-b border-gray-200 hover:bg-gray-100 transition-colors">
                                            <td className="px-2 py-2 text-sm uppercase align-middle border-r border-gray-200 sticky left-0 z-20 bg-gray-50">
                                                <div style={{ paddingLeft: `${(row.indentLevel || 0) * 16}px` }} className="truncate flex items-center gap-2">
                                                    {row.category === 'Package' && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); togglePackage(row.id); }}
                                                            className="text-gray-500 hover:text-indigo-600 focus:outline-none flex-shrink-0"
                                                        >
                                                            {expandedPackages.has(row.id) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                                        </button>
                                                    )}
                                                    {row.label}
                                                </div>
                                            </td>
                                            {renderFinancialCells(true, "bg-gray-50 border-r border-gray-200")}
                                        </tr>
                                    );
                                }

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
                                        id={`dre-row-${row.id}`}
                                        style={{ backgroundColor: row.bgColor || undefined }}
                                        className={`transition-colors text-slate-700 hover:bg-indigo-50/30 ${isTotal ? 'bg-indigo-50 font-bold border-y-2 border-gray-300 text-indigo-900' : 'border-b border-gray-100'} ${row.id === 'REV-IMP' ? 'bg-sky-100 border-y-2 border-sky-300 font-bold text-sky-950 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.5)]' : ''}`}
                                    >
                                        <td
                                            style={rowTextStyle}
                                            className={`px-2 py-1 border-r border-gray-100 align-middle sticky left-0 z-20 ${row.id === 'REV-IMP' ? 'bg-sky-100' : 'bg-white'} group-hover:bg-indigo-50/30 ${isTotal ? 'bg-indigo-50' : ''}`}
                                        >
                                            <div
                                                style={{ paddingLeft: `${(row.indentLevel || 0) * 16 + 12}px` }}
                                                className={`truncate text-xs ${isTotal ? 'uppercase tracking-wide' : ''}`}
                                                title={
                                                    row.id === 'REV-EXTRA-OR'
                                                        ? 'OR = Outras Receitas. Linha utilizada para inserir a diferença de receita extra da USALI com a ferramenta de receitas extras que pode ter algumas correções gerenciais.'
                                                        : row.id === 'REV-APT-OR'
                                                        ? 'OR = Outras Receitas. Linha utilizada para inserir a diferença de receita de hospedagem entre o Consolidado e a planilha Meta x Realizado da equipe de Inteligência de Mercado, já que podem ter alguns ajustes gerenciais que não refletem no Consolidado.'
                                                        : undefined
                                                }
                                            >
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

            {/* ====== CARDS: TRANSFORMAÇÃO / REATIVIDADE ====== */}
            {(() => {
                const revTotalRow = data.find(r => r.id === 'REV-TOTAL');
                const kpiBudgetRow = data.find(r => r.id === 'KPI-TRANS-BUDGET');
                const kpiLYRow = data.find(r => r.id === 'KPI-TRANS-LY');
                const kpiMetaLYRow = data.find(r => r.id === 'KPI-TRANS-M-LY');
                const kpiBudgetSemRow = data.find(r => r.id === 'KPI-TRANS-BUDGET-SEM');
                const kpiLYSemRow = data.find(r => r.id === 'KPI-TRANS-LY-SEM');
                const kpiMetaLYSemRow = data.find(r => r.id === 'KPI-TRANS-M-LY-SEM');
                if (!revTotalRow || !kpiBudgetRow || !kpiLYRow || !kpiMetaLYRow || !kpiBudgetSemRow || !kpiLYSemRow || !kpiMetaLYSemRow) return null;

                const yy = String(selectedYear || new Date().getFullYear()).slice(-2);
                const yyLY = String((selectedYear || new Date().getFullYear()) - 1).slice(-2);

                const revPrevia = revTotalRow.previa || 0;
                const groups = [
                    {
                        label: 'GOP com dedução de impostos',
                        cards: [
                            { title: `R${yy} x M${yy}`, currentRev: revPrevia, baseRev: revTotalRow.budget, value: kpiBudgetRow.real },
                            { title: `R${yy} x R${yyLY}`, currentRev: revPrevia, baseRev: revTotalRow.lastYear, value: kpiLYRow.real },
                            { title: `M${yy} x R${yyLY}`, currentRev: revTotalRow.budget, baseRev: revTotalRow.lastYear, value: kpiMetaLYRow.real },
                        ]
                    },
                    {
                        label: 'GOP sem dedução de impostos',
                        cards: [
                            { title: `R${yy} x M${yy}`, currentRev: revPrevia, baseRev: revTotalRow.budget, value: kpiBudgetSemRow.real },
                            { title: `R${yy} x R${yyLY}`, currentRev: revPrevia, baseRev: revTotalRow.lastYear, value: kpiLYSemRow.real },
                            { title: `M${yy} x R${yyLY}`, currentRev: revTotalRow.budget, baseRev: revTotalRow.lastYear, value: kpiMetaLYSemRow.real },
                        ]
                    }
                ];

                return (
                    <div className="flex flex-col gap-4 mt-4 shrink-0">
                        {groups.map(group => (
                            <div key={group.label}>
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{group.label}</p>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {group.cards.map(card => {
                                        // Transformação quando a receita do período à esquerda cresceu em
                                        // relação ao da direita; Reatividade quando encolheu (ver computeTransReat).
                                        const isTransformation = (card.currentRev - card.baseRev) >= 0;
                                        const kindLabel = isTransformation ? 'Transformação' : 'Reatividade';
                                        return (
                                            <div
                                                key={card.title}
                                                className={`flex items-center gap-3 p-4 rounded-xl border shadow-sm ${isTransformation ? 'bg-emerald-50 border-emerald-100' : 'bg-blue-50 border-blue-100'}`}
                                            >
                                                <div className={`p-2 rounded-full shrink-0 ${isTransformation ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
                                                    {isTransformation ? <TrendingUp size={20} /> : <Activity size={20} />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className={`text-sm font-bold truncate ${isTransformation ? 'text-emerald-800' : 'text-blue-800'}`}>
                                                        {kindLabel} ({card.title})
                                                    </h4>
                                                    <p className="text-xs text-gray-500">Indicador de eficiência operacional sobre variação de receita.</p>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <span className={`text-xl font-bold ${isTransformation ? 'text-emerald-700' : 'text-blue-700'}`}>
                                                        {formatValue(card.value, 'percent')}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                );
            })()}

            {/* ====== MODAL: IMPORTAR DO EXCEL ====== */}
            {showImportModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
                        {/* Header */}
                        <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-emerald-50">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                                    <FileSpreadsheet size={22} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-emerald-900">Importar do Excel</h2>
                                    <p className="text-sm text-emerald-700">Cole os dados copiados da planilha abaixo (Ctrl+V)</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowImportModal(false)}
                                className="text-emerald-400 hover:text-emerald-600 transition-colors p-2 hover:bg-emerald-100 rounded-full"
                            >
                                <X size={22} />
                            </button>
                        </div>

                        {/* Template hint + Collapsible lines list */}
                        <div className="px-6 pt-4 pb-2 space-y-3">
                            {/* Format example */}
                            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-800 font-mono leading-relaxed">
                                <span className="font-bold text-blue-900 block mb-1">Formato esperado (colunas separadas por Tab):</span>
                                Descrição{"\t"}Prévia{"\t"}Forecast{"\t"}Meta{"\t"}Ano anterior<br />
                                UH Disponível{"\t"}100{"\t"}110{"\t"}105{"\t"}95<br />
                                UH Ocupada{"\t"}75{"\t"}80{"\t"}78{"\t"}70<br />
                                <span className="text-blue-500 italic">... (outras linhas)</span>
                            </div>

                            {/* Collapsible: lines that can be imported */}
                            <div className="border border-emerald-200 rounded-xl overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => setShowImportLines(v => !v)}
                                    className="w-full flex items-center justify-between px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 transition-colors text-emerald-800 font-semibold text-xs"
                                >
                                    <span className="flex items-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
                                        Ver linhas que podem ser importadas
                                    </span>
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
                                        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                                        className={`transition-transform duration-200 ${showImportLines ? 'rotate-180' : ''}`}
                                    >
                                        <polyline points="6 9 12 15 18 9" />
                                    </svg>
                                </button>

                                {showImportLines && (
                                    <div className="bg-white px-4 py-3 max-h-64 overflow-y-auto">
                                        <p className="text-xs text-gray-500 mb-3">A primeira coluna da planilha deve conter exatamente um dos nomes abaixo:</p>

                                        {/* Indicadores */}
                                        <div className="mb-3">
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-sky-600 bg-sky-50 px-2 py-0.5 rounded-md block mb-1.5">📊 Indicadores</span>
                                            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                                                {[
                                                    'UH Disponível',
                                                    'UH Ocupada',
                                                    'Adultos',
                                                    'CHD',
                                                ].map(l => (
                                                    <span key={l} className="text-xs font-mono text-gray-700 py-0.5 border-b border-gray-50">{l}</span>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Receita */}
                                        <div className="mb-3">
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md block mb-1.5">💰 Receita</span>
                                            <div className="grid grid-cols-1 gap-y-0.5">
                                                {[
                                                    'Receita de Apartamentos (Lazer)',
                                                    'Receita de Apartamentos (Eventos)',
                                                    'Receitas Extras (Lazer)',
                                                    'Receitas Extras (Eventos)',
                                                    'Cancelamento de Time Share',
                                                    'Receita de ISS',
                                                    'Impostos',
                                                ].map(l => (
                                                    <span key={l} className="text-xs font-mono text-gray-700 py-0.5 border-b border-gray-50">{l}</span>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Custos */}
                                        <div className="mb-3">
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md block mb-1.5">🏷️ Custos</span>
                                            <div className="grid grid-cols-1 gap-y-0.5">
                                                {[
                                                    'Custo de Alimentos',
                                                    'Custo de Bebidas',
                                                    'Custo de Produtos Diversos',
                                                    'Custo de Outras Receitas',
                                                ].map(l => (
                                                    <span key={l} className="text-xs font-mono text-gray-700 py-0.5 border-b border-gray-50">{l}</span>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Despesas */}
                                        <div>
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-orange-600 bg-orange-50 px-2 py-0.5 rounded-md block mb-1.5">📋 Despesas</span>
                                            <div className="grid grid-cols-1 gap-y-0.5">
                                                {[
                                                    'Despesas Administrativas',
                                                    'Despesas Administrativas Gerais',
                                                    'Processamentos de Dados e TI (TI)',
                                                    'Processamentos de Dados e TI (Martech)',
                                                    'Processamentos de Dados e TI (Outros Setores)',
                                                    'Beneficios aos Colaboradores',
                                                    'Despesas com Pessoal',
                                                    'Encargos Sociais',
                                                    'Serviços de Terceiros',
                                                    'Servicos de Terceiros Temporarios',
                                                    'Serviço de Terceiros Recorrente',
                                                    'Serviços Contratados de Prestadores PJ - MEI',
                                                    'Despesas com Vendas e Marketing',
                                                    'Martech',
                                                    'Marketing',
                                                    'Outros setores',
                                                    'Despesas Financeiras e Bancárias',
                                                    'Despesas com Conservação e Limpeza',
                                                    'Despesas com Manutenção',
                                                    'Despesas com Serviços Públicos',
                                                    'Despesas Operacionais',
                                                    'Arrendamento',
                                                    'Despesa Tributaria',
                                                    'Outros Impostos',
                                                    'Provisões Gerais',
                                                    'Provisao de Servicos de Terceiros Temporarios',
                                                    'Outras Provisões',
                                                ].map(l => (
                                                    <span key={l} className="text-xs font-mono text-gray-700 py-0.5 border-b border-gray-50">{l}</span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Textarea */}
                        <div className="flex-1 overflow-y-auto px-6 py-3">
                            <label className="block text-xs font-bold text-gray-700 mb-1.5">Dados copiados do Excel:</label>
                            <textarea
                                className="w-full border border-gray-300 rounded-xl p-3 text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none bg-gray-50"
                                rows={14}
                                placeholder={`Copie as células do Excel (incluindo a linha de cabeçalho) e cole aqui...\n\nDescriçãoTABPréviaForecastMetaLast Year\nUH Disponível\t100\t110\t105\t95\nUH Ocupada\t75\t80\t78\t70`}
                                value={importText}
                                onChange={e => { setImportText(e.target.value); setImportResult(null); }}
                                onPaste={e => {
                                    // Allow default paste, clear result
                                    setImportResult(null);
                                }}
                                autoFocus
                            />
                        </div>

                        {/* Result feedback */}
                        {importResult && (
                            <div className="px-6 pb-3">
                                <div className={`rounded-lg p-3 flex items-start gap-3 text-sm ${importResult.success > 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'
                                    }`}>
                                    {importResult.success > 0
                                        ? <CheckCircle size={18} className="text-emerald-600 mt-0.5 shrink-0" />
                                        : <AlertCircle size={18} className="text-amber-600 mt-0.5 shrink-0" />
                                    }
                                    <div>
                                        <span className={`font-bold ${importResult.success > 0 ? 'text-emerald-800' : 'text-amber-800'}`}>
                                            {importResult.success > 0
                                                ? `${importResult.success} linha(s) importada(s) com sucesso!`
                                                : 'Nenhuma linha reconhecida.'}
                                        </span>
                                        {importResult.skipped.length > 0 && (
                                            <p className="text-xs text-gray-500 mt-1">
                                                Não reconhecidas: {importResult.skipped.join(', ')}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Footer */}
                        <div className="p-5 border-t border-gray-100 bg-white flex justify-end gap-3">
                            <button
                                onClick={() => setShowImportModal(false)}
                                className="px-5 py-2.5 text-gray-600 font-bold hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => {
                                    const lines = importText.split(/\r?\n/).filter(l => l.trim());
                                    if (lines.length < 2) {
                                        setImportResult({ success: 0, skipped: ['Nenhum dado encontrado'] });
                                        return;
                                    }

                                    // Detect header row (skip it)
                                    const firstLower = lines[0].toLowerCase();
                                    const dataLines = (
                                        firstLower.includes('descri') ||
                                        firstLower.includes('previa') ||
                                        firstLower.includes('prévia') ||
                                        firstLower.includes('forecast')
                                    ) ? lines.slice(1) : lines;

                                    const success: string[] = [];
                                    const skipped: string[] = [];

                                    // Helper: strip accents for fuzzy matching
                                    const stripAccents = (s: string) =>
                                        s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

                                    // ─── Work with a SYNCHRONOUS snapshot of current data ───
                                    // (fixes React setState-updater timing bug: success/skipped
                                    //  were populated inside the lazy updater, already empty
                                    //  when setImportResult ran right after setData())
                                    const newData = data.map(r => ({ ...r, forecastConfig: { ...r.forecastConfig }, previaConfig: r.previaConfig ? { ...r.previaConfig } : undefined }));
                                    
                                    // Filter to only map to non-header accounts or specifically editable revenue headers
                                    const importableRows = newData.filter(r => !r.isHeader || isSpecialEditableRow(r.id) || r.category === 'Indicators');
                                    
                                    const labelMap = new Map(importableRows.map(r => [r.label.trim().toLowerCase(), r]));
                                    const labelMapNA = new Map(importableRows.map(r => [stripAccents(r.label.trim().toLowerCase()), r]));
                                    // Accent-stripped version of IMPORT_LABEL_MAP keys
                                    const importMapNA: Record<string, string> = {};
                                    Object.entries(IMPORT_LABEL_MAP).forEach(([k, v]) => { importMapNA[stripAccents(k)] = v; });

                                    dataLines.forEach(line => {
                                        // Auto-detect separator: tab (Excel default) or semicolon
                                        const sep = line.includes('\t') ? '\t' : ';';
                                        const cols = line.split(sep);
                                        if (cols.length < 2) return;

                                        const rawLabel = cols[0].trim();
                                        if (!rawLabel) return;

                                        const normLabel = rawLabel.toLowerCase();
                                        const normLabelNA = stripAccents(normLabel);

                                        // Values: cols[1]=Prévia, cols[2]=Forecast, cols[3]=Meta, cols[4]=LastYear
                                        const valPrevia = parseNum(cols[1] || '');
                                        const valForecast = parseNum(cols[2] || '');
                                        const valMeta = parseNum(cols[3] || '');
                                        const valLY = parseNum(cols[4] || '');

                                        // 1. Direct ID mapping (with accents)
                                        let mappedId = IMPORT_LABEL_MAP[normLabel];
                                        // 2. Direct ID mapping (without accents fallback)
                                        if (!mappedId) mappedId = importMapNA[normLabelNA];

                                        let targetRow = mappedId && mappedId !== '__label__'
                                            ? importableRows.find(r => r.id === mappedId)
                                            : undefined;

                                        // 3. Fallback: match by full label (with accents)
                                        if (!targetRow) targetRow = labelMap.get(normLabel);
                                        // 4. Fallback: match by full label (without accents)
                                        if (!targetRow) targetRow = labelMapNA.get(normLabelNA);

                                        if (targetRow) {
                                            if (valPrevia !== 0) { targetRow.previa = valPrevia; targetRow.isManualPreviaOverride = true; if (targetRow.previaConfig) targetRow.previaConfig.manualValue = valPrevia; }
                                            if (valForecast !== 0) { targetRow.real = valForecast; targetRow.isManualOverride = true; if (targetRow.forecastConfig) { targetRow.forecastConfig.method = 'Fixed'; targetRow.forecastConfig.manualValue = valForecast; } }
                                            if (valMeta !== 0) { targetRow.budget = valMeta; }
                                            if (valLY !== 0) { targetRow.lastYear = valLY; }
                                            success.push(rawLabel);
                                        } else if (normLabel && !['descrição', 'descricao', 'descriçao', 'description'].includes(normLabel)) {
                                            skipped.push(rawLabel);
                                        }
                                    });

                                    // Apply data and feedback synchronously (no lazy updater)
                                    setData(recalculateTotals(newData, packages, accounts));
                                    setImportResult({ success: success.length, skipped });
                                }}
                                className="px-5 py-2.5 bg-emerald-600 text-white font-bold rounded-lg shadow-md hover:bg-emerald-700 transition-colors flex items-center gap-2"
                            >
                                <Upload size={18} />
                                Aplicar Importação
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showValidationModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
                        <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-indigo-50">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                                    <CheckCircle2 size={24} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-indigo-900">Salvar resultados</h2>
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
                                                    <span className="block text-xs text-gray-500">{isMonthClosed ? 'Real' : 'Prévia'}</span>
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
                                    if (activeProjectionType === 'Fechamento oficial' && !hasRole(currentUser, UserRole.ADMIN)) {
                                        alert('Apenas o ADMIN GERAL pode criar o evento de Fechamento Oficial.');
                                        return;
                                    }

                                    const rowsToSave: { accountName: string; costCenter?: string; value: number; scenario: 'Real' | 'Previa' | 'Meta' }[] = [];
                                    data.forEach(row => {
                                        if (row.category === 'Costs' || row.category === 'Account' || row.category === 'Indicators' || row.category === 'Revenue') {
                                            rowsToSave.push({ accountName: `override_${row.id}`, value: row.real, scenario: 'Real' });
                                            if (row.previa !== undefined) {
                                                rowsToSave.push({ accountName: `override_${row.id}`, value: row.previa, scenario: 'Previa' });
                                            }
                                            if (row.budget !== undefined) {
                                                rowsToSave.push({ accountName: `override_${row.id}`, value: row.budget, scenario: 'Meta' });
                                            }
                                        }
                                    });

                                    try {
                                        const activeHotel = hotels?.find(h => h.id === selectedHotel || h.name === selectedHotel);
                                        const hName = activeHotel?.name || selectedHotel || '';
                                        if (hName) {
                                            await supabaseService.saveForecastProjections(hName, selectedMonth || 1, selectedYear || 2026, activeRealVersionId || 'default', rowsToSave, activeProjectionType);
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

                                        await supabaseService.saveValidation(newValidation);

                                        if (setValidations) {
                                            setValidations(prev => [...prev, newValidation]);
                                        }

                                        const notificationMsg = `A unidade ${selectedHotel} salvou os resultados de ${activeProjectionType} para ${monthName}/${selectedYear}. Dados salvos no banco.`;
                                        console.log('Notification sent to Admin:', notificationMsg);

                                        alert(`Resultados salvos com sucesso!\n\nNotificação enviada aos administradores: "${notificationMsg}"`);
                                        setShowValidationModal(false);
                                    } catch (err) {
                                        console.error('Failed to save projections:', err);
                                        alert('Ocorreu um erro ao salvar os dados no Supabase. Tente novamente.');
                                    }
                                }}
                                className="px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-lg shadow-md hover:bg-indigo-700 transition-colors flex items-center gap-2"
                            >
                                <CheckCircle2 size={18} />
                                Salvar resultados
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Wizard OTB (On the books) — passo único: mensagem + dia de corte do mês */}
            {showOtbWizard && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
                        <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-indigo-50">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                                    <Activity size={24} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-indigo-900">On the books (OTB)</h2>
                                    <p className="text-sm text-indigo-700">{activeProjectionType}</p>
                                </div>
                            </div>
                            <button onClick={() => setShowOtbWizard(false)} className="text-indigo-400 hover:text-indigo-600 transition-colors p-2 hover:bg-indigo-100 rounded-full">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
                            <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed mb-5">
                                {`Para o primeiro passo, vamos inserir os dados OTBs, ou seja, "On the books", que é o que tem vendido no sistema do início do período até a data atual. Como estamos montando a prévia do mês ${monthName}, são os dados do início do mês de ${monthName} até o dia que você informar no espaço abaixo.\n\nSendo assim, vamos inserir para você ter um parâmetro inicial. Até qual dia do mês você vai inserir os dados do sistema para iniciar sua prévia? (Considere a data de fechamento da remessa contábil, ocupação disponíveis no painel de controle e receitas no relatório consolidado)`}
                            </p>
                            <div className="grid grid-cols-7 gap-2">
                                {Array.from({ length: daysInSelectedMonth }, (_, i) => i + 1).map(day => (
                                    <button
                                        key={day}
                                        onClick={() => setOtbDayPicked(day)}
                                        className={`py-2 rounded-lg text-sm font-bold transition-colors border ${
                                            otbDayPicked === day
                                                ? 'bg-indigo-600 text-white border-indigo-700'
                                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                        }`}
                                    >
                                        {day}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="p-5 border-t border-gray-100 bg-white flex justify-end gap-3">
                            <button onClick={() => setShowOtbWizard(false)} className="px-5 py-2.5 text-gray-600 font-bold hover:bg-gray-100 rounded-lg transition-colors">
                                Cancelar
                            </button>
                            <button
                                onClick={confirmOtbWizard}
                                disabled={otbDayPicked == null}
                                className="px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-lg shadow-md hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Ir para o segundo passo
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showBalanceteModal && (
                setRealOccupancyData && (
                    <BalanceteImportModal
                        accounts={accounts}
                        hotel={selectedHotel || ''}
                        year={selectedYear || 0}
                        month={selectedMonth || 0}
                        versionId={activeRealVersionId || ''}
                        otbContextKey={otbContextKey}
                        setRealOccupancyData={setRealOccupancyData}
                        onImportData={(rows, mode) => onImportData?.(rows, mode)}
                        onClose={() => setShowBalanceteModal(false)}
                        initialParsed={balanceteReviewData}
                    />
                )
            )}

            {showValidationSummaryModal && (
                <div
                    className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4"
                    onClick={() => setShowValidationSummaryModal(false)}
                >
                    <div
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200">
                            <h2 className="text-lg font-bold text-gray-800">Validar informações — resumo da prévia</h2>
                            <button onClick={() => setShowValidationSummaryModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-xs text-gray-500 uppercase font-bold border-b border-gray-200">
                                        <th className="text-left py-2 pr-3">Indicador</th>
                                        <th className="text-right py-2 px-3 border-l border-gray-200">Prévia</th>
                                        <th className="text-right py-2 px-3 border-l border-gray-200">Forecast</th>
                                        <th className="text-right py-2 px-3 border-l border-gray-200">Meta</th>
                                        <th className="text-right py-2 pl-3 border-l border-gray-200">Ano anterior</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {VALIDATION_SUMMARY_ROWS.map((item, i) => {
                                        if (!item) return <tr key={`spacer-${i}`}><td colSpan={5} className="h-3"></td></tr>;
                                        const row = data.find(r => r.id === item.id);
                                        if (!row) return null;
                                        const fmt = row.rowConfig?.format || 'currency';
                                        return (
                                            <tr key={item.id} className={item.bold ? 'font-bold text-gray-900' : 'text-gray-600'}>
                                                <td className="py-2 pr-3">{item.label}</td>
                                                <td className="py-2 px-3 text-right tabular-nums border-l border-gray-100">{formatValue(row.previa, fmt)}</td>
                                                <td className="py-2 px-3 text-right tabular-nums border-l border-gray-100">{formatValue(row.real, fmt)}</td>
                                                <td className="py-2 px-3 text-right tabular-nums border-l border-gray-100">{formatValue(row.budget, fmt)}</td>
                                                <td className="py-2 pl-3 text-right tabular-nums border-l border-gray-100">{formatValue(row.lastYear, fmt)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div className="flex justify-end items-center gap-3 px-6 py-4 border-t border-gray-200">
                            <button onClick={() => setShowValidationSummaryModal(false)} className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-lg">Fechar</button>
                            <button
                                onClick={() => { toggleValidadoManual(); setShowValidationSummaryModal(false); }}
                                className="px-5 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg"
                            >
                                {realOccupancyData[otbContextKey]?.['__validado_manual'] ? 'Desmarcar validado' : 'Marcar como validado'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Custom Modals */}
            {showAlertModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col scale-in-center">
                        <div className="p-6 bg-gradient-to-r from-emerald-500 to-teal-500 text-white flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                                <Activity size={24} className="text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black">Cálculo Concluído</h3>
                                <p className="text-sm text-emerald-100 font-medium">As variáveis foram atualizadas!</p>
                            </div>
                        </div>
                        <div className="p-6 bg-slate-50">
                            <p className="text-slate-700 text-base leading-relaxed text-center">
                                {calculationBase === 'forecast'
                                    ? <>As despesas <strong>fixas</strong> no Forecast foram preenchidas automaticamente com o valor da <strong>Meta</strong>. Revise se necessário.</>
                                    : <>Insira as despesas <strong>fixas</strong> na DRE e as linhas contábeis da DRE que são baseadas em <strong>Fixo</strong> nos respectivos pacotes contábeis.</>}
                            </p>
                        </div>
                        <div className="p-4 border-t border-gray-100 flex justify-end bg-white">
                            <button
                                onClick={() => setShowAlertModal(false)}
                                className="px-6 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors shadow-md shadow-emerald-200 active:scale-95"
                            >
                                Entendi
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showConfirmModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col scale-in-center">
                        <div className="p-6 bg-gradient-to-r from-indigo-600 to-blue-600 text-white flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                                <CheckCircle2 size={24} className="text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black">Salvar Resultados</h3>
                                <p className="text-sm text-indigo-100 font-medium">Atenção para esta ação</p>
                            </div>
                        </div>
                        <div className="p-6 bg-slate-50">
                            <p className="text-slate-700 text-base text-center font-medium">
                                Tem certeza que deseja salvar os resultados?
                            </p>
                            <p className="text-xs text-slate-500 text-center mt-2">
                                Após salvar, as linhas fixas serão ocultadas e os dados ficarão registrados no sistema.
                            </p>
                        </div>
                        <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-white">
                            <button
                                onClick={() => setShowConfirmModal(false)}
                                disabled={isSaving}
                                className="px-5 py-2.5 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmSaveResults}
                                disabled={isSaving}
                                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-200 disabled:opacity-50 active:scale-95"
                            >
                                {isSaving ? (
                                    <><span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></span> Salvando...</>
                                ) : (
                                    'Sim, Salvar'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ForecastTable;



function getDriverValue(driver: string | undefined, allRows: ForecastRow[], base: 'forecast' | 'previa' | 'budget'): number {
    if (!driver) return 0;

    let targetRowId = '';

    switch (driver) {
        case 'UH Ocupada': targetRowId = 'IND-2'; break;
        case 'PAX': targetRowId = 'IND-5'; break;
        case 'Emocionadores':
        case 'Emocionadores (CLT)':
            targetRowId = 'IND-7';
            break;
        case 'Extras': targetRowId = 'IND-8'; break;
        case 'Receita':
        case 'Receita Bruta':
            targetRowId = 'REV-TOTAL';
            break;
        case 'KPI de produtividade':
            targetRowId = 'IND-KPI';
            break;
        case 'Definido Manualmente':
            return 0;
        default: return 0;
    }

    const row = allRows.find(r => r.id === targetRowId);
    if (!row) return 0;
    // Forecast always projects off the Meta (budget) driver quantity, not a separately-tracked forecast occupancy.
    if (base === 'forecast') return row.budget;
    if (base === 'previa') return row.previa;
    if (base === 'budget') return row.budget;
    return 0;
}

// A package's KPI only makes sense when every Variável account inside it shares the
// same Plano de Contas driver — otherwise there is no single unit to divide the total by.
// Resolves the value of any freely-picked KPI calculation term (an account, package, indicator
// or revenue/result line, matched by its DRE row label) for a given scenario field.
function resolveKpiTerm(termLabel: string | undefined, allRows: ForecastRow[], field: 'previa' | 'real' | 'budget' | 'otb'): number {
    if (!termLabel) return 0;
    const target = termLabel.trim().toLowerCase();
    const row = allRows.find(r => r.label.trim().toLowerCase() === target);
    if (!row) return 0;
    // OTB reads the row's own OTB snapshot directly — no Meta substitution, since the whole point
    // is to reflect what was actually entered as of the cutoff day (or nothing, if not yet filled).
    if (field === 'otb') return row.otb || 0;
    // Forecast always projects off the Meta (budget) quantity for indicator/Receita Bruta lines,
    // since there's no separately-tracked "forecast occupancy" distinct from the plan.
    const usesMetaOnForecast = row.category === 'Indicators' || row.id === 'REV-TOTAL';
    if (field === 'real' && usesMetaOnForecast) return row.budget;
    if (field === 'real') return row.real;
    if (field === 'previa') return row.previa;
    return row.budget;
}

// The KPI formula is a free spreadsheet-style expression ("@[Line A] + @[Line B] / @[Line C]"),
// evaluated with the same engine already used for Intelligent DRE calculated rows.
function evaluateKpiCalculation(calc: KpiCalculation | undefined, allRows: ForecastRow[], field: 'previa' | 'real' | 'budget' | 'otb'): number {
    if (!calc || !calc.formula || !calc.formula.trim()) return 0;
    const context = { getValue: (name: string) => resolveKpiTerm(name, allRows, field) };
    return evaluateFormula(calc.formula, context);
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// "Calcular Forecast" can only auto-project a value when the formula is the simple ratio
// "@[This account] / @[Denominator]" — anything else (extra terms, +, -, multiply, or a
// numerator that isn't the account itself) has no single "rate" to reapply to the Meta.
function parseSelfRatioDenominator(formula: string | undefined, selfName: string): string | null {
    if (!formula) return null;
    const self = escapeRegExp(selfName.trim());
    const pattern = new RegExp(`^\\s*@\\[?${self}\\]?\\s*/\\s*@\\[?([^/*+\\-]+?)\\]?\\s*$`, 'i');
    const match = formula.trim().match(pattern);
    return match ? match[1].trim() : null;
}

function calculateRowValue(row: ForecastRow | null, config: ForecastConfig, allRows: ForecastRow[], base: 'forecast' | 'previa'): number {
    if (!config) return 0;

    if (config.method === 'Fixed') {
        return config.manualValue || 0;
    } else {
        const driverValue = getDriverValue(config.driver, allRows, base);

        let factor = config.factor || 0;

        if (factor === 0 && row && row.budget) {
            const driverBudget = getDriverValue(config.driver, allRows, 'budget');
            if (driverBudget && driverBudget > 0) {
                factor = row.budget / driverBudget;
            }
        }

        if (config.operator === 'divide' && factor !== 0) {
            return driverValue / factor;
        } else {
            return driverValue * factor;
        }
    }
}

function recalculateTotals(rows: ForecastRow[], packages: CostPackage[], accounts: Account[]) {
    const clonedRows = rows.map(r => ({
        ...r,
        forecastConfig: { ...r.forecastConfig },
        previaConfig: r.previaConfig ? { ...r.previaConfig } : undefined
    }));

    const rowMap = new Map(clonedRows.map(r => [r.id, r]));
    const nameMap = new Map(clonedRows.map(r => [r.label.trim(), r]));

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
        if (target) target[fieldToSet] = total;
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

        // REV-APT = Lazer + Eventos + Inclusas + OR
        sumAndSet('REV-APT', [{ id: 'REV-APT-LAZER' }, { id: 'REV-APT-EVENTOS' }, { id: 'REV-APT-INCLUSAS' }, { id: 'REV-APT-OR' }], field);

        // REV-EXTRA = Extra Lazer + Extra Eventos + OR Extras
        sumAndSet('REV-EXTRA', [{ id: 'REV-EXTRA-LAZER' }, { id: 'REV-EXTRA-EVENTOS' }, { id: 'REV-EXTRA-OR' }], field);

        // Keep the precomputed Receita ÷ PAX KPI in sync with the row's own (possibly just-edited)
        // value, and let "Receitas Extras" total KPI be the sum of the Lazer/Eventos KPIs.
        if (field !== 'lastYear') {
            let kpiSum = 0;
            ['REV-EXTRA-LAZER', 'REV-EXTRA-EVENTOS'].forEach(id => {
                const segRow = rowMap.get(id);
                const denom = segRow?.rowConfig?.precomputedKpi?.denominator?.[field];
                if (segRow?.rowConfig?.precomputedKpi && denom) {
                    const kpiVal = denom > 0 ? (segRow[field] || 0) / denom : 0;
                    segRow.rowConfig = { ...segRow.rowConfig, precomputedKpi: { ...segRow.rowConfig.precomputedKpi, [field]: kpiVal } };
                    kpiSum += kpiVal;
                }
            });
            const revExtraRow = rowMap.get('REV-EXTRA');
            if (revExtraRow?.rowConfig?.precomputedKpi) {
                revExtraRow.rowConfig = { ...revExtraRow.rowConfig, precomputedKpi: { ...revExtraRow.rowConfig.precomputedKpi, [field]: kpiSum } };
            }
        }

        // REV-TOTAL = REV-APT + REV-EXTRA + REV-TIME + REV-ISS
        sumAndSet('REV-TOTAL', [{ id: 'REV-APT' }, { id: 'REV-EXTRA' }, { id: 'REV-TIME' }, { id: 'REV-ISS' }], field);

        // Impostos (Prévia): replica o % de imposto da Meta (Imposto ÷ Receita Bruta Total) sobre
        // a Receita Bruta Total da própria Prévia, a cada vez que a receita muda — a não ser que
        // o usuário já tenha digitado um valor manualmente nessa célula (mesma trava usada pelas
        // contas Variável, isManualPreviaOverride).
        if (field === 'previa') {
            const impRow = rowMap.get('REV-IMP');
            const revTotalRowForImp = rowMap.get('REV-TOTAL');
            if (impRow && revTotalRowForImp && !impRow.isManualPreviaOverride) {
                const impostoRate = revTotalRowForImp.budget ? (impRow.budget || 0) / revTotalRowForImp.budget : 0;
                impRow.previa = impostoRate * (revTotalRowForImp.previa || 0);
            }
        }

        // REV-NET = REV-TOTAL - REV-IMP
        const revTotal = rowMap.get('REV-TOTAL')?.[field] || 0;
        const revImp = rowMap.get('REV-IMP')?.[field] || 0;
        const revNet = rowMap.get('REV-NET');
        if (revNet) revNet[field] = revTotal - revImp;

        // KPI: DM e RevPAR (Real time updates)
        const avail = rowMap.get('IND-1')?.[field] || 0;
        const occ = rowMap.get('IND-2')?.[field] || 0;
        const revApt = rowMap.get('REV-APT')?.[field] || 0;
        const revExtra = rowMap.get('REV-EXTRA')?.[field] || 0;

        // % de Ocupação = UH Ocupada / UH Disponível * 100
        const occPct = rowMap.get('IND-3');
        if (occPct) occPct[field] = avail > 0 ? (occ / avail) * 100 : 0;

        // Coeficientes de Adultos e CHD
        const adults = rowMap.get('IND-ADULTOS')?.[field] || 0;
        const chd = rowMap.get('IND-CHD')?.[field] || 0;
        const coefAdultos = rowMap.get('IND-COEF-ADULTOS');
        if (coefAdultos) coefAdultos[field] = occ > 0 ? adults / occ : 0;
        const coefChd = rowMap.get('IND-COEF-CHD');
        if (coefChd) coefChd[field] = occ > 0 ? chd / occ : 0;

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

    // --- OTB (On the books) — só Receita/Impostos, despesas ficam de fora por enquanto ---
    // Não estende os loops genéricos acima de propósito: se Custos não tiverem .otb, um GOP-otb
    // calculado ali sairia com margem inflada (como se não houvesse despesa nenhuma), o que é
    // enganoso — melhor deixar Resultado/GOP em branco na coluna OTB por ora.
    {
        const sumOtb = (ids: string[]) => ids.reduce((s, id) => s + (rowMap.get(id)?.otb || 0), 0);
        const revAptRowOtb = rowMap.get('REV-APT');
        if (revAptRowOtb) revAptRowOtb.otb = sumOtb(['REV-APT-LAZER', 'REV-APT-EVENTOS', 'REV-APT-INCLUSAS', 'REV-APT-OR']);
        const revExtraRowOtb = rowMap.get('REV-EXTRA');
        if (revExtraRowOtb) revExtraRowOtb.otb = sumOtb(['REV-EXTRA-LAZER', 'REV-EXTRA-EVENTOS', 'REV-EXTRA-OR']);
        const revTotalRowOtb = rowMap.get('REV-TOTAL');
        if (revTotalRowOtb) revTotalRowOtb.otb = sumOtb(['REV-APT', 'REV-EXTRA', 'REV-TIME', 'REV-ISS']);
        const impRowOtb = rowMap.get('REV-IMP');
        if (impRowOtb && revTotalRowOtb && impRowOtb.otb === undefined) {
            // Só cai pra essa estimativa (% da Meta) enquanto o balancete ainda não trouxe o
            // valor real do Imposto (services/mockData.ts já preenche .otb direto quando existe).
            const impostoRateOtb = revTotalRowOtb.budget ? (impRowOtb.budget || 0) / revTotalRowOtb.budget : 0;
            impRowOtb.otb = impostoRateOtb * (revTotalRowOtb.otb || 0);
        }
        const revNetRowOtb = rowMap.get('REV-NET');
        if (revNetRowOtb && revTotalRowOtb && impRowOtb) revNetRowOtb.otb = (revTotalRowOtb.otb || 0) - (impRowOtb.otb || 0);

        // REVPAR/TREVPOR/TREVPAR na coluna OTB — mesma fórmula do bloco real/budget/previa acima,
        // só que usando os indicadores/receitas já somados em .otb nesta mesma seção.
        const availOtb = rowMap.get('IND-1')?.otb || 0;
        const occOtb = rowMap.get('IND-2')?.otb || 0;
        const revAptOtbVal = revAptRowOtb?.otb || 0;
        const revExtraOtbVal = revExtraRowOtb?.otb || 0;
        const revparRowOtb = rowMap.get('IND-6');
        if (revparRowOtb) revparRowOtb.otb = availOtb > 0 ? revAptOtbVal / availOtb : 0;
        const trevporRowOtb = rowMap.get('IND-TREVPOR');
        if (trevporRowOtb) trevporRowOtb.otb = occOtb > 0 ? (revAptOtbVal + revExtraOtbVal) / occOtb : 0;
        const trevparRowOtb = rowMap.get('IND-TREVPAR');
        if (trevparRowOtb) trevparRowOtb.otb = availOtb > 0 ? (revAptOtbVal + revExtraOtbVal) / availOtb : 0;
    }

    // --- VARIABLE CALCULATIONS FOR INDIVIDUAL ACCOUNTS ---
    const updatedRows = Array.from(rowMap.values());
    updatedRows.forEach(row => {
        // A validated/restored override (from a saved Forecast version) already carries the
        // right value in row.real/previa — this legacy driver÷factor projection must not clobber
        // it just because the account's Plano de Contas config still says "Variável" on reload.
        if (row.forecastConfig.method === 'Variable' && !row.isManualOverride) {
            row.real = calculateRowValue(row, row.forecastConfig, updatedRows, 'forecast');
        }
        if (row.previaConfig?.method === 'Variable' && !row.isManualPreviaOverride) {
            row.previa = calculateRowValue(row, row.previaConfig, updatedRows, 'previa');
        }
    });

    // --- COSTS HIERARCHICAL AGGREGATION ---
    // 1. Sum Accounts (Level 2) into Packages (Level 1)
    // Use semantic properties: isHeader + indentLevel instead of ID prefixes
    const pkgRows = updatedRows.filter(r =>
        (r.category === 'Costs' || r.category === 'Package') &&
        r.isHeader &&
        r.indentLevel === 1 &&
        !r.id.startsWith('p-drill-')
    );
    pkgRows.forEach(pkgRow => {
        const pkgId = pkgRow.id;
        const pkgName = pkgRow.label;

        // Find children: accounts AND drill-down sub-rows at indentLevel 2
        const children = updatedRows.filter(r => {
            if (r.indentLevel !== 2) return false;
            if (r.category !== 'Costs' && r.category !== 'Account') return false;

            // Match drill-down rows: their ID contains the parent package ID
            if (r.id.startsWith('p-drill-')) {
                // Dynamic: p-drill-{pkgId}-{sub} → contains pkgId
                // Static: p-drill-{masterName}-{pkgName}-{sub} → contains pkgName
                return r.id.includes(pkgId) || r.id.includes(`-${pkgName}-`);
            }

            // Match regular account rows via the accounts registry
            let acc = accounts.find(a => a.id === r.id);
            if (!acc) {
                const originalAccId = r.id.split('-')[0];
                acc = accounts.find(a => a.id === originalAccId);
            }
            if (!acc) return false;
            return (acc.package || '').toLowerCase() === (pkgName || '').toLowerCase() || acc.packageId === pkgId;
        });

        if (children.length > 0) {
            pkgRow.real = children.reduce((sum, c) => sum + c.real, 0);
            pkgRow.budget = children.reduce((sum, c) => sum + c.budget, 0);
            pkgRow.lastYear = children.reduce((sum, c) => sum + c.lastYear, 0);
            pkgRow.previa = children.reduce((sum, c) => sum + (c.previa || 0), 0);
            pkgRow.isManualOverride = false;
            pkgRow.isManualPreviaOverride = false;
        }
    });

    // 2. Sum Packages (Level 1) directly into CUSTOS E DESPESAS OPERACIONAIS (Level 0)
    const cstHead = rowMap.get('CST-HEAD');
    if (cstHead) {
        cstHead.real = pkgRows.reduce((sum, p) => sum + p.real, 0);
        cstHead.budget = pkgRows.reduce((sum, p) => sum + p.budget, 0);
        cstHead.lastYear = pkgRows.reduce((sum, p) => sum + p.lastYear, 0);
        cstHead.previa = pkgRows.reduce((sum, p) => sum + (p.previa || 0), 0);
        cstHead.otb = pkgRows.reduce((sum, p) => sum + (p.otb || 0), 0);
    }

    // GOP (com/sem dedução de impostos) na coluna OTB — só agora que CST-HEAD.otb (soma dos
    // pacotes, alimentados pelo import do balancete) já está pronto. Mesma fórmula do bloco
    // genérico de campos abaixo (RES-OP-*), só que fixo pro campo .otb.
    {
        const revTotalOtb = rowMap.get('REV-TOTAL')?.otb || 0;
        const revImpOtb = rowMap.get('REV-IMP')?.otb || 0;
        const cstHeadOtb = cstHead?.otb || 0;
        const resOpSemImpOtb = rowMap.get('RES-OP-SEM-IMP');
        if (resOpSemImpOtb) resOpSemImpOtb.otb = revTotalOtb - cstHeadOtb;
        const resOpComImpOtb = rowMap.get('RES-OP-COM-IMP');
        if (resOpComImpOtb) resOpComImpOtb.otb = revTotalOtb - revImpOtb - cstHeadOtb;
        const resOpSemImpPctOtb = rowMap.get('RES-OP-SEM-IMP-PCT');
        if (resOpSemImpPctOtb) resOpSemImpPctOtb.otb = revTotalOtb !== 0 ? ((revTotalOtb - cstHeadOtb) / revTotalOtb) * 100 : 0;
        const resOpComImpPctOtb = rowMap.get('RES-OP-COM-IMP-PCT');
        if (resOpComImpPctOtb) resOpComImpPctOtb.otb = revTotalOtb !== 0 ? ((revTotalOtb - revImpOtb - cstHeadOtb) / revTotalOtb) * 100 : 0;
    }

    // --- REVENUE & RESULTS CALCULATIONS ---

    // Receita (e Impostos, mesma category 'Revenue') na coluna Forecast sempre espelha a
    // Prévia — diferente de Custos (que tem "Calcular Forecast"/KPI de conta), não existe uma
    // fonte de dado separada para Receita durante a montagem do forecast. Cobre tanto as linhas
    // de entrada (REV-APT-LAZER, REV-EXTRA-*, REV-TIME, REV-ISS, REV-IMP...) quanto os totais
    // (REV-APT, REV-EXTRA, REV-TOTAL, REV-NET), já recalculados acima para todos os campos.
    updatedRows.forEach(row => {
        if (row.category === 'Revenue') {
            row.real = row.previa || 0;
        }
    });

    ['real', 'budget', 'lastYear', 'previa'].forEach(f => {
        const field = f as 'real' | 'budget' | 'lastYear' | 'previa';

        const revTotal = rowMap.get('REV-TOTAL')?.[field] || 0;
        const revIss = rowMap.get('REV-ISS')?.[field] || 0;
        const revImp = rowMap.get('REV-IMP')?.[field] || 0;
        const cstHeadVal = rowMap.get('CST-HEAD')?.[field] || 0;

        const resOpSemImp = rowMap.get('RES-OP-SEM-IMP');
        if (resOpSemImp) resOpSemImp[field] = revTotal - cstHeadVal;

        const resOpComImp = rowMap.get('RES-OP-COM-IMP');
        if (resOpComImp) resOpComImp[field] = revTotal - revImp - cstHeadVal;

        const resOpSemImpPct = rowMap.get('RES-OP-SEM-IMP-PCT');
        if (resOpSemImpPct) resOpSemImpPct[field] = revTotal !== 0 ? ((revTotal - cstHeadVal) / revTotal) * 100 : 0;

        const resOpComImpPct = rowMap.get('RES-OP-COM-IMP-PCT');
        if (resOpComImpPct) resOpComImpPct[field] = revTotal !== 0 ? ((revTotal - revImp - cstHeadVal) / revTotal) * 100 : 0;
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

        row.deltaPreviaForecastVal = (row.previa || 0) - row.real;
        row.deltaPreviaForecastPct = row.real === 0 ? 0 : (((row.previa || 0) - row.real) / Math.abs(row.real)) * 100;
    });

    // --- TRANSFORMATION / REACTIVITY KPIs ---
    // Transformação = ΔGOP / ΔReceita quando a receita do período "atual" é MAIOR que a do
    // período "base" (a operação está crescendo por transformação real do negócio).
    // Reatividade = ΔCustos / ΔReceita quando a receita do período "atual" é MENOR que a do
    // período "base" (a operação está reagindo via corte/aumento de custos).
    const computeTransReat = (currentRev: number, baseRev: number, currentGop: number, baseGop: number, currentCost: number, baseCost: number) => {
        const deltaRev = currentRev - baseRev;
        if (deltaRev > 0) return ((currentGop - baseGop) / deltaRev) * 100;
        if (deltaRev < 0) return ((currentCost - baseCost) / deltaRev) * 100;
        return 0;
    };

    const kpiBudget = rowMap.get('KPI-TRANS-BUDGET'); // R x M, GOP c/ Imp.
    const kpiLY = rowMap.get('KPI-TRANS-LY'); // R x R Ant., GOP c/ Imp.
    const kpiMetaLY = rowMap.get('KPI-TRANS-M-LY'); // M x R Ant., GOP c/ Imp.
    const kpiBudgetSem = rowMap.get('KPI-TRANS-BUDGET-SEM'); // R x M, GOP s/ Imp.
    const kpiLYSem = rowMap.get('KPI-TRANS-LY-SEM'); // R x R Ant., GOP s/ Imp.
    const kpiMetaLYSem = rowMap.get('KPI-TRANS-M-LY-SEM'); // M x R Ant., GOP s/ Imp.
    const revTotalRow = rowMap.get('REV-TOTAL');
    const gopRow = rowMap.get('RES-OP-COM-IMP');
    const gopRowSem = rowMap.get('RES-OP-SEM-IMP');
    const costHead = rowMap.get('CST-HEAD');

    // "Receita da prévia ou fechamento" is row.previa — the column literally relabeled from
    // Prévia to Real once Fechamento oficial is validated (row.real is the separate "Forecast"
    // projection produced by "Calcular Forecast", not what the Δ REAL-META/LY columns show).
    if (kpiBudget && revTotalRow && gopRow && costHead) {
        kpiBudget.real = computeTransReat(revTotalRow.previa || 0, revTotalRow.budget, gopRow.previa || 0, gopRow.budget, costHead.previa || 0, costHead.budget);
    }

    if (kpiLY && revTotalRow && gopRow && costHead) {
        kpiLY.real = computeTransReat(revTotalRow.previa || 0, revTotalRow.lastYear, gopRow.previa || 0, gopRow.lastYear, costHead.previa || 0, costHead.lastYear);
    }

    if (kpiMetaLY && revTotalRow && gopRow && costHead) {
        kpiMetaLY.real = computeTransReat(revTotalRow.budget, revTotalRow.lastYear, gopRow.budget, gopRow.lastYear, costHead.budget, costHead.lastYear);
    }

    if (kpiBudgetSem && revTotalRow && gopRowSem && costHead) {
        kpiBudgetSem.real = computeTransReat(revTotalRow.previa || 0, revTotalRow.budget, gopRowSem.previa || 0, gopRowSem.budget, costHead.previa || 0, costHead.budget);
    }

    if (kpiLYSem && revTotalRow && gopRowSem && costHead) {
        kpiLYSem.real = computeTransReat(revTotalRow.previa || 0, revTotalRow.lastYear, gopRowSem.previa || 0, gopRowSem.lastYear, costHead.previa || 0, costHead.lastYear);
    }

    if (kpiMetaLYSem && revTotalRow && gopRowSem && costHead) {
        kpiMetaLYSem.real = computeTransReat(revTotalRow.budget, revTotalRow.lastYear, gopRowSem.budget, gopRowSem.lastYear, costHead.budget, costHead.lastYear);
    }

    return Array.from(rowMap.values());
}

// Extraída do useState inicial / derivedData desta tela para ser reaproveitada por outras telas
// (ex.: Análise de A&B) sem duplicar a lógica de escolha de estrutura + recálculo de totais.
export function buildForecastRows(
    dreConfigs: Record<string, import('../types').DreSection[]> | undefined,
    selectedMonth: number | undefined,
    selectedYear: number | undefined,
    financialData: ImportedRow[] | undefined,
    selectedHotel: string | undefined,
    hotels: Hotel[],
    realOccupancyData: Record<string, Record<string, number>>,
    activeRealVersionId: string | undefined,
    activeBudgetVersionId: string | undefined,
    accounts: Account[],
    packages: CostPackage[],
    budgetOccupancyData: Record<string, number[]>,
    activeProjectionType: import('../types').ProjectionType | undefined
): ForecastRow[] {
    const forecastStructure = dreConfigs?.['Forecast'] || [];

    let newData: ForecastRow[];
    if (forecastStructure.length > 0) {
        newData = getDynamicForecastData(forecastStructure, selectedMonth, selectedYear, financialData, selectedHotel, hotels, realOccupancyData, activeRealVersionId, activeBudgetVersionId, accounts, packages, budgetOccupancyData);
    } else {
        newData = getForecastData(selectedMonth, selectedYear, financialData, selectedHotel, hotels, realOccupancyData, activeRealVersionId, activeBudgetVersionId, accounts, packages, budgetOccupancyData, activeProjectionType);
    }

    const initializedData = newData.map(row => {
        const finalPrevia = row.previa;
        return {
            ...row,
            previa: finalPrevia,
            previaConfig: row.previaConfig || { method: 'Fixed', manualValue: finalPrevia }
        };
    });
    return recalculateTotals(initializedData, packages, accounts);
}

export { formatValue, formatPercentDiff, formatPointsDiff };