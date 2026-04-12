
import React, { useState, useMemo, useRef } from 'react';
import { getForecastData } from '../services/mockData';
import { Plus, Trash2, X, Save, Briefcase, Pencil, Calendar, PieChart, Lock, LockOpen, Settings as SettingsIcon, Users, Search, Upload, Settings, Eye, FileText, Layout, Info, ChevronUp, GripVertical } from 'lucide-react';
import { User, UserRole, CostCenter, ImportedRow, Hotel, Account, BudgetVersion, LaborParameters, ScheduleItem, ImportedCostCenter, CostPackage, GMDConfiguration } from '../types';
import TimelineView from './TimelineView';
import { supabaseService } from '../services/supabaseService';
import { supabaseTemp } from '../services/supabaseClient';

// Types for DRE Configuration state
interface DreAccount {
    id: string;
    name: string;
}

interface DrePackage {
    id: string;
    name: string;
    accounts: DreAccount[];
    isExpanded?: boolean;
}

interface DreSection {
    id: string;
    name: string;
    type: 'section' | 'result';
    items: DrePackage[];
}

interface ImportedAccount {
    id: string;
    name: string;
    package?: string;
    masterPackage?: string;
    status: 'valid' | 'error';
    msg: string;
    originalLine: number;
}

// --- IMPORT PREVIEW COMPONENT ---
interface ImportPreviewProps {
    summaryRows: {
        hotel: string;
        ano: string;
        mes: string;
        cenario: string;
        tipo: string;
        total: number;
        count: number;
    }[];
    errorRows: ImportedRow[];
    onCancel: () => void;
    onConfirm: (targetRealVersionId: string, targetBudgetVersionId: string) => void;
    importMode: 'append' | 'replace';
    setImportMode: (mode: 'append' | 'replace') => void;
    realVersions: BudgetVersion[];
    budgetVersions: BudgetVersion[];
}

const ImportPreview: React.FC<ImportPreviewProps> = ({ summaryRows, errorRows, onCancel, onConfirm, importMode, setImportMode, realVersions, budgetVersions }) => {
    const [targetRealVersionId, setTargetRealVersionId] = useState<string>('');
    const [targetBudgetVersionId, setTargetBudgetVersionId] = useState<string>('');

    const hasRealData = summaryRows.some(r => r.cenario.toUpperCase() === 'REAL');
    const hasBudgetData = summaryRows.some(r => r.cenario.toUpperCase() === 'BUDGET' || r.cenario.toUpperCase() === 'ORÇADO');

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h4 className="text-lg font-bold text-slate-800">Resumo da Importação</h4>
                <div className="flex gap-2">
                    <button onClick={onCancel} className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-50">Cancelar</button>
                    <button 
                        onClick={() => onConfirm(targetRealVersionId, targetBudgetVersionId)} 
                        disabled={(hasRealData && !targetRealVersionId) || (hasBudgetData && !targetBudgetVersionId)}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 disabled:opacity-50"
                    >
                        Confirmar Importação
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {hasRealData && (
                    <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                        <label className="block text-sm font-bold text-emerald-800 mb-2">Versão Real de Destino</label>
                        <select 
                            value={targetRealVersionId} 
                            onChange={e => setTargetRealVersionId(e.target.value)}
                            className="w-full border border-emerald-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                        >
                            <option value="">Selecione uma versão...</option>
                            {realVersions.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                        </select>
                    </div>
                )}
                {hasBudgetData && (
                    <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
                        <label className="block text-sm font-bold text-orange-800 mb-2">Versão Budget de Destino</label>
                        <select 
                            value={targetBudgetVersionId} 
                            onChange={e => setTargetBudgetVersionId(e.target.value)}
                            className="w-full border border-orange-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 outline-none"
                        >
                            <option value="">Selecione uma versão...</option>
                            {budgetVersions.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                        </select>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                    <div className="text-emerald-600 text-xs font-bold uppercase mb-1">Registros Válidos</div>
                    <div className="text-2xl font-bold text-emerald-700">{summaryRows.length} grupos</div>
                </div>
                <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                    <div className="text-red-600 text-xs font-bold uppercase mb-1">Erros Encontrados</div>
                    <div className="text-2xl font-bold text-red-700">{errorRows.length} linhas</div>
                </div>
            </div>

            <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200">
                <span className="text-sm font-bold text-gray-700">Modo de Importação:</span>
                <div className="flex gap-2">
                    <button 
                        onClick={() => setImportMode('append')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${importMode === 'append' ? 'bg-white text-indigo-600 shadow-sm border border-indigo-100' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Acrescentar (Append)
                    </button>
                    <button 
                        onClick={() => setImportMode('replace')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${importMode === 'replace' ? 'bg-white text-indigo-600 shadow-sm border border-indigo-100' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Substituir (Replace)
                    </button>
                </div>
            </div>

            {errorRows.length > 0 && (
                <div className="bg-white border border-red-200 rounded-xl overflow-hidden">
                    <div className="bg-red-50 px-4 py-2 border-b border-red-200">
                        <h5 className="text-xs font-bold text-red-700 uppercase">Erros de Validação</h5>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                        <table className="min-w-full divide-y divide-gray-200 text-[10px]">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-2 text-left font-medium text-gray-500">Linha</th>
                                    <th className="px-4 py-2 text-left font-medium text-gray-500">Erro</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {errorRows.map((err, idx) => (
                                    <tr key={idx}>
                                        <td className="px-4 py-2 font-mono text-gray-400">{err.originalLine}</td>
                                        <td className="px-4 py-2 text-red-600">{err.msg}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                    <h5 className="text-xs font-bold text-gray-700 uppercase">Resumo por Hotel/Mês</h5>
                </div>
                <div className="max-h-96 overflow-y-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-xs">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-2 text-left font-medium text-gray-500">Hotel</th>
                                <th className="px-4 py-2 text-left font-medium text-gray-500">Ano/Mês</th>
                                <th className="px-4 py-2 text-left font-medium text-gray-500">Cenário</th>
                                <th className="px-4 py-2 text-left font-medium text-gray-500">Tipo</th>
                                <th className="px-4 py-2 text-right font-medium text-gray-500">Total</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {summaryRows.map((row, idx) => (
                                <tr key={idx}>
                                    <td className="px-4 py-2 font-medium text-gray-900">{row.hotel}</td>
                                    <td className="px-4 py-2 text-gray-500">{row.ano}/{row.mes}</td>
                                    <td className="px-4 py-2 text-gray-500">{row.cenario}</td>
                                    <td className="px-4 py-2 text-gray-500">{row.tipo}</td>
                                    <td className="px-4 py-2 text-right font-bold text-indigo-600">
                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(row.total)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

// --- SPREADSHEET COMPONENT ---
/*
const extraRevRows = ["Receita de Lazer", "Receita de Eventos"];
const taxRows = ["Impostos"];
const occRows = [
    "Lazer - UH Disponível", "Lazer - UH Ocupada", "Lazer - PAX", "Receita de Hospedagem - Lazer",
    "Eventos - UH Disponível", "Eventos - UH Ocupada", "Eventos - PAX", "Receita de Hospedagem - Eventos"
];

interface SpreadsheetTableProps {
    rows: string[]; // List of row labels (Indicators)
    data: Record<string, Record<number, string>>; // rowLabel -> monthIndex (1-12) -> value
    onCellChange: (rowLabel: string, month: number, value: string) => void;
    onPaste?: (startRowLabel: string, startMonth: number, pastedData: string[][]) => void;
}
*/

/*
const SpreadsheetTable: React.FC<SpreadsheetTableProps> = ({ rows, data, onCellChange, onPaste }) => {
    const months = [1,2,3,4,5,6,7,8,9,10,11,12];

    const handlePaste = (e: React.ClipboardEvent, rowLabel: string, startMonth: number) => {
        if (!onPaste) return;
        e.preventDefault();
        const clipboardData = e.clipboardData.getData('text');
        const pastedRows = clipboardData.split(/\r\n|\n|\r/).filter(r => r.trim()).map(row => row.split('\t'));
        onPaste(rowLabel, startMonth, pastedRows);
    };
    
    return (
        <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm">
            <table className="min-w-full divide-y divide-gray-200 text-xs">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10 border-r border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Indicador</th>
                        {months.map(m => (
                            <th key={m} className="px-2 py-2 text-center font-medium text-gray-500 w-24 border-l border-gray-200">
                                {new Date(2024, m-1).toLocaleString('pt-BR', { month: 'short' }).toUpperCase()}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {rows.map((rowLabel, idx) => (
                        <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}>
                            <td className="px-3 py-1 font-medium text-gray-700 sticky left-0 bg-white z-10 border-r border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] truncate max-w-[200px]" title={rowLabel}>
                                {rowLabel}
                            </td>
                            {months.map(m => (
                                <td key={m} className="p-0 border-l border-gray-100">
                                    <input 
                                        type="text" 
                                        className="w-full h-full px-2 py-1.5 text-right focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-transparent"
                                        placeholder="-"
                                        value={data[rowLabel]?.[m] || ''}
                                        onChange={(e) => onCellChange(rowLabel, m, e.target.value)}
                                        onPaste={(e) => handlePaste(e, rowLabel, m)}
                                    />
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
*/

type ModalType = 'user' | 'hotel' | 'costCenter' | 'package' | 'account' | 'gmd' | null;

interface UnifiedAdministrationViewProps {
    onImportData?: (data: ImportedRow[], mode: 'append' | 'replace') => void;
    
    // Props for Data Persistence (Passed from App)
    users: User[]; setUsers: React.Dispatch<React.SetStateAction<User[]>>;
    hotels: Hotel[]; setHotels: React.Dispatch<React.SetStateAction<Hotel[]>>;
    costCenters: CostCenter[]; setCostCenters: React.Dispatch<React.SetStateAction<CostCenter[]>>;
    packages: CostPackage[]; setPackages: React.Dispatch<React.SetStateAction<CostPackage[]>>;
    accounts: Account[]; setAccounts: React.Dispatch<React.SetStateAction<Account[]>>;
    gmdConfigs: GMDConfiguration[]; setGmdConfigs: React.Dispatch<React.SetStateAction<GMDConfiguration[]>>;
    
    // Month Management
    monthStatus: Record<string, 'open' | 'closed'>;
    setMonthStatus: React.Dispatch<React.SetStateAction<Record<string, 'open' | 'closed'>>>;

    // Budget Versioning
    budgetVersions: BudgetVersion[];
    setBudgetVersions: React.Dispatch<React.SetStateAction<BudgetVersion[]>>;
    activeBudgetVersionId: string;
    setActiveBudgetVersionId: (id: string) => void;

    // Real Versioning
    realVersions: BudgetVersion[];
    setRealVersions: React.Dispatch<React.SetStateAction<BudgetVersion[]>>;
    activeRealVersionId: string;
    setActiveRealVersionId: (id: string) => void;

    // Labor Parameters
    laborParametersMap: Record<string, LaborParameters>;
    setLaborParametersMap: React.Dispatch<React.SetStateAction<Record<string, LaborParameters>>>;

    // Schedule
    budgetSchedule: ScheduleItem[];
    setBudgetSchedule: React.Dispatch<React.SetStateAction<ScheduleItem[]>>;
}

const UnifiedAdministrationView: React.FC<UnifiedAdministrationViewProps> = ({ 
    onImportData,
    users, setUsers,
    hotels, setHotels,
    costCenters, setCostCenters,
    packages, setPackages,
    accounts, setAccounts,
    gmdConfigs, setGmdConfigs,
    monthStatus, setMonthStatus,
    budgetVersions, setBudgetVersions,
    activeBudgetVersionId, setActiveBudgetVersionId,
    realVersions, setRealVersions,
    activeRealVersionId, setActiveRealVersionId,
    laborParametersMap, setLaborParametersMap,
    budgetSchedule, setBudgetSchedule
}) => {
  // Main Module Tabs
  const [mainTab, setMainTab] = useState<'real' | 'budget' | 'geral'>('real');

  // Sub-tabs for Tauá Real
  const [activeRealTab, setActiveRealTab] = useState<'versions' | 'closure' | 'import' | 'labor' | 'schedule' | 'dre_params'>('versions');
  const [realFilterYear, setRealFilterYear] = useState<number>(new Date().getFullYear());

  // Sub-tabs for Tauá Geral
  const [activeGeralTab, setActiveGeralTab] = useState<'registries' | 'gmd' | 'permissions' | 'import' | 'dre_view'>('registries');

  // Sub-tabs for Tauá Budget
  const [activeBudgetTab, setActiveBudgetTab] = useState<'versions' | 'labor' | 'expense_characteristics' | 'import'>('versions');
  const [budgetFilterYear, setBudgetFilterYear] = useState<number>(new Date().getFullYear());
  
  // Registry Sub-tabs (Now under Geral)
  const [activeRegistryTab, setActiveRegistryTab] = useState<'users' | 'logs' | 'hotels' | 'costCenters' | 'packages' | 'accounts' | 'dre_structure'>('users');

  // Import Sub-tabs
  const [activeImportTab, setActiveImportTab] = useState<'financial' | 'revenue' | 'occupancy' | 'costCenters' | 'accounts'>('financial');

  // Logs & Permissions state
  const [userLogs, setUserLogs] = useState([
    { id: '1', userId: 'u1', userName: 'Carlos Silva', userUnit: 'Tauá Resort Caeté', action: 'Atualizou Forecast DRE', timestamp: new Date(Date.now() - 3600000).toISOString() },
    { id: '2', userId: 'u2', userName: 'Ana Souza', userUnit: 'Tauá Resort Atibaia', action: 'Criou Nova Versão GMD', timestamp: new Date(Date.now() - 86400000).toISOString() }
  ]);
  
  const [permissionsMatrix, setPermissionsMatrix] = useState<Record<string, Record<string, Record<UserRole, boolean>>>>({
    'GMD': {
      'Criar Nova Versão GMD': {
        [UserRole.ADMIN]: true, [UserRole.DIRETORIA]: false, [UserRole.ADMIN_UNIDADE]: true,
        [UserRole.ENTITY_MANAGER]: false, [UserRole.PACKAGE_MANAGER]: false, [UserRole.AREA_MANAGER]: false,
        [UserRole.COST_ANALYST]: true, [UserRole.AREA_ANALYST]: false
      },
      'Aprovar Fechamento GMD': {
        [UserRole.ADMIN]: true, [UserRole.DIRETORIA]: true, [UserRole.ADMIN_UNIDADE]: false,
        [UserRole.ENTITY_MANAGER]: false, [UserRole.PACKAGE_MANAGER]: false, [UserRole.AREA_MANAGER]: false,
        [UserRole.COST_ANALYST]: false, [UserRole.AREA_ANALYST]: false
      },
      'Justificar Desvios': {
        [UserRole.ADMIN]: true, [UserRole.DIRETORIA]: false, [UserRole.ADMIN_UNIDADE]: true,
        [UserRole.ENTITY_MANAGER]: true, [UserRole.PACKAGE_MANAGER]: true, [UserRole.AREA_MANAGER]: true,
        [UserRole.COST_ANALYST]: true, [UserRole.AREA_ANALYST]: true
      }
    },
    'Orçamento': {
      'Criar Versão de Orçamento': {
        [UserRole.ADMIN]: true, [UserRole.DIRETORIA]: false, [UserRole.ADMIN_UNIDADE]: true,
        [UserRole.ENTITY_MANAGER]: false, [UserRole.PACKAGE_MANAGER]: false, [UserRole.AREA_MANAGER]: false,
        [UserRole.COST_ANALYST]: true, [UserRole.AREA_ANALYST]: false
      },
      'Importar Massivo (Excel)': {
        [UserRole.ADMIN]: true, [UserRole.DIRETORIA]: false, [UserRole.ADMIN_UNIDADE]: false,
        [UserRole.ENTITY_MANAGER]: false, [UserRole.PACKAGE_MANAGER]: false, [UserRole.AREA_MANAGER]: false,
        [UserRole.COST_ANALYST]: true, [UserRole.AREA_ANALYST]: false
      },
      'Editar Parâmetros de Mão de Obra': {
        [UserRole.ADMIN]: true, [UserRole.DIRETORIA]: false, [UserRole.ADMIN_UNIDADE]: true,
        [UserRole.ENTITY_MANAGER]: false, [UserRole.PACKAGE_MANAGER]: false, [UserRole.AREA_MANAGER]: false,
        [UserRole.COST_ANALYST]: true, [UserRole.AREA_ANALYST]: false
      }
    },
    'Cadastros e Configurações': {
      'Tabela de Usuários': {
        [UserRole.ADMIN]: true, [UserRole.DIRETORIA]: false, [UserRole.ADMIN_UNIDADE]: true,
        [UserRole.ENTITY_MANAGER]: false, [UserRole.PACKAGE_MANAGER]: false, [UserRole.AREA_MANAGER]: false,
        [UserRole.COST_ANALYST]: false, [UserRole.AREA_ANALYST]: false
      },
      'Plano de Contas Master/Pacote': {
        [UserRole.ADMIN]: true, [UserRole.DIRETORIA]: false, [UserRole.ADMIN_UNIDADE]: false,
        [UserRole.ENTITY_MANAGER]: false, [UserRole.PACKAGE_MANAGER]: false, [UserRole.AREA_MANAGER]: false,
        [UserRole.COST_ANALYST]: true, [UserRole.AREA_ANALYST]: false
      },
      'Configuração de Setores (CR/PDV)': {
        [UserRole.ADMIN]: true, [UserRole.DIRETORIA]: false, [UserRole.ADMIN_UNIDADE]: true,
        [UserRole.ENTITY_MANAGER]: false, [UserRole.PACKAGE_MANAGER]: false, [UserRole.AREA_MANAGER]: false,
        [UserRole.COST_ANALYST]: true, [UserRole.AREA_ANALYST]: false
      }
    }
  });
  
  // Financial Import State (shared for Real tab)
  const [importText, setImportText] = useState('');
  const [parsedData, setParsedData] = useState<ImportedRow[]>([]);
  const [importStep, setImportStep] = useState<'input' | 'preview'>('input');
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [importYear, setImportYear] = useState<number>(new Date().getFullYear());

  // Budget 2026 Import State (separate from Real import)
  const [budgetImportText, setBudgetImportText] = useState('');
  const [budgetParsedData, setBudgetParsedData] = useState<ImportedRow[]>([]);
  const [budgetImportStep, setBudgetImportStep] = useState<'input' | 'preview' | 'done'>('input');
  const [budgetImportSaving, setBudgetImportSaving] = useState(false);
  const [budgetImportSavedCount, setBudgetImportSavedCount] = useState<number | null>(null);

  // Cost Center Import State
  const [ccImportStep, setCcImportStep] = useState<'input' | 'preview'>('input');
  const [ccParsedData, setCcParsedData] = useState<ImportedCostCenter[]>([]);
  const [ccImportMode, setCcImportMode] = useState<'append' | 'replace'>('append');
  const [ccSearchTerm, setCcSearchTerm] = useState('');

  // Account Import State
  const [accImportStep, setAccImportStep] = useState<'input' | 'preview'>('input');
  const [accParsedData, setAccParsedData] = useState<ImportedAccount[]>([]);
  const [accImportMode, setAccImportMode] = useState<'append' | 'replace'>('append');
  const [accSearchTerm, setAccSearchTerm] = useState('');

  // Account View Customization
  const [collapsedMasterPackages, setCollapsedMasterPackages] = useState<Set<string>>(new Set());
  const [collapsedPackages, setCollapsedPackages] = useState<Set<string>>(new Set());
  const [accountViewLevel, setAccountViewLevel] = useState<'master' | 'package' | 'account'>('account');

  const uniqueMasterPackages = useMemo(() => {
    const map = new Map<string, {name: string, code: string}>();
    accounts.forEach(a => {
        if (a.masterPackage) map.set(a.masterPackage, { name: a.masterPackage, code: a.masterPackageCode || '' });
    });
    return Array.from(map.values());
  }, [accounts]);

  const uniqueSubPackages = useMemo(() => {
    const map = new Map<string, {name: string, code: string, masterName: string}>();
    accounts.forEach(a => {
        if (a.package) map.set(a.package, { name: a.package, code: a.packageCode || '', masterName: a.masterPackage || '' });
    });
    return Array.from(map.values());
  }, [accounts]);


  const toggleMasterExpand = (name: string) => {
    setCollapsedMasterPackages(prev => {
        const next = new Set(prev);
        if (next.has(name)) next.delete(name);
        else next.add(name);
        return next;
    });
  };

  const togglePackageExpand = (name: string) => {
    setCollapsedPackages(prev => {
        const next = new Set(prev);
        if (next.has(name)) next.delete(name);
        else next.add(name);
        return next;
    });
  };

  const setAllLevel = (level: 'master' | 'package' | 'account') => {
      setAccountViewLevel(level);
      if (level === 'master') {
          setCollapsedMasterPackages(new Set(uniqueMasterPackages.map(m => m.name)));
          setCollapsedPackages(new Set(uniqueSubPackages.map(p => p.name)));
      } else if (level === 'package') {
          setCollapsedMasterPackages(new Set());
          setCollapsedPackages(new Set(uniqueSubPackages.map(p => p.name)));
      } else {
          setCollapsedMasterPackages(new Set());
          setCollapsedPackages(new Set());
      }
  };

  const [pickingFor, setPickingFor] = useState<{ sectionId: string, packageId: string } | null>(null);

  const handleAccountDragStart = (e: React.DragEvent, id: string, type: 'account' | 'pkg' | 'master') => {
    e.dataTransfer.setData('sourceId', id);
    e.dataTransfer.setData('sourceType', type);
    e.currentTarget.classList.add('opacity-40');
  };

  const handleAccountDragEnd = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('opacity-40');
  };

  const handleAccountDrop = (e: React.DragEvent, targetId: string, targetType: 'account' | 'pkg' | 'master') => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('sourceId');
    const sourceType = e.dataTransfer.getData('sourceType');
    if (sourceId === targetId) return;

    setAccounts(prev => {
        const sorted = [...prev].sort((a,b) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.id.localeCompare(b.id));
        
        if (sourceType === 'account' && targetType === 'account') {
            const srcIdx = sorted.findIndex(a => a.id === sourceId);
            const tgtIdx = sorted.findIndex(a => a.id === targetId);
            const [moved] = sorted.splice(srcIdx, 1);
            sorted.splice(tgtIdx, 0, moved);
        } else if (sourceType === 'pkg' && targetType === 'pkg') {
            const srcSet = sorted.filter(a => a.package === sourceId);
            const rest = sorted.filter(a => a.package !== sourceId);
            const tgtIdx = srcSet[0].masterPackage === sourceId ? -1 : rest.findIndex(a => a.package === targetId);
            if (tgtIdx !== -1) rest.splice(tgtIdx, 0, ...srcSet);
            return rest.map((a, i) => ({ ...a, sortOrder: i }));
        } else if (sourceType === 'master' && targetType === 'master') {
            const srcSet = sorted.filter(a => a.masterPackage === sourceId);
            const rest = sorted.filter(a => a.masterPackage !== sourceId);
            const tgtIdx = rest.findIndex(a => a.masterPackage === targetId);
            if (tgtIdx !== -1) rest.splice(tgtIdx, 0, ...srcSet);
            return rest.map((a, i) => ({ ...a, sortOrder: i }));
        }
        
        return sorted.map((a, i) => ({ ...a, sortOrder: i }));
    });
  };
  const [newSectionName, setNewSectionName] = useState('');
  const [isAddingSection, setIsAddingSection] = useState(false);
  const [addingPackageTo, setAddingPackageTo] = useState<string | null>(null);
  const [newPackageName, setNewPackageName] = useState('');

  const dreIdCounter = useRef(0);
  const getNextId = (prefix: string) => `${prefix}-${dreIdCounter.current++}`;

  // Revenue Import State (9 Cols)
  // const [revImportText, setRevImportText] = useState('');
  // const [revImportStep, setRevImportStep] = useState<'input' | 'preview'>('input');

  // --- GLOBAL IMPORT STATE ---
  // const [importGlobalHotelId, setImportGlobalHotelId] = useState('');
  // const [importGlobalYear, setImportGlobalYear] = useState(new Date().getFullYear());
  // const [importGlobalScenario, setImportGlobalScenario] = useState<'Real' | 'Budget'>('Real');

  // --- SPREADSHEET DATA STATE ---
  /*
  const [extraRevGrid, setExtraRevGrid] = useState<Record<string, Record<number, string>>>({});
  const [taxGrid, setTaxGrid] = useState<Record<string, Record<number, string>>>({});
  const [occGrid, setOccGrid] = useState<Record<string, Record<number, string>>>({});
  */

  // --- SPREADSHEET HANDLERS ---
  /*
  const handleSpreadsheetCellChange = (
      module: 'extra_revenue' | 'taxes' | 'occupancy',
      rowLabel: string,
      month: number,
      value: string
  ) => {
      const setter = module === 'extra_revenue' ? setExtraRevGrid : 
                     module === 'taxes' ? setTaxGrid : setOccGrid;
      
      setter(prev => ({
          ...prev,
          [rowLabel]: {
              ...(prev[rowLabel] || {}),
              [month]: value
          }
      }));
  };

  const handleSpreadsheetPaste = (
      module: 'extra_revenue' | 'taxes' | 'occupancy',
      startRowLabel: string,
      startMonth: number,
      pastedData: string[][]
  ) => {
      const setter = module === 'extra_revenue' ? setExtraRevGrid : 
                     module === 'taxes' ? setTaxGrid : setOccGrid;
      const rowLabels = module === 'extra_revenue' ? extraRevRows : 
                        module === 'taxes' ? taxRows : occRows;

      setter(prev => {
          const newGrid = { ...prev };
          const startRowIdx = rowLabels.indexOf(startRowLabel);
          
          if (startRowIdx === -1) return prev;

          pastedData.forEach((rowData, rIdx) => {
              const currentRowLabel = rowLabels[startRowIdx + rIdx];
              if (!currentRowLabel) return;

              if (!newGrid[currentRowLabel]) newGrid[currentRowLabel] = {};

              rowData.forEach((cellValue, cIdx) => {
                  const currentMonth = startMonth + cIdx;
                  if (currentMonth > 12) return;
                  
                  // Basic cleanup of pasted value
                  const cleanVal = cellValue.trim();
                  newGrid[currentRowLabel][currentMonth] = cleanVal;
              });
          });
          return newGrid;
      });
  };

  const handleSpreadsheetImport = (module: 'extra_revenue' | 'taxes' | 'occupancy') => {
      if (!importGlobalHotelId) {
          alert("Por favor, selecione o Hotel nos parâmetros globais.");
          return;
      }

      const grid = module === 'extra_revenue' ? extraRevGrid : 
                   module === 'taxes' ? taxGrid : occGrid;
      
      const hotelObj = hotels.find(h => h.id === importGlobalHotelId);
      const hotelCode = hotelObj ? hotelObj.code : '';
      const hotelName = hotelObj ? hotelObj.name : '';

      const parsed: ImportedRow[] = [];
      const rows = Object.keys(grid);
      let hasData = false;

      rows.forEach((rowLabel, idx) => {
          const monthData = grid[rowLabel];
          if (!monthData) return;

          Object.entries(monthData).forEach(([monthStr, valStr]) => {
              if (!valStr || valStr.trim() === '') return;
              
              const month = parseInt(monthStr);
              const cleanVal = valStr.replace(/\./g, '').replace(',', '.').trim();
              const val = parseFloat(cleanVal);
              
              if (isNaN(val)) return;

              hasData = true;
              
              let tipo = '';
              let conta = '';
              let cr = '';

              if (module === 'extra_revenue') {
                  tipo = 'Receita Extra';
                  conta = rowLabel; 
                  cr = 'Vendas'; // Default CR
              } else if (module === 'taxes') {
                  tipo = 'Imposto';
                  conta = rowLabel; 
                  cr = 'Fiscal'; // Default CR
              } else {
                  tipo = 'Indicador';
                  conta = rowLabel; 
                  cr = 'Geral'; // Default CR
              }

              parsed.push({
                  ano: importGlobalYear.toString(),
                  cenario: importGlobalScenario,
                  tipo,
                  hotel: hotelCode || hotelName, // Use code if avail, else name
                  conta,
                  cr,
                  mes: month.toString(),
                  valor: val.toString(),
                  status: 'valid',
                  msg: '',
                  originalLine: idx + 1
              });
          });
      });

      if (!hasData) {
          alert("Nenhum dado preenchido na tabela.");
          return;
      }

      if (onImportData) {
          onImportData(parsed, 'append'); 
      }
      
      alert(`Importação de ${module === 'extra_revenue' ? 'Receitas Extras' : module === 'taxes' ? 'Impostos' : 'Ocupação'} concluída com sucesso! ${parsed.length} registros processados.`);
      
      // Clear grid
      if (module === 'extra_revenue') setExtraRevGrid({});
      else if (module === 'taxes') setTaxGrid({});
      else setOccGrid({});
  };
  */

  // --- LOCAL UI STATE ---
  
  // --- IMPORT SUMMARY CALCULATION ---
  const { errorRows, summaryRows } = useMemo(() => {
      const data: ImportedRow[] = parsedData;
      
      const errors: ImportedRow[] = [];
      const valid: ImportedRow[] = [];
      
      data.forEach(row => {
          if (row.status === 'error') errors.push(row);
          else valid.push(row);
      });

      // Group valid rows for summary view
      const summaryMap = new Map<string, {
          hotel: string, 
          ano: string, 
          mes: string, 
          cenario: string, 
          tipo: string, 
          total: number,
          count: number 
      }>();

      valid.forEach(row => {
          // Grouping logic
          const groupingType = row.tipo;
          
          const key = `${row.hotel}|${row.ano}|${row.mes}|${row.cenario}|${groupingType}`;
          if (!summaryMap.has(key)) {
              summaryMap.set(key, {
                  hotel: row.hotel,
                  ano: row.ano,
                  mes: row.mes,
                  cenario: row.cenario,
                  tipo: groupingType,
                  total: 0,
                  count: 0
              });
          }
          const entry = summaryMap.get(key)!;
          const val = parseFloat(row.valor.replace(',', '.')) || 0;
          entry.total += val;
          entry.count += 1;
      });

      return {
          errorRows: errors,
          summaryRows: Array.from(summaryMap.values())
      };
  }, [parsedData]);


  const [dreStructure, setDreStructure] = useState<DreSection[]>(() => {
    // Initial DRE generation logic
    const rawData = getForecastData();
    const sections: DreSection[] = [];
    let currentSection: DreSection | undefined;
    let currentPackage: DrePackage | undefined;

    rawData.forEach(row => {
        if (['Indicators', 'Spacer', 'Staff'].includes(row.category)) return;

        if (row.indentLevel === 0) {
            const isResult = row.isTotal || row.id === 'REV-NET' || row.category === 'Result';
            currentSection = {
                id: row.id,
                name: row.label,
                type: isResult ? 'result' : 'section',
                items: []
            };
            sections.push(currentSection);
            currentPackage = undefined;
        } else if (row.indentLevel === 1 && currentSection && currentSection.type === 'section') {
            currentPackage = {
                id: row.id,
                name: row.label,
                accounts: [],
                isExpanded: false
            };
            currentSection.items.push(currentPackage);
        } else if (row.indentLevel === 2 && currentPackage) {
            currentPackage.accounts.push({ id: row.id, name: row.label });
        }
    });
    return sections;
  });

  // --- MODAL & FORM STATE ---
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form States
  const [userForm, setUserForm] = useState({ name: '', email: '', role: UserRole.PACKAGE_MANAGER, hotelId: '', password: '' });
  const [costCenterForm, setCostCenterForm] = useState({ id: '', code: '', name: '', directorate: '', department: '', type: 'CR' as 'CR' | 'PDV', hotelName: '', hierarchicalCode: '', companyCode: '' });
  const [hotelForm, setHotelForm] = useState({ id: '', name: '' });
  const [accountForm, setAccountForm] = useState<Account>({ 
    id: '', 
    code: '', 
    name: '', 
    package: '', 
    packageCode: '', 
    masterPackage: '', 
    masterPackageCode: '', 
    type: 'Fixed',
    sortOrder: 0,
    outOfScope: false,
    level: 'account'
  });
  
  const [gmdForm, setGmdForm] = useState<Partial<GMDConfiguration>>({
    hotelId: '',
    entityManagerIds: [],
    packageId: '',
    packageManagerId: '',
    supportUserIds: [],
    linkedAccountIds: [],
    costCenterId: '',
    accountManagerId: ''
  });
  
  const [dreParams, setDreParams] = useState({
    showEmptyRows: true,
    showAccountCodes: true,
    showMasterPackages: true,
    compareWithLastYear: true,
    compareWithBudget: true
  });
  
  // GMD Wizard State
  // --- HANDLERS: OPEN MODALS ---
  
  const openNewUser = () => {
      setEditingId(null);
      setUserForm({ name: '', email: '', role: UserRole.PACKAGE_MANAGER, hotelId: '', password: '' });
      setActiveModal('user');
  };

  const openEditUser = (id: string) => {
      const u = users.find(i => i.id === id);
      if (u) {
          setEditingId(id);
          setUserForm({ name: u.name, email: u.email, role: u.role, hotelId: u.hotelId || '', password: '' });
          setActiveModal('user');
      }
  };

  const openNewCostCenter = () => {
      setEditingId(null);
      setCostCenterForm({ id: '', code: '', name: '', directorate: '', department: '', type: 'CR', hotelName: '', hierarchicalCode: '', companyCode: '' });
      setActiveModal('costCenter');
  };

  const openEditCostCenter = (id: string) => {
      const cc = costCenters.find(i => i.id === id);
      if (cc) {
          setEditingId(id);
          setCcImportStep('input'); // Reset import step if it was open
          setCostCenterForm({ 
            id: cc.id, 
            code: cc.code || '', 
            name: cc.name, 
            directorate: cc.directorate || '', 
            department: cc.department || '', 
            type: cc.type || 'CR',
            hotelName: cc.hotelName || '',
            hierarchicalCode: cc.hierarchicalCode || '',
            companyCode: cc.companyCode || ''
          });
          setActiveModal('costCenter');
      }
  };

  const openNewHotel = () => {
      setEditingId(null);
      setHotelForm({ id: '', name: '' });
      setActiveModal('hotel');
  };

  const openEditHotel = (id: string) => {
      const h = hotels.find(i => i.id === id);
      if (h) {
          setEditingId(id);
          setHotelForm({ id: h.id, name: h.name });
          setActiveModal('hotel');
      }
  };

  const handleSaveHotel = async () => {
      if (!hotelForm.name) return;
      
      const hotelId = editingId || hotelForm.id || hotelForm.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const hotelCode = hotelForm.id || hotelForm.name.substring(0, 3).toUpperCase();
      
      const newHotel: Hotel = { 
          id: hotelId, 
          name: hotelForm.name, 
          code: hotelCode 
      };

      try {
          await supabaseService.upsertHotels([newHotel]);
          if (editingId) {
              setHotels(prev => prev.map(h => h.id === editingId ? newHotel : h));
          } else {
              setHotels(prev => [...prev, newHotel]);
          }
          setActiveModal(null);
      } catch (err: any) {
          console.error("Erro ao salvar hotel:", err);
          const msg = err?.message || err?.details || JSON.stringify(err);
          alert(`Erro ao salvar hotel: ${msg}`);
      }
  };

  const openNewAccount = () => {
      setEditingId(null);
      setAccountForm({ 
        id: '', 
        code: '', 
        name: '', 
        package: '', 
        packageCode: '',
        masterPackage: '', 
        masterPackageCode: '',
        type: 'Fixed',
        sortOrder: accounts.length,
        outOfScope: false,
        level: 'account'
      });
      setActiveModal('account');
  };

  const openEditAccount = (id: string) => {
      const acc = accounts.find(i => i.id === id);
      if (acc) {
          setEditingId(id);
          setAccountForm({ 
            id: acc.id, 
            code: acc.code || acc.id, 
            name: acc.name, 
            package: acc.package || '', 
            packageCode: acc.packageCode || '',
            masterPackage: acc.masterPackage || '', 
            masterPackageCode: acc.masterPackageCode || '',
            type: acc.type || 'Fixed',
            sortOrder: acc.sortOrder || 0,
            outOfScope: acc.outOfScope || false,
            level: acc.level || 'account'
          });
          setActiveModal('account');
      }
  };

  const openNewGMD = () => {
      setEditingId(null);
      setGmdForm({
          hotelId: '',
          entityManagerIds: [],
          packageId: '',
          packageManagerId: '',
          supportUserIds: [],
          linkedAccountIds: [],
          costCenterId: '',
          accountManagerId: ''
      });
      setActiveModal('gmd');
  };

  const openEditGMD = (id: string) => {
      const gmd = gmdConfigs.find(g => g.id === id);
      if (gmd) {
          setEditingId(id);
          setGmdForm({ ...gmd });
          setActiveModal('gmd');
      }
  };

  const handleSaveGMD = async () => {
      if (!gmdForm.hotelId || !gmdForm.packageId || !gmdForm.costCenterId) {
          alert("Por favor, preencha os campos obrigatórios (Hotel, Pacote e Setor).");
          return;
      }

      const newGMD: GMDConfiguration = {
          ...(gmdForm as GMDConfiguration),
          id: editingId || `gmd-${Date.now()}`
      };

      try {
          await supabaseService.upsertGmdConfig(newGMD);
          if (editingId) {
              setGmdConfigs(prev => prev.map(g => g.id === editingId ? newGMD : g));
          } else {
              setGmdConfigs(prev => [...prev, newGMD]);
          }
          setActiveModal(null);
      } catch (err: any) {
          console.error("Erro ao salvar GMD:", err);
          const msg = err?.message || err?.details || JSON.stringify(err);
          alert(`Erro ao salvar GMD: ${msg}`);
      }
  };

  // --- HANDLERS: SAVE ---

  const handleSaveUser = async () => {
      if (!userForm.name) return;
      
      let finalId = editingId || `u-${Date.now()}`;
      
      try {
          const newUserReq: User = { 
              id: finalId, 
              name: userForm.name,
              email: userForm.email,
              role: userForm.role,
              hotelId: userForm.hotelId,
              tempPassword: userForm.password || undefined
          };

          const returnedUuid = await supabaseService.adminSaveProfile(newUserReq);
          newUserReq.id = returnedUuid;
          
          if (editingId) {
              setUsers(prev => prev.map(u => u.id === editingId ? newUserReq : u));
          } else {
              setUsers(prev => [...prev, newUserReq]);
          }
          setActiveModal(null);
      } catch (err: any) {
          console.error("Erro ao salvar usuário:", err);
          const msg = err?.message || err?.details || JSON.stringify(err);
          alert(`Erro ao salvar usuário: ${msg}`);
      }
  };

  const handleSaveCostCenter = async () => {
      if (!costCenterForm.name || !costCenterForm.id) return;
      const newCC: CostCenter = { 
        ...costCenterForm,
        code: costCenterForm.id // Ensure code matches ID
      };

      try {
          await supabaseService.upsertCostCenters([newCC]);
          if (editingId) {
              setCostCenters(prev => prev.map(cc => cc.id === editingId ? newCC : cc));
          } else {
              setCostCenters(prev => [...prev, newCC]);
          }
          setActiveModal(null);
      } catch (err: any) {
          console.error("Erro ao salvar setor:", err);
          const msg = err?.message || err?.details || JSON.stringify(err);
          alert(`Erro ao salvar setor: ${msg}`);
      }
  };

  const handleSaveAccount = async () => {
      if (!accountForm.name || (accountForm.level === 'account' && !accountForm.id)) return;
      
      let finalForm = { ...accountForm };
      
      // Level-specific logic
      if (accountForm.level === 'master') {
          finalForm.masterPackage = accountForm.name;
          finalForm.masterPackageCode = accountForm.code;
          finalForm.package = '';
          finalForm.packageCode = '';
          if (!editingId) finalForm.id = `master-${Date.now()}`;
      } else if (accountForm.level === 'pkg') {
          finalForm.package = accountForm.name;
          finalForm.packageCode = accountForm.code;
          if (!editingId) finalForm.id = `pkg-${Date.now()}`;
      } else if (accountForm.level === 'account') {
          // Normal account logic
      }

      if (editingId) {
          const updated = accounts.map(acc => acc.id === editingId ? { ...acc, ...finalForm } : acc);
          setAccounts(updated);
          try { 
              await supabaseService.upsertAccounts(updated.filter(a => a.id === editingId)); 
          } catch(e: any) { 
              console.error(e); 
              alert(`Erro ao atualizar conta: ${e?.message || JSON.stringify(e)}`);
          }
      } else {
          const newAcc: Account = { 
              ...finalForm, 
              id: finalForm.id || `gen-${Date.now()}`, 
              code: finalForm.id || `gen-${Date.now()}`,
              sortOrder: accounts.length
          };
          const updated = [...accounts, newAcc];
          setAccounts(updated);
          try { 
              await supabaseService.upsertAccounts([newAcc]); 
          } catch(e: any) { 
              console.error(e);
              alert(`Erro ao criar conta: ${e?.message || JSON.stringify(e)}`);
          }
      }
      setActiveModal(null);
  };

  const handleDeleteAccountRow = async (id: string, type: 'account' | 'pkg' | 'master' = 'account', name?: string) => {
    const msg = type === 'master' ? `Excluir o Pacote Master "${name}" e TODAS as suas contas?` :
                type === 'pkg' ? `Excluir o Pacote "${name}" e TODAS as suas contas?` :
                "Tem certeza que deseja excluir esta conta?";
                
    if (!confirm(msg)) return;
    
    let toDeleteIds: string[] = [];
    
    if (type === 'master') {
        toDeleteIds = accounts.filter(a => a.masterPackage === name).map(a => a.id);
    } else if (type === 'pkg') {
        toDeleteIds = accounts.filter(a => a.package === name).map(a => a.id);
    } else {
        toDeleteIds = [id];
    }
    
    setAccounts(prev => prev.filter(a => !toDeleteIds.includes(a.id)));
    
    try { 
        for (const tid of toDeleteIds) {
            await supabaseService.deleteAccount(tid); 
        }
    } catch(e) { 
        console.error(e); 
    }
  };

  // --- DRE STRUCTURE HANDLERS ---
  const addDreSection = () => {
    if (!newSectionName.trim()) return;
    const newSection: DreSection = {
      id: getNextId('sec'),
      name: newSectionName.trim(),
      type: 'section',
      items: []
    };
    setDreStructure(prev => [...prev, newSection]);
    setNewSectionName('');
    setIsAddingSection(false);
  };

  const deleteDreSection = (id: string) => {
    setDreStructure(prev => prev.filter(s => s.id !== id));
  };

  const addDrePackage = (sectionId: string) => {
    if (!newPackageName.trim()) return;
    const newPackage: DrePackage = {
      id: getNextId('pkg'),
      name: newPackageName.trim(),
      accounts: []
    };
    setDreStructure(prev => prev.map(s => s.id === sectionId ? { ...s, items: [...s.items, newPackage] } : s));
    setNewPackageName('');
    setAddingPackageTo(null);
  };

  const deleteDrePackage = (sectionId: string, packageId: string) => {
    setDreStructure(prev => prev.map(s => s.id === sectionId ? { ...s, items: s.items.filter(p => p.id !== packageId) } : s));
  };

  const addDreAccount = (sectionId: string, packageId: string, accountId: string, accountName: string) => {
    setDreStructure(prev => prev.map(s => s.id === sectionId ? {
      ...s,
      items: s.items.map(p => p.id === packageId ? {
        ...p,
        accounts: [...p.accounts, { id: accountId, name: accountName }]
      } : p)
    } : s));
  };

  const deleteDreAccount = (sectionId: string, packageId: string, accountId: string) => {
    setDreStructure(prev => prev.map(s => s.id === sectionId ? {
      ...s,
      items: s.items.map(p => p.id === packageId ? {
        ...p,
        accounts: p.accounts.filter(a => a.id !== accountId)
      } : p)
    } : s));
  };

  const processCostCenterImport = () => {
    if (!importText.trim()) return;

    const rows = importText.split('\n');
    const firstRow = rows[0];
    
    // Detect separator: tab or semicolon
    const separator = firstRow.includes('\t') ? '\t' : (firstRow.includes(';') ? ';' : '\t');
    
    const firstRowCols = firstRow.split(separator);
    const hasHeader = isNaN(Number(firstRowCols[3])); // Check if 'Código' column is a number
    const startIdx = hasHeader ? 1 : 0;
    
    const parsed: ImportedCostCenter[] = [];

    for (let i = startIdx; i < rows.length; i++) {
        const rowContent = rows[i].trim();
        if (!rowContent) continue;

        const cols = rows[i].split(separator);
        
        // Expected: Hotel | Hierarquico | Descrição | Código | Código da Empresa | Departamento | Diretoria | Tipo
        if (cols.length < 4) {
            parsed.push({
                id: `error-${i}`,
                hierarchicalCode: '',
                hotelName: '',
                name: rowContent,
                type: 'CR',
                directorate: '',
                department: '',
                companyCode: '',
                status: 'error',
                msg: 'Colunas insuficientes (Mínimo: Hotel, Hierarquico, Descrição, Código)',
                originalLine: i + 1
            });
            continue;
        }

        // Mapping based on spreadsheet:
        // 0: Hotel, 1: Hierarquico, 2: Descrição, 3: Código, 4: Código da Empresa, 5: Departamento, 6: Diretoria, 7: Tipo
        const [hotel, hCode, name, id, compCode, dep, dir, type] = cols.map(c => c?.trim() || '');
        
        let status: 'valid' | 'error' = 'valid';
        const msgParts: string[] = [];

        if (!id) { status = 'error'; msgParts.push('Código (ID) ausente'); }
        if (!name) { status = 'error'; msgParts.push('Descrição ausente'); }
        
        const normType = (type || '').toUpperCase().includes('PDV') ? 'PDV' : 'CR';

        parsed.push({
            id,
            hierarchicalCode: hCode,
            hotelName: hotel,
            name,
            type: normType,
            directorate: dir,
            department: dep,
            companyCode: compCode,
            status,
            msg: msgParts.join(' | '),
            originalLine: i + 1
        });
    }

    setCcParsedData(parsed);
    setCcImportStep('preview');
  };

  const handleFinalCostCenterImport = async () => {
    const validData = ccParsedData.filter(r => r.status === 'valid');
    if (validData.length === 0) return;

    const newCostCenters: CostCenter[] = validData.map(r => ({
        id: r.id,
        code: r.id,
        name: r.name,
        type: r.type,
        directorate: r.directorate,
        department: r.department,
        hotelName: r.hotelName,
        hierarchicalCode: r.hierarchicalCode,
        companyCode: r.companyCode
    }));

    try {
        await supabaseService.upsertCostCenters(newCostCenters);
        
        if (ccImportMode === 'replace') {
            setCostCenters(newCostCenters);
        } else {
            setCostCenters(prev => {
                const map = new Map(prev.map(cc => [cc.id, cc]));
                newCostCenters.forEach(cc => map.set(cc.id, cc));
                return Array.from(map.values());
            });
        }

        setCcImportStep('input');
        setCcParsedData([]);
        setImportText('');
        alert(`${validData.length} setores importados e sincronizados com sucesso!`);
    } catch (err) {
        console.error("Erro ao importar setores no Supabase:", err);
        alert("Erro ao sincronizar com banco de dados.");
    }
  };

  const processAccountImport = () => {
    if (!importText.trim()) return;

    const rows = importText.split('\n');
    const firstRow = rows[0];
    
    // Detect separator: tab or semicolon
    const separator = firstRow.includes('\t') ? '\t' : (firstRow.includes(';') ? ';' : '\t');
    
    const parsed: ImportedAccount[] = [];

    for (let i = 0; i < rows.length; i++) {
        const rowContent = rows[i].trim();
        if (!rowContent) continue;

        // SKIP HEADER ROW: if the first column is 'Código', skip it
        if (i === 0 && (rowContent.toLowerCase().includes('código') || rowContent.toLowerCase().includes('codigo'))) {
            continue;
        }

        const cols = rows[i].split(separator);
        
        // Expected: Código | Conta Contábil | Pacote | Pacote Master
        if (cols.length < 2) {
            parsed.push({
                id: `error-${i}`,
                name: rowContent,
                status: 'error',
                msg: 'Colunas insuficientes (Mínimo: Código, Nome)',
                originalLine: i + 1
            });
            continue;
        }

        const [id, name, pacote, masterPacote] = cols.map(c => c?.trim() || '');
        
        let status: 'valid' | 'error' = 'valid';
        const msgParts: string[] = [];

        if (!id) { status = 'error'; msgParts.push('Código ausente'); }
        if (!name) { status = 'error'; msgParts.push('Nome ausente'); }

        parsed.push({
            id,
            name,
            package: pacote,
            masterPackage: masterPacote,
            status,
            msg: msgParts.join(' | '),
            originalLine: i + 1
        });
    }
    setAccParsedData(parsed);
    setAccImportStep('preview');
  };

  const handleFinalAccountImport = async () => {
    const validData = accParsedData.filter(r => r.status === 'valid');
    if (validData.length === 0) return;

    const newAccounts: Account[] = validData.map((a, i) => ({ 
        id: a.id, 
        code: a.id, 
        name: a.name, 
        package: a.package, 
        masterPackage: a.masterPackage,
        type: 'Fixed' as const,
        sortOrder: accounts.length + i // Ensure unique sequential order
    }));

    // DEDUPLICATE: Postgres throws error if same ID appears twice in one upsert batch
    const deduplicatedRecordMap = new Map<string, Account>();
    newAccounts.forEach(acc => deduplicatedRecordMap.set(acc.id, acc));
    const uniqueAccountsToSave = Array.from(deduplicatedRecordMap.values());

    const updated = accImportMode === 'replace' ? uniqueAccountsToSave : (() => {
        const map = new Map(accounts.map(acc => [acc.id, acc]));
        uniqueAccountsToSave.forEach(acc => map.set(acc.id, acc));
        return Array.from(map.values());
    })();

    setAccounts(updated);
    
    // PERSIST TO SUPABASE
    try {
        await supabaseService.upsertAccounts(uniqueAccountsToSave);
        alert(`${uniqueAccountsToSave.length} contas importadas e sincronizadas com sucesso!`);
    } catch (err: any) {
        console.error("Erro ao salvar no Supabase:", err);
        alert(`Erro ao sincronizar com banco de dados: ${err.message || JSON.stringify(err)}`);
    }

    setAccImportStep('input');
    setAccParsedData([]);
    setImportText('');
  };

  // --- HANDLERS: DELETE ---

  const handleDelete = async (type: 'users' | 'gmd' | 'hotels' | 'costCenters' | 'accounts', id: string) => {
      if (!confirm("Tem certeza que deseja excluir este item?")) return;
      
      try {
          switch(type) {
              case 'users': 
                  await supabaseService.deleteProfile(id);
                  setUsers(prev => prev.filter(i => i.id !== id)); 
                  break;
              case 'hotels': 
                  await supabaseService.deleteHotel(id);
                  setHotels(prev => prev.filter(i => i.id !== id)); 
                  break;
              case 'costCenters': 
                  await supabaseService.deleteCostCenter(id);
                  setCostCenters(prev => prev.filter(i => i.id !== id)); 
                  break;
              case 'accounts': 
                  await supabaseService.deleteAccount(id);
                  setAccounts(prev => prev.filter(i => i.id !== id)); 
                  break;
              case 'gmd': 
                  await supabaseService.deleteGmdConfig(id);
                  setGmdConfigs(prev => prev.filter(i => i.id !== id)); 
                  break;
          }
      } catch (err) {
          console.error(`Erro ao excluir ${type}:`, err);
          alert("Erro ao excluir no banco de dados.");
      }
  };

  // --- HANDLERS: FINANCIAL IMPORT (General) ---
  const processFinancialImport = () => {
      if (!importText.trim()) return;

      const rows = importText.split('\n');
      const firstRowCols = rows[0].split('\t');
      const hasHeader = isNaN(Number(firstRowCols[2])); // Mês is now at index 2
      const startIdx = hasHeader ? 1 : 0;
      
      const parsed: ImportedRow[] = [];

      // OPTIMIZATION: Pre-compute Sets for O(1) lookup
      const accountSet = new Set(accounts.map(a => a.name.trim().toLowerCase()));
      const crSet = new Set(costCenters.map(c => c.name.trim().toLowerCase()));

      for (let i = startIdx; i < rows.length; i++) {
          const rowContent = rows[i].trim();
          if (!rowContent) continue;

          const cols = rows[i].split('\t');
          
          let status: 'valid' | 'error' = 'valid';
          const msgParts: string[] = [];
          
          if (cols.length < 11) {
              status = 'error';
              msgParts.push(`Colunas insuficientes (${cols.length}/11). Verifique tabulação.`);
              while(cols.length < 11) cols.push('');
          }

          const [ano_col, escopo, mes, contaName, crName, valor, hotel, departamento, pacote, pacoteMaster, diretoria] = cols;
          
          // Se o cenário não vier na coluna, assumimos REAL por padrão para a aba de Real
          // Mas para manter compatibilidade com a lógica de handleFinalImport:
          const cenario = 'REAL'; 
          const tipo = 'Revenue'; // Valor padrão para tipo/natureza se omitido

          let finalVal = '';
          if (valor) {
               // Remove dots (thousands separator) and replace comma with dot
               const cleanValStr = valor.replace(/\./g, '').replace(',', '.').trim();
               const valNum = parseFloat(cleanValStr);
               if (!isNaN(valNum)) {
                   // Ensure integer as requested
                   finalVal = Math.round(valNum).toString();
               }
          }

          // Format Account Code if it is a 5-digit number (e.g. 64104 -> 64.104)
          let formattedContaName = contaName;
          const originalContaName = contaName;
          if (contaName && /^\d{5}$/.test(contaName.trim())) {
              formattedContaName = contaName.trim().replace(/^(\d{2})(\d{3})$/, '$1.$2');
          }

          if (status !== 'error') {
               if (isNaN(Number(mes.trim())) || Number(mes.trim()) < 1 || Number(mes.trim()) > 12) {
                   status = 'error';
                   msgParts.push(`Mês inválido: '${mes}'`);
               }
               if (finalVal === '' || valor.trim() === '') {
                   status = 'error';
                   msgParts.push(`Valor inválido: '${valor}'`);
               }
          }

          // Try to match formatted first, then original
          let matchedAccountName = '';
          if (accountSet.has(formattedContaName.trim().toLowerCase())) {
              matchedAccountName = formattedContaName;
          } else if (accountSet.has(originalContaName.trim().toLowerCase())) {
              matchedAccountName = originalContaName;
          }

          const accountExists = !!matchedAccountName;
          const crExists = crSet.has(crName.trim().toLowerCase());

          if (!accountExists) { 
              status = 'error'; 
              msgParts.push(`Conta contábil '${contaName}' não encontrada (Hotel: ${hotel})`); 
          }
          if (!crExists) { 
              status = 'error'; 
              msgParts.push(`Setor/CR '${crName}' não encontrado (Hotel: ${hotel})`); 
          }

          parsed.push({
              ano: ano_col || importYear.toString(), 
              cenario: cenario, 
              tipo: tipo, 
              hotel: hotel || '', 
              conta: matchedAccountName || contaName || '', 
              cr: crName || '', 
              mes: mes || '', 
              valor: finalVal || valor || '', 
              escopo: escopo || '',
              departamento: departamento || '',
              pacote: pacote || '',
              pacoteMaster: pacoteMaster || '',
              diretoria: diretoria || '',
              status, 
              msg: msgParts.join(' | '),
              originalLine: i + 1
          });
      }

      setParsedData(parsed);
      setImportStep('preview');
  };

  const handleFinalImport = (targetRealVersionId: string, targetBudgetVersionId: string) => {
      const dataToImport = parsedData;

      // Map version IDs to the rows based on cenario
      const finalData = dataToImport.filter(d => d.status === 'valid').map(d => {
          const isReal = d.cenario.toUpperCase() === 'REAL';
          return {
              ...d,
              versionId: isReal ? targetRealVersionId : targetBudgetVersionId
          };
      });

      if (onImportData) {
          onImportData(finalData, importMode);
      }
      
      const count = finalData.length;
      alert(`Importação concluída! ${count} registros processados.`);
      
      setImportStep('input');
      setImportText('');
      setParsedData([]);
      setImportMode('append');
  };

  // ─── Budget 2026 Import (13-column format) ─────────────────────────────────
  const processBudget2026Import = () => {
    if (!budgetImportText.trim()) return;
    setBudgetImportSavedCount(null);

    const rows = budgetImportText.split('\n');
    const firstRow = rows[0];
    const sep = firstRow.includes('\t') ? '\t' : ';';

    // Detect header: first cell should be text like 'Receita/ despesa'
    const firstCols = firstRow.split(sep);
    const hasHeader = isNaN(Number(firstCols[9])); // col 9 = Mês
    const startIdx = hasHeader ? 1 : 0;

    const parsed: ImportedRow[] = [];
    const accountSet = new Set(accounts.map(a => a.name.trim().toLowerCase()));
    const accountCodeSet = new Set(accounts.map(a => (a.code || '').trim().toLowerCase()).filter(Boolean));
    const crSet = new Set(costCenters.map(c => c.id.trim().toLowerCase()));
    const crNameSet = new Set(costCenters.map(c => c.name.trim().toLowerCase()));

    for (let i = startIdx; i < rows.length; i++) {
      const rowContent = rows[i].trim();
      if (!rowContent) continue;

      const cols = rows[i].split(sep).map(c => c?.trim() || '');

      let status: 'valid' | 'error' = 'valid';
      const msgParts: string[] = [];

      if (cols.length < 11) {
        status = 'error';
        msgParts.push(`Colunas insuficientes (${cols.length}/13). Verifique a tabulação.`);
        while (cols.length < 13) cols.push('');
      }

      // Column mapping:
      // 0: Receita/Despesa  1: Real/Meta  2: Escopo ou Fora  3: Filial
      // 4: CR Certo         5: Departamento  6: Descrição da Conta
      // 7: Pacote           8: Pacote Master  9: Mês  10: Valor
      // 11: CR              12: Conta Contábil
      const [
        tipoConta,   // Receita/Despesa
        realMeta,    // Real/Meta
        escopo,      // Escopo ou Fora
        filial,      // Filial
        crCerto,     // CR Certo
        departamento,// Departamento
        descConta,   // Descrição da Conta
        pacote,      // Pacote
        pacoteMaster,// Pacote Master
        mesRaw,      // Mês
        valorRaw,    // Valor
        crRaw,       // CR (ex: 1.1.1.004)
        contaContabil// Conta Contábil (ex: 4.01.01.01.006)
      ] = cols;

      // Validate month
      const mes = mesRaw?.trim();
      if (!mes || isNaN(Number(mes)) || Number(mes) < 1 || Number(mes) > 12) {
        status = 'error';
        msgParts.push(`Mês inválido: '${mes}'`);
      }

      // Validate & clean value
      const cleanVal = (valorRaw || '').replace(/\./g, '').replace(',', '.').trim();
      const valNum = parseFloat(cleanVal);
      let finalValor = '';
      if (isNaN(valNum)) {
        status = 'error';
        msgParts.push(`Valor inválido: '${valorRaw}'`);
      } else {
        finalValor = Math.round(valNum).toString();
      }

      // Match account by name or code (flexible)
      const descLower = (descConta || '').trim().toLowerCase();
      const ccLower   = (contaContabil || '').trim().toLowerCase();
      let matchedAccount = descConta || '';
      if (!accountSet.has(descLower) && !accountCodeSet.has(ccLower)) {
        // Non-blocking: we keep it valid but flag as warning
        // The account may not exist yet — allow import
      }

      // Only mark as error if BOTH cost center AND account are completely empty
      if (!descConta && !contaContabil) {
        status = 'error';
        msgParts.push('Descrição da Conta e Conta Contábil ausentes');
      }

      parsed.push({
        ano:          '2026',
        cenario:      'Meta',            // Budget 2026 is always 'Meta'
        tipo:         tipoConta || '',
        hotel:        filial || '',
        conta:        matchedAccount,
        cr:           crCerto || crRaw || '',
        mes:          mes || '',
        valor:        finalValor || '0',
        escopo:       escopo || '',
        departamento: departamento || '',
        pacote:       pacote || '',
        pacoteMaster: pacoteMaster || '',
        diretoria:    '',
        status,
        msg:          msgParts.join(' | '),
        originalLine: i + 1,
        // Extra fields stored on the row for Supabase
        ...({
          contaContabil: contaContabil || '',
          crCodigo:      crRaw || '',
          realMeta:      realMeta || 'Meta',
        } as any),
      });
    }

    setBudgetParsedData(parsed);
    setBudgetImportStep('preview');
  };

  const handleFinalBudget2026Import = async (targetBudgetVersionId: string) => {
    if (!targetBudgetVersionId) {
      alert('Selecione a versão de Budget de destino.');
      return;
    }

    const validRows = budgetParsedData.filter(r => r.status === 'valid');
    if (validRows.length === 0) {
      alert('Nenhum registro válido para importar.');
      return;
    }

    const rowsWithVersion = validRows.map(r => ({
      ...r,
      versionId: targetBudgetVersionId,
      cenario:   'Meta',
    }));

    // 1) Atualiza estado local (Tauá Real vai usar cenario=Meta como budget)
    if (onImportData) {
      onImportData(rowsWithVersion, 'append');
    }

    // 2) Persiste no Supabase
    setBudgetImportSaving(true);
    try {
      // Remove registros anteriores desta versão para evitar duplicados
      await supabaseService.deleteFinancialDataByVersion(targetBudgetVersionId);
      await supabaseService.saveFinancialData(rowsWithVersion);
      setBudgetImportSavedCount(rowsWithVersion.length);
      setBudgetImportStep('done');
    } catch (err: any) {
      console.error('Erro ao salvar orçamento no Supabase:', err);
      alert(`Dados importados localmente, mas erro ao salvar no banco:\n${err?.message || JSON.stringify(err)}`);
      setBudgetImportStep('done');
      setBudgetImportSavedCount(rowsWithVersion.length);
    } finally {
      setBudgetImportSaving(false);
    }
  };

  /*
  const processRevenueImport = () => {
    if (!revImportText.trim()) return;

    const rows = revImportText.split('\n');
    const firstRowCols = rows[0].split('\t');
    const hasHeader = isNaN(Number(firstRowCols[0]));
    const startIdx = hasHeader ? 1 : 0;
    
    const parsed: ImportedRow[] = [];

    // OPTIMIZATION: Pre-compute Sets for O(1) lookup
    const accountSet = new Set(accounts.map(a => a.name.trim().toLowerCase()));
    const crSet = new Set(costCenters.map(c => c.name.trim().toLowerCase()));

    for (let i = startIdx; i < rows.length; i++) {
        const rowContent = rows[i].trim();
        if (!rowContent) continue;

        const cols = rows[i].split('\t');
        
        let status: 'valid' | 'error' = 'valid';
        const msgParts: string[] = [];
        
        if (cols.length < 9) {
            status = 'error';
            msgParts.push(`Colunas insuficientes (${cols.length}/9). Necessário: Ano, Cenario, Natureza, Hotel, Conta, CR, Mes, Valor, Tipo`);
            while(cols.length < 9) cols.push('');
        }

        const [ano, cenario, natureza, hotel, contaName, crName, mes, valor, tipoClassificacao] = cols;

        let finalVal = '';
        if (valor) {
             const cleanValStr = valor.replace(/\./g, '').replace(',', '.').trim();
             const valNum = parseFloat(cleanValStr);
             if (!isNaN(valNum)) {
                 finalVal = Math.round(valNum).toString();
             }
        }

        // Format Account Code if it is a 5-digit number (e.g. 64104 -> 64.104)
        let formattedContaName = contaName;
        const originalContaName = contaName;
        if (contaName && /^\d{5}$/.test(contaName.trim())) {
            formattedContaName = contaName.trim().replace(/^(\d{2})(\d{3})$/, '$1.$2');
        }

        if (status !== 'error') {
             if (isNaN(Number(ano.trim())) || Number(ano.trim()) < 2000 || Number(ano.trim()) > 2100) {
                 status = 'error';
                 msgParts.push(`Ano inválido: '${ano}'`);
             }
             if (isNaN(Number(mes.trim())) || Number(mes.trim()) < 1 || Number(mes.trim()) > 12) {
                 status = 'error';
                 msgParts.push(`Mês inválido: '${mes}'`);
             }
             if (finalVal === '' || valor.trim() === '') {
                 status = 'error';
                 msgParts.push(`Valor inválido: '${valor}'`);
             }
        }

        // Try to match formatted first, then original
        let matchedAccountName = '';
        if (accountSet.has(formattedContaName.trim().toLowerCase())) {
            matchedAccountName = formattedContaName;
        } else if (accountSet.has(originalContaName.trim().toLowerCase())) {
            matchedAccountName = originalContaName;
        }

        const accountExists = !!matchedAccountName;
        const crExists = crSet.has(crName.trim().toLowerCase());

        if (!accountExists) { 
            status = 'error'; 
            msgParts.push(`Conta contábil '${contaName}' não encontrada (Hotel: ${hotel})`); 
        }
        if (!crExists) { 
            status = 'error'; 
            msgParts.push(`Setor/CR '${crName}' não encontrado (Hotel: ${hotel})`); 
        }

        parsed.push({
            id: `rev-${Date.now()}-${i}`,
            ano, cenario, tipo: natureza, hotelId: hotel, contaId: matchedAccountName || contaName, crId: crName, mes, 
            valor: finalVal || valor || '', 
            status, 
            msg: msgParts.join(' | '),
            originalLine: i + 1,
            classificacao: tipoClassificacao
        });
    }

    setRevParsedData(parsed);
    setRevImportStep('preview');
  };
  */

  const handleCreateBudgetVersion = async (year?: number, month?: number) => {
    const name = prompt('Nome da nova versão (ex: 2026 Oficial):');
    if (name) {
      const newVersion: BudgetVersion = {
        id: `v-${Date.now()}`,
        name,
        year: year || new Date().getFullYear(),
        month: month || 1,
        createdAt: new Date().toISOString(),
        isLocked: false,
        isMain: budgetVersions.length === 0
      };
      
      try {
        await supabaseService.upsertBudgetVersion(newVersion);
        setBudgetVersions(prev => [...prev, newVersion]);
        setActiveBudgetVersionId(newVersion.id);
      } catch (err) {
        console.error('Failed to save version:', err);
        alert('Erro ao salvar versão no banco.');
      }
    }
  };

  const handleCreateRealVersion = async (year?: number, month?: number) => {
    const name = prompt('Nome da nova versão de Realizado (ex: 2026 Real):');
    if (name) {
      const newVersion: BudgetVersion = {
        id: `r-${Date.now()}`,
        name,
        year: year || new Date().getFullYear(),
        month: month || 1,
        createdAt: new Date().toISOString(),
        isLocked: false,
        isMain: realVersions.length === 0
      };
      
      try {
        await supabaseService.upsertBudgetVersion(newVersion);
        setRealVersions(prev => [...prev, newVersion]);
        setActiveRealVersionId(newVersion.id);
      } catch (err) {
        console.error('Failed to save version:', err);
        alert('Erro ao salvar versão no banco.');
      }
    }
  };

  const handleToggleVersionLock = async (id: string, isBudget: boolean) => {
    const list = isBudget ? budgetVersions : realVersions;
    const version = list.find(v => v.id === id);
    if (!version) return;

    const updated = { ...version, isLocked: !version.isLocked };
    try {
      await supabaseService.upsertBudgetVersion(updated);
      if (isBudget) {
        setBudgetVersions(prev => prev.map(bv => bv.id === id ? updated : bv));
      } else {
        setRealVersions(prev => prev.map(rv => rv.id === id ? updated : rv));
      }
    } catch (err) {
      console.error('Failed to update version lock:', err);
    }
  };

  const handleDeleteVersion = async (id: string, isBudget: boolean) => {
    if (!confirm('Tem certeza que deseja excluir esta versão? Todos os dados vinculados serão perdidos.')) return;
    
    try {
      await supabaseService.deleteFinancialDataByVersion(id);
      await supabaseService.deleteBudgetVersion(id);
      
      if (isBudget) {
        setBudgetVersions(prev => prev.filter(v => v.id !== id));
        if (activeBudgetVersionId === id) setActiveBudgetVersionId('');
      } else {
        setRealVersions(prev => prev.filter(v => v.id !== id));
        if (activeRealVersionId === id) setActiveRealVersionId('');
      }
    } catch (err) {
      console.error('Failed to delete version:', err);
      alert('Erro ao excluir versão.');
    }
  };

  const handleAddScheduleStep = () => {
    const newStep: ScheduleItem = {
      id: `s-${Date.now()}`,
      step: 'Nova Etapa',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      status: 'pending'
    };
    setBudgetSchedule(prev => [...prev, newStep]);
  };

  const handleDeleteScheduleStep = (index: number) => {
    setBudgetSchedule(prev => prev.filter((_, i) => i !== index));
  };

  const renderLaborParametersForm = (versionId: string) => {
    const params = laborParametersMap[versionId] || laborParametersMap['v2']; // fallback
    
    const handleChange = <K extends keyof LaborParameters>(field: K, value: LaborParameters[K]) => {
      setLaborParametersMap(prev => ({
        ...prev,
        [versionId]: {
          ...(prev[versionId] || prev['v2']),
          [field]: value
        }
      }));
    };

    return (
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
          <Users className="text-indigo-600" size={20} />
          Parâmetros de Mão de Obra
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-700">Dissídio (%)</label>
            <input 
              type="number" 
              value={params.dissidioPct} 
              onChange={e => handleChange('dissidioPct', parseFloat(e.target.value))}
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-700">Mês do Dissídio (1-12)</label>
            <input 
              type="number" 
              min="1"
              max="12"
              value={params.dissidioMonth} 
              onChange={e => handleChange('dissidioMonth', parseInt(e.target.value))}
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-700">FGTS (%)</label>
            <input 
              type="number" 
              value={params.fgtsPct} 
              onChange={e => handleChange('fgtsPct', parseFloat(e.target.value))}
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-700">INSS (%)</label>
            <input 
              type="number" 
              value={params.inssPct} 
              onChange={e => handleChange('inssPct', parseFloat(e.target.value))}
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-700">PIS (%)</label>
            <input 
              type="number" 
              value={params.pisPct} 
              onChange={e => handleChange('pisPct', parseFloat(e.target.value))}
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-700">Outros Encargos (%)</label>
            <input 
              type="number" 
              value={params.chargesPct} 
              onChange={e => handleChange('chargesPct', parseFloat(e.target.value))}
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-700">% ISS sobre Receita</label>
            <input 
              type="number" 
              value={params.issRevenuePct} 
              onChange={e => handleChange('issRevenuePct', parseFloat(e.target.value))}
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-700">Refeição PAT (R$)</label>
            <input 
              type="number" 
              value={params.patMealValue} 
              onChange={e => handleChange('patMealValue', parseFloat(e.target.value))}
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-700">Valor Hora Extra (R$)</label>
            <input 
              type="number" 
              value={params.overtimeHourValue} 
              onChange={e => handleChange('overtimeHourValue', parseFloat(e.target.value))}
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-700">Direito a Benefícios</label>
            <select 
              value={params.benefitsEligibility || 'emocionador'}
              onChange={e => handleChange('benefitsEligibility', e.target.value as LaborParameters['benefitsEligibility'])}
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
            >
              <option value="emocionador">Só Emocionador (CLT)</option>
              <option value="emocionador_extra">Emocionador + Extraordinário</option>
              <option value="emocionador_extra_others">Emocionador + Extraordinário + Outros</option>
            </select>
          </div>
          {params.benefitsEligibility === 'emocionador_extra_others' && (
            <div className="space-y-2">
              <label className="block text-sm font-bold text-gray-700">Qtd. Outros (Benefícios)</label>
              <input 
                type="number" 
                value={params.benefitsOthersCount || 0} 
                onChange={e => handleChange('benefitsOthersCount', parseInt(e.target.value))}
                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          )}
        </div>
        <div className="mt-8 flex justify-end">
          <button className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-700 transition-colors flex items-center gap-2">
            <Save size={18} /> Salvar Parâmetros
          </button>
        </div>
      </div>
    );
  };

  const renderTauáReal = () => {
    return (
      <div className="space-y-6">
        <div className="flex border-b border-gray-200 mb-6 overflow-x-auto">
          <button onClick={() => setActiveRealTab('versions')} className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeRealTab === 'versions' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Versões</button>
          <button onClick={() => setActiveRealTab('closure')} className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeRealTab === 'closure' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Fechamento</button>
          <button onClick={() => setActiveRealTab('import')} className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeRealTab === 'import' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Importação</button>
          <button onClick={() => setActiveRealTab('labor')} className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeRealTab === 'labor' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Mão de Obra</button>
          <button onClick={() => setActiveRealTab('schedule')} className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeRealTab === 'schedule' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Cronograma</button>
          <button onClick={() => setActiveRealTab('dre_params')} className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeRealTab === 'dre_params' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Parâmetros DRE</button>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm min-h-[400px]">
          {activeRealTab === 'versions' && (
            <TimelineView
              title="Planejamentos (Realizado)"
              versions={realVersions}
              activeVersionId={activeRealVersionId}
              onSelectVersion={setActiveRealVersionId}
              onToggleLock={(id) => handleToggleVersionLock(id, false)}
              onDelete={(id) => handleDeleteVersion(id, false)}
              onCreateVersion={handleCreateRealVersion}
            />
          )}
          {activeRealTab === 'closure' && (
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Lock className="text-indigo-600" size={20} />
                Fechamento de Meses
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => {
                  const key = `2024-${String(m).padStart(2, '0')}`;
                  const isClosed = monthStatus[key] === 'closed';
                  return (
                    <div key={m} className={`p-4 rounded-lg border flex items-center justify-between ${isClosed ? 'bg-gray-50 border-gray-200' : 'bg-indigo-50/30 border-indigo-100'}`}>
                      <span className="font-bold text-gray-700 capitalize">{new Date(2024, m-1).toLocaleString('pt-BR', { month: 'long' })}</span>
                      <button onClick={() => setMonthStatus(prev => ({ ...prev, [key]: isClosed ? 'open' : 'closed' }))} className={`p-2 rounded-md ${isClosed ? 'bg-gray-200 text-gray-600' : 'bg-indigo-600 text-white'}`}>
                        {isClosed ? <Lock size={18} /> : <LockOpen size={18} />}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {activeRealTab === 'import' && (
            <div className="space-y-6">
              <div className="space-y-4">
                {importStep === 'input' ? (
                  <>
                    <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-sm text-amber-800 mb-4">
                      <p className="font-bold mb-1">Instruções para Importação Financeira:</p>
                      <p>Cole os dados do Excel com as seguintes colunas (separadas por TAB):</p>
                      <code className="block mt-2 bg-white/50 p-2 rounded border border-amber-100 font-mono text-[10px]">
                        Ano | Escopo ou Fora | Mês | Classe Gerencial Nome | Centro de Resultado Nome | Valor Ajustado | Filial | Departamento | Pacote | Pacote Master | Diretoria
                      </code>
                    </div>
                    <div className="flex items-center gap-4 mb-4">
                      <label className="text-sm font-bold text-gray-700">Ano da Importação:</label>
                      <select 
                        value={importYear}
                        onChange={(e) => setImportYear(parseInt(e.target.value))}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                      >
                        {[2023, 2024, 2025, 2026, 2027].map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                    <textarea className="w-full h-64 p-4 border border-gray-300 rounded-lg font-mono text-xs" placeholder="Cole os dados do Excel aqui..." value={importText} onChange={(e) => setImportText(e.target.value)} />
                    <button onClick={processFinancialImport} className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold">Processar Dados</button>
                  </>
                ) : (
                  <ImportPreview summaryRows={summaryRows} errorRows={errorRows} onCancel={() => setImportStep('input')} onConfirm={handleFinalImport} importMode={importMode} setImportMode={setImportMode} realVersions={realVersions} budgetVersions={budgetVersions} />
                )}
              </div>
            </div>
          )}
          {activeRealTab === 'labor' && (
            <div className="space-y-8">
              {renderLaborParametersForm(activeRealVersionId)}
            </div>
          )}
          {activeRealTab === 'schedule' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Calendar className="text-indigo-600" size={20} />
                  Cronograma de Elaboração
                </h3>
                <button onClick={handleAddScheduleStep} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
                  <Plus size={16} /> Nova Etapa
                </button>
              </div>
              <div className="space-y-4">
                {budgetSchedule.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-4 p-4 rounded-lg border border-slate-100 bg-slate-50/50">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
                      {idx + 1}
                    </div>
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase">Etapa</label>
                        <input 
                          type="text" 
                          value={item.step} 
                          onChange={e => {
                            const newSchedule = [...budgetSchedule];
                            newSchedule[idx].step = e.target.value;
                            setBudgetSchedule(newSchedule);
                          }}
                          className="w-full bg-transparent border-none focus:ring-0 font-bold text-slate-900 p-0"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase">Início</label>
                        <input 
                          type="date" 
                          value={item.startDate} 
                          onChange={e => {
                            const newSchedule = [...budgetSchedule];
                            newSchedule[idx].startDate = e.target.value;
                            setBudgetSchedule(newSchedule);
                          }}
                          className="w-full bg-transparent border-none focus:ring-0 text-slate-600 p-0 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase">Fim</label>
                        <input 
                          type="date" 
                          value={item.endDate} 
                          onChange={e => {
                            const newSchedule = [...budgetSchedule];
                            newSchedule[idx].endDate = e.target.value;
                            setBudgetSchedule(newSchedule);
                          }}
                          className="w-full bg-transparent border-none focus:ring-0 text-slate-600 p-0 text-sm"
                        />
                      </div>
                    </div>
                    <button onClick={() => handleDeleteScheduleStep(idx)} className="p-2 text-red-400 hover:text-red-600 transition-colors">
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {activeRealTab === 'dre_params' && <div className="text-gray-500 italic">Parâmetros da DRE (Orçamento vs Ano Anterior)...</div>}
        </div>
      </div>
    );
  };

  const renderTauáBudget = () => {
    return (
      <div className="space-y-6">
        <div className="flex border-b border-gray-200 mb-6 overflow-x-auto">
          <button onClick={() => setActiveBudgetTab('versions')} className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeBudgetTab === 'versions' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Versões</button>
          <button onClick={() => setActiveBudgetTab('labor')} className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeBudgetTab === 'labor' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Mão de Obra</button>
          <button onClick={() => setActiveBudgetTab('expense_characteristics')} className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeBudgetTab === 'expense_characteristics' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Característica da despesa</button>
          <button onClick={() => setActiveBudgetTab('import')} className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeBudgetTab === 'import' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Importação</button>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm min-h-[400px]">
          {activeBudgetTab === 'versions' && (
            <TimelineView
              title="Planejamentos (Orçamento)"
              versions={budgetVersions}
              activeVersionId={activeBudgetVersionId}
              onSelectVersion={setActiveBudgetVersionId}
              onToggleLock={(id) => handleToggleVersionLock(id, true)}
              onDelete={(id) => handleDeleteVersion(id, true)}
              onCreateVersion={handleCreateBudgetVersion}
            />
          )}
          {activeBudgetTab === 'expense_characteristics' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-gray-700">Característica da Despesa (Fixo vs Variável)</h4>
                <div className="text-xs text-slate-500 italic">
                  Defina como cada conta deve se comportar durante a projeção de novas versões do orçamento.
                </div>
              </div>
              <div className="overflow-hidden border border-gray-200 rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Código</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome da Conta</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Comportamento (Budget)</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {accounts.map(acc => (
                      <tr key={acc.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500">{acc.id}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{acc.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <select 
                            value={acc.type || 'Fixed'}
                            onChange={(e) => {
                              const newType = e.target.value as Account['type'];
                              setAccounts(prev => prev.map(a => a.id === acc.id ? { ...a, type: newType } : a));
                            }}
                            className="border border-gray-300 rounded px-2 py-1 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                          >
                            <option value="Fixed">Fixo</option>
                            <option value="Variable_PAX">Variável (PAX)</option>
                            <option value="Variable_UH">Variável (UH Ocupada)</option>
                            <option value="Variable_Revenue">Variável (Receita)</option>
                            <option value="Variable_Staff">Variável (Quadro de Pessoal)</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {activeBudgetTab === 'import' && (
            <div className="space-y-6">
              {budgetImportStep === 'input' && (
                <>
                  <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 p-5 rounded-xl text-sm text-amber-900">
                    <p className="font-bold text-base mb-2 flex items-center gap-2">
                      <Upload size={18} className="text-amber-600" />
                      Importação do Orçamento 2026
                    </p>
                    <p className="mb-3">Cole os dados do Excel com as <strong>13 colunas</strong> abaixo (separadas por TAB):</p>
                    <div className="bg-white/70 p-3 rounded-lg border border-amber-100 font-mono text-[10px] leading-relaxed grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
                      <div><span className="text-amber-600 font-bold">1.</span> Receita / Despesa <span className="text-gray-400">(Texto)</span></div>
                      <div><span className="text-amber-600 font-bold">2.</span> Real / Meta <span className="text-gray-400">(Número)</span></div>
                      <div><span className="text-amber-600 font-bold">3.</span> Escopo ou Fora <span className="text-gray-400">(Texto)</span></div>
                      <div><span className="text-amber-600 font-bold">4.</span> Filial <span className="text-gray-400">(Texto)</span></div>
                      <div><span className="text-amber-600 font-bold">5.</span> CR Certo <span className="text-gray-400">(Texto)</span></div>
                      <div><span className="text-amber-600 font-bold">6.</span> Departamento <span className="text-gray-400">(Texto)</span></div>
                      <div><span className="text-amber-600 font-bold">7.</span> Descrição da Conta <span className="text-gray-400">(Texto)</span></div>
                      <div><span className="text-amber-600 font-bold">8.</span> Pacote <span className="text-gray-400">(Texto)</span></div>
                      <div><span className="text-amber-600 font-bold">9.</span> Pacote Master <span className="text-gray-400">(Texto)</span></div>
                      <div><span className="text-amber-600 font-bold">10.</span> Mês <span className="text-gray-400">(Número 1-12)</span></div>
                      <div><span className="text-amber-600 font-bold">11.</span> Valor <span className="text-gray-400">(Número)</span></div>
                      <div><span className="text-amber-600 font-bold">12.</span> CR <span className="text-gray-400">(ex: 1.1.1.004)</span></div>
                      <div><span className="text-amber-600 font-bold">13.</span> Conta Contábil <span className="text-gray-400">(ex: 4.01.01.01.006)</span></div>
                    </div>
                    <p className="mt-3 text-xs text-amber-700 italic">
                      💡 Os dados importados serão salvos como <strong>Meta</strong> e ficarão disponíveis automaticamente no Tauá Real ao criar uma versão de 2026.
                    </p>
                  </div>
                  <textarea 
                    className="w-full h-64 p-4 border border-gray-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" 
                    placeholder="Cole os dados do Excel aqui (13 colunas separadas por TAB)..." 
                    value={budgetImportText} 
                    onChange={(e) => setBudgetImportText(e.target.value)} 
                  />
                  <button 
                    onClick={processBudget2026Import} 
                    disabled={!budgetImportText.trim()}
                    className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                  >
                    <FileText size={16} /> Processar Dados
                  </button>
                </>
              )}

              {budgetImportStep === 'preview' && (() => {
                const budgetErrors = budgetParsedData.filter(r => r.status === 'error');
                const budgetValid = budgetParsedData.filter(r => r.status === 'valid');

                // Summary by filial + mes
                const summaryMap = new Map<string, { hotel: string; mes: string; tipo: string; total: number; count: number }>();
                budgetValid.forEach(r => {
                  const key = `${r.hotel}|${r.mes}|${r.tipo}`;
                  if (!summaryMap.has(key)) summaryMap.set(key, { hotel: r.hotel, mes: r.mes, tipo: r.tipo, total: 0, count: 0 });
                  const e = summaryMap.get(key)!;
                  e.total += parseFloat(r.valor) || 0;
                  e.count++;
                });
                const summaryArr = Array.from(summaryMap.values()).sort((a, b) => Number(a.mes) - Number(b.mes));

                return (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h4 className="text-lg font-bold text-slate-800">Resumo — Orçamento 2026</h4>
                      <div className="flex gap-2">
                        <button onClick={() => { setBudgetImportStep('input'); setBudgetParsedData([]); }} className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-50">Cancelar</button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                        <div className="text-emerald-600 text-xs font-bold uppercase mb-1">Registros Válidos</div>
                        <div className="text-2xl font-bold text-emerald-700">{budgetValid.length}</div>
                      </div>
                      <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                        <div className="text-red-600 text-xs font-bold uppercase mb-1">Erros</div>
                        <div className="text-2xl font-bold text-red-700">{budgetErrors.length}</div>
                      </div>
                      <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                        <div className="text-indigo-600 text-xs font-bold uppercase mb-1">Total Geral</div>
                        <div className="text-2xl font-bold text-indigo-700">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(budgetValid.reduce((s, r) => s + (parseFloat(r.valor) || 0), 0))}
                        </div>
                      </div>
                    </div>

                    {/* Target version picker */}
                    <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
                      <label className="block text-sm font-bold text-orange-800 mb-2">Versão Budget de Destino</label>
                      <select 
                        id="budget2026-version-select"
                        defaultValue={activeBudgetVersionId}
                        className="w-full border border-orange-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 outline-none"
                      >
                        <option value="">Selecione uma versão...</option>
                        {budgetVersions.map(v => <option key={v.id} value={v.id}>{v.name} ({v.year})</option>)}
                      </select>
                    </div>

                    {budgetErrors.length > 0 && (
                      <div className="bg-white border border-red-200 rounded-xl overflow-hidden">
                        <div className="bg-red-50 px-4 py-2 border-b border-red-200">
                          <h5 className="text-xs font-bold text-red-700 uppercase">Erros de Validação (primeiros 50)</h5>
                        </div>
                        <div className="max-h-48 overflow-y-auto">
                          <table className="min-w-full divide-y divide-gray-200 text-[10px]">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-2 text-left font-medium text-gray-500">Linha</th>
                                <th className="px-4 py-2 text-left font-medium text-gray-500">Erro</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {budgetErrors.slice(0, 50).map((err, idx) => (
                                <tr key={idx}>
                                  <td className="px-4 py-2 font-mono text-gray-400">{err.originalLine}</td>
                                  <td className="px-4 py-2 text-red-600">{err.msg}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Summary table */}
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                      <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                        <h5 className="text-xs font-bold text-gray-700 uppercase">Resumo por Filial / Mês</h5>
                      </div>
                      <div className="max-h-64 overflow-y-auto">
                        <table className="min-w-full divide-y divide-gray-200 text-xs">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left font-medium text-gray-500">Filial</th>
                              <th className="px-4 py-2 text-left font-medium text-gray-500">Mês</th>
                              <th className="px-4 py-2 text-left font-medium text-gray-500">Tipo</th>
                              <th className="px-4 py-2 text-right font-medium text-gray-500">Registros</th>
                              <th className="px-4 py-2 text-right font-medium text-gray-500">Total</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {summaryArr.map((row, idx) => (
                              <tr key={idx}>
                                <td className="px-4 py-2 font-medium text-gray-900">{row.hotel}</td>
                                <td className="px-4 py-2 text-gray-500">{row.mes}</td>
                                <td className="px-4 py-2 text-gray-500">{row.tipo}</td>
                                <td className="px-4 py-2 text-right text-gray-500">{row.count}</td>
                                <td className="px-4 py-2 text-right font-bold text-indigo-600">
                                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(row.total)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        const sel = (document.getElementById('budget2026-version-select') as HTMLSelectElement)?.value || activeBudgetVersionId;
                        handleFinalBudget2026Import(sel);
                      }}
                      disabled={budgetImportSaving || budgetValid.length === 0}
                      className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {budgetImportSaving ? (
                        <><span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> Salvando...</>
                      ) : (
                        <><Save size={16} /> Confirmar e Salvar no Supabase</>
                      )}
                    </button>
                  </div>
                );
              })()}

              {budgetImportStep === 'done' && (
                <div className="text-center py-16 space-y-6">
                  <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                    <svg className="w-10 h-10 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900">Orçamento 2026 Importado!</h3>
                  <p className="text-gray-500 max-w-md mx-auto">
                    {budgetImportSavedCount !== null
                      ? <><strong>{budgetImportSavedCount}</strong> registros foram salvos com sucesso no Supabase e estão disponíveis como <strong>Meta</strong> no Tauá Real.</>
                      : 'Dados importados com sucesso.'}
                  </p>
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={() => { setBudgetImportStep('input'); setBudgetImportText(''); setBudgetParsedData([]); setBudgetImportSavedCount(null); }}
                      className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700"
                    >
                      Nova Importação
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          {activeBudgetTab === 'labor' && (
            <div className="space-y-8">
              {renderLaborParametersForm(activeBudgetVersionId)}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderTauáGeral = () => {
    return (
      <div className="space-y-6">
        <div className="flex border-b border-gray-200 mb-6 overflow-x-auto">
          <button onClick={() => setActiveGeralTab('registries')} className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeGeralTab === 'registries' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Cadastros</button>
          <button onClick={() => setActiveGeralTab('gmd')} className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeGeralTab === 'gmd' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>GMD</button>
          <button onClick={() => setActiveGeralTab('permissions')} className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeGeralTab === 'permissions' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Matriz de Permissões</button>
          <button onClick={() => setActiveGeralTab('import')} className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeGeralTab === 'import' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Importação</button>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm min-h-[400px]">
          {activeGeralTab === 'registries' && (
            <div className="space-y-6">
              <div className="flex border-b border-gray-100 mb-6 overflow-x-auto">
                <button onClick={() => setActiveRegistryTab('users')} className={`px-4 py-2 text-sm font-medium border-b-2 ${activeRegistryTab === 'users' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500'}`}>Usuários</button>
                <button onClick={() => setActiveRegistryTab('logs')} className={`px-4 py-2 text-sm font-medium border-b-2 ${activeRegistryTab === 'logs' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500'}`}>Logs</button>
                <button onClick={() => setActiveRegistryTab('hotels')} className={`px-4 py-2 text-sm font-medium border-b-2 ${activeRegistryTab === 'hotels' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500'}`}>Hotéis</button>
                <button onClick={() => setActiveRegistryTab('costCenters')} className={`px-4 py-2 text-sm font-medium border-b-2 ${activeRegistryTab === 'costCenters' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500'}`}>Setores</button>
                <button onClick={() => setActiveRegistryTab('accounts')} className={`px-4 py-2 text-sm font-medium border-b-2 ${activeRegistryTab === 'accounts' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500'}`}>Contas</button>
                <button onClick={() => setActiveRegistryTab('dre_structure')} className={`px-4 py-2 text-sm font-medium border-b-2 ${activeRegistryTab === 'dre_structure' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500'}`}>Estrutura DRE</button>
              </div>
              {activeRegistryTab === 'users' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-gray-700">Gestão de Usuários</h4>
                    <button onClick={openNewUser} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700"><Plus size={16}/> Novo Usuário</button>
                  </div>
                  <div className="overflow-x-auto border border-gray-200 rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unidade</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Perfil</th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Data Cadastro</th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Últ. Acesso</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {users.map(u => {
                          const userHotel = hotels.find(h => h.id === u.hotelId);
                          return (
                          <tr key={u.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{u.name}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{u.email}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{userHotel?.name || '-'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-medium">
                              <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-[10px] uppercase font-bold">{u.role}</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-mono text-gray-500">
                              {u.createdAt ? new Date(u.createdAt).toLocaleDateString('pt-BR') : '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-mono text-gray-500">
                              {u.lastAccess ? new Date(u.lastAccess).toLocaleDateString('pt-BR') : '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <button onClick={() => openEditUser(u.id)} className="text-indigo-600 hover:text-indigo-900 mr-3"><Pencil size={16}/></button>
                              <button onClick={() => handleDelete('users', u.id)} className="text-red-600 hover:text-red-900"><Trash2 size={16}/></button>
                            </td>
                          </tr>
                        )})}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {activeRegistryTab === 'logs' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-gray-700">Registros de Atividades (Logs)</h4>
                  </div>
                  <div className="overflow-hidden border border-gray-200 rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase text-xs">Usuário</th>
                          <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase text-xs">Ação</th>
                          <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase text-xs">Unidade</th>
                          <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase text-xs">Horário</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {userLogs.map(log => (
                          <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-800">{log.userName}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-indigo-600 font-medium">{log.action}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-slate-500">{log.userUnit}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-slate-500 font-mono text-xs">
                              {new Date(log.timestamp).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {activeRegistryTab === 'hotels' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-gray-700">Gestão de Hotéis</h4>
                    <button onClick={openNewHotel} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all active:scale-95"><Plus size={16}/> Novo Hotel</button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {hotels.map(h => (
                      <div key={h.id} className="p-4 border border-gray-200 rounded-xl bg-gray-50 flex justify-between items-center">
                        <div>
                          <p className="font-bold text-gray-900">{h.name}</p>
                          <p className="text-xs text-gray-500">ID: {h.id}</p>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => openEditHotel(h.id)} className="p-1.5 text-gray-400 hover:text-indigo-600"><Pencil size={16}/></button>
                          <button onClick={() => handleDelete('hotels', h.id)} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 size={16}/></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {activeRegistryTab === 'costCenters' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-gray-700">Gestão de Setores</h4>
                    <div className="flex gap-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
                        <input 
                          type="text" 
                          placeholder="Buscar setor..." 
                          className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
                          value={ccSearchTerm}
                          onChange={(e) => setCcSearchTerm(e.target.value)}
                        />
                      </div>
                      <button 
                        onClick={() => {
                          setActiveGeralTab('import');
                          setActiveImportTab('costCenters');
                          setCcImportStep('input');
                        }} 
                        className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-50"
                      >
                        <Upload size={16}/> Importar
                      </button>
                      <button onClick={openNewCostCenter} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700"><Plus size={16}/> Novo Setor</button>
                    </div>
                  </div>
                  <div className="overflow-hidden border border-gray-200 rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">Hotel</th>
                          <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">Hierárquico</th>
                          <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">Descrição</th>
                          <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">Código</th>
                          <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">Cód. Empresa</th>
                          <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">Departamento</th>
                          <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">Diretoria</th>
                          <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">Tipo</th>
                          <th className="px-4 py-3 text-right text-[10px] font-bold text-gray-500 uppercase">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {costCenters
                          .filter(cc => 
                            cc.name.toLowerCase().includes(ccSearchTerm.toLowerCase()) ||
                            cc.id.toLowerCase().includes(ccSearchTerm.toLowerCase()) ||
                            (cc.hotelName || '').toLowerCase().includes(ccSearchTerm.toLowerCase()) ||
                            (cc.department || '').toLowerCase().includes(ccSearchTerm.toLowerCase()) ||
                            (cc.directorate || '').toLowerCase().includes(ccSearchTerm.toLowerCase()) ||
                            (cc.hierarchicalCode || '').toLowerCase().includes(ccSearchTerm.toLowerCase())
                          )
                          .map(cc => (
                          <tr key={cc.id}>
                            <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">{cc.hotelName || '-'}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-xs font-mono text-gray-500">{cc.hierarchicalCode || '-'}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-xs font-medium text-gray-900">{cc.name}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-xs font-mono text-gray-500">{cc.id}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">{cc.companyCode || '-'}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">{cc.department || '-'}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">{cc.directorate || '-'}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-xs">
                              <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${cc.type === 'PDV' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                                {cc.type || 'CR'}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                              <button onClick={() => openEditCostCenter(cc.id)} className="text-indigo-600 hover:text-indigo-900 mr-3"><Pencil size={16}/></button>
                              <button onClick={() => handleDelete('costCenters', cc.id)} className="text-red-600 hover:text-red-900"><Trash2 size={16}/></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {activeRegistryTab === 'accounts' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <h4 className="font-bold text-gray-700">Plano de Contas</h4>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14}/>
                        <input 
                          type="text" 
                          placeholder="Buscar conta..." 
                          className="pl-9 pr-4 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none w-64"
                          onChange={(e) => setAccSearchTerm(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
                        <button 
                          onClick={() => setAllLevel('master')}
                          className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${accountViewLevel === 'master' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                          Masters
                        </button>
                        <button 
                          onClick={() => setAllLevel('package')}
                          className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${accountViewLevel === 'package' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                          Pacotes
                        </button>
                        <button 
                          onClick={() => setAllLevel('account')}
                          className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${accountViewLevel === 'account' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                          Contas
                        </button>
                      </div>
                      <button 
                        onClick={() => {
                          setActiveGeralTab('import');
                          setActiveImportTab('accounts');
                          setAccImportStep('input');
                        }} 
                        className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-50"
                      >
                        <Upload size={16}/> Importar
                      </button>
                      <button onClick={openNewAccount} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all active:scale-95"><Plus size={16}/> Nova Conta</button>
                    </div>
                  </div>
                  <div className="overflow-hidden border border-gray-200 rounded-lg shadow-sm">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider w-32">Código</th>
                          <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Conta Contábil</th>
                          <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider w-32">Fora do Escopo</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {(() => {
                          let lastMaster = '';
                          let lastPackage = '';
                          
                          const filteredAccounts = accounts.filter(acc => 
                            acc.name.toLowerCase().includes(accSearchTerm.toLowerCase()) || 
                            acc.id.toLowerCase().includes(accSearchTerm.toLowerCase()) ||
                            (acc.package || '').toLowerCase().includes(accSearchTerm.toLowerCase()) ||
                            (acc.masterPackage || '').toLowerCase().includes(accSearchTerm.toLowerCase())
                          ).sort((a, b) => {
                            if (a.sortOrder !== b.sortOrder) {
                              return (a.sortOrder || 0) - (b.sortOrder || 0);
                            }
                            // Fallback to name if order is the same
                            return a.name.localeCompare(b.name);
                          });

                          const rows: React.ReactNode[] = [];

                          filteredAccounts.forEach((acc) => {
                            const isNewMaster = acc.masterPackage !== lastMaster;
                            const isNewPackage = (acc.package !== lastPackage || isNewMaster) && acc.package;
                            
                            if (isNewMaster && acc.masterPackage) {
                              const isCollapsed = collapsedMasterPackages.has(acc.masterPackage);
                              rows.push(
                                <tr 
                                  key={`master-${acc.masterPackage}`} 
                                  draggable={true}
                                  onDragStart={(e) => handleAccountDragStart(e, acc.masterPackage!, 'master')}
                                  onDragEnd={handleAccountDragEnd}
                                  onDragOver={(e) => e.preventDefault()}
                                  onDrop={(e) => handleAccountDrop(e, acc.masterPackage!, 'master')}
                                  className="bg-indigo-50 border-y border-indigo-100 group cursor-pointer hover:bg-indigo-100 transition-colors" 
                                >
                                  <td className="px-4 py-2 flex items-center gap-2" onClick={() => toggleMasterExpand(acc.masterPackage!)}>
                                    <GripVertical size={14} className="text-indigo-300 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing" />
                                    <ChevronUp size={14} className={`text-indigo-600 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} />
                                    <span className="text-[10px] font-black text-indigo-900 uppercase tracking-widest">{acc.masterPackageCode}</span>
                                  </td>
                                  <td colSpan={1} className="px-4 py-2 text-[10px] font-black text-indigo-900 uppercase tracking-widest" onClick={() => toggleMasterExpand(acc.masterPackage!)}>
                                    {acc.masterPackage}
                                  </td>
                                  <td className="px-4 py-2 text-right">
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); handleDeleteAccountRow('', 'master', acc.masterPackage!); }}
                                      className="text-indigo-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                      title="Excluir Pacote Master"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </td>
                                </tr>
                              );
                            }

                            const masterCollapsed = acc.masterPackage && collapsedMasterPackages.has(acc.masterPackage);

                            if (isNewPackage && !masterCollapsed) {
                              const isCollapsed = collapsedPackages.has(acc.package!);
                              rows.push(
                                <tr 
                                  key={`pkg-${acc.package}`} 
                                  draggable={true}
                                  onDragStart={(e) => handleAccountDragStart(e, acc.package!, 'pkg')}
                                  onDragEnd={handleAccountDragEnd}
                                  onDragOver={(e) => e.preventDefault()}
                                  onDrop={(e) => handleAccountDrop(e, acc.package!, 'pkg')}
                                  className="bg-slate-50 border-b border-slate-100 group cursor-pointer hover:bg-slate-100 transition-colors" 
                                >
                                  <td className="px-4 py-1.5 flex items-center gap-2 pl-8" onClick={() => togglePackageExpand(acc.package!)}>
                                    <GripVertical size={12} className="text-slate-300 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing" />
                                    <ChevronUp size={12} className={`text-slate-500 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} />
                                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">{acc.packageCode}</span>
                                  </td>
                                  <td colSpan={1} className="px-4 py-1.5 text-[10px] font-bold text-slate-600 uppercase tracking-wider" onClick={() => togglePackageExpand(acc.package!)}>
                                    {acc.package}
                                  </td>
                                  <td className="px-4 py-1.5 text-right">
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); handleDeleteAccountRow('', 'pkg', acc.package!); }}
                                      className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                      title="Excluir Pacote"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </td>
                                </tr>
                              );
                            }

                            const pkgCollapsed = acc.package && collapsedPackages.has(acc.package);

                            if (!masterCollapsed && !pkgCollapsed) {
                              rows.push(
                                <tr 
                                  key={acc.id} 
                                  draggable={true}
                                  onDragStart={(e) => handleAccountDragStart(e, acc.id, 'account')}
                                  onDragEnd={handleAccountDragEnd}
                                  onDragOver={(e) => e.preventDefault()}
                                  onDrop={(e) => handleAccountDrop(e, acc.id, 'account')}
                                  className="hover:bg-gray-50 transition-colors group cursor-pointer" 
                                >
                                  <td className="px-4 py-3 whitespace-nowrap text-xs font-mono text-gray-500 pl-14 flex items-center gap-2" onClick={() => openEditAccount(acc.id)}>
                                    <GripVertical size={12} className="text-gray-300 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing" />
                                    {acc.code}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-xs font-bold text-gray-900" onClick={() => openEditAccount(acc.id)}>{acc.name}</td>
                                  <td className="px-4 py-3 whitespace-nowrap text-xs font-bold text-gray-900 flex items-center justify-center gap-4">
                                    <span className={acc.outOfScope ? "text-red-600" : "text-emerald-600"}>
                                      {acc.outOfScope ? 'Sim' : 'Não'}
                                    </span>
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); handleDeleteAccountRow(acc.id); }}
                                      className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                      title="Excluir Conta"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </td>
                                </tr>
                              );
                            }
                            
                            lastMaster = acc.masterPackage || '';
                            lastPackage = acc.package || '';
                          });

                          return rows;
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {activeRegistryTab === 'dre_structure' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-gray-700">Estrutura do DRE</h4>
                    {!isAddingSection ? (
                      <button onClick={() => setIsAddingSection(true)} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all active:scale-95"><Plus size={16}/> Nova Seção</button>
                    ) : (
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          value={newSectionName} 
                          onChange={e => setNewSectionName(e.target.value)}
                          placeholder="Nome da Seção..."
                          className="p-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                          autoFocus
                        />
                        <button onClick={addDreSection} className="bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700">Adicionar</button>
                        <button onClick={() => setIsAddingSection(false)} className="bg-gray-200 text-gray-600 px-3 py-2 rounded-lg text-sm font-bold hover:bg-gray-300">Cancelar</button>
                      </div>
                    )}
                  </div>
                  <div className="space-y-4">
                    {dreStructure.map(section => (
                      <div key={section.id} className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                        <div className="bg-gray-50 p-4 flex justify-between items-center border-b border-gray-200">
                          <h5 className="font-bold text-gray-900">{section.name}</h5>
                          <div className="flex gap-2">
                            <button onClick={() => setAddingPackageTo(section.id)} className="p-1.5 text-gray-400 hover:text-indigo-600 transition-colors" title="Adicionar Pacote"><Plus size={16}/></button>
                            <button onClick={() => deleteDreSection(section.id)} className="p-1.5 text-gray-400 hover:text-red-600 transition-colors" title="Excluir Seção"><Trash2 size={16}/></button>
                          </div>
                        </div>
                        <div className="p-4 space-y-3">
                          {addingPackageTo === section.id && (
                            <div className="flex gap-2 mb-3 p-2 bg-indigo-50 rounded-lg">
                              <input 
                                type="text" 
                                value={newPackageName} 
                                onChange={e => setNewPackageName(e.target.value)}
                                placeholder="Nome do Pacote..."
                                className="flex-1 p-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                autoFocus
                              />
                              <button onClick={() => addDrePackage(section.id)} className="bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700">Ok</button>
                              <button onClick={() => setAddingPackageTo(null)} className="bg-gray-200 text-gray-600 px-3 py-2 rounded-lg text-sm font-bold hover:bg-gray-300">X</button>
                            </div>
                          )}
                          {section.items.map(pkg => (
                            <div key={pkg.id} className="bg-white border border-gray-100 rounded-lg p-3 shadow-sm hover:border-indigo-200 transition-colors">
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-sm font-bold text-slate-700">{pkg.name}</span>
                                <div className="flex gap-1">
                                  <button onClick={() => setPickingFor({ sectionId: section.id, packageId: pkg.id })} className="p-1 text-gray-400 hover:text-indigo-600 transition-colors" title="Adicionar Conta"><Plus size={14}/></button>
                                  <button onClick={() => deleteDrePackage(section.id, pkg.id)} className="p-1 text-gray-400 hover:text-red-600 transition-colors" title="Excluir Pacote"><Trash2 size={14}/></button>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {pkg.accounts.map(acc => (
                                  <span key={acc.id} className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-600 rounded text-[10px] font-medium border border-slate-200">
                                    {acc.name}
                                    <button onClick={() => deleteDreAccount(section.id, pkg.id, acc.id)} className="hover:text-red-600 ml-1"><X size={10}/></button>
                                  </span>
                                ))}
                                {pkg.accounts.length === 0 && (
                                  <span className="text-[10px] text-gray-400 italic">Nenhuma conta vinculada</span>
                                )}
                              </div>
                            </div>
                          ))}
                          {section.items.length === 0 && (
                            <div className="text-center py-4 text-gray-400 text-xs italic">Nenhum pacote nesta seção</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {activeGeralTab === 'gmd' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-gray-700">Configuração de Matriz GMD</h4>
                <button onClick={openNewGMD} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all active:scale-95"><Plus size={16}/> Nova Configuração</button>
              </div>
              <div className="overflow-hidden border border-gray-200 rounded-xl shadow-sm">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">Hotel</th>
                      <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">Pacote</th>
                      <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">Setor (CR)</th>
                      <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">Gestor do Pacote</th>
                      <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">Dono da Conta</th>
                      <th className="px-4 py-3 text-right text-[10px] font-bold text-gray-500 uppercase">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {gmdConfigs.map(config => {
                      const hotel = hotels.find(h => h.id === config.hotelId);
                      const pkg = packages.find(p => p.id === config.packageId);
                      const cc = costCenters.find(c => c.id === config.costCenterId);
                      const pkgManager = users.find(u => u.id === config.packageManagerId);
                      const accManager = users.find(u => u.id === config.accountManagerId);
                      
                      return (
                        <tr key={config.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">{hotel?.name || '-'}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-xs font-bold text-gray-900">{pkg?.name || '-'}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">{cc?.name || '-'}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">{pkgManager?.name || '-'}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">{accManager?.name || '-'}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                            <button onClick={() => openEditGMD(config.id)} className="text-indigo-600 hover:text-indigo-900 mr-3"><Pencil size={16}/></button>
                            <button onClick={() => handleDelete('gmd', config.id)} className="text-red-600 hover:text-red-900"><Trash2 size={16}/></button>
                          </td>
                        </tr>
                      );
                    })}
                    {gmdConfigs.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-gray-400 italic text-sm">Nenhuma configuração GMD encontrada.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {activeGeralTab === 'permissions' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-gray-700">Matriz de Permissões</h4>
                <div className="text-xs text-slate-500 italic">Configure as permissões de acesso por perfil de usuário.</div>
              </div>
              <div className="overflow-x-auto border border-gray-200 rounded-xl shadow-sm">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-[linear-gradient(to_right,#f8fafc,#f1f5f9)]">
                    <tr>
                      <th className="px-6 py-4 text-left font-bold text-slate-700 uppercase text-[10px] tracking-wider border-r border-slate-200 sticky left-0 z-10 bg-[#f8fafc]">
                        Ação \ Perfil
                      </th>
                      {Object.values(UserRole).map(role => (
                        <th key={role} className="px-3 py-4 text-center font-bold text-slate-600 uppercase text-[10px] tracking-wider whitespace-nowrap">
                          {role}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {Object.entries(permissionsMatrix).map(([categoryName, actionsMap]) => (
                      <React.Fragment key={categoryName}>
                        <tr className="bg-slate-100/80">
                          <td colSpan={Object.keys(UserRole).length + 1} className="px-6 py-3 text-xs font-bold text-slate-700 uppercase tracking-widest border-y border-slate-200">
                            {categoryName}
                          </td>
                        </tr>
                        {Object.entries(actionsMap).map(([actionName, roleMap]) => (
                          <tr key={actionName} className="hover:bg-slate-50/50 transition-colors group">
                            <td className="px-6 py-4 text-sm font-medium text-slate-800 border-r border-slate-100 sticky left-0 bg-white group-hover:bg-slate-50/50 transition-colors shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] pl-8 relative">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                              {actionName}
                            </td>
                            {Object.values(UserRole).map(role => (
                              <td key={role} className="px-3 py-4 text-center">
                                <label className="flex items-center justify-center cursor-pointer w-full h-full">
                                  <input 
                                    type="checkbox" 
                                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 transition-transform hover:scale-110 active:scale-95"
                                    checked={roleMap[role]}
                                    onChange={e => {
                                      const newVal = e.target.checked;
                                      setPermissionsMatrix(prev => ({
                                        ...prev,
                                        [categoryName]: {
                                          ...prev[categoryName],
                                          [actionName]: {
                                            ...prev[categoryName][actionName],
                                            [role]: newVal
                                          }
                                        }
                                      }));
                                    }}
                                  />
                                </label>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {activeGeralTab === 'import' && (
            <div className="space-y-6">
              <div className="flex border-b border-gray-100 mb-6">
                <button 
                  onClick={() => setActiveImportTab('costCenters')} 
                  className={`px-4 py-2 text-sm font-medium border-b-2 ${
                    activeImportTab === 'costCenters' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500'
                  }`}
                >
                  Setores (CR/PDV)
                </button>
                
                <button 
                  onClick={() => setActiveImportTab('accounts')} 
                  className={`px-4 py-2 text-sm font-medium border-b-2 ${
                    activeImportTab === 'accounts' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500'
                  }`}
                >
                  Contas Contábeis
                </button>
              </div>
              
              {activeImportTab !== 'accounts' ? (
                <div className="space-y-4">
                  {ccImportStep === 'input' ? (
                    <div className="space-y-4">
                      <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-sm text-amber-800">
                        <p className="font-bold mb-1">Instruções para Importação de Setores:</p>
                        <p>Cole os dados do Excel com as seguintes colunas (separadas por TAB ou Ponto e Vírgula):</p>
                        <code className="block mt-2 bg-white/50 p-2 rounded border border-amber-100">
                          Hotel | Hierárquico | Descrição | Código | Código da Empresa | Departamento | Diretoria | Tipo
                        </code>
                      </div>
                      <textarea 
                        value={importText}
                        onChange={e => setImportText(e.target.value)}
                        className="w-full h-64 p-4 border border-gray-300 rounded-xl font-mono text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                        placeholder="Cole aqui os dados copiados do Excel..."
                      />
                      <div className="flex justify-end">
                        <button 
                          onClick={processCostCenterImport}
                          disabled={!importText.trim()}
                          className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 shadow-lg shadow-indigo-100"
                        >
                          Processar Importação
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="flex justify-between items-center">
                        <h4 className="font-bold text-gray-900">Prévia da Importação ({ccParsedData.length} linhas)</h4>
                        <div className="flex gap-4 items-center">
                          <div className="flex bg-gray-100 p-1 rounded-lg">
                            <button onClick={() => setCcImportMode('append')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${ccImportMode === 'append' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}>Mesclar</button>
                            <button onClick={() => setCcImportMode('replace')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${ccImportMode === 'replace' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500'}`}>Substituir Tudo</button>
                          </div>
                          <button onClick={() => setCcImportStep('input')} className="text-gray-500 hover:text-gray-700 font-bold text-sm">Voltar</button>
                        </div>
                      </div>
                      
                      <div className="overflow-hidden border border-gray-200 rounded-xl">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">Status</th>
                              <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">Hotel</th>
                              <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">Hierárquico</th>
                              <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">Descrição</th>
                              <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">Código</th>
                              <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">Cód. Empresa</th>
                              <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">Tipo</th>
                              <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">Mensagem</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {ccParsedData.map((row, idx) => (
                              <tr key={idx} className={row.status === 'error' ? 'bg-red-50' : ''}>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  {row.status === 'valid' ? <div className="w-2 h-2 rounded-full bg-emerald-500" /> : <div className="w-2 h-2 rounded-full bg-red-500" />}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-xs">{row.hotelName}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-xs font-mono">{row.hierarchicalCode}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-xs font-bold">{row.name}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-xs font-mono">{row.id}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-xs">{row.companyCode}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-xs">{row.type}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-[10px] text-red-600 italic">{row.msg}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      
                      <div className="flex justify-end gap-4">
                        <button onClick={() => setCcImportStep('input')} className="px-6 py-3 border border-gray-300 rounded-xl font-bold text-gray-600 hover:bg-gray-50">Cancelar</button>
                        <button 
                          onClick={handleFinalCostCenterImport}
                          className={`px-8 py-3 rounded-xl font-bold text-white shadow-lg ${ccImportMode === 'replace' ? 'bg-red-600 hover:bg-red-700 shadow-red-100' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100'}`}
                        >
                          {ccImportMode === 'replace' ? 'Confirmar Substituição' : 'Confirmar Importação'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {accImportStep === 'input' ? (
                    <div className="space-y-4">
                      <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-sm text-amber-800">
                        <p className="font-bold mb-1">Instruções para Importação de Contas:</p>
                        <p>Cole os dados do Excel com as seguintes colunas (separadas por TAB ou Ponto e Vírgula):</p>
                        <code className="block mt-2 bg-white/50 p-2 rounded border border-amber-100">
                          Código | Conta Contábil | Pacote | Pacote Master
                        </code>
                      </div>
                      <textarea 
                        value={importText}
                        onChange={e => setImportText(e.target.value)}
                        className="w-full h-64 p-4 border border-gray-300 rounded-xl font-mono text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                        placeholder="Cole aqui os dados copiados do Excel..."
                      />
                      <div className="flex justify-end">
                        <button 
                          onClick={processAccountImport}
                          disabled={!importText.trim()}
                          className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 shadow-lg shadow-indigo-100"
                        >
                          Processar Importação
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="flex justify-between items-center">
                        <h4 className="font-bold text-gray-900">Prévia da Importação ({accParsedData.length} linhas)</h4>
                        <div className="flex gap-4 items-center">
                          <div className="flex bg-gray-100 p-1 rounded-lg">
                            <button onClick={() => setAccImportMode('append')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${accImportMode === 'append' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}>Mesclar</button>
                            <button onClick={() => setAccImportMode('replace')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${accImportMode === 'replace' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500'}`}>Substituir Tudo</button>
                          </div>
                          <button onClick={() => setAccImportStep('input')} className="text-gray-500 hover:text-gray-700 font-bold text-sm">Voltar</button>
                        </div>
                      </div>
                      
                      <div className="overflow-hidden border border-gray-200 rounded-xl">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">Status</th>
                              <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">Código</th>
                              <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">Conta Contábil</th>
                              <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">Pacote</th>
                              <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">Pacote Master</th>
                              <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase">Mensagem</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {accParsedData.map((row, idx) => (
                              <tr key={idx} className={row.status === 'error' ? 'bg-red-50' : ''}>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  {row.status === 'valid' ? <div className="w-2 h-2 rounded-full bg-emerald-500" /> : <div className="w-2 h-2 rounded-full bg-red-500" />}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-xs font-mono">{row.id}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-xs font-bold">{row.name}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-xs">{row.package || '-'}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-xs">{row.masterPackage || '-'}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-[10px] text-red-600 italic">{row.msg}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      
                      <div className="flex justify-end gap-4">
                        <button onClick={() => setAccImportStep('input')} className="px-6 py-3 border border-gray-300 rounded-xl font-bold text-gray-600 hover:bg-gray-50">Cancelar</button>
                        <button 
                          onClick={handleFinalAccountImport}
                          className={`px-8 py-3 rounded-xl font-bold text-white shadow-lg ${accImportMode === 'replace' ? 'bg-red-600 hover:bg-red-700 shadow-red-100' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100'}`}
                        >
                          {accImportMode === 'replace' ? 'Confirmar Substituição' : 'Confirmar Importação'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <SettingsIcon className="text-indigo-600" size={32} />
            Administração
          </h2>
          <p className="text-slate-500 mt-1">Configure os parâmetros globais do sistema Tauá.</p>
        </div>
      </div>

      {/* Main Module Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-8 w-fit">
        <button
          onClick={() => setMainTab('real')}
          className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
            mainTab === 'real' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <PieChart size={18} />
          Tauá Real
        </button>
        <button
          onClick={() => setMainTab('budget')}
          className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
            mainTab === 'budget' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Briefcase size={18} />
          Tauá Budget
        </button>
        <button
          onClick={() => setMainTab('geral')}
          className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
            mainTab === 'geral' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <SettingsIcon size={18} />
          Tauá Geral
        </button>
      </div>

      {mainTab === 'real' && renderTauáReal()}
      {mainTab === 'budget' && renderTauáBudget()}
      {mainTab === 'geral' && renderTauáGeral()}

      {/* Modals for Registries */}
      {activeModal === 'user' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-indigo-600 text-white">
              <h3 className="text-xl font-bold">{editingId ? 'Editar Usuário' : 'Novo Usuário'}</h3>
              <button onClick={() => setActiveModal(null)} className="text-white/80 hover:text-white"><X size={24}/></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Nome Completo</label>
                <input type="text" value={userForm.name} onChange={e => setUserForm({...userForm, name: e.target.value})} className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Ex: João Silva" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Email</label>
                <input type="email" value={userForm.email} onChange={e => setUserForm({...userForm, email: e.target.value})} className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="joao@taua.com.br" />
              </div>
              {!editingId && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Senha Provisória</label>
                  <input type="password" value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Definir senha de acesso" />
                  <p className="text-[10px] text-gray-500 mt-1 italic">Defina uma senha para que o usuário possa acessar o sistema. Opcional caso o usuário já possua cadastro no sistema corporativo.</p>
                </div>
              )}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Perfil de Acesso</label>
                <select value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value as UserRole})} className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none">
                  {Object.values(UserRole).map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Hotel Principal</label>
                <select value={userForm.hotelId} onChange={e => setUserForm({...userForm, hotelId: e.target.value})} className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none">
                  <option value="">Selecione um hotel...</option>
                  {hotels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
              </div>
            </div>
            <div className="p-6 bg-gray-50 flex gap-3">
              <button onClick={() => setActiveModal(null)} className="flex-1 py-3 border border-gray-300 rounded-xl font-bold text-gray-600 hover:bg-gray-100">Cancelar</button>
              <button onClick={handleSaveUser} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200">Salvar</button>
            </div>
          </div>
        </div>
      )}
      {activeModal === 'costCenter' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-indigo-600 text-white">
              <h3 className="text-xl font-bold">{editingId ? 'Editar Setor' : 'Novo Setor'}</h3>
              <button onClick={() => setActiveModal(null)} className="text-white/80 hover:text-white"><X size={24}/></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Código (ID)</label>
                  <input type="text" value={costCenterForm.id} onChange={e => setCostCenterForm({...costCenterForm, id: e.target.value})} className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Ex: 100" disabled={!!editingId} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Cód. Empresa</label>
                  <input type="text" value={costCenterForm.companyCode} onChange={e => setCostCenterForm({...costCenterForm, companyCode: e.target.value})} className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Ex: 1" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Código Hierárquico</label>
                <input type="text" value={costCenterForm.hierarchicalCode} onChange={e => setCostCenterForm({...costCenterForm, hierarchicalCode: e.target.value})} className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Ex: 1.1.1.001" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Hotel</label>
                <select value={costCenterForm.hotelName} onChange={e => setCostCenterForm({...costCenterForm, hotelName: e.target.value})} className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none">
                  <option value="">Selecione um hotel...</option>
                  {hotels.map(h => <option key={h.id} value={h.name}>{h.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Nome do Setor</label>
                <input type="text" value={costCenterForm.name} onChange={e => setCostCenterForm({...costCenterForm, name: e.target.value})} className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Ex: Recepção" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Tipo de Setor</label>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setCostCenterForm({...costCenterForm, type: 'CR'})}
                    className={`flex-1 py-3 rounded-xl font-bold border transition-all ${costCenterForm.type === 'CR' ? 'bg-indigo-50 border-indigo-600 text-indigo-600' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                  >
                    CR (Só Despesas)
                  </button>
                  <button 
                    onClick={() => setCostCenterForm({...costCenterForm, type: 'PDV'})}
                    className={`flex-1 py-3 rounded-xl font-bold border transition-all ${costCenterForm.type === 'PDV' ? 'bg-emerald-50 border-emerald-600 text-emerald-600' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                  >
                    PDV (Rec. e Desp.)
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Diretoria</label>
                  <input type="text" value={costCenterForm.directorate} onChange={e => setCostCenterForm({...costCenterForm, directorate: e.target.value})} className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Ex: Operações" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Departamento</label>
                  <input type="text" value={costCenterForm.department} onChange={e => setCostCenterForm({...costCenterForm, department: e.target.value})} className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Ex: Hospedagem" />
                </div>
              </div>
            </div>
            <div className="p-6 bg-gray-50 flex gap-3">
              <button onClick={() => setActiveModal(null)} className="flex-1 py-3 border border-gray-300 rounded-xl font-bold text-gray-600 hover:bg-gray-100">Cancelar</button>
              <button onClick={handleSaveCostCenter} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200">Salvar</button>
            </div>
          </div>
        </div>
      )}
      {activeModal === 'hotel' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-indigo-600 text-white">
              <h3 className="text-xl font-bold">{editingId ? 'Editar Hotel' : 'Novo Hotel'}</h3>
              <button onClick={() => setActiveModal(null)} className="text-white/80 hover:text-white"><X size={24}/></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">ID do Hotel (Opcional)</label>
                <input 
                  type="text" 
                  value={hotelForm.id} 
                  onChange={e => setHotelForm({...hotelForm, id: e.target.value})}
                  placeholder="Ex: H1"
                  className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Nome do Hotel</label>
                <input 
                  type="text" 
                  value={hotelForm.name} 
                  onChange={e => setHotelForm({...hotelForm, name: e.target.value})}
                  placeholder="Nome do Hotel"
                  className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>
            <div className="p-6 bg-gray-50 flex gap-3">
              <button onClick={() => setActiveModal(null)} className="flex-1 py-3 border border-gray-300 rounded-xl font-bold text-gray-600 hover:bg-gray-100">Cancelar</button>
              <button onClick={handleSaveHotel} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200">Salvar</button>
            </div>
          </div>
        </div>
      )}
      {activeModal === 'account' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-indigo-600 text-white">
              <h3 className="text-xl font-bold">{editingId ? 'Editar Cadastro' : 'Novo Cadastro'}</h3>
              <button onClick={() => setActiveModal(null)} className="text-white/80 hover:text-white"><X size={24}/></button>
            </div>
            
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto font-sans">
              <div className="flex bg-gray-100 p-1 rounded-xl">
                 {(['master', 'pkg', 'account'] as const).map(lvl => (
                   <button
                     key={lvl}
                     onClick={() => setAccountForm({...accountForm, level: lvl})}
                     className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${accountForm.level === lvl ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                   >
                     {lvl === 'master' ? 'Pacote Master' : lvl === 'pkg' ? 'Pacote' : 'Conta'}
                   </button>
                 ))}
              </div>

              {accountForm.level === 'account' && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Código da Conta</label>
                  <input type="text" value={accountForm.id} onChange={e => setAccountForm({...accountForm, id: e.target.value})} className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Ex: 4.01.01.01.001" disabled={!!editingId} />
                </div>
              )}
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  {accountForm.level === 'master' ? 'Nome do Pacote Master' : accountForm.level === 'pkg' ? 'Nome do Pacote' : 'Nome da Conta'}
                </label>
                <input type="text" value={accountForm.name} onChange={e => setAccountForm({...accountForm, name: e.target.value})} className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" placeholder={accountForm.level === 'master' ? 'Ex: Custos Variáveis' : 'Ex: Condimentos'} />
              </div>

              {(accountForm.level === 'pkg' || accountForm.level === 'account') && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-1">
                    <label className="block text-sm font-bold text-gray-700 mb-1">Cód. Master</label>
                    <input type="text" value={accountForm.masterPackageCode} onChange={e => setAccountForm({...accountForm, masterPackageCode: e.target.value})} className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-gray-50" placeholder="Ex: 4.1" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-bold text-gray-700 mb-1">Pacote Master</label>
                    <select 
                      value={accountForm.masterPackage} 
                      onChange={e => {
                          const val = e.target.value;
                          const match = uniqueMasterPackages.find(m => m.name === val);
                          setAccountForm({
                              ...accountForm, 
                              masterPackage: val,
                              masterPackageCode: match ? match.code : accountForm.masterPackageCode
                          });
                      }} 
                      className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                    >
                      <option value="">Selecione um Master...</option>
                      {uniqueMasterPackages.map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
                      <option value="CUSTOM">+ Novo Pacote Master...</option>
                    </select>
                  </div>
                </div>
              )}

              {accountForm.level === 'account' && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-1">
                    <label className="block text-sm font-bold text-gray-700 mb-1">Cód. Pacote</label>
                    <input type="text" value={accountForm.packageCode} onChange={e => setAccountForm({...accountForm, packageCode: e.target.value})} className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-gray-50" placeholder="Ex: 4.1.1" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-bold text-gray-700 mb-1">Pacote</label>
                    <select 
                      value={accountForm.package} 
                      onChange={e => {
                          const val = e.target.value;
                          const match = uniqueSubPackages.find(p => p.name === val);
                          setAccountForm({
                              ...accountForm, 
                              package: val,
                              packageCode: match ? match.code : accountForm.packageCode
                          });
                      }} 
                      className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                    >
                      <option value="">Selecione um Pacote...</option>
                      {uniqueSubPackages
                          .filter(p => !accountForm.masterPackage || p.masterName === accountForm.masterPackage)
                          .map(p => <option key={p.name} value={p.name}>{p.name}</option>)
                      }
                      <option value="CUSTOM">+ Novo Pacote...</option>
                    </select>
                  </div>
                </div>
              )}

              {accountForm.level === 'account' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Comportamento (Budget)</label>
                    <select value={accountForm.type} onChange={e => setAccountForm({...accountForm, type: e.target.value as Account['type']})} className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none">
                      <option value="Fixed">Fixo</option>
                      <option value="Variable_PAX">Variável (PAX)</option>
                      <option value="Variable_UH">Variável (UH Ocupada)</option>
                      <option value="Variable_Revenue">Variável (Receita)</option>
                      <option value="Variable_Staff">Variável (Quadro de Pessoal)</option>
                    </select>
                  </div>
                  <div className="flex items-end pb-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                        checked={accountForm.outOfScope}
                        onChange={e => setAccountForm({...accountForm, outOfScope: e.target.checked})}
                      />
                      <span className="text-sm font-bold text-gray-700">Fora do Escopo</span>
                    </label>
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-6 bg-gray-50 flex gap-3">
              <button onClick={() => setActiveModal(null)} className="flex-1 py-3 border border-gray-300 rounded-xl font-bold text-gray-600 hover:bg-gray-100">Cancelar</button>
              <button onClick={handleSaveAccount} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200">Salvar</button>
            </div>
          </div>
        </div>
      )}
      {activeModal === 'gmd' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-indigo-600 text-white">
              <h3 className="text-xl font-bold">{editingId ? 'Editar Configuração GMD' : 'Nova Configuração GMD'}</h3>
              <button onClick={() => setActiveModal(null)} className="text-white/80 hover:text-white"><X size={24}/></button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-6 max-h-[70vh] overflow-y-auto">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Hotel</label>
                  <select value={gmdForm.hotelId} onChange={e => setGmdForm({...gmdForm, hotelId: e.target.value})} className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none">
                    <option value="">Selecione um hotel...</option>
                    {hotels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Pacote USALI</label>
                  <select value={gmdForm.packageId} onChange={e => setGmdForm({...gmdForm, packageId: e.target.value})} className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none">
                    <option value="">Selecione um pacote...</option>
                    {packages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Setor (CR/PDV)</label>
                  <select value={gmdForm.costCenterId} onChange={e => setGmdForm({...gmdForm, costCenterId: e.target.value})} className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none">
                    <option value="">Selecione um setor...</option>
                    {costCenters.map(cc => <option key={cc.id} value={cc.id}>{cc.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Gestor do Pacote</label>
                  <select value={gmdForm.packageManagerId} onChange={e => setGmdForm({...gmdForm, packageManagerId: e.target.value})} className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none">
                    <option value="">Selecione um gestor...</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Dono da Conta (Account Manager)</label>
                  <select value={gmdForm.accountManagerId} onChange={e => setGmdForm({...gmdForm, accountManagerId: e.target.value})} className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none">
                    <option value="">Selecione um gestor...</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Gestores da Entidade (Entity Managers)</label>
                  <div className="p-3 border border-gray-300 rounded-xl max-h-32 overflow-y-auto space-y-2">
                    {users.map(u => (
                      <label key={u.id} className="flex items-center gap-2 text-sm">
                        <input 
                          type="checkbox" 
                          checked={gmdForm.entityManagerIds?.includes(u.id)}
                          onChange={e => {
                            const ids = gmdForm.entityManagerIds || [];
                            if (e.target.checked) setGmdForm({...gmdForm, entityManagerIds: [...ids, u.id]});
                            else setGmdForm({...gmdForm, entityManagerIds: ids.filter(id => id !== u.id)});
                          }}
                        />
                        {u.name}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 bg-gray-50 flex gap-3">
              <button onClick={() => setActiveModal(null)} className="flex-1 py-3 border border-gray-300 rounded-xl font-bold text-gray-600 hover:bg-gray-100">Cancelar</button>
              <button onClick={handleSaveGMD} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200">Salvar Configuração</button>
            </div>
          </div>
        </div>
      )}

      {pickingFor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-indigo-600 text-white">
              <h3 className="text-xl font-bold">Selecionar Conta</h3>
              <button onClick={() => setPickingFor(null)} className="text-white/80 hover:text-white"><X size={24}/></button>
            </div>
            <div className="p-4">
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
                <input 
                  type="text" 
                  placeholder="Filtrar contas..." 
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  onChange={(e) => setAccSearchTerm(e.target.value)}
                />
              </div>
              <div className="max-h-96 overflow-y-auto space-y-1 pr-2 custom-scrollbar">
                {accounts
                  .filter(a => a.name.toLowerCase().includes(accSearchTerm.toLowerCase()) || a.code.toLowerCase().includes(accSearchTerm.toLowerCase()))
                  .map(acc => (
                  <button 
                    key={acc.id}
                    onClick={() => {
                      addDreAccount(pickingFor.sectionId, pickingFor.packageId, acc.id, acc.name);
                      setPickingFor(null);
                    }}
                    className="w-full text-left p-3 hover:bg-indigo-50 rounded-xl transition-colors flex items-center justify-between group"
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-gray-700 group-hover:text-indigo-700">{acc.name}</span>
                      <span className="text-[10px] font-mono text-gray-400 uppercase tracking-tighter">{acc.code}</span>
                    </div>
                    <Plus size={14} className="text-gray-300 group-hover:text-indigo-500"/>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UnifiedAdministrationView;
