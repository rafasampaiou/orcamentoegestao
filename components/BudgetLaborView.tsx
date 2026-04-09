import React, { useState } from 'react';
import { Plus, Trash2, Users, DollarSign, ShieldCheck, Settings2, ChevronRight, ChevronDown, Briefcase, Gift, UserPlus, Truck } from 'lucide-react';
import { LaborPosition, LaborDissidio, JobTemplate } from '../laborTypes';
import { CostCenter, LaborParameters, Account, CostPackage } from '../types';

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

type LaborTab = 'positions' | 'headcount' | 'benefits' | 'charges' | 'details' | 'personnel_expenses' | 'third_party';

interface BudgetLaborViewProps {
    costCenters: CostCenter[];
    laborParameters: LaborParameters;
    accounts: Account[];
    packages: CostPackage[];
    budgetOccupancyData?: Record<string, number[]>;
    laborData?: Record<string, any>;
    setLaborData?: (data: any) => void;
}

const BudgetLaborView: React.FC<BudgetLaborViewProps> = ({ costCenters, laborParameters, accounts, packages, budgetOccupancyData = {}, laborData = {}, setLaborData }) => {
    const [activeTab, setActiveTab] = useState<LaborTab>('positions');

    // Derive Benefit and Charge accounts from provided accounts and packages
    const BENEFIT_ACCOUNTS = React.useMemo(() => {
        const pkg = packages.find(p => p.name === 'BENEFICIOS AOS COLABORADORES');
        if (!pkg) return [];
        return accounts.filter(a => a.packageId === pkg.id).map(a => ({ code: a.code, name: a.name }));
    }, [accounts, packages]);

    const CHARGE_ACCOUNTS = React.useMemo(() => {
        const pkg = packages.find(p => p.name === 'ENCARGOS SOCIAIS');
        if (!pkg) return [];
        return accounts.filter(a => a.packageId === pkg.id).map(a => ({ code: a.code, name: a.name }));
    }, [accounts, packages]);

    const PERSONNEL_EXPENSES_ACCOUNTS = React.useMemo(() => {
        const pkg = packages.find(p => p.name === 'DESPESAS COM PESSOAL');
        if (!pkg) return [];
        return accounts.filter(a => a.packageId === pkg.id).map(a => ({ code: a.code, name: a.name }));
    }, [accounts, packages]);

    const THIRD_PARTY_ACCOUNTS = React.useMemo(() => {
        const names = [
            'Servicos prestados por terceiros',
            'Servicos de terceiros temporarios',
            'Serviços contratados de prestadores PJ - MEI',
            'Servico de terceiros recorrente'
        ];
        return names.map(name => {
            const acc = accounts.find(a => a.name.toLowerCase().includes(name.toLowerCase()));
            return acc ? { code: acc.code, name: acc.name } : { code: name, name: name };
        });
    }, [accounts]);

    const PAYROLL_ACCOUNTS = React.useMemo(() => {
        const findAccount = (pkgName: string, search: string) => {
            const pkg = packages.find(p => p.name === pkgName);
            if (!pkg) return search;
            const acc = accounts.find(a => a.packageId === pkg.id && a.name.toLowerCase().includes(search.toLowerCase()));
            return acc ? acc.name : search;
        };

        return {
            salaries: findAccount('DESPESAS COM PESSOAL', 'Salarios e ordenados'),
            decimo: findAccount('DESPESAS COM PESSOAL', 'Decimo terceiro salario'),
            ferias: findAccount('DESPESAS COM PESSOAL', 'Ferias'),
            fgts: findAccount('ENCARGOS SOCIAIS', 'FGTS'),
            inss: findAccount('ENCARGOS SOCIAIS', 'INSS'),
            pis: findAccount('ENCARGOS SOCIAIS', 'PIS s/ folha')
        };
    }, [accounts, packages]);

    // Dissídio State
    const [dissidio, setDissidio] = useState<LaborDissidio>(laborData?.dissidio || {
        percentage: laborParameters.dissidioPct,
        startMonth: laborParameters.dissidioMonth
    });

    // Job Templates State (Master List)
    const [jobTemplates, setJobTemplates] = useState<JobTemplate[]>(laborData?.jobTemplates || [
        { id: 't1', name: 'Gerente Geral', type: 'PJ', salaries: Array(12).fill(15000) },
        { id: 't2', name: 'Recepcionista', type: 'CLT', salaries: Array(12).fill(2500) },
        { id: 't3', name: 'Jovem Aprendiz', type: 'CLT', salaries: Array(12).fill(800) },
    ]);

    // Positions State (Assignments to Sectors)
    const [positions, setPositions] = useState<LaborPosition[]>(laborData?.positions || [
        { id: '1', templateId: 't1', sectorId: costCenters[0]?.id || '1', isExcludedFromTotal: false, headcount: Array(12).fill(1) },
        { id: '2', templateId: 't2', sectorId: costCenters[1]?.id || '2', isExcludedFromTotal: false, headcount: Array(12).fill(4) },
        { id: '3', templateId: 't3', sectorId: costCenters[0]?.id || '1', isExcludedFromTotal: true, headcount: Array(12).fill(2) },
    ]);

    const [newAssignment, setNewAssignment] = useState({ templateId: '', sectorId: '' });
    const [copiedHeadcount, setCopiedHeadcount] = useState<number | null>(null);

    // Benefits State
    const [benefitConfigs, setBenefitConfigs] = useState<Record<string, {
        method: 'driver' | 'absolute' | 'percent_increase' | 'absolute_increase',
        values: number[],
        lastYearValues: number[],
        increaseValue: number
    }>>(laborData?.benefitConfigs || {});

    const [personnelExpensesConfigs, setPersonnelExpensesConfigs] = useState<Record<string, {
        method: 'driver' | 'absolute' | 'percent_increase' | 'absolute_increase',
        values: number[],
        lastYearValues: number[],
        increaseValue: number
    }>>(laborData?.personnelExpensesConfigs || {});

    const [thirdPartyConfigs, setThirdPartyConfigs] = useState<Record<string, {
        method: 'driver' | 'absolute' | 'percent_increase' | 'absolute_increase',
        values: number[],
        lastYearValues: number[],
        increaseValue: number,
        providerName?: string
    }>>(laborData?.thirdPartyConfigs || {});

    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importText, setImportText] = useState('');
    const [expandedSectors, setExpandedSectors] = useState<Record<string, boolean>>({});
    const [expandedBenefitAccounts, setExpandedBenefitAccounts] = useState<Record<string, boolean>>({});
    const [editingKpi, setEditingKpi] = useState<{ key: string, value: string } | null>(null);
    const [expandedPersonnelAccounts, setExpandedPersonnelAccounts] = useState<Record<string, boolean>>({});
    const [expandedThirdPartyAccounts, setExpandedThirdPartyAccounts] = useState<Record<string, boolean>>({});
    const [expandedChargeAccounts, setExpandedChargeAccounts] = useState<Record<string, boolean>>({});
    const [expandedDetailPositions, setExpandedDetailPositions] = useState<Record<string, boolean>>({});

    // Track which sectors are active for each third-party account
    const [activeThirdPartySectors, setActiveThirdPartySectors] = useState<Record<string, string[]>>(laborData?.activeThirdPartySectors || {});

    // Specific state for Third Party Temporaries (per sector)
    const [thirdPartyTemporariesSectors, setThirdPartyTemporariesSectors] = useState<Record<string, {
        kpi: number[],
        hoursPerDay: number[],
        hourlyRate: number[]
    }>>(laborData?.thirdPartyTemporariesSectors || {});

    // Specific state for Third Party Recurrent (PJ Managers)
    const [thirdPartyRecurrentData, setThirdPartyRecurrentData] = useState<Record<string, {
        salary: number[],
        thirteenth: number[],
        vacation: number[]
    }>>(laborData?.thirdPartyRecurrentData || {});

    React.useEffect(() => {
        if (setLaborData) {
            setLaborData({
                jobTemplates,
                positions,
                benefitConfigs,
                personnelExpensesConfigs,
                thirdPartyConfigs,
                activeThirdPartySectors,
                thirdPartyTemporariesSectors,
                thirdPartyRecurrentData,
                dissidio
            });
        }
    }, [jobTemplates, positions, benefitConfigs, personnelExpensesConfigs, thirdPartyConfigs, activeThirdPartySectors, thirdPartyTemporariesSectors, thirdPartyRecurrentData, dissidio]);

    const toggleSectorExpand = (sectorId: string) => {
        setExpandedSectors(prev => ({ ...prev, [sectorId]: !prev[sectorId] }));
    };

    const toggleBenefitAccountExpand = (accCode: string) => {
        setExpandedBenefitAccounts(prev => ({ ...prev, [accCode]: !prev[accCode] }));
    };

    const togglePersonnelAccountExpand = (accCode: string) => {
        setExpandedPersonnelAccounts(prev => ({ ...prev, [accCode]: !prev[accCode] }));
    };

    const toggleThirdPartyAccountExpand = (accCode: string) => {
        setExpandedThirdPartyAccounts(prev => ({ ...prev, [accCode]: !prev[accCode] }));
    };

    const toggleChargeAccountExpand = (accCode: string) => {
        setExpandedChargeAccounts(prev => ({ ...prev, [accCode]: !prev[accCode] }));
    };

    const toggleDetailPositionExpand = (positionId: string) => {
        setExpandedDetailPositions(prev => ({ ...prev, [positionId]: !prev[positionId] }));
    };

    const handleAddThirdPartySector = (accCode: string, sectorId: string) => {
        setActiveThirdPartySectors(prev => {
            const current = prev[accCode] || [];
            if (current.includes(sectorId)) return prev;
            return { ...prev, [accCode]: [...current, sectorId] };
        });
    };

    const handleRemoveThirdPartySector = (accCode: string, sectorId: string) => {
        setActiveThirdPartySectors(prev => {
            const current = prev[accCode] || [];
            return { ...prev, [accCode]: current.filter(id => id !== sectorId) };
        });
    };

    const handleThirdPartyTemporariesSectorChange = (sectorId: string, field: 'kpi' | 'hoursPerDay' | 'hourlyRate', monthIdx: number, value: number) => {
        setThirdPartyTemporariesSectors(prev => {
            const current = prev[sectorId] || {
                kpi: Array(12).fill(0),
                hoursPerDay: Array(12).fill(0),
                hourlyRate: Array(12).fill(0)
            };
            const newValues = [...current[field]];
            newValues[monthIdx] = value;
            return { ...prev, [sectorId]: { ...current, [field]: newValues } };
        });
    };

    const handleImportExcel = () => {
        const rows = importText.split('\n').filter(r => r.trim());

        // Filter out header row if present
        const dataRows = rows.filter(row => {
            const firstCol = row.split('\t')[0].toLowerCase();
            return !firstCol.includes('cargo') && !firstCol.includes('mês');
        });

        const newTemplates: JobTemplate[] = dataRows.map(row => {
            const cols = row.split('\t');
            const name = cols[0]?.trim() || 'Novo Cargo';

            const monthlySalaries = Array(12).fill(0).map((_, i) => {
                const valStr = cols[i + 1] || '0';
                // Remove R$, spaces, and thousands separator (dot)
                // Then replace decimal separator (comma) with dot
                const cleanVal = valStr
                    .replace(/R\$/g, '')
                    .replace(/\s/g, '')
                    .replace(/\./g, '')
                    .replace(',', '.');

                return parseFloat(cleanVal) || 0;
            });

            return {
                id: Math.random().toString(36).substr(2, 9),
                name,
                type: 'CLT',
                salaries: monthlySalaries
            };
        });

        if (newTemplates.length > 0) {
            setJobTemplates([...jobTemplates, ...newTemplates]);
        }
        setImportText('');
        setIsImportModalOpen(false);
    };

    const handleBenefitChange = (accCode: string, sectorId: string, monthIdx: number, value: number) => {
        const key = `${accCode}-${sectorId}`;
        setBenefitConfigs(prev => {
            const current = prev[key] || {
                method: 'driver',
                values: Array(12).fill(0),
                lastYearValues: Array(12).fill(0),
                increaseValue: 0
            };
            const newValues = [...current.values];
            newValues[monthIdx] = value;
            return { ...prev, [key]: { ...current, values: newValues } };
        });
    };

    const handleBenefitMethodChange = (accCode: string, sectorId: string, method: 'driver' | 'absolute') => {
        const key = `${accCode}-${sectorId}`;
        setBenefitConfigs(prev => {
            const current = prev[key] || {
                values: Array(12).fill(0),
                lastYearValues: Array(12).fill(0),
                increaseValue: 0
            };

            return {
                ...prev,
                [key]: { ...current, method, values: current.values }
            };
        });
    };

    const handlePersonnelExpenseChange = (accCode: string, sectorId: string, monthIdx: number, value: number) => {
        const key = `${accCode}-${sectorId}`;
        setPersonnelExpensesConfigs(prev => {
            const current = prev[key] || {
                method: 'driver',
                values: Array(12).fill(0),
                lastYearValues: Array(12).fill(0),
                increaseValue: 0
            };
            const newValues = [...current.values];
            newValues[monthIdx] = value;
            return { ...prev, [key]: { ...current, values: newValues } };
        });
    };

    const handlePersonnelExpenseMethodChange = (accCode: string, sectorId: string, method: 'driver' | 'absolute') => {
        const key = `${accCode}-${sectorId}`;
        setPersonnelExpensesConfigs(prev => ({
            ...prev,
            [key]: { ...(prev[key] || { values: Array(12).fill(0), lastYearValues: Array(12).fill(0), increaseValue: 0 }), method }
        }));
    };

    const handleThirdPartyChange = (accCode: string, sectorId: string, monthIdx: number, value: number) => {
        const key = `${accCode}-${sectorId}`;
        setThirdPartyConfigs(prev => {
            const current = prev[key] || {
                method: 'driver',
                values: Array(12).fill(0),
                lastYearValues: Array(12).fill(0),
                increaseValue: 0
            };
            const newValues = [...current.values];
            newValues[monthIdx] = value;
            return { ...prev, [key]: { ...current, values: newValues } };
        });
    };

    const handleThirdPartyProviderNameChange = (accCode: string, sectorId: string, name: string) => {
        const key = `${accCode}-${sectorId}`;
        setThirdPartyConfigs(prev => {
            const current = prev[key] || {
                method: 'absolute',
                values: Array(12).fill(0),
                lastYearValues: Array(12).fill(0),
                increaseValue: 0
            };
            return { ...prev, [key]: { ...current, providerName: name } };
        });
    };

    const handleThirdPartyPaste = (accCode: string, sectorId: string, startIdx: number, text: string) => {
        const values = text.split(/\s+/).map(v => {
            let clean = v.trim();
            if (clean.includes(',') && clean.includes('.')) {
                clean = clean.replace(/\./g, '').replace(',', '.');
            } else if (clean.includes(',')) {
                clean = clean.replace(',', '.');
            }
            return parseFloat(clean.replace(/[^0-9.-]/g, '')) || 0;
        });
        setThirdPartyConfigs(prev => {
            const key = `${accCode}-${sectorId}`;
            const current = prev[key] || { method: 'absolute', values: Array(12).fill(0), lastYearValues: Array(12).fill(0), increaseValue: 0 };
            const newValues = [...current.values];
            values.forEach((v, i) => {
                if (startIdx + i < 12) {
                    newValues[startIdx + i] = v;
                }
            });
            return { ...prev, [key]: { ...current, values: newValues } };
        });
    };

    const handleThirdPartyRecurrentChange = (sectorId: string, field: 'salary' | 'thirteenth' | 'vacation', monthIdx: number, value: number) => {
        setThirdPartyRecurrentData(prev => {
            const current = prev[sectorId] || { salary: Array(12).fill(0), thirteenth: Array(12).fill(0), vacation: Array(12).fill(0) };
            const newValues = [...current[field]];
            newValues[monthIdx] = value;
            return { ...prev, [sectorId]: { ...current, [field]: newValues } };
        });
    };

    // --- HANDLERS ---

    const handleAddJobTemplate = () => {
        const newTemplate: JobTemplate = {
            id: Math.random().toString(36).substr(2, 9),
            name: 'Novo Cargo',
            type: 'CLT',
            salaries: Array(12).fill(0),
        };
        setJobTemplates([...jobTemplates, newTemplate]);
    };

    const updateJobTemplate = (id: string, updates: Partial<JobTemplate>) => {
        setJobTemplates(jobTemplates.map(t => t.id === id ? { ...t, ...updates } : t));
    };

    const removeJobTemplate = (id: string) => {
        setJobTemplates(jobTemplates.filter(t => t.id !== id));
        // Also remove assignments
        setPositions(positions.filter(p => p.templateId !== id));
    };

    const handleAddAssignment = () => {
        if (!newAssignment.templateId || !newAssignment.sectorId) return;
        const newPos: LaborPosition = {
            id: Math.random().toString(36).substr(2, 9),
            templateId: newAssignment.templateId,
            sectorId: newAssignment.sectorId,
            isExcludedFromTotal: false,
            headcount: Array(12).fill(0),
        };
        setPositions([...positions, newPos]);
        setNewAssignment({ templateId: '', sectorId: '' });
    };

    const updateAssignment = (id: string, updates: Partial<LaborPosition>) => {
        setPositions(positions.map(p => p.id === id ? { ...p, ...updates } : p));
    };

    const removeAssignment = (id: string) => {
        setPositions(positions.filter(p => p.id !== id));
    };

    // --- CALCULATIONS ---

    const getAdjustedSalary = (templateId: string, monthIdx: number) => {
        const template = jobTemplates.find(t => t.id === templateId);
        if (!template) return 0;

        const baseSalary = template.salaries[monthIdx];
        // Dissídio applies from startMonth onwards
        if (monthIdx + 1 < dissidio.startMonth) return baseSalary;

        return baseSalary * (1 + dissidio.percentage / 100);
    };

    const calculateSectorPayroll = (sectorId: string, monthIdx: number) => {
        return positions
            .filter(p => p.sectorId === sectorId && !p.isExcludedFromTotal)
            .reduce((sum, p) => {
                const template = jobTemplates.find(t => t.id === p.templateId);
                if (!template || template.type !== 'CLT') return sum;
                return sum + (getAdjustedSalary(p.templateId, monthIdx) * p.headcount[monthIdx]);
            }, 0);
    };

    const getChargePercentage = (accName: string) => {
        const name = accName.toLowerCase();
        if (name.includes('fgts')) return laborParameters.fgtsPct;
        if (name.includes('inss')) return laborParameters.inssPct;
        if (name.includes('pis')) return laborParameters.pisPct;
        return 0;
    };

    const formatCurrency = (val: number, decimals: number = 2) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'decimal',
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }).format(val);
    };

    // --- RENDERERS ---

    const renderPositionsTab = () => (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-8">
                    <div className="flex items-center gap-3">
                        <Settings2 className="text-indigo-600" size={20} />
                        <h3 className="font-bold text-gray-800">Configuração de Dissídio</h3>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex flex-col">
                            <label className="text-[10px] font-bold text-gray-500 uppercase">Percentual (%)</label>
                            <input
                                type="number"
                                value={dissidio.percentage}
                                onChange={(e) => setDissidio({ ...dissidio, percentage: parseFloat(e.target.value) || 0 })}
                                className="border-b border-gray-300 focus:border-indigo-500 outline-none py-1 w-24 font-bold text-indigo-700"
                            />
                        </div>
                        <div className="flex flex-col">
                            <label className="text-[10px] font-bold text-gray-500 uppercase">Mês de Início</label>
                            <select
                                value={dissidio.startMonth}
                                onChange={(e) => setDissidio({ ...dissidio, startMonth: parseInt(e.target.value) })}
                                className="border-b border-gray-300 focus:border-indigo-500 outline-none py-1 w-32 font-bold text-indigo-700 bg-transparent"
                            >
                                {MONTHS.map((m, i) => (
                                    <option key={m} value={i + 1}>{m}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
                <button
                    onClick={() => setIsImportModalOpen(true)}
                    className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors text-sm font-bold shadow-sm"
                >
                    <Plus size={16} /> Importar do Excel
                </button>
            </div>

            {isImportModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <div>
                                <h3 className="text-xl font-bold text-gray-800">Importar Cargos e Salários</h3>
                                <p className="text-sm text-gray-500">Cole as colunas do Excel: Cargo | Jan | Fev | ... | Dez</p>
                            </div>
                            <button onClick={() => setIsImportModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <Plus size={24} className="rotate-45" />
                            </button>
                        </div>
                        <div className="p-6">
                            <textarea
                                value={importText}
                                onChange={(e) => setImportText(e.target.value)}
                                placeholder="Cole aqui..."
                                className="w-full h-64 p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-xs"
                            />
                            <div className="mt-6 flex justify-end gap-3">
                                <button
                                    onClick={() => setIsImportModalOpen(false)}
                                    className="px-6 py-2 rounded-lg text-gray-600 font-bold hover:bg-gray-100 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleImportExcel}
                                    className="px-6 py-2 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-colors shadow-md"
                                >
                                    Importar Dados
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-700">Cargos e Salários por Mês</h3>
                    <button
                        onClick={handleAddJobTemplate}
                        className="flex items-center gap-2 bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors text-xs font-bold"
                    >
                        <Plus size={14} /> Adicionar Cargo
                    </button>
                </div>
                <div className="overflow-x-auto no-scrollbar">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-200 uppercase text-sm">
                            <tr>
                                <th className="px-4 py-3 min-w-[300px] sticky left-0 bg-gray-50 z-10">Cargo</th>
                                <th className="px-4 py-3 w-24 text-center">Tipo</th>
                                {MONTHS.map(m => <th key={m} className="px-2 py-3 text-right min-w-[75px]">{m}</th>)}
                                <th className="px-4 py-3 w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {jobTemplates.filter(t => t.type === 'CLT').map((template) => (
                                <tr key={template.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-4 py-2 sticky left-0 bg-white z-10 border-r border-gray-100">
                                        <input
                                            type="text"
                                            value={template.name}
                                            onChange={(e) => updateJobTemplate(template.id, { name: e.target.value })}
                                            className="w-full bg-transparent focus:outline-none font-medium text-gray-700 text-sm"
                                        />
                                    </td>
                                    <td className="px-4 py-2 text-center">
                                        <select
                                            value={template.type}
                                            onChange={(e) => updateJobTemplate(template.id, { type: e.target.value as 'CLT' | 'PJ' })}
                                            className="bg-transparent focus:outline-none text-[10px] font-bold uppercase text-indigo-600"
                                        >
                                            <option value="CLT">CLT</option>
                                            <option value="PJ">PJ</option>
                                        </select>
                                    </td>
                                    {MONTHS.map((_, idx) => (
                                        <td key={idx} className="px-2 py-2 text-right font-mono text-sm">
                                            <input
                                                type="text"
                                                value={formatCurrency(template.salaries[idx], 0)}
                                                onChange={(e) => {
                                                    const val = parseFloat(e.target.value.replace(/\./g, '').replace(',', '.')) || 0;
                                                    const newSalaries = [...template.salaries];
                                                    newSalaries[idx] = val;
                                                    updateJobTemplate(template.id, { salaries: newSalaries });
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.ctrlKey && (e.key === 'c' || e.key === 'C')) {
                                                        setCopiedHeadcount(template.salaries[idx]);
                                                    } else if (e.ctrlKey && (e.key === 'v' || e.key === 'V')) {
                                                        if (copiedHeadcount !== null) {
                                                            e.preventDefault();
                                                            const newSalaries = [...template.salaries];
                                                            if (idx === 0) {
                                                                newSalaries.fill(copiedHeadcount);
                                                            } else {
                                                                for (let i = idx; i < 12; i++) {
                                                                    newSalaries[i] = copiedHeadcount;
                                                                }
                                                            }
                                                            updateJobTemplate(template.id, { salaries: newSalaries });
                                                        }
                                                    }
                                                }}
                                                className="w-full text-right bg-transparent focus:outline-none text-indigo-700 font-bold text-sm"
                                            />
                                        </td>
                                    ))}
                                    <td className="px-4 py-2 text-center">
                                        <button onClick={() => removeJobTemplate(template.id)} className="text-gray-400 hover:text-red-500">
                                            <Trash2 size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );

    const renderHeadcountTab = () => {
        const cltPositions = positions.filter(p => {
            const t = jobTemplates.find(jt => jt.id === p.templateId);
            return t?.type === 'CLT';
        });

        const calculateTotalHeadcount = (monthIdx: number) => {
            return cltPositions
                .filter(p => !p.isExcludedFromTotal)
                .reduce((sum, p) => sum + (p.headcount[monthIdx] || 0), 0);
        };

        return (
            <div className="space-y-8">
                {/* ADD ASSIGNMENT UI */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center gap-6">
                    <div className="flex items-center gap-3">
                        <Plus className="text-indigo-600" size={20} />
                        <h3 className="font-bold text-gray-800">Adicionar Cargo ao Setor</h3>
                    </div>
                    <div className="flex items-center gap-4 flex-1">
                        <div className="flex flex-col flex-1">
                            <label className="text-[10px] font-bold text-gray-500 uppercase">Cargo</label>
                            <select
                                value={newAssignment.templateId}
                                onChange={(e) => setNewAssignment({ ...newAssignment, templateId: e.target.value })}
                                className="border-b border-gray-300 focus:border-indigo-500 outline-none py-1 font-bold text-indigo-700 bg-transparent"
                            >
                                <option value="">Selecionar Cargo...</option>
                                {jobTemplates.map(t => (
                                    <option key={t.id} value={t.id}>{t.name} ({t.type})</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex flex-col flex-1">
                            <label className="text-[10px] font-bold text-gray-500 uppercase">Setor</label>
                            <select
                                value={newAssignment.sectorId}
                                onChange={(e) => setNewAssignment({ ...newAssignment, sectorId: e.target.value })}
                                className="border-b border-gray-300 focus:border-indigo-500 outline-none py-1 font-bold text-indigo-700 bg-transparent"
                            >
                                <option value="">Selecionar Setor...</option>
                                {costCenters.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                        <button
                            onClick={handleAddAssignment}
                            disabled={!newAssignment.templateId || !newAssignment.sectorId}
                            className="mt-4 px-6 py-2 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-colors shadow-md disabled:bg-gray-300 disabled:shadow-none"
                        >
                            Adicionar
                        </button>
                    </div>
                </div>

                {/* HEADCOUNT SECTION */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
                        <Users className="text-gray-600" size={18} />
                        <h3 className="font-bold text-gray-700">Headcount por Setor</h3>
                    </div>
                    <div className="no-scrollbar overflow-x-auto">
                        <table className="w-full text-sm text-left border-collapse">
                            <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-200 uppercase text-sm">
                                <tr>
                                    <th className="px-4 py-3 min-w-[200px] sticky left-0 bg-gray-50 z-10">Setor / Cargo</th>
                                    {MONTHS.map(m => <th key={m} className="px-2 py-3 text-right min-w-[50px]">{m}</th>)}
                                    <th className="px-4 py-3 text-right min-w-[75px] bg-gray-100">Total</th>
                                    <th className="px-4 py-3 text-right min-w-[100px] bg-blue-50 text-blue-700">Salário Ref.</th>
                                    <th className="px-4 py-3 w-10"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {costCenters.map(sector => {
                                    const sectorPositions = cltPositions.filter(p => p.sectorId === sector.id);
                                    const isExpanded = expandedSectors[sector.id];
                                    const isSectorExcluded = sectorPositions.length > 0 && sectorPositions.every(p => p.isExcludedFromTotal);

                                    const toggleSector = (excluded: boolean) => {
                                        setPositions(prev => prev.map(p =>
                                            p.sectorId === sector.id && jobTemplates.find(t => t.id === p.templateId)?.type === 'CLT'
                                                ? { ...p, isExcludedFromTotal: excluded }
                                                : p
                                        ));
                                    };

                                    return (
                                        <React.Fragment key={sector.id}>
                                            <tr className="bg-gray-50/50 font-bold text-gray-800">
                                                <td className="px-4 py-2 sticky left-0 bg-gray-50/50 z-10 flex items-center gap-2 min-w-[200px]">
                                                    <button
                                                        onClick={() => toggleSectorExpand(sector.id)}
                                                        className="p-1 hover:bg-gray-200 rounded transition-colors"
                                                    >
                                                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                    </button>
                                                    <input
                                                        type="checkbox"
                                                        checked={!isSectorExcluded}
                                                        onChange={(e) => toggleSector(!e.target.checked)}
                                                        className="rounded border-gray-300 text-indigo-600"
                                                    />
                                                    <span className="text-sm">{sector.name}</span>
                                                </td>
                                                {MONTHS.map((_, idx) => (
                                                    <td key={idx} className="px-2 py-2 text-right text-indigo-600 text-sm font-bold">
                                                        {sectorPositions.reduce((sum, p) => sum + (p.headcount[idx] || 0), 0)}
                                                    </td>
                                                ))}
                                                <td className="px-4 py-2 text-right text-indigo-800 bg-indigo-50/30 text-sm font-bold">
                                                    {sectorPositions.reduce((sum, p) => sum + p.headcount.reduce((a, b) => a + b, 0), 0)}
                                                </td>
                                                <td className="px-4 py-2 bg-blue-50/10"></td>
                                                <td className="px-4 py-2"></td>
                                            </tr>
                                            {isExpanded && sectorPositions.map(p => {
                                                const template = jobTemplates.find(t => t.id === p.templateId);
                                                if (!template) return null;
                                                const rowTotal = p.headcount.reduce((a, b) => a + b, 0);
                                                const avgSalary = template.salaries.reduce((a, b) => a + b, 0) / 12;
                                                return (
                                                    <tr key={p.id} className={`hover:bg-gray-50 ${p.isExcludedFromTotal ? 'opacity-60 italic' : ''}`}>
                                                        <td className="px-8 py-2 sticky left-0 bg-white z-10 text-gray-600 flex items-center gap-2 min-w-[200px]">
                                                            <input
                                                                type="checkbox"
                                                                checked={!p.isExcludedFromTotal}
                                                                onChange={(e) => updateAssignment(p.id, { isExcludedFromTotal: !e.target.checked })}
                                                                className="rounded border-gray-300 text-indigo-600"
                                                            />
                                                            <span className="text-sm">{template.name}</span>
                                                        </td>
                                                        {MONTHS.map((_, idx) => (
                                                            <td key={idx} className="px-2 py-2 text-right">
                                                                <input
                                                                    type="text"
                                                                    value={p.headcount[idx]}
                                                                    onChange={(e) => {
                                                                        const newHc = [...p.headcount];
                                                                        newHc[idx] = parseInt(e.target.value) || 0;
                                                                        updateAssignment(p.id, { headcount: newHc });
                                                                    }}
                                                                    onKeyDown={(e) => {
                                                                        if (e.ctrlKey && (e.key === 'c' || e.key === 'C')) {
                                                                            setCopiedHeadcount(p.headcount[idx]);
                                                                        } else if (e.ctrlKey && (e.key === 'v' || e.key === 'V')) {
                                                                            if (copiedHeadcount !== null) {
                                                                                e.preventDefault();
                                                                                const newHc = [...p.headcount];
                                                                                // Se colar no primeiro mês, preenche todos. Se colar nos outros, preenche daquele em diante.
                                                                                if (idx === 0) {
                                                                                    newHc.fill(copiedHeadcount);
                                                                                } else {
                                                                                    for (let i = idx; i < 12; i++) {
                                                                                        newHc[i] = copiedHeadcount;
                                                                                    }
                                                                                }
                                                                                updateAssignment(p.id, { headcount: newHc });
                                                                            }
                                                                        }
                                                                    }}
                                                                    className="w-full text-right bg-transparent outline-none focus:ring-1 focus:ring-indigo-300 rounded px-1 text-sm font-bold"
                                                                />
                                                            </td>
                                                        ))}
                                                        <td className="px-4 py-2 text-right font-bold text-gray-700 bg-gray-50 text-sm">
                                                            {rowTotal}
                                                        </td>
                                                        <td className="px-4 py-2 text-right font-bold text-blue-700 bg-blue-50/20 text-sm">
                                                            {formatCurrency(avgSalary, 0)}
                                                        </td>
                                                        <td className="px-4 py-2 text-center">
                                                            <button onClick={() => removeAssignment(p.id)} className="text-gray-400 hover:text-red-500">
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </React.Fragment>
                                    );
                                })}
                                {/* TOTAL INFORMATIVO */}
                                <tr className="bg-slate-800 text-white font-bold border-t-2 border-slate-900">
                                    <td className="px-4 py-3 sticky left-0 bg-slate-800 z-10">TOTAL INFORMATIVO (Ativos)</td>
                                    {MONTHS.map((_, idx) => (
                                        <td key={idx} className="px-2 py-3 text-right text-emerald-400 text-sm">
                                            {calculateTotalHeadcount(idx)}
                                        </td>
                                    ))}
                                    <td className="px-4 py-3 text-right text-emerald-400 bg-slate-900 text-sm">
                                        {cltPositions.filter(p => !p.isExcludedFromTotal).reduce((sum, p) => sum + p.headcount.reduce((a, b) => a + b, 0), 0)}
                                    </td>
                                    <td className="px-4 py-3 bg-slate-900"></td>
                                    <td className="px-4 py-3 bg-slate-900"></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    const renderBenefitsTab = () => (
        <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <Gift className="text-rose-500" size={18} />
                        <h3 className="font-bold text-gray-700">Benefícios por Setor e Conta</h3>
                    </div>
                </div>
                <div className="no-scrollbar overflow-x-auto">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-200 uppercase text-sm">
                            <tr>
                                <th className="px-4 py-3 min-w-[200px] sticky left-0 bg-gray-50 z-10">Conta / Setor</th>
                                <th className="px-4 py-3 w-48 text-center">Método / Projeção</th>
                                {MONTHS.map(m => <th key={m} className="px-2 py-3 text-right min-w-[50px]">{m}</th>)}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {BENEFIT_ACCOUNTS.map(acc => {
                                const accountTotals = MONTHS.map((_, idx) => {
                                    return costCenters.reduce((sum, sector) => {
                                        const config = benefitConfigs[`${acc.code}-${sector.id}`];
                                        return sum + (config?.values[idx] || 0);
                                    }, 0);
                                });

                                return (
                                    <React.Fragment key={acc.code}>
                                        <tr className="bg-gray-100 font-bold text-gray-700">
                                            <td className="px-4 py-2 sticky left-0 bg-gray-100 z-10 flex items-center gap-2">
                                                <button
                                                    onClick={() => toggleBenefitAccountExpand(acc.code)}
                                                    className="p-1 hover:bg-gray-200 rounded transition-colors"
                                                >
                                                    {expandedBenefitAccounts[acc.code] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                </button>
                                                <span>{acc.code} - {acc.name}</span>
                                            </td>
                                            <td className="px-4 py-2 text-center text-[10px] uppercase text-gray-500">Total Mensal</td>
                                            {accountTotals.map((total, idx) => (
                                                <td key={idx} className="px-2 py-2 text-right font-mono text-indigo-700 text-sm font-bold">
                                                    {formatCurrency(total, 0)}
                                                </td>
                                            ))}
                                        </tr>
                                        {expandedBenefitAccounts[acc.code] && costCenters.map(sector => {
                                            const config = benefitConfigs[`${acc.code}-${sector.id}`] || {
                                                method: 'driver',
                                                values: Array(12).fill(0),
                                                lastYearValues: Array(12).fill(0),
                                                increaseValue: 0
                                            };
                                            return (
                                                <tr key={`${acc.code}-${sector.id}`} className="hover:bg-gray-50 border-b border-gray-50">
                                                    <td className="px-8 py-2 sticky left-0 bg-white z-10 font-medium text-gray-700 text-sm">{sector.name}</td>
                                                    <td className="px-4 py-2 flex items-center gap-2">
                                                        <select
                                                            value={config.method}
                                                            onChange={(e) => handleBenefitMethodChange(acc.code, sector.id, e.target.value as 'driver' | 'absolute')}
                                                            className="flex-1 bg-transparent text-[10px] font-bold uppercase text-indigo-600 outline-none"
                                                        >
                                                            <option value="driver">Por Emocionador</option>
                                                            <option value="absolute">Valor Absoluto</option>
                                                        </select>
                                                    </td>
                                                    {MONTHS.map((_, idx) => (
                                                        <td key={idx} className="px-2 py-2 text-right">
                                                            <input
                                                                type="text"
                                                                value={config.values[idx] === 0 ? '' : formatCurrency(config.values[idx], 0)}
                                                                onChange={(e) => {
                                                                    const val = parseFloat(e.target.value.replace(/\./g, '').replace(',', '.')) || 0;
                                                                    handleBenefitChange(acc.code, sector.id, idx, val);
                                                                }}
                                                                placeholder="0,00"
                                                                className="w-full text-right bg-transparent outline-none focus:ring-1 focus:ring-indigo-300 rounded px-1 font-mono text-xs"
                                                            />
                                                        </td>
                                                    ))}
                                                </tr>
                                            );
                                        })}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );

    const renderPersonnelExpensesTab = () => (
        <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <UserPlus className="text-blue-500" size={18} />
                        <h3 className="font-bold text-gray-700">Despesas com Pessoal por Setor e Conta</h3>
                    </div>
                </div>
                <div className="no-scrollbar overflow-x-auto">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-200 uppercase text-sm">
                            <tr>
                                <th className="px-4 py-3 min-w-[200px] sticky left-0 bg-gray-50 z-10">Conta / Setor</th>
                                <th className="px-4 py-3 w-48 text-center">Método / Projeção</th>
                                {MONTHS.map(m => <th key={m} className="px-2 py-3 text-right min-w-[50px]">{m}</th>)}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {PERSONNEL_EXPENSES_ACCOUNTS.map(acc => {
                                const accountTotals = MONTHS.map((_, idx) => {
                                    return costCenters.reduce((sum, sector) => {
                                        const config = personnelExpensesConfigs[`${acc.code}-${sector.id}`];
                                        return sum + (config?.values[idx] || 0);
                                    }, 0);
                                });

                                return (
                                    <React.Fragment key={acc.code}>
                                        <tr className="bg-gray-100 font-bold text-gray-700">
                                            <td className="px-4 py-2 sticky left-0 bg-gray-100 z-10 flex items-center gap-2">
                                                <button
                                                    onClick={() => togglePersonnelAccountExpand(acc.code)}
                                                    className="p-1 hover:bg-gray-200 rounded transition-colors"
                                                >
                                                    {expandedPersonnelAccounts[acc.code] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                </button>
                                                <span>{acc.code} - {acc.name}</span>
                                            </td>
                                            <td className="px-4 py-2 text-center text-[10px] uppercase text-gray-500">Total Mensal</td>
                                            {accountTotals.map((total, idx) => (
                                                <td key={idx} className="px-2 py-2 text-right font-mono text-indigo-700 text-sm font-bold">
                                                    {formatCurrency(total, 0)}
                                                </td>
                                            ))}
                                        </tr>
                                        {expandedPersonnelAccounts[acc.code] && costCenters.map(sector => {
                                            const config = personnelExpensesConfigs[`${acc.code}-${sector.id}`] || {
                                                method: 'absolute',
                                                values: Array(12).fill(0),
                                                lastYearValues: Array(12).fill(0),
                                                increaseValue: 0
                                            };
                                            return (
                                                <tr key={`${acc.code}-${sector.id}`} className="hover:bg-gray-50 border-b border-gray-50">
                                                    <td className="px-8 py-2 sticky left-0 bg-white z-10 font-medium text-gray-700 text-sm">{sector.name}</td>
                                                    <td className="px-4 py-2 flex items-center gap-2">
                                                        <select
                                                            value={config.method}
                                                            onChange={(e) => handlePersonnelExpenseMethodChange(acc.code, sector.id, e.target.value as 'driver' | 'absolute')}
                                                            className="flex-1 bg-transparent text-[10px] font-bold uppercase text-indigo-600 outline-none"
                                                        >
                                                            <option value="absolute">Valor Absoluto</option>
                                                            <option value="driver">Por Headcount</option>
                                                        </select>
                                                    </td>
                                                    {MONTHS.map((_, idx) => (
                                                        <td key={idx} className="px-2 py-2 text-right">
                                                            <input
                                                                type="text"
                                                                value={config.values[idx] === 0 ? '' : formatCurrency(config.values[idx], 0)}
                                                                onChange={(e) => {
                                                                    const val = parseFloat(e.target.value.replace(/\./g, '').replace(',', '.')) || 0;
                                                                    handlePersonnelExpenseChange(acc.code, sector.id, idx, val);
                                                                }}
                                                                placeholder="0,00"
                                                                className="w-full text-right bg-transparent outline-none focus:ring-1 focus:ring-indigo-300 rounded px-1 font-mono text-xs"
                                                            />
                                                        </td>
                                                    ))}
                                                </tr>
                                            );
                                        })}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );

    const renderThirdPartyTab = () => {
        const daysMonth = budgetOccupancyData['days_month'] || Array(12).fill(30);
        const occupiedRooms = budgetOccupancyData['geral_sold'] || Array(12).fill(0);

        return (
            <div className="space-y-8">
                {THIRD_PARTY_ACCOUNTS.map(acc => {
                    const isExpanded = expandedThirdPartyAccounts[acc.code] !== false;
                    const activeSectors = activeThirdPartySectors[acc.code] || [];

                    // Calculate Account Totals for Header
                    const accountMonthlyTotals = Array(12).fill(0);

                    // 1. Serviços prestados por terceiros
                    if (acc.name.toLowerCase().includes('servicos prestados por terceiros')) {
                        activeSectors.forEach(sectorId => {
                            const config = thirdPartyConfigs[`${acc.code}-${sectorId}`] || { values: Array(12).fill(0) };
                            config.values.forEach((v, i) => accountMonthlyTotals[i] += v);
                        });

                        return (
                            <div key={acc.code} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                <div className="p-0 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                                    <div className="flex items-center gap-4 flex-shrink-0 w-[200px] px-4 py-4 border-r border-gray-200">
                                        <Truck className="text-amber-500" size={18} />
                                        <div className="flex flex-col">
                                            <span className="font-bold text-gray-800 text-sm">Outros prestadores</span>
                                            <span className="text-[9px] text-gray-600 font-medium uppercase tracking-wider">{acc.name}</span>
                                        </div>
                                    </div>

                                    {/* Monthly Summary in Header */}
                                    <div className="hidden xl:flex items-center flex-1 overflow-x-auto no-scrollbar">
                                        {accountMonthlyTotals.map((val, i) => (
                                            <div key={i} className="min-w-[75px] flex-1 text-right px-2">
                                                <div className="text-sm uppercase text-gray-400 font-bold leading-none mb-1">{MONTHS[i]}</div>
                                                <div className="text-xs font-mono font-bold leading-none text-amber-700">{formatCurrency(val, 0)}</div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="flex items-center gap-3 flex-shrink-0 w-[140px] justify-end pr-4 border-l border-gray-200 h-full py-4">
                                        <div className="flex flex-col items-end">
                                            <span className="text-xs font-bold text-gray-400 uppercase leading-none mb-1">Total Geral</span>
                                            <span className="text-sm font-mono font-bold text-amber-900">
                                                {formatCurrency(accountMonthlyTotals.reduce((a, b) => a + b, 0), 0)}
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => toggleThirdPartyAccountExpand(acc.code)}
                                            className="p-1 hover:bg-gray-200 rounded transition-colors"
                                        >
                                            {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                        </button>
                                    </div>
                                </div>
                                {isExpanded && (
                                    <div className="no-scrollbar overflow-x-auto">
                                        <table className="w-full text-sm text-left border-collapse">
                                            <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-200 uppercase text-sm">
                                                <tr>
                                                    <th className="px-4 py-3 min-w-[200px] sticky left-0 bg-gray-50 z-10">
                                                        <div className="flex items-center justify-start gap-2">
                                                            <div className="relative group">
                                                                <button className="w-6 h-6 flex items-center justify-center rounded-full bg-amber-100 text-amber-600 hover:bg-amber-200 transition-colors">
                                                                    <span className="text-lg font-bold leading-none">+</span>
                                                                </button>
                                                                <select
                                                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                                                    onChange={(e) => {
                                                                        if (e.target.value) {
                                                                            handleAddThirdPartySector(acc.code, e.target.value);
                                                                            e.target.value = '';
                                                                        }
                                                                    }}
                                                                    value=""
                                                                >
                                                                    <option value="">+ Setor</option>
                                                                    {costCenters.filter(s => !activeSectors.includes(s.id)).map(s => (
                                                                        <option key={s.id} value={s.id}>{s.name}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        </div>
                                                    </th>
                                                    {MONTHS.map(m => <th key={m} className="px-2 py-3 text-right min-w-[75px]"></th>)}
                                                    <th className="px-4 py-3 text-right min-w-[100px]">Total</th>
                                                    <th className="px-4 py-3 w-10"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {activeSectors.map(sectorId => {
                                                    const sector = costCenters.find(s => s.id === sectorId);
                                                    if (!sector) return null;
                                                    const config = (thirdPartyConfigs[`${acc.code}-${sector.id}`] || {
                                                        method: 'absolute',
                                                        values: Array(12).fill(0)
                                                    }) as any;
                                                    const rowTotal = config.values.reduce((a, b) => a + b, 0);

                                                    return (
                                                        <tr key={sector.id} className="hover:bg-gray-50">
                                                            <td className="px-4 py-2 sticky left-0 bg-white z-10 font-medium text-gray-700 text-sm">
                                                                <div className="flex flex-col gap-1">
                                                                    <span>{sector.name}</span>
                                                                    {acc.name.includes('Servicos prestados por terceiros') && (
                                                                        <input
                                                                            type="text"
                                                                            placeholder="Nome do prestador..."
                                                                            value={config.providerName || ''}
                                                                            onChange={(e) => handleThirdPartyProviderNameChange(acc.code, sector.id, e.target.value)}
                                                                            className="text-[10px] text-gray-500 bg-transparent border-b border-gray-100 focus:border-indigo-300 outline-none"
                                                                        />
                                                                    )}
                                                                </div>
                                                            </td>
                                                            {MONTHS.map((_, idx) => (
                                                                <td key={idx} className="px-2 py-2 text-right">
                                                                    <input
                                                                        type="text"
                                                                        value={config.values[idx] === 0 ? '' : formatCurrency(config.values[idx], 0)}
                                                                        onChange={(e) => {
                                                                            const val = parseFloat(e.target.value.replace(/\./g, '').replace(',', '.')) || 0;
                                                                            handleThirdPartyChange(acc.code, sector.id, idx, val);
                                                                        }}
                                                                        onPaste={(e) => {
                                                                            e.preventDefault();
                                                                            handleThirdPartyPaste(acc.code, sector.id, idx, e.clipboardData.getData('text'));
                                                                        }}
                                                                        placeholder="0,00"
                                                                        className="w-full text-right bg-transparent outline-none focus:ring-1 focus:ring-indigo-300 rounded px-1 font-mono text-[13px]"
                                                                    />
                                                                </td>
                                                            ))}
                                                            <td className="px-4 py-2 text-right font-bold text-[13px] text-gray-900 bg-gray-50/50">
                                                                {formatCurrency(rowTotal, 0)}
                                                            </td>
                                                            <td className="px-2 py-2 text-center">
                                                                <button
                                                                    onClick={() => handleRemoveThirdPartySector(acc.code, sector.id)}
                                                                    className="text-red-400 hover:text-red-600 p-1"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                                {activeSectors.length === 0 && (
                                                    <tr>
                                                        <td colSpan={MONTHS.length + 4} className="px-4 py-8 text-center text-gray-400 text-xs">
                                                            Nenhum setor adicionado. Use o menu acima para adicionar.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        );
                    }

                    // 2. Serviços de terceiros temporários
                    if (acc.name.toLowerCase().includes('servicos de terceiros temporarios')) {
                        const sectorData = activeSectors.map(sectorId => {
                            const sector = costCenters.find(s => s.id === sectorId);
                            const config = thirdPartyTemporariesSectors[sectorId] || {
                                kpi: Array(12).fill(0),
                                hoursPerDay: Array(12).fill(0),
                                hourlyRate: Array(12).fill(0)
                            };
                            const values = MONTHS.map((_, idx) => {
                                const rooms = occupiedRooms[idx];
                                return rooms * config.kpi[idx] * config.hoursPerDay[idx] * config.hourlyRate[idx];
                            });
                            return { sector, config, values, total: values.reduce((a, b) => a + b, 0) };
                        });

                        sectorData.forEach(sd => {
                            sd.values.forEach((v, i) => accountMonthlyTotals[i] += v);
                        });

                        // Inverse Global KPI calculation
                        const globalKpis = MONTHS.map((_, idx) => {
                            const totalCost = accountMonthlyTotals[idx];
                            const rooms = occupiedRooms[idx];
                            // This is complex because each sector has its own hours and rate.
                            // The user said: "considerar o valor R$ total de cada mes de cada setor, e ir fazendo o calculo inverso até chegar no kpi do hotel todo."
                            // If TotalCost = sum(Rooms * KPI_s * Hours_s * Rate_s)
                            // And we want a "Global KPI" such that TotalCost = Rooms * GlobalKPI * AvgHours * AvgRate?
                            // Or maybe just GlobalKPI = TotalCost / Rooms? (assuming a standard unit)
                            // Let's assume GlobalKPI = TotalCost / Rooms (this gives the cost per occupied room, which is a common KPI)
                            return rooms > 0 ? totalCost / rooms : 0;
                        });

                        return (
                            <div key={acc.code} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                <div className="p-0 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                                    <div className="flex items-center gap-4 flex-shrink-0 w-[200px] px-4 py-4 border-r border-gray-200">
                                        <Truck className="text-blue-500" size={18} />
                                        <div className="flex flex-col">
                                            <span className="font-bold text-gray-800 text-sm">Extraordinários</span>
                                            <span className="text-[9px] text-gray-600 font-medium uppercase tracking-wider">{acc.name}</span>
                                        </div>
                                    </div>

                                    {/* Monthly Summary in Header */}
                                    <div className="hidden xl:flex items-center flex-1 overflow-x-auto no-scrollbar">
                                        {accountMonthlyTotals.map((val, i) => (
                                            <div key={i} className="min-w-[75px] flex-1 text-right px-2">
                                                <div className="text-sm uppercase text-gray-400 font-bold leading-none mb-1">{MONTHS[i]}</div>
                                                <div className="text-xs font-mono font-bold leading-none text-blue-700">{formatCurrency(val, 0)}</div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="flex items-center gap-3 flex-shrink-0 w-[140px] justify-end pr-4 border-l border-gray-200 h-full py-4">
                                        <div className="flex flex-col items-end">
                                            <span className="text-xs font-bold text-gray-400 uppercase leading-none mb-1">Total Geral</span>
                                            <span className="text-sm font-mono font-bold text-blue-900">
                                                {formatCurrency(accountMonthlyTotals.reduce((a, b) => a + b, 0), 0)}
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => toggleThirdPartyAccountExpand(acc.code)}
                                            className="p-1 hover:bg-gray-200 rounded transition-colors"
                                        >
                                            {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                        </button>
                                    </div>
                                </div>
                                {isExpanded && (
                                    <div className="no-scrollbar overflow-x-auto">
                                        <table className="w-full text-sm text-left border-collapse">
                                            <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-200 uppercase text-sm">
                                                <tr>
                                                    <th className="px-4 py-3 min-w-[200px] sticky left-0 bg-gray-50 z-10">
                                                        <div className="flex items-center justify-start gap-2">
                                                            <div className="relative group">
                                                                <button className="w-6 h-6 flex items-center justify-center rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors">
                                                                    <span className="text-lg font-bold leading-none">+</span>
                                                                </button>
                                                                <select
                                                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                                                    onChange={(e) => {
                                                                        if (e.target.value) {
                                                                            handleAddThirdPartySector(acc.code, e.target.value);
                                                                            e.target.value = '';
                                                                        }
                                                                    }}
                                                                    value=""
                                                                >
                                                                    <option value="">+ Setor</option>
                                                                    {costCenters.filter(s => !activeSectors.includes(s.id)).map(s => (
                                                                        <option key={s.id} value={s.id}>{s.name}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        </div>
                                                    </th>
                                                    {MONTHS.map(m => <th key={m} className="px-2 py-3 text-right min-w-[75px]"></th>)}
                                                    <th className="px-4 py-3 text-right min-w-[100px]">Total</th>
                                                    <th className="px-4 py-3 w-10"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {/* Global Summary */}
                                                <tr className="bg-blue-50/30">
                                                    <td className="px-4 py-2 sticky left-0 bg-blue-50/30 z-10 font-bold text-blue-800 text-xs">Dias do mês (Ocupação)</td>
                                                    {daysMonth.map((val, idx) => (
                                                        <td key={idx} className="px-2 py-2 text-right font-mono text-[13px] text-blue-600">{val}</td>
                                                    ))}
                                                    <td className="px-4 py-2 text-right font-bold text-blue-800 text-[13px]">{daysMonth.reduce((a, b) => a + b, 0)}</td>
                                                    <td></td>
                                                </tr>
                                                <tr className="bg-blue-50/30">
                                                    <td className="px-4 py-2 sticky left-0 bg-blue-50/30 z-10 font-bold text-blue-800 text-xs">Quartos Ocupados (Ocupação)</td>
                                                    {occupiedRooms.map((val, idx) => (
                                                        <td key={idx} className="px-2 py-2 text-right font-mono text-[13px] text-blue-600">{formatCurrency(val, 0)}</td>
                                                    ))}
                                                    <td className="px-4 py-2 text-right font-bold text-blue-800 text-[13px]">{formatCurrency(occupiedRooms.reduce((a, b) => a + b, 0), 0)}</td>
                                                    <td></td>
                                                </tr>
                                                <tr className="bg-indigo-50/30">
                                                    <td className="px-4 py-2 sticky left-0 bg-indigo-50/30 z-10 font-bold text-indigo-800 text-xs">KPI de Mão de Obra (Global - Calculado)</td>
                                                    {globalKpis.map((val, idx) => (
                                                        <td key={idx} className="px-2 py-2 text-right font-mono text-[13px] text-indigo-700 font-bold">
                                                            {val.toFixed(2)}
                                                        </td>
                                                    ))}
                                                    <td className="px-4 py-2"></td>
                                                    <td></td>
                                                </tr>

                                                {/* Sector Rows */}
                                                {sectorData.map(({ sector, config, values, total }) => {
                                                    if (!sector) return null;
                                                    const isSectorExpanded = expandedSectors[`${acc.code}-${sector.id}`];

                                                    return (
                                                        <React.Fragment key={sector.id}>
                                                            <tr className="hover:bg-gray-50 font-bold">
                                                                <td className="px-4 py-2 sticky left-0 bg-white z-10 flex items-center justify-between gap-2">
                                                                    <div className="flex items-center gap-2">
                                                                        <button
                                                                            onClick={() => setExpandedSectors(prev => ({ ...prev, [`${acc.code}-${sector.id}`]: !prev[`${acc.code}-${sector.id}`] }))}
                                                                            className="p-1 hover:bg-gray-200 rounded transition-colors"
                                                                        >
                                                                            {isSectorExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                                        </button>
                                                                        <span className="text-xs">{sector.name}</span>
                                                                    </div>
                                                                    <button
                                                                        onClick={() => handleRemoveThirdPartySector(acc.code, sector.id)}
                                                                        className="text-red-400 hover:text-red-600 p-1"
                                                                    >
                                                                        <Trash2 size={12} />
                                                                    </button>
                                                                </td>
                                                                {values.map((val, idx) => (
                                                                    <td key={idx} className="px-2 py-2 text-right font-mono text-[13px] text-indigo-700">
                                                                        {formatCurrency(val, 0)}
                                                                    </td>
                                                                ))}
                                                                <td className="px-4 py-2 text-right font-bold text-[13px] text-indigo-900 bg-indigo-50/30">
                                                                    {formatCurrency(total, 0)}
                                                                </td>
                                                                <td></td>
                                                            </tr>
                                                            {isSectorExpanded && (
                                                                <>
                                                                    <tr className="bg-gray-50/30 text-[10px] text-gray-500">
                                                                        <td className="px-12 py-1 sticky left-0 bg-gray-50/30 z-10">KPI</td>
                                                                        {MONTHS.map((_, idx) => (
                                                                            <td key={idx} className="px-2 py-1 text-right">
                                                                                <input
                                                                                    type="text"
                                                                                    value={editingKpi?.key === `${sector.id}-${idx}` ? editingKpi.value : (config.kpi[idx] === 0 ? '' : config.kpi[idx].toString().replace('.', ','))}
                                                                                    onChange={(e) => {
                                                                                        const val = e.target.value;
                                                                                        setEditingKpi({ key: `${sector.id}-${idx}`, value: val });
                                                                                        const numericVal = parseFloat(val.replace(',', '.')) || 0;
                                                                                        handleThirdPartyTemporariesSectorChange(sector.id, 'kpi', idx, numericVal);
                                                                                    }}
                                                                                    onBlur={() => setEditingKpi(null)}
                                                                                    className="w-full text-right bg-transparent outline-none focus:ring-1 focus:ring-indigo-300 rounded px-1 font-mono text-[11px]"
                                                                                    placeholder="0,00"
                                                                                />
                                                                            </td>
                                                                        ))}
                                                                        <td className="px-4 py-1"></td>
                                                                        <td></td>
                                                                    </tr>
                                                                    <tr className="bg-gray-50/30 text-[10px] text-gray-500">
                                                                        <td className="px-12 py-1 sticky left-0 bg-gray-50/30 z-10">Hora trabalhada por dia</td>
                                                                        {MONTHS.map((_, idx) => (
                                                                            <td key={idx} className="px-2 py-1 text-right">
                                                                                <input
                                                                                    type="number"
                                                                                    value={config.hoursPerDay[idx] || ''}
                                                                                    onChange={(e) => handleThirdPartyTemporariesSectorChange(sector.id, 'hoursPerDay', idx, parseFloat(e.target.value) || 0)}
                                                                                    className="w-full text-right bg-transparent outline-none focus:ring-1 focus:ring-indigo-300 rounded px-1 font-mono text-[11px]"
                                                                                    placeholder="0"
                                                                                />
                                                                            </td>
                                                                        ))}
                                                                        <td className="px-4 py-1"></td>
                                                                        <td></td>
                                                                    </tr>
                                                                    <tr className="bg-gray-50/30 text-[10px] text-gray-500">
                                                                        <td className="px-12 py-1 sticky left-0 bg-gray-50/30 z-10">Valor da Hora</td>
                                                                        {MONTHS.map((_, idx) => (
                                                                            <td key={idx} className="px-2 py-1 text-right">
                                                                                <input
                                                                                    type="number"
                                                                                    value={config.hourlyRate[idx] || ''}
                                                                                    onChange={(e) => handleThirdPartyTemporariesSectorChange(sector.id, 'hourlyRate', idx, parseFloat(e.target.value) || 0)}
                                                                                    className="w-full text-right bg-transparent outline-none focus:ring-1 focus:ring-indigo-300 rounded px-1 font-mono text-[11px]"
                                                                                    placeholder="0.00"
                                                                                />
                                                                            </td>
                                                                        ))}
                                                                        <td className="px-4 py-1"></td>
                                                                        <td></td>
                                                                    </tr>
                                                                </>
                                                            )}
                                                        </React.Fragment>
                                                    );
                                                })}
                                                {activeSectors.length === 0 && (
                                                    <tr>
                                                        <td colSpan={MONTHS.length + 3} className="px-4 py-8 text-center text-gray-400 text-xs">
                                                            Nenhum setor adicionado. Use o menu acima para adicionar.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        );
                    }

                    // 3. Serviço de terceiros recorrente (Gestores PJ)
                    if (acc.name.toLowerCase().includes('servico de terceiros recorrente')) {
                        activeSectors.forEach(sectorId => {
                            const sectorPJPositions = positions.filter(p => {
                                const template = jobTemplates.find(t => t.id === p.templateId);
                                return p.sectorId === sectorId && template?.type === 'PJ';
                            });
                            sectorPJPositions.forEach(p => {
                                const data = thirdPartyRecurrentData[`${p.id}`] || { salary: Array(12).fill(0), thirteenth: Array(12).fill(0), vacation: Array(12).fill(0) };
                                data.salary.forEach((v, i) => accountMonthlyTotals[i] += v);
                                data.thirteenth.forEach((v, i) => accountMonthlyTotals[i] += v);
                                data.vacation.forEach((v, i) => accountMonthlyTotals[i] += v);
                            });
                        });

                        return (
                            <div key={acc.code} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                <div className="p-0 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                                    <div className="flex items-center gap-4 flex-shrink-0 w-[200px] px-4 py-4 border-r border-gray-200">
                                        <Truck className="text-purple-500" size={18} />
                                        <div className="flex flex-col">
                                            <span className="font-bold text-gray-800 text-sm">Gestores</span>
                                            <span className="text-[9px] text-gray-600 font-medium uppercase tracking-wider">{acc.name}</span>
                                        </div>
                                    </div>

                                    {/* Monthly Summary in Header */}
                                    <div className="hidden xl:flex items-center flex-1 overflow-x-auto no-scrollbar">
                                        {accountMonthlyTotals.map((val, i) => (
                                            <div key={i} className="min-w-[75px] flex-1 text-right px-2">
                                                <div className="text-sm uppercase text-gray-400 font-bold leading-none mb-1">{MONTHS[i]}</div>
                                                <div className="text-xs font-mono font-bold leading-none text-purple-700">{formatCurrency(val, 0)}</div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="flex items-center gap-3 flex-shrink-0 w-[140px] justify-end pr-4 border-l border-gray-200 h-full py-4">
                                        <div className="flex flex-col items-end">
                                            <span className="text-xs font-bold text-gray-400 uppercase leading-none mb-1">Total Geral</span>
                                            <span className="text-sm font-mono font-bold text-purple-900">
                                                {formatCurrency(accountMonthlyTotals.reduce((a, b) => a + b, 0), 0)}
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => toggleThirdPartyAccountExpand(acc.code)}
                                            className="p-1 hover:bg-gray-200 rounded transition-colors"
                                        >
                                            {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                        </button>
                                    </div>
                                </div>
                                {isExpanded && (
                                    <div className="no-scrollbar overflow-x-auto">
                                        <table className="w-full text-sm text-left border-collapse">
                                            <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-200 uppercase text-sm">
                                                <tr>
                                                    <th className="px-4 py-3 min-w-[200px] sticky left-0 bg-gray-50 z-10">
                                                        <div className="flex items-center justify-start gap-2">
                                                            <div className="relative group">
                                                                <button className="w-6 h-6 flex items-center justify-center rounded-full bg-purple-100 text-purple-600 hover:bg-purple-200 transition-colors">
                                                                    <span className="text-lg font-bold leading-none">+</span>
                                                                </button>
                                                                <select
                                                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                                                    onChange={(e) => {
                                                                        if (e.target.value) {
                                                                            handleAddThirdPartySector(acc.code, e.target.value);
                                                                            e.target.value = '';
                                                                        }
                                                                    }}
                                                                    value=""
                                                                >
                                                                    <option value="">+ Setor</option>
                                                                    {costCenters.filter(s => !activeSectors.includes(s.id)).map(s => (
                                                                        <option key={s.id} value={s.id}>{s.name}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        </div>
                                                    </th>
                                                    {MONTHS.map(m => <th key={m} className="px-2 py-3 text-right min-w-[75px]"></th>)}
                                                    <th className="px-4 py-3 text-right min-w-[100px]">Total</th>
                                                    <th className="px-4 py-3 w-10"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {activeSectors.map(sectorId => {
                                                    const sector = costCenters.find(s => s.id === sectorId);
                                                    if (!sector) return null;
                                                    const sectorPJPositions = positions.filter(p => {
                                                        const template = jobTemplates.find(t => t.id === p.templateId);
                                                        return p.sectorId === sector.id && template?.type === 'PJ';
                                                    });

                                                    return (
                                                        <React.Fragment key={sector.id}>
                                                            <tr className="bg-gray-50/50 font-bold text-gray-800">
                                                                <td className="px-4 py-2 sticky left-0 bg-gray-50/50 z-10 flex items-center justify-between gap-2">
                                                                    <span className="text-xs">{sector.name}</span>
                                                                    <button
                                                                        onClick={() => handleRemoveThirdPartySector(acc.code, sector.id)}
                                                                        className="text-red-400 hover:text-red-600 p-1"
                                                                    >
                                                                        <Trash2 size={12} />
                                                                    </button>
                                                                </td>
                                                                {MONTHS.map((_, idx) => {
                                                                    const sectorTotal = sectorPJPositions.reduce((sum, p) => {
                                                                        const data = thirdPartyRecurrentData[`${p.id}`] || { salary: Array(12).fill(0), thirteenth: Array(12).fill(0), vacation: Array(12).fill(0) };
                                                                        return sum + data.salary[idx] + data.thirteenth[idx] + data.vacation[idx];
                                                                    }, 0);
                                                                    return (
                                                                        <td key={idx} className="px-2 py-2 text-right font-mono text-[13px] text-indigo-700">
                                                                            {formatCurrency(sectorTotal, 0)}
                                                                        </td>
                                                                    );
                                                                })}
                                                                <td className="px-4 py-2 text-right font-bold text-indigo-700 bg-gray-100/50 text-[13px]">
                                                                    {formatCurrency(MONTHS.reduce((sum, _, idx) => {
                                                                        return sum + sectorPJPositions.reduce((pSum, p) => {
                                                                            const data = thirdPartyRecurrentData[`${p.id}`] || { salary: Array(12).fill(0), thirteenth: Array(12).fill(0), vacation: Array(12).fill(0) };
                                                                            return pSum + data.salary[idx] + data.thirteenth[idx] + data.vacation[idx];
                                                                        }, 0);
                                                                    }, 0), 0)}
                                                                </td>
                                                                <td></td>
                                                            </tr>
                                                            {sectorPJPositions.map(p => {
                                                                const template = jobTemplates.find(t => t.id === p.templateId);
                                                                const data = thirdPartyRecurrentData[`${p.id}`] || { salary: Array(12).fill(0), thirteenth: Array(12).fill(0), vacation: Array(12).fill(0) };

                                                                return (
                                                                    <React.Fragment key={p.id}>
                                                                        <tr className="hover:bg-gray-50">
                                                                            <td className="px-8 py-1 sticky left-0 bg-white z-10 text-gray-600 text-[11px] font-bold">{template?.name} (Total)</td>
                                                                            {MONTHS.map((_, idx) => (
                                                                                <td key={idx} className="px-2 py-1 text-right font-mono text-[13px] text-gray-500 font-bold">
                                                                                    {formatCurrency(data.salary[idx] + data.thirteenth[idx] + data.vacation[idx], 0)}
                                                                                </td>
                                                                            ))}
                                                                            <td className="px-4 py-1 text-right font-bold text-gray-700 bg-gray-50/30 text-[13px]">
                                                                                {formatCurrency(MONTHS.reduce((sum, _, idx) => sum + data.salary[idx] + data.thirteenth[idx] + data.vacation[idx], 0), 0)}
                                                                            </td>
                                                                            <td></td>
                                                                        </tr>
                                                                        <tr className="hover:bg-gray-50">
                                                                            <td className="px-12 py-1 sticky left-0 bg-white z-10 text-gray-500 text-[10px]">Salário</td>
                                                                            {MONTHS.map((_, idx) => (
                                                                                <td key={idx} className="px-2 py-1 text-right">
                                                                                    <input
                                                                                        type="text"
                                                                                        value={data.salary[idx] === 0 ? '' : formatCurrency(data.salary[idx], 0)}
                                                                                        onChange={(e) => {
                                                                                            const val = parseFloat(e.target.value.replace(/\./g, '').replace(',', '.')) || 0;
                                                                                            handleThirdPartyRecurrentChange(p.id, 'salary', idx, val);
                                                                                        }}
                                                                                        className="w-full text-right bg-transparent outline-none focus:ring-1 focus:ring-indigo-300 rounded px-1 font-mono text-[13px]"
                                                                                        placeholder="0"
                                                                                    />
                                                                                </td>
                                                                            ))}
                                                                            <td className="px-4 py-1"></td>
                                                                            <td></td>
                                                                        </tr>
                                                                        <tr className="hover:bg-gray-50">
                                                                            <td className="px-12 py-1 sticky left-0 bg-white z-10 text-gray-500 text-[10px]">13º Salário</td>
                                                                            {MONTHS.map((_, idx) => (
                                                                                <td key={idx} className="px-2 py-1 text-right">
                                                                                    <input
                                                                                        type="text"
                                                                                        value={data.thirteenth[idx] === 0 ? '' : formatCurrency(data.thirteenth[idx], 0)}
                                                                                        onChange={(e) => {
                                                                                            const val = parseFloat(e.target.value.replace(/\./g, '').replace(',', '.')) || 0;
                                                                                            handleThirdPartyRecurrentChange(p.id, 'thirteenth', idx, val);
                                                                                        }}
                                                                                        className="w-full text-right bg-transparent outline-none focus:ring-1 focus:ring-indigo-300 rounded px-1 font-mono text-[13px]"
                                                                                        placeholder="0"
                                                                                    />
                                                                                </td>
                                                                            ))}
                                                                            <td className="px-4 py-1"></td>
                                                                            <td></td>
                                                                        </tr>
                                                                        <tr className="hover:bg-gray-50">
                                                                            <td className="px-12 py-1 sticky left-0 bg-white z-10 text-gray-500 text-[10px]">Férias</td>
                                                                            {MONTHS.map((_, idx) => (
                                                                                <td key={idx} className="px-2 py-1 text-right">
                                                                                    <input
                                                                                        type="text"
                                                                                        value={data.vacation[idx] === 0 ? '' : formatCurrency(data.vacation[idx], 0)}
                                                                                        onChange={(e) => {
                                                                                            const val = parseFloat(e.target.value.replace(/\./g, '').replace(',', '.')) || 0;
                                                                                            handleThirdPartyRecurrentChange(p.id, 'vacation', idx, val);
                                                                                        }}
                                                                                        className="w-full text-right bg-transparent outline-none focus:ring-1 focus:ring-indigo-300 rounded px-1 font-mono text-[13px]"
                                                                                        placeholder="0"
                                                                                    />
                                                                                </td>
                                                                            ))}
                                                                            <td className="px-4 py-1"></td>
                                                                            <td></td>
                                                                        </tr>
                                                                    </React.Fragment>
                                                                );
                                                            })}
                                                        </React.Fragment>
                                                    );
                                                })}
                                                {activeSectors.length === 0 && (
                                                    <tr>
                                                        <td colSpan={MONTHS.length + 3} className="px-4 py-8 text-center text-gray-400 text-xs">
                                                            Nenhum setor adicionado. Use o menu acima para adicionar.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        );
                    }

                    // 4. Serviços contratados de prestadores PJ - MEI
                    if (acc.name.toLowerCase().includes('serviços contratados de prestadores pj - mei')) {
                        activeSectors.forEach(sectorId => {
                            const config = thirdPartyConfigs[`${acc.code}-${sectorId}`] || { values: Array(12).fill(0) };
                            config.values.forEach((v, i) => accountMonthlyTotals[i] += v);
                        });

                        return (
                            <div key={acc.code} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                <div className="p-0 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                                    <div className="flex items-center gap-4 flex-shrink-0 w-[200px] px-4 py-4 border-r border-gray-200">
                                        <Truck className="text-emerald-500" size={18} />
                                        <div className="flex flex-col">
                                            <span className="font-bold text-gray-800 text-sm">Extraordinários - Pacotes PJ</span>
                                            <span className="text-[9px] text-gray-600 font-medium uppercase tracking-wider">{acc.name}</span>
                                        </div>
                                    </div>

                                    {/* Monthly Summary in Header */}
                                    <div className="hidden xl:flex items-center flex-1 overflow-x-auto no-scrollbar">
                                        {accountMonthlyTotals.map((val, i) => (
                                            <div key={i} className="min-w-[75px] flex-1 text-right px-2">
                                                <div className="text-sm uppercase text-gray-400 font-bold leading-none mb-1">{MONTHS[i]}</div>
                                                <div className="text-xs font-mono font-bold leading-none text-emerald-700">{formatCurrency(val, 0)}</div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="flex items-center gap-3 flex-shrink-0 w-[140px] justify-end pr-4 border-l border-gray-200 h-full py-4">
                                        <div className="flex flex-col items-end">
                                            <span className="text-xs font-bold text-gray-400 uppercase leading-none mb-1">Total Geral</span>
                                            <span className="text-sm font-mono font-bold text-emerald-900">
                                                {formatCurrency(accountMonthlyTotals.reduce((a, b) => a + b, 0), 0)}
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => toggleThirdPartyAccountExpand(acc.code)}
                                            className="p-1 hover:bg-gray-200 rounded transition-colors"
                                        >
                                            {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                        </button>
                                    </div>
                                </div>
                                {isExpanded && (
                                    <div className="overflow-x-auto no-scrollbar">
                                        <table className="w-full text-sm text-left border-collapse">
                                            <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-200 uppercase text-sm">
                                                <tr>
                                                    <th className="px-4 py-3 min-w-[200px] sticky left-0 bg-gray-50 z-10">
                                                        <div className="flex items-center justify-start gap-2">
                                                            <div className="relative group">
                                                                <button className="w-6 h-6 flex items-center justify-center rounded-full bg-emerald-100 text-emerald-600 hover:bg-emerald-200 transition-colors">
                                                                    <span className="text-lg font-bold leading-none">+</span>
                                                                </button>
                                                                <select
                                                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                                                    onChange={(e) => {
                                                                        if (e.target.value) {
                                                                            handleAddThirdPartySector(acc.code, e.target.value);
                                                                            e.target.value = '';
                                                                        }
                                                                    }}
                                                                    value=""
                                                                >
                                                                    <option value="">+ Setor</option>
                                                                    {costCenters.filter(s => !activeSectors.includes(s.id)).map(s => (
                                                                        <option key={s.id} value={s.id}>{s.name}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        </div>
                                                    </th>
                                                    {MONTHS.map(m => <th key={m} className="px-2 py-3 text-right min-w-[75px]"></th>)}
                                                    <th className="px-4 py-3 text-right min-w-[100px]">Total</th>
                                                    <th className="px-4 py-3 w-10"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {activeSectors.map(sectorId => {
                                                    const sector = costCenters.find(s => s.id === sectorId);
                                                    if (!sector) return null;
                                                    const config = thirdPartyConfigs[`${acc.code}-${sector.id}`] || {
                                                        method: 'absolute',
                                                        values: Array(12).fill(0)
                                                    };
                                                    const rowTotal = config.values.reduce((a, b) => a + b, 0);

                                                    return (
                                                        <tr key={sector.id} className="hover:bg-gray-50">
                                                            <td className="px-4 py-2 sticky left-0 bg-white z-10 font-medium text-gray-700 text-sm min-w-[200px]">{sector.name}</td>
                                                            {MONTHS.map((_, idx) => (
                                                                <td key={idx} className="px-2 py-2 text-right">
                                                                    <input
                                                                        type="text"
                                                                        value={config.values[idx] === 0 ? '' : formatCurrency(config.values[idx], 0)}
                                                                        onChange={(e) => {
                                                                            const val = parseFloat(e.target.value.replace(/\./g, '').replace(',', '.')) || 0;
                                                                            handleThirdPartyChange(acc.code, sector.id, idx, val);
                                                                        }}
                                                                        placeholder="0,00"
                                                                        className="w-full text-right bg-transparent outline-none focus:ring-1 focus:ring-emerald-300 rounded px-1 font-mono text-[13px]"
                                                                    />
                                                                </td>
                                                            ))}
                                                            <td className="px-4 py-2 text-right font-bold text-gray-900 bg-gray-50/50 text-[13px]">
                                                                {formatCurrency(rowTotal, 0)}
                                                            </td>
                                                            <td className="px-2 py-2 text-center">
                                                                <button
                                                                    onClick={() => handleRemoveThirdPartySector(acc.code, sector.id)}
                                                                    className="text-red-400 hover:text-red-600 p-1"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                                {activeSectors.length === 0 && (
                                                    <tr>
                                                        <td colSpan={MONTHS.length + 3} className="px-4 py-8 text-center text-gray-400 text-xs">
                                                            Nenhum setor adicionado. Use o menu acima para adicionar.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        );
                    }

                    // Default fallback (should not happen with current names)
                    return null;
                })}
            </div>
        );
    };

    const renderChargesTab = () => (
        <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <ShieldCheck className="text-emerald-600" size={18} />
                        <h3 className="font-bold text-gray-700">Encargos Sociais (Automáticos)</h3>
                    </div>
                    <div className="flex gap-4 text-[10px] font-bold text-gray-500 uppercase">
                        <span>FGTS: {laborParameters.fgtsPct}%</span>
                        <span>INSS: {laborParameters.inssPct}%</span>
                        <span>PIS: {laborParameters.pisPct}%</span>
                    </div>
                </div>
                <div className="no-scrollbar overflow-x-auto">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-200 uppercase text-sm">
                            <tr>
                                <th className="px-4 py-3 min-w-[200px] sticky left-0 bg-gray-50 z-10">Conta / Setor</th>
                                {MONTHS.map(m => <th key={m} className="px-2 py-3 text-right min-w-[75px]">{m}</th>)}
                                <th className="px-4 py-3 text-right bg-gray-100">Total Ano</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {CHARGE_ACCOUNTS.map(acc => {
                                const isExpanded = expandedChargeAccounts[acc.code];
                                const accountTotals = MONTHS.map((_, mIdx) => {
                                    return costCenters.reduce((sum, sector) => {
                                        const payroll = calculateSectorPayroll(sector.id, mIdx);
                                        const pct = getChargePercentage(acc.name);
                                        return sum + (payroll * pct / 100);
                                    }, 0);
                                });

                                return (
                                    <React.Fragment key={acc.code}>
                                        <tr className="bg-gray-100 font-bold text-gray-700">
                                            <td className="px-4 py-2 sticky left-0 bg-gray-100 z-10 flex items-center gap-2">
                                                <button
                                                    onClick={() => toggleChargeAccountExpand(acc.code)}
                                                    className="p-1 hover:bg-gray-200 rounded transition-colors"
                                                >
                                                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                </button>
                                                <span>{acc.code} - {acc.name}</span>
                                            </td>
                                            {accountTotals.map((total, idx) => (
                                                <td key={idx} className="px-2 py-2 text-right font-mono text-indigo-700 text-sm font-bold">
                                                    {formatCurrency(total, 0)}
                                                </td>
                                            ))}
                                            <td className="px-4 py-2 text-right font-bold bg-gray-200">
                                                {formatCurrency(accountTotals.reduce((a, b) => a + b, 0), 0)}
                                            </td>
                                        </tr>
                                        {isExpanded && costCenters.map(sector => {
                                            const sectorValues = MONTHS.map((_, mIdx) => {
                                                const payroll = calculateSectorPayroll(sector.id, mIdx);
                                                const pct = getChargePercentage(acc.name);
                                                return payroll * pct / 100;
                                            });
                                            const sectorTotal = sectorValues.reduce((a, b) => a + b, 0);
                                            return (
                                                <tr key={`${acc.code}-${sector.id}`} className="hover:bg-gray-50">
                                                    <td className="px-8 py-2 sticky left-0 bg-white z-10 text-gray-600 text-xs">{sector.name}</td>
                                                    {sectorValues.map((val, idx) => (
                                                        <td key={idx} className="px-2 py-2 text-right font-mono text-xs text-gray-500">
                                                            {formatCurrency(val, 0)}
                                                        </td>
                                                    ))}
                                                    <td className="px-4 py-2 text-right font-bold text-gray-700 bg-gray-50 text-xs">
                                                        {formatCurrency(sectorTotal, 0)}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );

    const renderDetailsTab = () => {
        const occupiedRooms = budgetOccupancyData['geral_sold'] || Array(12).fill(0);

        return (
            <div className="space-y-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <Briefcase className="text-indigo-600" size={18} />
                            <h3 className="font-bold text-gray-700">Detalhamento de Custos por Setor</h3>
                        </div>
                    </div>
                    <div className="no-scrollbar overflow-x-auto">
                        <table className="w-full text-sm text-left border-collapse">
                            <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-200 uppercase text-sm">
                                <tr>
                                    <th className="px-4 py-3 sticky left-0 bg-gray-50 z-10 min-w-[200px]">Setor / Cargo / Conta</th>
                                    {MONTHS.map(m => <th key={m} className="px-2 py-3 text-right min-w-[75px]">{m}</th>)}
                                    <th className="px-4 py-3 text-right bg-indigo-50 text-indigo-700">Total Ano</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {costCenters.map(sector => {
                                    const sectorPositions = positions.filter(p => p.sectorId === sector.id);
                                    const sectorPJManagers = sectorPositions
                                        .filter(p => {
                                            const template = jobTemplates.find(t => t.id === p.templateId);
                                            return template?.type === 'PJ';
                                        })
                                        .map(p => {
                                            const template = jobTemplates.find(t => t.id === p.templateId);
                                            const data = thirdPartyRecurrentData[p.id] || { salary: Array(12).fill(0), thirteenth: Array(12).fill(0), vacation: Array(12).fill(0) };
                                            return {
                                                role: template?.name || 'Gestor PJ',
                                                data: {
                                                    salary: data.salary,
                                                    decimo: data.thirteenth,
                                                    vacation: data.vacation
                                                }
                                            };
                                        });
                                    const isSectorExpanded = expandedSectors[sector.id];

                                    // PJ Managers for this sector
                                    const sectorPJPositions = positions.filter(p => {
                                        const template = jobTemplates.find(t => t.id === p.templateId);
                                        return p.sectorId === sector.id && template?.type === 'PJ';
                                    });

                                    // Other Third Party for this sector
                                    const meiAcc = THIRD_PARTY_ACCOUNTS.find(a => a.name.toLowerCase().includes('mei'));
                                    const servicesAcc = THIRD_PARTY_ACCOUNTS.find(a => a.name.toLowerCase().includes('prestados por terceiros'));

                                    const sectorMEI = thirdPartyConfigs[`${meiAcc?.code}-${sector.id}`]?.values || Array(12).fill(0);
                                    const sectorServices = thirdPartyConfigs[`${servicesAcc?.code}-${sector.id}`]?.values || Array(12).fill(0);

                                    const tempConfig = thirdPartyTemporariesSectors[sector.id] || {
                                        kpi: Array(12).fill(0),
                                        hoursPerDay: Array(12).fill(0),
                                        hourlyRate: Array(12).fill(0)
                                    };
                                    const sectorTemporaries = MONTHS.map((_, idx) => {
                                        const rooms = occupiedRooms[idx];
                                        return rooms * (tempConfig.kpi[idx] || 0) * (tempConfig.hoursPerDay[idx] || 0) * (tempConfig.hourlyRate[idx] || 0);
                                    });

                                    const sectorTotalsPerMonth = MONTHS.map((_, mIdx) => {
                                        // CLT
                                        const cltTotal = sectorPositions.reduce((sum, p) => {
                                            const template = jobTemplates.find(t => t.id === p.templateId);
                                            if (!template || template.type !== 'CLT') return sum;
                                            const adjustedSalary = getAdjustedSalary(p.templateId, mIdx);
                                            const base = adjustedSalary * p.headcount[mIdx];
                                            const charges = base * (laborParameters.fgtsPct + laborParameters.inssPct + laborParameters.pisPct) / 100;
                                            const decimo = mIdx === 11 ? base : 0;
                                            const ferias = base * 0.33 / 12;
                                            return sum + base + charges + decimo + ferias;
                                        }, 0);
                                        // Benefits
                                        const benefitsTotal = BENEFIT_ACCOUNTS.reduce((bSum, acc) => {
                                            const config = benefitConfigs[`${acc.code}-${sector.id}`];
                                            return bSum + (config?.values[mIdx] || 0);
                                        }, 0);
                                        // PJ Managers
                                        const pjTotal = sectorPJPositions.reduce((sum, p) => {
                                            const data = thirdPartyRecurrentData[`${p.id}`] || { salary: Array(12).fill(0), thirteenth: Array(12).fill(0), vacation: Array(12).fill(0) };
                                            return sum + (data.salary[mIdx] || 0) + (data.thirteenth[mIdx] || 0) + (data.vacation[mIdx] || 0);
                                        }, 0);
                                        // Others
                                        const othersTotal = sectorMEI[mIdx] + sectorServices[mIdx] + sectorTemporaries[mIdx];

                                        return cltTotal + benefitsTotal + pjTotal + othersTotal;
                                    });

                                    const sectorTotalYear = sectorTotalsPerMonth.reduce((a, b) => a + b, 0);
                                    if (sectorTotalYear === 0) return null;

                                    return (
                                        <React.Fragment key={sector.id}>
                                            <tr className="bg-gray-100 font-bold text-gray-800">
                                                <td className="px-4 py-2 sticky left-0 bg-gray-100 z-10 flex items-center gap-2">
                                                    <button
                                                        onClick={() => toggleSectorExpand(sector.id)}
                                                        className="p-1 hover:bg-gray-200 rounded transition-colors"
                                                    >
                                                        {isSectorExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                    </button>
                                                    <span>{sector.name}</span>
                                                </td>
                                                {sectorTotalsPerMonth.map((total, mIdx) => (
                                                    <td key={mIdx} className="px-2 py-2 text-right font-mono text-xs text-gray-700">
                                                        {formatCurrency(total, 0)}
                                                    </td>
                                                ))}
                                                <td className="px-4 py-2 text-right font-bold bg-gray-200">
                                                    {formatCurrency(sectorTotalYear, 0)}
                                                </td>
                                            </tr>
                                            {isSectorExpanded && (
                                                <>
                                                    {/* CLT Positions */}
                                                    {sectorPositions.map(p => {
                                                        const template = jobTemplates.find(t => t.id === p.templateId);
                                                        if (!template || template.type !== 'CLT') return null;
                                                        const isPositionExpanded = expandedDetailPositions[p.id];

                                                        const rows = [
                                                            { name: PAYROLL_ACCOUNTS.salaries, values: MONTHS.map((_, mIdx) => getAdjustedSalary(p.templateId, mIdx) * p.headcount[mIdx]) },
                                                            { name: PAYROLL_ACCOUNTS.decimo, values: MONTHS.map((_, mIdx) => (mIdx === 11 ? (getAdjustedSalary(p.templateId, mIdx) * p.headcount[mIdx]) : 0)) },
                                                            { name: PAYROLL_ACCOUNTS.ferias, values: MONTHS.map((_, mIdx) => (getAdjustedSalary(p.templateId, mIdx) * p.headcount[mIdx] * 0.33 / 12)) },
                                                            { name: PAYROLL_ACCOUNTS.fgts, values: MONTHS.map((_, mIdx) => getAdjustedSalary(p.templateId, mIdx) * p.headcount[mIdx] * laborParameters.fgtsPct / 100) },
                                                            { name: PAYROLL_ACCOUNTS.inss, values: MONTHS.map((_, mIdx) => getAdjustedSalary(p.templateId, mIdx) * p.headcount[mIdx] * laborParameters.inssPct / 100) },
                                                            { name: PAYROLL_ACCOUNTS.pis, values: MONTHS.map((_, mIdx) => getAdjustedSalary(p.templateId, mIdx) * p.headcount[mIdx] * laborParameters.pisPct / 100) },
                                                        ];

                                                        // Add benefits for this position
                                                        BENEFIT_ACCOUNTS.forEach(acc => {
                                                            const config = benefitConfigs[`${acc.code}-${sector.id}`];
                                                            if (config) {
                                                                const sectorHeadcountPerMonth = MONTHS.map((_, mIdx) => sectorPositions.reduce((sum, sp) => sum + sp.headcount[mIdx], 0));
                                                                const values = MONTHS.map((_, mIdx) => {
                                                                    const totalSectorHeadcount = sectorHeadcountPerMonth[mIdx];
                                                                    if (totalSectorHeadcount === 0) return 0;
                                                                    const perPerson = config.values[mIdx] / totalSectorHeadcount;
                                                                    return perPerson * p.headcount[mIdx];
                                                                });
                                                                if (values.some(v => v > 0)) {
                                                                    rows.push({ name: acc.name, values });
                                                                }
                                                            }
                                                        });

                                                        const positionTotalPerMonth = MONTHS.map((_, mIdx) => rows.reduce((sum, r) => sum + r.values[mIdx], 0));

                                                        return (
                                                            <React.Fragment key={p.id}>
                                                                <tr className="bg-white font-semibold text-gray-700 border-b border-gray-100">
                                                                    <td className="px-8 py-2 sticky left-0 bg-white z-10 flex items-center gap-2">
                                                                        <button
                                                                            onClick={() => toggleDetailPositionExpand(p.id)}
                                                                            className="p-1 hover:bg-gray-100 rounded transition-colors"
                                                                        >
                                                                            {isPositionExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                                        </button>
                                                                        <span>{template.name} (CLT)</span>
                                                                    </td>
                                                                    {positionTotalPerMonth.map((total, mIdx) => (
                                                                        <td key={mIdx} className="px-2 py-2 text-right font-mono text-sm text-indigo-600 font-bold">
                                                                            {formatCurrency(total, 0)}
                                                                        </td>
                                                                    ))}
                                                                    <td className="px-4 py-2 text-right font-bold bg-indigo-50/30 text-indigo-700 text-sm">
                                                                        {formatCurrency(positionTotalPerMonth.reduce((a, b) => a + b, 0), 0)}
                                                                    </td>
                                                                </tr>
                                                                {isPositionExpanded && rows.map((row, rIdx) => (
                                                                    <tr key={rIdx} className="hover:bg-gray-50 text-xs text-gray-500">
                                                                        <td className="px-12 py-1 sticky left-0 bg-white z-10 italic">{row.name}</td>
                                                                        {row.values.map((val, mIdx) => (
                                                                            <td key={mIdx} className="px-2 py-1 text-right font-mono text-xs">
                                                                                {formatCurrency(val, 0)}
                                                                            </td>
                                                                        ))}
                                                                        <td className="px-4 py-1 text-right font-bold bg-gray-50/50 text-xs">
                                                                            {formatCurrency(row.values.reduce((a, b) => a + b, 0), 0)}
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </React.Fragment>
                                                        );
                                                    })}

                                                    {/* PJ Managers */}
                                                    {sectorPJManagers.map(pj => {
                                                        const pjTotalPerMonth = MONTHS.map((_, idx) => (pj.data.salary[idx] || 0) + (pj.data.decimo[idx] || 0) + (pj.data.vacation[idx] || 0));
                                                        const isPJExpanded = expandedDetailPositions[`pj-${sector.id}-${pj.role}`];

                                                        const rows = [
                                                            { name: 'Pro-labore / Salário', values: pj.data.salary },
                                                            { name: '13º Salário', values: pj.data.decimo },
                                                            { name: 'Férias', values: pj.data.vacation }
                                                        ];

                                                        return (
                                                            <React.Fragment key={pj.role}>
                                                                <tr className="bg-white font-semibold text-gray-700 border-b border-gray-100">
                                                                    <td className="px-8 py-2 sticky left-0 bg-white z-10 flex items-center gap-2">
                                                                        <button
                                                                            onClick={() => toggleDetailPositionExpand(`pj-${sector.id}-${pj.role}`)}
                                                                            className="p-1 hover:bg-gray-100 rounded transition-colors"
                                                                        >
                                                                            {isPJExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                                        </button>
                                                                        <span>{pj.role} (PJ)</span>
                                                                    </td>
                                                                    {pjTotalPerMonth.map((total, mIdx) => (
                                                                        <td key={mIdx} className="px-2 py-2 text-right font-mono text-sm text-emerald-600 font-bold">
                                                                            {formatCurrency(total, 0)}
                                                                        </td>
                                                                    ))}
                                                                    <td className="px-4 py-2 text-right font-bold bg-emerald-50/30 text-emerald-700 text-sm">
                                                                        {formatCurrency(pjTotalPerMonth.reduce((a, b) => a + b, 0), 0)}
                                                                    </td>
                                                                </tr>
                                                                {isPJExpanded && rows.map((row, rIdx) => (
                                                                    <tr key={rIdx} className="hover:bg-gray-50 text-xs text-gray-500">
                                                                        <td className="px-12 py-1 sticky left-0 bg-white z-10 italic">{row.name}</td>
                                                                        {row.values.map((val, mIdx) => (
                                                                            <td key={mIdx} className="px-2 py-1 text-right font-mono text-xs">
                                                                                {formatCurrency(val, 0)}
                                                                            </td>
                                                                        ))}
                                                                        <td className="px-4 py-1 text-right font-bold bg-gray-50/50 text-xs">
                                                                            {formatCurrency(row.values.reduce((a, b) => a + b, 0), 0)}
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </React.Fragment>
                                                        );
                                                    })}

                                                    {/* Other Third Party */}
                                                    {[
                                                        { name: 'Serviços Prestados por Terceiros', values: sectorServices },
                                                        { name: 'Serviços de Terceiros Temporários', values: sectorTemporaries },
                                                        { name: 'Prestadores PJ - MEI', values: sectorMEI }
                                                    ].map((item, idx) => {
                                                        const total = item.values.reduce((a, b) => a + b, 0);
                                                        if (total === 0) return null;
                                                        return (
                                                            <tr key={idx} className="bg-white text-xs text-gray-600 border-b border-gray-100">
                                                                <td className="px-12 py-2 sticky left-0 bg-white z-10 font-medium">{item.name}</td>
                                                                {item.values.map((val, mIdx) => (
                                                                    <td key={mIdx} className="px-2 py-2 text-right font-mono">
                                                                        {formatCurrency(val, 0)}
                                                                    </td>
                                                                ))}
                                                                <td className="px-4 py-2 text-right font-bold bg-gray-50/50">
                                                                    {formatCurrency(total, 0)}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="p-8 w-full max-w-full mx-auto font-calibri">
            <div className="mb-8">
                <h2 className="text-3xl font-bold text-gray-900">Mão de Obra - Tauá Budget</h2>
                <p className="text-gray-500 mt-2">Gestão completa de cargos, salários, headcount, benefícios e encargos.</p>
            </div>

            {/* TAB NAVIGATION */}
            <div className="flex gap-1 bg-gray-200 p-1 rounded-xl mb-8 w-fit">
                <button
                    onClick={() => setActiveTab('positions')}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'positions' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}
                >
                    <DollarSign size={18} /> Cargos e Salários
                </button>
                <button
                    onClick={() => setActiveTab('headcount')}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'headcount' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}
                >
                    <Users size={18} /> Headcount
                </button>
                <button
                    onClick={() => setActiveTab('benefits')}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'benefits' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}
                >
                    <Gift size={18} /> Benefícios
                </button>
                <button
                    onClick={() => setActiveTab('personnel_expenses')}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'personnel_expenses' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}
                >
                    <UserPlus size={18} /> Despesas com Pessoal
                </button>
                <button
                    onClick={() => setActiveTab('third_party')}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'third_party' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}
                >
                    <Truck size={18} /> Terceiros
                </button>
                <button
                    onClick={() => setActiveTab('charges')}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'charges' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}
                >
                    <ShieldCheck size={18} /> Encargos Sociais
                </button>
                <button
                    onClick={() => setActiveTab('details')}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'details' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}
                >
                    <Briefcase size={18} /> Detalhamento
                </button>
            </div>

            {/* TAB CONTENT */}
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                {activeTab === 'positions' && renderPositionsTab()}
                {activeTab === 'headcount' && renderHeadcountTab()}
                {activeTab === 'benefits' && renderBenefitsTab()}
                {activeTab === 'personnel_expenses' && renderPersonnelExpensesTab()}
                {activeTab === 'third_party' && renderThirdPartyTab()}
                {activeTab === 'charges' && renderChargesTab()}
                {activeTab === 'details' && renderDetailsTab()}
            </div>
        </div>
    );
};

export default BudgetLaborView;
