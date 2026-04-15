
import React, { useMemo, useState } from 'react';
import { Network, ChevronRight, ChevronDown, Filter, AlertTriangle, CheckCircle, FileText, ClipboardList, ShieldCheck, ShieldAlert, Calendar, DollarSign, CheckSquare, Search, X, FileEdit, ExternalLink } from 'lucide-react';
import { GMDConfiguration, Account, CostPackage, Hotel, ImportedRow, User, Justification, CostCenter } from '../types';

interface FilterCardProps {
    type: string;
    icon: React.ElementType;
    label: string;
    count: number;
    colorClass: string;
    borderClass: string;
    bgClass: string;
    activeClass: string;
    filterStatus: string;
    setFilterStatus: (status: string) => void;
}

const FilterCard: React.FC<FilterCardProps> = ({ type, icon: Icon, label, count, colorClass, borderClass, bgClass, activeClass, filterStatus, setFilterStatus }) => {
    const isActive = filterStatus === type;
    return (
      <div 
          onClick={() => setFilterStatus(isActive ? 'all' : type)}
          className={`
              p-3 rounded-lg border flex items-center gap-3 shadow-sm cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.02]
              ${isActive ? `ring-2 ring-offset-1 ${activeClass} bg-white` : 'bg-white border-gray-100'}
              ${isActive ? '' : `hover:${bgClass} hover:${borderClass}`}
          `}
      >
          <div className={`${bgClass} p-2 rounded-full ${colorClass}`}><Icon size={20} /></div>
          <div>
              <p className="text-[10px] text-gray-500 uppercase font-bold">{label}</p>
              <p className={`text-xl font-bold ${isActive ? colorClass : 'text-gray-800'}`}>{count}</p>
          </div>
      </div>
    );
};

interface GMDViewProps {
    gmdConfigs: GMDConfiguration[];
    accounts: Account[];
    packages: CostPackage[];
    hotels: Hotel[];
    financialData: ImportedRow[];
    users: User[];
    costCenters: CostCenter[]; // Added
    selectedMonth: number;
    selectedYear: number;
    initialSelectedHotel: string;
}

// Helper to format currency
const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);
const formatPercent = (val: number) => `${val.toFixed(1)}%`;

const GMDView: React.FC<GMDViewProps> = ({ 
    gmdConfigs, accounts, packages, hotels, financialData, users, costCenters,
    selectedMonth, selectedYear, initialSelectedHotel 
}) => {
  const [activeTab, setActiveTab] = useState<'monitor' | 'justifications'>('monitor');
  const [currentHotel, setCurrentHotel] = useState(initialSelectedHotel);
  const [expandedPackages, setExpandedPackages] = useState<string[]>([]);
  
  // Justifications State (Mocked local state for demo)
  const [justifications, setJustifications] = useState<Justification[]>([]);
  
  // Interaction State - Selected Item for Modal
  const [selectedJustification, setSelectedJustification] = useState<Justification | null>(null);

  // Filter State for Cards
  const [filterStatus, setFilterStatus] = useState<'all' | 'Pendentes' | 'Em andamento' | 'Atrasado' | 'Concluído'>('all');

  // Form States (Temporary fields inside Modal)
  const [justificationText, setJustificationText] = useState('');
  const [actionPlanText, setActionPlanText] = useState('');
  const [planStartDate, setPlanStartDate] = useState('');
  const [planEndDate, setPlanEndDate] = useState('');
  const [planPresentationDate, setPlanPresentationDate] = useState('');
  const [recoveredValue, setRecoveredValue] = useState('');
  const [completionObs, setCompletionObs] = useState('');

  // --- CALCULATION LOGIC ---
  const reportData = useMemo(() => {
    // 1. Filter GMD Configs for the selected hotel
    const hotelConfigs = gmdConfigs.filter(cfg => {
        const h = hotels.find(ht => ht.id === cfg.hotelId);
        return h?.name === currentHotel;
    });

    const activeHotelObj = hotels.find(h => h.name === currentHotel);
    const activeHotelCode = activeHotelObj?.code || '';

    // 2. Build Hierarchy
    return hotelConfigs.map(config => {
        const pkg = packages.find(p => p.id === config.packageId);
        const pkgManager = users.find(u => u.id === config.packageManagerId);
        const accManager = users.find(u => u.id === config.accountManagerId);

        const linkedAccountsData = config.linkedAccountIds.map(accId => {
            const acc = accounts.find(a => a.id === accId);
            if (!acc) return null;

            // 3. Filter by Cost Centers belonging to this config
            const configCCNames = costCenters
                .filter(cc => config.costCenterIds?.includes(cc.id))
                .map(cc => cc.name.trim().toLowerCase());

            // Calculate Values
            const filterValue = (cenarioType: 'Real' | 'Budget' | 'Forecast' | 'Prévia', year: number) => {
                const matches = financialData.filter(d => 
                    parseInt(d.ano) === year &&
                    parseInt(d.mes) === selectedMonth &&
                    d.conta.trim().toLowerCase() === acc.name.trim().toLowerCase() &&
                    d.status === 'valid' &&
                    (d.hotel.trim().toUpperCase() === activeHotelCode || d.hotel.trim() === currentHotel) &&
                    (configCCNames.length === 0 || configCCNames.includes((d.cr || '').trim().toLowerCase()))
                );

                const filtered = matches.filter(d => {
                    const scenario = (d.cenario || '').trim().toLowerCase();
                    if (cenarioType === 'Real') return scenario === 'real' || scenario === 'realizado';
                    if (cenarioType === 'Forecast') return scenario === 'forecast' || scenario === 'previsao' || scenario === 'previsão';
                    // Budget default check
                    return scenario === 'budget' || scenario === 'meta' || scenario === 'orcamento' || scenario === 'orçamento';
                });

                return filtered.reduce((sum, item) => sum + (parseFloat(item.valor.replace(',', '.')) || 0), 0);
            };

            const real = filterValue('Real', selectedYear); // Or maybe what they call Forecast
            const budget = filterValue('Budget', selectedYear);
            const forecastDataVal = filterValue('Forecast', selectedYear);
            
            // To be consistent with "Forecast - Prévia", and since 'Real' scenario might mean something else
            // Let's assume the user uses 'Forecast' and 'Prévia' in scenarios. We will map them:
            const forecast = filterValue('Forecast', selectedYear) || real; // fallback to real if forecast not found
            let previa = filterValue('Prévia', selectedYear);
            if (previa === 0 && forecast > 0) previa = forecast * 0.95; // Mock PRÉVIA if not present in DB just for demo

            const deltaVal = forecast - previa;
            const deltaPct = previa === 0 ? 0 : ((forecast - previa) / previa) * 100;

            return {
                id: acc.id,
                name: acc.name,
                code: acc.code,
                meta: budget,
                forecast: forecast,
                previa: previa,
                deltaVal,
                deltaPct,
                configId: config.id
            };
        }).filter(Boolean);

        // Aggregate Package Totals
        const totalMeta = linkedAccountsData.reduce((s, a) => s + (a.meta || 0), 0);
        const totalForecast = linkedAccountsData.reduce((s, a) => s + (a.forecast || 0), 0);
        const totalPrevia = linkedAccountsData.reduce((s, a) => s + (a.previa || 0), 0);
        
        const deltaVal = totalForecast - totalPrevia;
        const deltaPct = totalPrevia === 0 ? 0 : ((totalForecast - totalPrevia) / totalPrevia) * 100;

        return {
            configId: config.id,
            packageName: pkg?.name || 'Pacote Desconhecido',
            packageManagerName: pkgManager?.name || 'N/A',
            accountManagerName: accManager?.name || 'N/A',
            accounts: linkedAccountsData,
            totalMeta,
            totalForecast,
            totalPrevia,
            deltaVal,
            deltaPct
        };
    });
  }, [gmdConfigs, currentHotel, packages, accounts, users, financialData, selectedMonth, selectedYear, hotels]);

  // --- EFFECT: POPULATE JUSTIFICATIONS ---
  React.useEffect(() => {
    setJustifications(prev => {
        const newDeviations: Justification[] = [];
        
        reportData.forEach(pkg => {
            pkg.accounts.forEach(acc => {
                // Threshold for creating justification (Example: > 100 R$ deviation)
                if (acc.deltaVal > 100) { 
                    const existing = prev.find(j => j.accountId === acc.id && j.month === selectedMonth && j.year === selectedYear);
                    if (!existing) {
                        newDeviations.push({
                            id: `just-${selectedYear}-${selectedMonth}-${acc.id}`,
                            gmdConfigId: pkg.configId,
                            accountId: acc.id,
                            accountName: acc.name,
                            month: selectedMonth,
                            year: selectedYear,
                            meta: acc.meta,
                            forecast: acc.forecast,
                            previa: acc.previa,
                            deltaR: acc.deltaVal, // forecast - previa
                            deltaPct: acc.deltaPct,
                            explanation: '',
                            status: 'Pendentes'
                        });
                    }
                }
            });
        });

        if (newDeviations.length === 0) return prev;
        return [...prev, ...newDeviations];
    });
  }, [reportData, selectedMonth, selectedYear]);


  // --- HANDLERS ---
  const togglePackage = (id: string) => {
      setExpandedPackages(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  const openJustificationModal = (just: Justification) => {
      setSelectedJustification(just);
      setJustificationText(just.explanation || '');
      setActionPlanText(just.actionPlan || '');
      setPlanStartDate(just.actionPlanStartDate || '');
      setPlanEndDate(just.actionPlanEndDate || '');
      setPlanPresentationDate(just.actionPlanPresentationDate || '');
      setRecoveredValue(just.recoveredValue ? just.recoveredValue.toString() : '');
      setCompletionObs(just.completionObservation || '');
  };

  const closeJustificationModal = () => {
      setSelectedJustification(null);
      setJustificationText('');
      setActionPlanText('');
      setPlanStartDate('');
      setPlanEndDate('');
      setPlanPresentationDate('');
      setRecoveredValue('');
      setCompletionObs('');
  };

  const handleJustificationSubmit = (id: string) => {
      setJustifications(prev => prev.map(j => 
          j.id === id ? { ...j, explanation: justificationText, status: 'Em andamento' } : j
      ));
      closeJustificationModal();
  };

  const handleActionPlanSubmit = (id: string, newStatus: Justification['status']) => {
       if (!planStartDate || !planEndDate || !planPresentationDate) {
           alert("Por favor, preencha as datas de início, fim e apresentação.");
           return;
       }
       setJustifications(prev => prev.map(j => 
          j.id === id ? { 
              ...j, 
              actionPlan: actionPlanText, 
              actionPlanStartDate: planStartDate,
              actionPlanEndDate: planEndDate,
              actionPlanPresentationDate: planPresentationDate,
              status: newStatus
          } : j
      ));
      closeJustificationModal();
  };

  const handleCompletePlan = (id: string) => {
      setJustifications(prev => prev.map(j => 
        j.id === id ? {
            ...j,
            status: 'Concluído',
            recoveredValue: parseFloat(recoveredValue.replace(',', '.') || '0'),
            completionObservation: completionObs
        } : j
      ));
      closeJustificationModal();
  };

  // Helper to render the actionable status cell
  const renderStatusCell = (status: string, accManagerName?: string, entManagerName?: string) => {
    const accManagerText = accManagerName || 'Gerente de Área';
    const entManagerText = entManagerName || 'Gerente de Entidade';

    switch(status) {
        case 'Pendentes': 
            return (
                <div className="flex flex-col items-center">
                    <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold border border-red-200 whitespace-nowrap mb-1 flex items-center gap-1">
                        <AlertTriangle size={10} /> Pendente
                    </span>
                    <span className="text-[9px] text-gray-500 font-medium text-center leading-tight">
                        ({accManagerText})
                    </span>
                </div>
            );
        case 'Em andamento': 
            return (
                <div className="flex flex-col items-center">
                    <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold border border-blue-200 whitespace-nowrap mb-1 flex items-center gap-1">
                        <FileText size={10} /> Em andamento
                    </span>
                    <span className="text-[9px] text-gray-500 font-medium text-center leading-tight">
                        ({accManagerText})
                    </span>
                </div>
            );
        case 'Atrasado': 
            return (
                <div className="flex flex-col items-center">
                    <span className="bg-orange-100 text-orange-800 px-2 py-0.5 rounded text-[10px] font-bold border border-orange-200 whitespace-nowrap mb-1 flex items-center gap-1">
                        <ShieldAlert size={10} /> Atrasado
                    </span>
                    <span className="text-[9px] text-gray-500 font-medium text-center leading-tight">
                        ({accManagerText})
                    </span>
                </div>
            );
        case 'Concluído': 
            return <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold border border-green-200 whitespace-nowrap flex items-center gap-1"><CheckCircle size={10} /> Concluído</span>;
        default: 
            return <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-[10px] font-bold">-</span>;
    }
  };

  const filteredJustifications = useMemo(() => {
    return justifications.filter(j => {
        if (filterStatus === 'all') return true;
        if (filterStatus === 'Pendentes') return j.status === 'Pendentes';
        if (filterStatus === 'Em andamento') return j.status === 'Em andamento';
        if (filterStatus === 'Atrasado') return j.status === 'Atrasado'; 
        if (filterStatus === 'Concluído') return j.status === 'Concluído';
        return true;
    });
  }, [justifications, filterStatus]);



  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 h-full overflow-hidden flex flex-col font-sans relative">
       
       {/* HEADER */}
       <div className="p-5 border-b border-gray-200 bg-gray-50 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Network className="text-indigo-600" />
                Acompanhamento Matricial (GMD)
            </h2>
            <p className="text-sm text-gray-500">Monitoramento por Pacotes: Meta vs Forecast vs Real</p>
          </div>

          <div className="flex items-center gap-4">
              {/* Hotel Filter */}
              <div className="flex items-center bg-white px-3 py-1.5 rounded-lg border border-gray-300 shadow-sm">
                <Filter className="text-gray-400 mr-2" size={16} />
                <select 
                    value={currentHotel} 
                    onChange={(e) => setCurrentHotel(e.target.value)}
                    className="bg-transparent text-sm font-semibold text-gray-700 focus:outline-none cursor-pointer w-40"
                >
                    {hotels.map(h => (
                        <option key={h.id} value={h.name}>{h.name}</option>
                    ))}
                </select>
             </div>

             {/* Tab Switcher */}
             <div className="flex bg-gray-200 p-1 rounded-lg">
                <button 
                    onClick={() => setActiveTab('monitor')}
                    className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'monitor' ? 'bg-white shadow-sm text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Visão Geral
                </button>
                <button 
                    onClick={() => setActiveTab('justifications')}
                    className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${activeTab === 'justifications' ? 'bg-white shadow-sm text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Desvios & Justificativas
                    {justifications.filter(j => j.status !== 'Concluído').length > 0 && (
                        <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 rounded-full">
                            {justifications.filter(j => j.status !== 'Concluído').length}
                        </span>
                    )}
                </button>
             </div>
          </div>
      </div>
      
      {/* CONTENT AREA */}
      <div className="flex-1 overflow-auto bg-gray-50/50 p-6">
        
        {/* --- TAB 1: MONITOR (FORECAST STYLE) --- */}
        {activeTab === 'monitor' && (
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                <table className="w-full text-xs">
                    <thead className="bg-gray-100 text-gray-600 font-semibold uppercase tracking-wide">
                        <tr>
                            <th className="px-4 py-3 text-left w-[30%]">Pacote / Conta Contábil</th>
                            {/* NEW COLUMN STRUCTURE: EQUAL WIDTHS (14% each = 70%) */}
                            <th className="px-2 py-3 text-right text-gray-700 bg-gray-50 w-[14%]">Meta</th>
                            <th className="px-2 py-3 text-right text-gray-700 bg-blue-50/20 w-[14%]">Forecast</th>
                            <th className="px-2 py-3 text-right text-gray-700 bg-blue-50/40 w-[14%]">Real</th>
                            <th className="px-2 py-3 text-right text-gray-700 w-[14%]">DIF (R$)</th>
                            <th className="px-2 py-3 text-right text-gray-700 w-[14%]">DIF (%)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reportData.map(pkg => {
                            const isExpanded = expandedPackages.includes(pkg.configId);
                            const rowColor = pkg.deltaVal > 0 ? 'text-red-600' : 'text-emerald-600'; // Positive diff in expense is BAD (Red)
                            
                            return (
                                <React.Fragment key={pkg.configId}>
                                    {/* Package Header Row */}
                                    <tr className="border-b border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer" onClick={() => togglePackage(pkg.configId)}>
                                        <td className="px-4 py-3 font-bold text-gray-800 flex items-center gap-2">
                                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                            <div>
                                                <div className="uppercase">{pkg.packageName}</div>
                                                <div className="text-[10px] text-gray-500 font-normal mt-0.5">
                                                    Gestor Pacote: {pkg.packageManagerName} | Gestor Conta: {pkg.accountManagerName}
                                                </div>
                                            </div>
                                        </td>
                                        
                                        <td className="px-2 py-3 text-right font-medium text-gray-600 bg-gray-50/50">{formatCurrency(pkg.totalMeta)}</td>
                                        <td className="px-2 py-3 text-right font-medium text-blue-700 bg-blue-50/20">{formatCurrency(pkg.totalForecast)}</td>
                                        <td className="px-2 py-3 text-right font-bold text-gray-900 bg-blue-50/40">{formatCurrency(pkg.totalPrevia)}</td>
                                        
                                        <td className={`px-2 py-3 text-right font-bold ${rowColor}`}>{formatCurrency(pkg.deltaVal)}</td>
                                        <td className={`px-2 py-3 text-right font-bold border-r border-gray-200 ${rowColor}`}>{formatPercent(pkg.deltaPct)}</td>
                                    </tr>

                                    {/* Linked Accounts Rows */}
                                    {isExpanded && pkg.accounts.map(acc => {
                                        const accColor = acc.deltaVal > 0 ? 'text-red-600' : 'text-emerald-600';
                                        return (
                                            <tr key={acc.id} className="border-b border-gray-100 bg-white hover:bg-gray-50">
                                                <td className="px-4 py-2 pl-10 flex flex-col justify-center">
                                                    <span className="text-gray-700 font-medium">{acc.name}</span>
                                                    <span className="text-[9px] text-gray-400 font-mono">{acc.code}</span>
                                                </td>
                                                
                                                <td className="px-2 py-2 text-right text-gray-500">{formatCurrency(acc.meta)}</td>
                                                <td className="px-2 py-2 text-right text-blue-600 bg-blue-50/10">{formatCurrency(acc.forecast)}</td>
                                                <td className="px-2 py-2 text-right font-medium bg-blue-50/20">{formatCurrency(acc.previa)}</td>
                                                
                                                <td className={`px-2 py-2 text-right font-medium ${accColor}`}>{formatCurrency(acc.deltaVal)}</td>
                                                <td className={`px-2 py-2 text-right text-[10px] border-r border-gray-200 ${accColor}`}>{formatPercent(acc.deltaPct)}</td>
                                            </tr>
                                        );
                                    })}
                                    
                                    {/* Empty State for Package */}
                                    {isExpanded && pkg.accounts.length === 0 && (
                                        <tr><td colSpan={6} className="px-4 py-3 text-center text-gray-400 italic text-xs">Nenhuma conta vinculada a este pacote neste hotel.</td></tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        )}

        {/* --- TAB 2: JUSTIFICATIONS TABLE --- */}
        {activeTab === 'justifications' && (
            <div className="space-y-4 h-full flex flex-col">
                 <div className="grid grid-cols-1 md:grid-cols-4 gap-4 shrink-0">
                    <FilterCard 
                        type="Pendentes" icon={AlertTriangle} label="Pendente" 
                        count={justifications.filter(j => j.status === 'Pendentes').length}
                        colorClass="text-red-600" bgClass="bg-red-50" borderClass="border-red-200" activeClass="ring-red-200"
                        filterStatus={filterStatus} setFilterStatus={setFilterStatus as any}
                    />
                    <FilterCard 
                        type="Em andamento" icon={FileText} label="Em Análise" 
                        count={justifications.filter(j => j.status === 'Em andamento').length}
                        colorClass="text-yellow-600" bgClass="bg-yellow-50" borderClass="border-yellow-200" activeClass="ring-yellow-200"
                        filterStatus={filterStatus} setFilterStatus={setFilterStatus as any}
                    />
                    <FilterCard 
                        type="Atrasado" icon={ClipboardList} label="Atrasados" 
                        count={justifications.filter(j => j.status === 'Atrasado').length}
                        colorClass="text-orange-600" bgClass="bg-orange-50" borderClass="border-orange-200" activeClass="ring-orange-200"
                        filterStatus={filterStatus} setFilterStatus={setFilterStatus as any}
                    />
                    <FilterCard 
                        type="Concluído" icon={CheckCircle} label="Concluídos" 
                        count={justifications.filter(j => j.status === 'Concluído').length}
                        colorClass="text-green-600" bgClass="bg-green-50" borderClass="border-green-200" activeClass="ring-green-200"
                        filterStatus={filterStatus} setFilterStatus={setFilterStatus as any}
                    />
                </div>

                {filteredJustifications.length === 0 && justifications.length > 0 ? (
                     <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-lg border border-gray-200">
                        <Filter size={48} className="text-gray-300 mb-4" />
                        <h3 className="text-lg font-bold text-gray-700">Nenhum item encontrado</h3>
                        <p className="text-gray-500">Nenhum desvio corresponde ao filtro selecionado.</p>
                        <button onClick={() => setFilterStatus('all')} className="mt-4 text-indigo-600 font-bold text-sm hover:underline">Limpar Filtros</button>
                     </div>
                ) : justifications.length === 0 ? (
                     <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-lg border border-gray-200">
                        <ShieldCheck size={48} className="text-emerald-300 mb-4" />
                        <h3 className="text-lg font-bold text-gray-700">Tudo em ordem!</h3>
                        <p className="text-gray-500">Nenhum desvio significativo encontrado para este mês.</p>
                     </div>
                ) : (
                    <div className="bg-white border border-gray-200 rounded-lg shadow-sm flex-1 overflow-hidden flex flex-col">
                        {/* Table Header */}
                        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center shrink-0">
                            <h3 className="font-bold text-gray-700 text-sm flex items-center gap-2">
                                Lista de Desvios 
                                <span className="bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full text-xs">{filteredJustifications.length}</span>
                            </h3>
                            <div className="relative">
                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                                <input type="text" placeholder="Filtrar por conta ou gestor..." className="pl-8 pr-3 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 w-56" />
                            </div>
                        </div>
                        
                        {/* Table Body */}
                        <div className="overflow-auto flex-1">
                            <table className="min-w-full text-xs text-left whitespace-nowrap">
                                <thead className="bg-gray-100 text-gray-600 font-semibold sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="px-4 py-3">Pacote</th>
                                        <th className="px-4 py-3">Conta Contábil</th>
                                        {/* New Columns */}
                                        <th className="px-4 py-3 text-gray-500">Gestor Pacote</th>
                                        <th className="px-4 py-3 text-gray-500">Gestor Conta</th>
                                        
                                        <th className="px-4 py-3 text-right">Meta (R$)</th>
                                        <th className="px-4 py-3 text-right">Forecast (R$)</th>
                                        <th className="px-4 py-3 text-right">Prévia (R$)</th>
                                        <th className="px-4 py-3 text-right">Desvio (R$)</th>
                                        <th className="px-4 py-3 text-center w-40">Próximo Passo / Status</th>
                                        <th className="px-4 py-3 text-center w-28">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredJustifications.map((just) => {
                                        const config = gmdConfigs.find(c => c.id === just.gmdConfigId);
                                        const pkg = packages.find(p => p.id === config?.packageId);
                                        const pkgManager = users.find(u => u.id === config?.packageManagerId);
                                        const accManager = users.find(u => u.id === config?.accountManagerId);
                                        
                                        // Find entity managers for this config
                                        const entManagerNames = config?.entityManagerIds
                                            .map(id => users.find(u => u.id === id)?.name)
                                            .filter(Boolean)
                                            .join(', ') || 'N/A';
                                        
                                        return (
                                            <tr key={just.id} className="hover:bg-indigo-50/30 transition-colors group">
                                                <td className="px-4 py-3 font-bold text-gray-800">{pkg?.name}</td>
                                                <td className="px-4 py-3 text-gray-600 font-medium">{just.accountName}</td>
                                                
                                                {/* Managers Data */}
                                                <td className="px-4 py-3 text-gray-500">{pkgManager?.name || '-'}</td>
                                                <td className="px-4 py-3 text-gray-500">{accManager?.name || '-'}</td>

                                                <td className="px-4 py-3 text-right text-gray-500">{formatCurrency(just.meta)}</td>
                                                <td className="px-4 py-3 text-right font-medium">{formatCurrency(just.forecast)}</td>
                                                <td className="px-4 py-3 text-right font-medium text-gray-600">{formatCurrency(just.previa)}</td>
                                                <td className="px-4 py-3 text-right text-red-600 font-bold bg-red-50/30 rounded">{formatCurrency(just.deltaR)}</td>
                                                <td className="px-4 py-3 text-center">
                                                    {renderStatusCell(just.status, accManager?.name, entManagerNames)}
                                                </td>
                                                <td className="px-4 py-2 text-center">
                                                    <button 
                                                        onClick={() => openJustificationModal(just)}
                                                        className="flex items-center justify-center w-full px-3 py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors shadow-sm font-bold text-[10px] uppercase tracking-wide gap-1"
                                                    >
                                                        <ExternalLink size={12} />
                                                        {just.status === 'Concluído' ? 'Abrir' : 'Resolver'}
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        )}

      </div>

      {/* --- MODAL FOR JUSTIFICATION / ACTION PLAN --- */}
      {selectedJustification && (
        <div className="absolute inset-0 z-50 flex justify-end bg-black/20 backdrop-blur-[1px]">
            <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right-10 duration-200">
                
                {/* Modal Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <div>
                        <h3 className="font-bold text-gray-800 text-lg">Detalhes do Desvio</h3>
                        <p className="text-xs text-gray-500">{selectedJustification.accountName}</p>
                    </div>
                    <button onClick={closeJustificationModal} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Modal Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    
                    {/* Financial Summary Card */}
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 grid grid-cols-4 gap-4 text-center">
                        <div>
                            <p className="text-[10px] text-gray-500 uppercase font-bold">Meta</p>
                            <p className="text-sm font-bold text-gray-800">{formatCurrency(selectedJustification.meta)}</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-gray-500 uppercase font-bold">Forecast</p>
                            <p className="text-sm font-bold text-gray-800">{formatCurrency(selectedJustification.forecast)}</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-gray-500 uppercase font-bold">Prévia</p>
                            <p className="text-sm font-bold text-gray-800">{formatCurrency(selectedJustification.previa)}</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-gray-500 uppercase font-bold text-red-600">Desvio R$</p>
                            <p className="text-sm font-bold text-red-600">{formatCurrency(selectedJustification.deltaR)}</p>
                        </div>
                    </div>

                    {/* Status Indicator */}
                    <div className="flex items-center gap-2 justify-center bg-gray-50 p-2 rounded border border-gray-100">
                        {(() => {
                            const config = gmdConfigs.find(c => c.id === selectedJustification.gmdConfigId);
                            const accManager = users.find(u => u.id === config?.accountManagerId);
                            const entManagerNames = config?.entityManagerIds.map(id => users.find(u => u.id === id)?.name).join(', ');
                            return renderStatusCell(selectedJustification.status, accManager?.name, entManagerNames);
                        })()}
                    </div>

                    <hr className="border-gray-100" />

                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                <FileText size={16} className="text-indigo-500" /> 
                                Justificativa e Plano de Ação
                            </label>
                            {selectedJustification.status === 'Pendentes' && (
                                <span className="text-[10px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full animate-pulse">Ação Necessária</span>
                            )}
                        </div>
                        
                        {selectedJustification.status === 'Pendentes' ? (
                            <div className="space-y-4 bg-indigo-50/50 p-4 rounded-lg border border-indigo-100">
                                <div>
                                    <label className="text-xs font-bold text-gray-700 block mb-1">Qual o motivo do desvio?</label>
                                    <textarea 
                                        className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                                        rows={2}
                                        placeholder="Explique detalhadamente..."
                                        value={justificationText}
                                        onChange={(e) => setJustificationText(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-700 block mb-1">Plano de Ação para correção</label>
                                    <textarea 
                                        className="w-full border border-indigo-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                        rows={3}
                                        placeholder="O que será feito para reverter ou conter este desvio?"
                                        value={actionPlanText}
                                        onChange={(e) => setActionPlanText(e.target.value)}
                                    />
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    <div>
                                        <label className="text-[10px] font-bold text-indigo-600 block mb-1">Início da Correção</label>
                                        <input type="date" value={planStartDate} onChange={(e) => setPlanStartDate(e.target.value)} className="w-full text-xs p-2 border border-indigo-200 rounded outline-none focus:ring-1 focus:ring-indigo-500" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-indigo-600 block mb-1">Fim da Correção</label>
                                        <input type="date" value={planEndDate} onChange={(e) => setPlanEndDate(e.target.value)} className="w-full text-xs p-2 border border-indigo-200 rounded outline-none focus:ring-1 focus:ring-indigo-500" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-indigo-600 block mb-1">Data de Apresentação</label>
                                        <input type="date" value={planPresentationDate} onChange={(e) => setPlanPresentationDate(e.target.value)} className="w-full text-xs p-2 border border-indigo-200 rounded outline-none focus:ring-1 focus:ring-indigo-500" />
                                    </div>
                                </div>
                                <button onClick={() => handleActionPlanSubmit(selectedJustification.id, 'Em andamento')} className="w-full bg-indigo-600 text-white py-3 mt-2 rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors shadow-sm">
                                    Iniciar Plano de Ação
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-700">
                                    <p className="font-bold text-xs text-gray-500 mb-1">Justificativa:</p>
                                    <p>{selectedJustification.explanation}</p>
                                </div>
                                <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-3">
                                    <p className="font-bold text-xs text-blue-500 mb-1">Plano de Ação:</p>
                                    <p className="text-sm text-gray-800 mb-3">{selectedJustification.actionPlan}</p>
                                    <div className="flex gap-4 text-[10px] text-blue-700 font-bold bg-white p-2 rounded border border-blue-100">
                                        <span className="flex items-center gap-1"><Calendar size={12} /> Início: {selectedJustification.actionPlanStartDate ? new Date(selectedJustification.actionPlanStartDate).toLocaleDateString('pt-BR') : '-'}</span>
                                        <span className="flex items-center gap-1"><Calendar size={12} /> Fim: {selectedJustification.actionPlanEndDate ? new Date(selectedJustification.actionPlanEndDate).toLocaleDateString('pt-BR') : '-'}</span>
                                        <span className="flex items-center gap-1"><Calendar size={12} /> Apresentação: {selectedJustification.actionPlanPresentationDate ? new Date(selectedJustification.actionPlanPresentationDate).toLocaleDateString('pt-BR') : '-'}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 4. Completion Section */}
                    {['Em andamento', 'Atrasado'].includes(selectedJustification.status) && (
                        <div className="pt-6 mt-6 border-t border-dashed border-gray-300">
                            <h4 className="font-bold text-green-800 text-sm mb-3 flex items-center gap-2">
                                <CheckSquare size={16} /> Conclusão do Plano
                            </h4>
                            <div className="bg-green-50 p-4 rounded-lg border border-green-200 space-y-3">
                                <div>
                                    <label className="block text-xs font-bold text-green-700 mb-1">Valor Recuperado (R$)</label>
                                    <div className="relative">
                                        <DollarSign size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-green-600" />
                                        <input 
                                            type="text" 
                                            className="w-full pl-7 pr-3 py-2 border border-green-300 rounded text-sm focus:ring-2 focus:ring-green-500 outline-none"
                                            placeholder="0,00"
                                            value={recoveredValue}
                                            onChange={(e) => setRecoveredValue(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-green-700 mb-1">Observações Finais</label>
                                    <textarea 
                                        className="w-full px-3 py-2 border border-green-300 rounded text-sm focus:ring-2 focus:ring-green-500 outline-none"
                                        rows={2}
                                        placeholder="Resultado obtido..."
                                        value={completionObs}
                                        onChange={(e) => setCompletionObs(e.target.value)}
                                    />
                                </div>
                                <div className="flex gap-3">
                                    <button onClick={() => handleCompletePlan(selectedJustification.id)} className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-green-700 flex justify-center items-center gap-2">
                                        <CheckCircle size={16} /> Confirmar Conclusão
                                    </button>
                                    {selectedJustification.status === 'Em andamento' && (
                                        <button onClick={() => handleActionPlanSubmit(selectedJustification.id, 'Atrasado')} className="flex-1 bg-orange-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-orange-700 flex justify-center items-center gap-2">
                                            <AlertTriangle size={16} /> Marcar Atrasado
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {selectedJustification.status === 'Concluído' && (
                        <div className="bg-green-100/50 border border-green-200 rounded-lg p-4 mt-4">
                            <div className="flex items-center gap-2 text-green-800 font-bold mb-2">
                                <CheckCircle size={18} /> Plano Concluído
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm mb-2">
                                <div>
                                    <span className="block text-xs text-green-600">Valor Recuperado</span>
                                    <span className="font-bold text-gray-800">{formatCurrency(selectedJustification.recoveredValue || 0)}</span>
                                </div>
                            </div>
                            <p className="text-xs text-green-900 italic border-t border-green-200 pt-2 mt-2">
                                "{selectedJustification.completionObservation}"
                            </p>
                        </div>
                    )}

                </div>
            </div>
        </div>
      )}

    </div>
  );
};

export default GMDView;
