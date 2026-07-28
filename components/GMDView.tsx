import React, { useMemo, useState } from 'react';
import { Network, Filter, AlertTriangle, CheckCircle, FileText, ClipboardList, ShieldCheck, ShieldAlert, Calendar, DollarSign, CheckSquare, Search, X, FileEdit, ExternalLink } from 'lucide-react';
import { GMDConfiguration, Account, CostPackage, Hotel, ImportedRow, User, Justification, CostCenter, UserRole, hasRole, ProjectionType } from '../types';
import { VersionInfoBanner } from './VersionInfoBanner';
import { supabaseService } from '../services/supabaseService';

// Segmentação informativa de Despesas Administrativas e Despesas com Vendas e Marketing —
// alimentada pela importação do Orçamento ou editada direto aqui; nunca altera financial_data.
const ADMIN_SEGMENT_KEYS: { key: string; label: string }[] = [
    { key: 'admin_ti', label: 'Tech HUB (TI)' },
    { key: 'admin_marketing', label: 'Tech HUB (Marketing)' },
    { key: 'admin_martech', label: 'Tech HUB (Martech)' },
];
const VENDAS_SEGMENT_KEYS: { key: string; label: string }[] = [
    { key: 'vendas_marketing', label: 'Marketing' },
    { key: 'vendas_martech', label: 'Martech' },
];
const SEGMENTED_MASTERS: Record<string, { key: string; label: string }[]> = {
    'DESPESAS ADMINISTRATIVAS': ADMIN_SEGMENT_KEYS,
    'DESPESAS COM VENDAS E MARKETING': VENDAS_SEGMENT_KEYS,
};

const PROJECTION_TYPE_OPTIONS: { value: ProjectionType; label: string }[] = [
    { value: 'Reunião de Ritmo', label: 'Reunião de Ritmo' },
    { value: 'FCA N2', label: 'FCA N2' },
    { value: 'FCA N1', label: 'FCA N1' },
    { value: 'Fechamento oficial', label: 'Fechamento' },
    { value: 'Realizado', label: 'Realizado' },
];

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
    activeRealVersionName?: string;
    activeRealVersionId?: string;
    activeBudgetVersionId?: string;
    activeProjectionType?: ProjectionType;
    setActiveProjectionType?: React.Dispatch<React.SetStateAction<ProjectionType>>;
    currentUser?: User;
}

// Helper to format currency
const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);
const formatPercent = (val: number) => `${val.toFixed(1)}%`;

const GMDView: React.FC<GMDViewProps> = ({
    gmdConfigs, accounts, packages, hotels, financialData, users, costCenters,
    selectedMonth, selectedYear, initialSelectedHotel, activeRealVersionName,
    activeRealVersionId, activeBudgetVersionId, activeProjectionType, setActiveProjectionType, currentUser
}) => {
  const [activeTab, setActiveTab] = useState<'monitor' | 'justifications'>('monitor');
  const [currentHotel, setCurrentHotel] = useState(initialSelectedHotel);
  const [localMonth, setLocalMonth] = useState(selectedMonth);

  React.useEffect(() => { setLocalMonth(selectedMonth); }, [selectedMonth]);

  // Segmentação de despesas (Tech HUB / Marketing / Martech) — vem do Orçamento importado ou de
  // edição manual direto aqui; guardada em gmd_expense_segments, amarrada à versão de Orçamento.
  const [gmdSegments, setGmdSegments] = useState<any[]>([]);
  const [pendingSegmentEdits, setPendingSegmentEdits] = useState<Record<string, number>>({});
  const pendingSegmentEditsRef = React.useRef<Record<string, number>>({});
  React.useEffect(() => { pendingSegmentEditsRef.current = pendingSegmentEdits; }, [pendingSegmentEdits]);

  React.useEffect(() => {
    supabaseService.getGmdExpenseSegments().then(setGmdSegments).catch(() => {});
  }, []);

  React.useEffect(() => {
    const keys = Object.keys(pendingSegmentEdits);
    if (keys.length === 0) return;
    const timeout = setTimeout(async () => {
        const hotelObj = hotels.find(h => h.name === currentHotel);
        const rows = keys.map(k => ({
            hotel: hotelObj?.name || currentHotel, year: selectedYear, month: localMonth,
            versionId: activeBudgetVersionId || null, segmentKey: k, value: pendingSegmentEditsRef.current[k],
        }));
        try {
            await supabaseService.upsertGmdExpenseSegments(rows);
            setGmdSegments(prev => {
                const map = new Map(prev.map((s: any) => [`${s.hotel}|${s.year}|${s.month}|${s.version_id}|${s.segment_key}`, s]));
                rows.forEach(r => {
                    const vid = r.versionId || '';
                    map.set(`${r.hotel}|${r.year}|${r.month}|${vid}|${r.segmentKey}`, {
                        hotel: r.hotel, year: r.year, month: r.month, version_id: vid,
                        segment_key: r.segmentKey, value: r.value,
                    });
                });
                return Array.from(map.values());
            });
            setPendingSegmentEdits(prev => {
                const next = { ...prev };
                keys.forEach(k => { if (next[k] === pendingSegmentEditsRef.current[k]) delete next[k]; });
                return next;
            });
        } catch (e) {
            console.error('Erro ao salvar segmentação GMD', e);
        }
    }, 800);
    return () => clearTimeout(timeout);
  }, [pendingSegmentEdits, currentHotel, selectedYear, localMonth, activeBudgetVersionId, hotels]);

  const getSegmentValue = (segmentKey: string): number => {
    if (segmentKey in pendingSegmentEdits) return pendingSegmentEdits[segmentKey];
    const hotelObj = hotels.find(h => h.name === currentHotel);
    const vid = activeBudgetVersionId || '';
    const found = gmdSegments.find((s: any) =>
        (s.hotel === currentHotel || s.hotel === hotelObj?.name) &&
        s.year === selectedYear && s.month === localMonth &&
        (s.version_id || '') === vid && s.segment_key === segmentKey
    );
    return found ? (parseFloat(found.value) || 0) : 0;
  };

  const handleSegmentEdit = (segmentKey: string, value: number) => {
    setPendingSegmentEdits(prev => ({ ...prev, [segmentKey]: value }));
  };

  // Justifications State — persistidas em gmd_justifications (services/supabaseService.ts),
  // amarradas a hotel/ano/mês/versão, pra não se perder conforme a mesma versão avança de estágio.
  const [justifications, setJustifications] = useState<Justification[]>([]);

  React.useEffect(() => {
    supabaseService.getGmdJustifications().then(rows => {
        setJustifications(rows.filter((r: any) => r.hotel === currentHotel).map((r: any): Justification => ({
            id: r.id,
            gmdConfigId: r.gmd_config_id,
            accountId: r.account_id,
            accountName: r.account_name,
            month: r.month,
            year: r.year,
            meta: parseFloat(r.meta) || 0,
            forecast: parseFloat(r.forecast) || 0,
            previa: parseFloat(r.previa) || 0,
            deltaR: parseFloat(r.delta_r) || 0,
            deltaPct: parseFloat(r.delta_pct) || 0,
            explanation: r.explanation || '',
            status: r.status || 'Pendentes',
            rejectionReason: r.rejection_reason,
            actionPlan: r.action_plan,
            actionPlanStartDate: r.action_plan_start_date,
            actionPlanEndDate: r.action_plan_end_date,
            actionPlanPresentationDate: r.action_plan_presentation_date,
            recoveredValue: r.recovered_value != null ? parseFloat(r.recovered_value) : undefined,
            completionObservation: r.completion_observation,
            assignedAreaManagerId: r.assigned_area_manager_id,
        })));
    }).catch(() => {});
  }, []);

  const persistJustification = (j: Justification) => {
    supabaseService.upsertGmdJustification({
        id: j.id,
        hotel: currentHotel,
        year: j.year,
        month: j.month,
        versionId: activeRealVersionId || null,
        gmdConfigId: j.gmdConfigId,
        accountId: j.accountId,
        accountName: j.accountName,
        meta: j.meta,
        forecast: j.forecast,
        previa: j.previa,
        deltaR: j.deltaR,
        deltaPct: j.deltaPct,
        explanation: j.explanation,
        status: j.status,
        rejectionReason: j.rejectionReason,
        actionPlan: j.actionPlan,
        actionPlanStartDate: j.actionPlanStartDate,
        actionPlanEndDate: j.actionPlanEndDate,
        actionPlanPresentationDate: j.actionPlanPresentationDate,
        recoveredValue: j.recoveredValue,
        completionObservation: j.completionObservation,
        assignedAreaManagerId: j.assignedAreaManagerId,
    }).catch(e => console.error('Erro ao salvar plano de ação GMD', e));
  };

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
  const [assignedAreaManagerId, setAssignedAreaManagerId] = useState('');

  const canUserResolveJustification = (just: Justification) => {
      if (!currentUser) return false;
      if (hasRole(currentUser, UserRole.ADMIN)) return true;

      const config = gmdConfigs.find(c => c.id === just.gmdConfigId);
      if (!config) return false;

      // Um usuário pode acumular vários perfis (ex.: Gerente de Entidade + Gerente de Pacotes)
      // — cada bloco abaixo concede acesso independentemente; a permissão final é a UNIÃO de
      // tudo que algum dos perfis do usuário concede, não só o primeiro que bater.

      // Gerente de Entidade e Analista de Custos: can resolve/approve if in one of their hotels
      if (hasRole(currentUser, UserRole.ENTITY_MANAGER) || hasRole(currentUser, UserRole.COST_ANALYST)) {
          const userHotelIds = currentUser.hotelIds && currentUser.hotelIds.length > 0
              ? currentUser.hotelIds
              : (currentUser.hotelId ? [currentUser.hotelId] : []);
          const userHotelObjs = userHotelIds
              .map(id => hotels.find(h => h.id === id || h.code === id))
              .filter((h): h is Hotel => !!h);
          const configHotelObj = hotels.find(h => h.id === config.hotelId);
          if (userHotelObjs.length === 0 || !configHotelObj || userHotelObjs.some(h => h.name === configHotelObj.name)) {
              return true;
          }
      }

      // Gerente de Pacotes: can resolve if any Pacote under this Pacote Master is under their
      // responsibility — responsiblePackages guarda nomes de Pacote (granularidade da DRE
      // Forecast), enquanto o config do GMD é atribuído por Pacote Master.
      if (hasRole(currentUser, UserRole.PACKAGE_MANAGER)) {
          const pkg = masterPackages.find(p => p.id === config.packageId || p.name === config.packageId);
          const subPackageNames = pkg ? Array.from(new Set(accounts.filter(a => a.masterPackage === pkg.name).map(a => a.package).filter(Boolean))) : [];
          const isResponsibleForPkg = subPackageNames.some(name => currentUser.responsiblePackages?.includes(name as string));
          const isResponsibleForRev = currentUser.responsibleRevenues?.some(rev =>
              pkg?.name.toLowerCase().includes(rev.toLowerCase())
          );
          if (isResponsibleForPkg || isResponsibleForRev) return true;
      }

      // Gerente de Área / Analista de área: can resolve if CR matches responsibleCostCenters OR directed to them
      if (hasRole(currentUser, UserRole.AREA_MANAGER) || hasRole(currentUser, UserRole.AREA_ANALYST)) {
          if (just.assignedAreaManagerId === currentUser.id) return true;

          const hasResponsibleCR = config.costCenterIds?.some(ccId =>
              currentUser.responsibleCostCenters?.includes(ccId)
          );
          if (hasResponsibleCR) return true;
      }

      return false;
  };

  // Derive Master Packages from Accounts for GMD
  const masterPackages = useMemo(() => {
    const masters = new Map<string, string>(); // name -> code
    accounts.forEach(acc => {
      if (acc.masterPackage) {
        if (!masters.has(acc.masterPackage) || !masters.get(acc.masterPackage)) {
          masters.set(acc.masterPackage, acc.masterPackageCode || acc.masterPackage);
        }
      }
    });
    return Array.from(masters.entries()).map(([name, code]) => ({
      id: code,
      name: name
    }));
  }, [accounts]);

  // --- CALCULATION LOGIC ---
  const reportData = useMemo(() => {
    // 1. Filter GMD Configs for the selected hotel
    const hotelConfigs = gmdConfigs.filter(cfg => {
        const h = hotels.find(ht => ht.id === cfg.hotelId);
        return h?.name === currentHotel;
    });

    const activeHotelObj = hotels.find(h => h.name === currentHotel);
    const activeHotelCode = activeHotelObj?.code || '';

    const flattened: any[] = [];

    masterPackages.forEach(pkg => {
        const pkgName = pkg.name || 'Pacote Desconhecido';
        const pkgId = pkg.id;

        // Try to find configurations for this package
        const configsForPkg = hotelConfigs.filter(c => c.packageId === pkgId || c.packageId === pkgName);

        // If no config, create a dummy one to ensure it renders
        if (configsForPkg.length === 0) {
            configsForPkg.push({
                id: `dummy-${pkgId}`,
                hotelId: activeHotelObj?.id || '',
                packageId: pkgId,
                packageManagerId: '',
                accountManagerId: '',
                entityManagerIds: [],
                supportUserIds: [],
                linkedAccountIds: accounts.filter(a => a.masterPackage === pkgName || a.masterPackageCode === pkgId).map(a => a.id),
                costCenterIds: []
            });
        }

        // Junta as contas de todos os configs desse master numa lista só (a maioria dos masters
        // tem um único config; havendo mais de um, os totais do master continuam corretos).
        let allAccountsData: any[] = [];
        configsForPkg.forEach(config => {
            const configCCNames = costCenters
                .filter(cc => config.costCenterIds?.includes(cc.id))
                .map(cc => cc.name.trim().toLowerCase());

            const linkedAccountsData = config.linkedAccountIds.map(accId => {
                const acc = accounts.find(a => a.id === accId);
                if (!acc) return null;

                const filterValue = (cenarioType: 'Real' | 'Budget' | 'Forecast' | 'Prévia', year: number) => {
                    const matches = financialData.filter(d =>
                        parseInt(d.ano) === year &&
                        parseInt(d.mes) === localMonth &&
                        d.conta.trim().toLowerCase() === acc.name.trim().toLowerCase() &&
                        d.status === 'valid' &&
                        (d.hotel.trim().toUpperCase() === activeHotelCode || d.hotel.trim() === currentHotel) &&
                        (configCCNames.length === 0 || configCCNames.includes((d.cr || '').trim().toLowerCase()))
                    );

                    const filtered = matches.filter(d => {
                        const scenario = (d.cenario || '').trim().toLowerCase();
                        if (cenarioType === 'Real') return scenario === 'real' || scenario === 'realizado';
                        if (cenarioType === 'Forecast') return scenario === 'forecast' || scenario === 'previsao' || scenario === 'previsão';
                        return scenario === 'budget' || scenario === 'meta' || scenario === 'orcamento' || scenario === 'orçamento';
                    });

                    return filtered.reduce((sum, item) => sum + (parseFloat(item.valor.replace(',', '.')) || 0), 0);
                };

                const real = filterValue('Real', selectedYear);
                const budget = filterValue('Budget', selectedYear);
                const forecast = filterValue('Forecast', selectedYear) || real;
                let previa = filterValue('Prévia', selectedYear) || (forecast * 0.95); // Mock fallback for demo consistency

                // If all are zero and it's a dummy config, skip to avoid clutter
                if (real === 0 && budget === 0 && forecast === 0 && previa === 0 && config.id.startsWith('dummy-')) {
                   return null;
                }

                return {
                    id: acc.id,
                    name: acc.name,
                    code: acc.code,
                    package: acc.package || pkgName,
                    meta: budget,
                    forecast: forecast,
                    previa: previa,
                    deltaVal: forecast - previa,
                    deltaPct: previa === 0 ? 0 : ((forecast - previa) / previa) * 100,
                    configId: config.id
                };
            }).filter(Boolean) as any[];

            allAccountsData = allAccountsData.concat(linkedAccountsData);
        });

        if (allAccountsData.length === 0) return;

        const totalMeta = allAccountsData.reduce((s, a) => s + (a.meta || 0), 0);
        const totalForecast = allAccountsData.reduce((s, a) => s + (a.forecast || 0), 0);
        const totalPrevia = allAccountsData.reduce((s, a) => s + (a.previa || 0), 0);
        const masterDeltaVal = totalForecast - totalPrevia;
        const masterDeltaPct = totalPrevia === 0 ? 0 : (masterDeltaVal / totalPrevia) * 100;
        const anyConfigId = configsForPkg[0]?.id;

        // Master Header row — sempre aparece, com o total do master. Guarda `accounts` (conta a
        // conta) só pra alimentar a geração de Justification — a UI não lista conta contábil.
        flattened.push({
            id: `master-${pkgName}`,
            configId: anyConfigId,
            isMasterHeader: true,
            packageName: pkgName,
            totalMeta, totalForecast, totalPrevia,
            deltaVal: masterDeltaVal,
            deltaPct: masterDeltaPct,
            accounts: allAccountsData,
        });

        const segmentDefs = SEGMENTED_MASTERS[pkgName];
        if (segmentDefs) {
            // Masters com segmentação informativa (Despesas Administrativas / Vendas e Marketing):
            // filhos são as linhas de segmentação (Tech HUB TI/Marketing/Martech, ou Marketing/Martech),
            // mais "Outros" calculado — nunca a lista de pacotes ou de contas.
            let sumSegments = 0;
            segmentDefs.forEach(seg => {
                const val = getSegmentValue(seg.key);
                sumSegments += val;
                flattened.push({
                    id: `seg-${pkgName}-${seg.key}`,
                    isSegmentRow: true,
                    indentLevel: 1,
                    segmentKey: seg.key,
                    packageName: seg.label,
                    totalMeta: val,
                });
            });
            flattened.push({
                id: `seg-${pkgName}-outros`,
                isSegmentRow: true,
                indentLevel: 1,
                segmentKey: null,
                packageName: 'Outros',
                totalMeta: totalMeta - sumSegments,
            });
        } else {
            // Masters "normais": agrupa as contas por Pacote da DRE Forecast (sem listar conta a
            // conta) — genérico pra qualquer master.
            const byPackage = new Map<string, any[]>();
            allAccountsData.forEach(a => {
                const key = a.package || pkgName;
                if (!byPackage.has(key)) byPackage.set(key, []);
                byPackage.get(key)!.push(a);
            });
            byPackage.forEach((accs, pkgLabel) => {
                const pMeta = accs.reduce((s, a) => s + (a.meta || 0), 0);
                const pForecast = accs.reduce((s, a) => s + (a.forecast || 0), 0);
                const pPrevia = accs.reduce((s, a) => s + (a.previa || 0), 0);
                flattened.push({
                    id: `pkg-${pkgName}-${pkgLabel}`,
                    isSubPackage: true,
                    indentLevel: 1,
                    packageName: pkgLabel,
                    totalMeta: pMeta,
                    totalForecast: pForecast,
                    totalPrevia: pPrevia,
                    deltaVal: pForecast - pPrevia,
                    deltaPct: pPrevia === 0 ? 0 : ((pForecast - pPrevia) / pPrevia) * 100,
                });
            });
        }
    });

    return flattened;
  }, [gmdConfigs, currentHotel, masterPackages, accounts, users, financialData, localMonth, selectedYear, hotels, costCenters, gmdSegments, pendingSegmentEdits]);

  // Id determinístico por hotel+versão+ano+mês+conta — assim, ao progredir de estágio dentro da
  // MESMA versão (mesmo activeRealVersionId), a linha é a MESMA no banco: status/plano continuam.
  const slugify = (s: string) => (s || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const buildJustificationId = (accId: string) =>
      `${slugify(currentHotel)}__${slugify(activeRealVersionId || '')}__${selectedYear}__${localMonth}__${slugify(accId)}`;

  // --- EFFECT: POPULATE JUSTIFICATIONS ---
  React.useEffect(() => {
    setJustifications(prev => {
        const newDeviations: Justification[] = [];

        reportData.forEach(pkg => {
            pkg.accounts?.forEach((acc: any) => {
                // Threshold for creating justification (Example: > 100 R$ deviation)
                if (acc.deltaVal > 100) {
                    const id = buildJustificationId(acc.id);
                    const existing = prev.find(j => j.id === id);
                    if (!existing) {
                        const newJust: Justification = {
                            id,
                            gmdConfigId: pkg.configId,
                            accountId: acc.id,
                            accountName: acc.name,
                            month: localMonth,
                            year: selectedYear,
                            meta: acc.meta,
                            forecast: acc.forecast,
                            previa: acc.previa,
                            deltaR: acc.deltaVal, // forecast - previa
                            deltaPct: acc.deltaPct,
                            explanation: '',
                            status: 'Pendentes'
                        };
                        newDeviations.push(newJust);
                        persistJustification(newJust);
                    }
                }
            });
        });

        if (newDeviations.length === 0) return prev;
        return [...prev, ...newDeviations];
    });
  }, [reportData, localMonth, selectedYear, currentHotel, activeRealVersionId]);


  // --- HANDLERS ---
  const openJustificationModal = (just: Justification) => {
      setSelectedJustification(just);
      setJustificationText(just.explanation || '');
      setActionPlanText(just.actionPlan || '');
      setPlanStartDate(just.actionPlanStartDate || '');
      setPlanEndDate(just.actionPlanEndDate || '');
      setPlanPresentationDate(just.actionPlanPresentationDate || '');
      setRecoveredValue(just.recoveredValue ? just.recoveredValue.toString() : '');
      setCompletionObs(just.completionObservation || '');
      setAssignedAreaManagerId(just.assignedAreaManagerId || '');
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
      setAssignedAreaManagerId('');
  };

  const updateAndPersist = (id: string, updater: (j: Justification) => Justification) => {
      setJustifications(prev => prev.map(j => {
          if (j.id !== id) return j;
          const updated = updater(j);
          persistJustification(updated);
          return updated;
      }));
  };

  const handleJustificationSubmit = (id: string) => {
      updateAndPersist(id, j => ({ ...j, explanation: justificationText, status: 'Em andamento' }));
      closeJustificationModal();
  };

  const handleActionPlanSubmit = (id: string, newStatus: Justification['status']) => {
       if (!planStartDate || !planEndDate || !planPresentationDate) {
           alert("Por favor, preencha as datas de início, fim e apresentação.");
           return;
       }
       updateAndPersist(id, j => ({
              ...j,
              actionPlan: actionPlanText,
              actionPlanStartDate: planStartDate,
              actionPlanEndDate: planEndDate,
              actionPlanPresentationDate: planPresentationDate,
              assignedAreaManagerId: assignedAreaManagerId,
              status: newStatus
       }));
      closeJustificationModal();
  };

  const handleCompletePlan = (id: string) => {
      updateAndPersist(id, j => ({
            ...j,
            status: 'Concluído',
            recoveredValue: parseFloat(recoveredValue.replace(',', '.') || '0'),
            completionObservation: completionObs
      }));
      closeJustificationModal();
  };

  const handleUpdateExecution = (id: string) => {
      updateAndPersist(id, j => ({
            ...j,
            recoveredValue: parseFloat(recoveredValue.replace(',', '.') || '0'),
            completionObservation: completionObs
      }));
      alert("Progresso salvo com sucesso!");
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
       
       <VersionInfoBanner versionName={activeRealVersionName} />

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
              {/* Version Filter */}
              {setActiveProjectionType && (
                  <div className="flex items-center bg-gray-100 p-1 rounded-lg">
                      {PROJECTION_TYPE_OPTIONS.map(opt => (
                          <button
                              key={opt.value}
                              onClick={() => setActiveProjectionType(opt.value)}
                              className={`px-3 py-1 text-xs font-bold rounded-md transition-all whitespace-nowrap ${activeProjectionType === opt.value
                                  ? 'bg-white text-indigo-600 shadow-sm border border-gray-200'
                                  : 'text-gray-500 hover:text-gray-700'
                              }`}
                          >
                              {opt.label}
                          </button>
                      ))}
                  </div>
              )}

              {/* Month Filter */}
              <div className="flex items-center bg-white px-3 py-1.5 rounded-lg border border-gray-300 shadow-sm">
                <Calendar className="text-gray-400 mr-2" size={16} />
                <select 
                    value={localMonth} 
                    onChange={(e) => setLocalMonth(parseInt(e.target.value))}
                    className="bg-transparent text-sm font-semibold text-gray-700 focus:outline-none cursor-pointer"
                >
                    {Array.from({length: 12}, (_, i) => i + 1).map(m => (
                        <option key={m} value={m}>Mês {m}</option>
                    ))}
                </select>
             </div>

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
                        {reportData.map((pkg, idx) => {
                            const rowColor = pkg.deltaVal > 0 ? 'text-red-600' : 'text-emerald-600';

                            // Styling based on row type
                            const isMaster = pkg.isMasterHeader;
                            const isSub = pkg.isSubPackage;
                            const isSeg = pkg.isSegmentRow;

                            const bgClass = isMaster ? 'bg-indigo-50/50' :
                                           (isSub || isSeg) ? 'bg-gray-50 hover:bg-gray-100 border-l-4 border-l-indigo-300' :
                                           'bg-gray-50 hover:bg-gray-100';

                            const textClass = isMaster ? 'font-black text-indigo-900' : 'font-bold text-gray-800';
                            const indentClass = (isSub || isSeg) ? 'pl-8' : 'pl-4';

                            return (
                                <tr key={pkg.id || `row-${idx}`} className={`border-b border-gray-200 transition-colors ${bgClass}`}>
                                    <td className={`px-4 py-3 ${indentClass} ${textClass}`}>
                                        <div className={isMaster ? 'uppercase tracking-tight' : ''}>{pkg.packageName}</div>
                                    </td>

                                    <td className="px-2 py-3 text-right font-medium text-gray-600 bg-gray-50/50">
                                        {isSeg && pkg.segmentKey ? (
                                            <input
                                                type="number"
                                                defaultValue={pkg.totalMeta || ''}
                                                onBlur={(e) => handleSegmentEdit(pkg.segmentKey, parseFloat(e.target.value.replace(',', '.')) || 0)}
                                                className="w-24 text-right bg-white border border-gray-300 rounded px-1 py-0.5 text-xs font-medium text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                                            />
                                        ) : formatCurrency(pkg.totalMeta)}
                                    </td>
                                    <td className="px-2 py-3 text-right font-medium text-blue-700 bg-blue-50/20">{isSeg ? '-' : formatCurrency(pkg.totalForecast)}</td>
                                    <td className="px-2 py-3 text-right font-bold text-gray-900 bg-blue-50/40">{isSeg ? '-' : formatCurrency(pkg.totalPrevia)}</td>

                                    <td className={`px-2 py-3 text-right font-bold ${isSeg ? 'text-gray-400' : rowColor}`}>{isSeg ? '-' : formatCurrency(pkg.deltaVal)}</td>
                                    <td className={`px-2 py-3 text-right font-bold border-r border-gray-200 ${isSeg ? 'text-gray-400' : rowColor}`}>{isSeg ? '-' : formatPercent(pkg.deltaPct)}</td>
                                </tr>
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
                                        const pkg = masterPackages.find(p => p.id === config?.packageId || p.name === config?.packageId);
                                        const pkgManager = users.find(u => u.id === config?.packageManagerId);
                                        const accManager = users.find(u => u.id === config?.accountManagerId);
                                        
                                        // Find entity managers for this config
                                        const entManagerNames = config?.entityManagerIds
                                            .map(id => users.find(u => u.id === id)?.name)
                                            .filter(Boolean)
                                            .join(', ') || 'N/A';
                                        
                                        return (
                                            <tr key={just.id} className="hover:bg-indigo-50/30 transition-colors group">
                                                <td className="px-4 py-3 font-bold text-gray-800">
                                                    {pkg?.name}
                                                    {config?.subArea && <span className="block text-[9px] text-indigo-500 uppercase tracking-tighter">({config.subArea})</span>}
                                                </td>
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
                                                        {just.status === 'Concluído' ? 'Visualizar' : canUserResolveJustification(just) ? 'Resolver' : 'Visualizar'}
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

                    {/* Read-Only Warning Banner */}
                    {!canUserResolveJustification(selectedJustification) && selectedJustification.status !== 'Concluído' && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 font-semibold flex items-center gap-2">
                            <ShieldAlert size={16} className="text-amber-600 shrink-0" />
                            <span>Modo de Visualização Apenas. Seu perfil não possui permissão para editar ou iniciar este plano de ação.</span>
                        </div>
                    )}

                    <hr className="border-gray-100" />

                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                <FileText size={16} className="text-indigo-500" /> 
                                Justificativa e Plano de Ação
                            </label>
                            {selectedJustification.status === 'Pendentes' && canUserResolveJustification(selectedJustification) && (
                                <span className="text-[10px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full animate-pulse">Ação Necessária</span>
                            )}
                        </div>
                        
                        {selectedJustification.status === 'Pendentes' ? (
                            canUserResolveJustification(selectedJustification) ? (
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
                                    <div>
                                        <label className="text-xs font-bold text-gray-700 block mb-1">Direcionar para Gerente de Área / Analista</label>
                                        <select
                                            value={assignedAreaManagerId}
                                            onChange={(e) => setAssignedAreaManagerId(e.target.value)}
                                            className="w-full text-xs p-2.5 border border-gray-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-medium"
                                        >
                                            <option value="">Selecione o gestor de área...</option>
                                            {users
                                                .filter(u => hasRole(u, UserRole.AREA_MANAGER) || hasRole(u, UserRole.AREA_ANALYST))
                                                .map(u => (
                                                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                                                ))
                                            }
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div>
                                            <label className="text-[10px] font-bold text-indigo-600 block mb-1">Início da Correção</label>
                                            <input type="date" value={planStartDate} onChange={(e) => setPlanStartDate(e.target.value)} className="w-full text-xs p-2 border border-indigo-200 rounded outline-none focus:ring-1 focus:ring-indigo-500 bg-white" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-indigo-600 block mb-1">Fim da Correção</label>
                                            <input type="date" value={planEndDate} onChange={(e) => setPlanEndDate(e.target.value)} className="w-full text-xs p-2 border border-indigo-200 rounded outline-none focus:ring-1 focus:ring-indigo-500 bg-white" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-indigo-600 block mb-1">Data de Apresentação</label>
                                            <input type="date" value={planPresentationDate} onChange={(e) => setPlanPresentationDate(e.target.value)} className="w-full text-xs p-2 border border-indigo-200 rounded outline-none focus:ring-1 focus:ring-indigo-500 bg-white" />
                                        </div>
                                    </div>
                                    <button onClick={() => handleActionPlanSubmit(selectedJustification.id, 'Em andamento')} className="w-full bg-indigo-600 text-white py-3 mt-2 rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors shadow-sm">
                                        Iniciar Plano de Ação
                                    </button>
                                </div>
                            ) : (
                                <div className="text-center py-6 border border-dashed border-gray-200 rounded-lg bg-gray-50 text-gray-500">
                                    Nenhum plano de ação iniciado para este desvio pendente.
                                </div>
                            )
                        ) : (
                            <div className="space-y-3">
                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-700">
                                    <p className="font-bold text-xs text-gray-500 mb-1">Justificativa:</p>
                                    <p>{selectedJustification.explanation}</p>
                                </div>
                                <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-3">
                                    <p className="font-bold text-xs text-blue-500 mb-1">Plano de Ação:</p>
                                    <p className="text-sm text-gray-800 mb-3">{selectedJustification.actionPlan}</p>
                                    
                                    {selectedJustification.assignedAreaManagerId && (
                                        <div className="mb-3 text-xs text-gray-600">
                                            <span className="font-bold">Direcionado para:</span> {users.find(u => u.id === selectedJustification.assignedAreaManagerId)?.name || 'Gestor'}
                                        </div>
                                    )}

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
                                <CheckSquare size={16} /> Execução & Conclusão do Plano
                            </h4>
                            <div className="bg-green-50 p-4 rounded-lg border border-green-200 space-y-3">
                                <div>
                                    <label className="block text-xs font-bold text-green-700 mb-1">Valor Recuperado (R$)</label>
                                    <div className="relative">
                                        <DollarSign size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-green-600" />
                                        <input 
                                            type="text" 
                                            className="w-full pl-7 pr-3 py-2 border border-green-300 rounded text-sm focus:ring-2 focus:ring-green-500 outline-none bg-white"
                                            placeholder="0,00"
                                            value={recoveredValue}
                                            onChange={(e) => setRecoveredValue(e.target.value)}
                                            disabled={!canUserResolveJustification(selectedJustification)}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-green-700 mb-1">Observações de Execução / Finais</label>
                                    <textarea 
                                        className="w-full px-3 py-2 border border-green-300 rounded text-sm focus:ring-2 focus:ring-green-500 outline-none bg-white"
                                        rows={2}
                                        placeholder="Atualize o status ou resultado obtido..."
                                        value={completionObs}
                                        onChange={(e) => setCompletionObs(e.target.value)}
                                        disabled={!canUserResolveJustification(selectedJustification)}
                                    />
                                </div>
                                
                                {canUserResolveJustification(selectedJustification) && (
                                    <div className="flex flex-col gap-2">
                                        {/* Entity Managers, Cost Analysts, and Admins can finalize */}
                                        {(hasRole(currentUser, UserRole.ADMIN) || hasRole(currentUser, UserRole.ENTITY_MANAGER) || hasRole(currentUser, UserRole.COST_ANALYST)) ? (
                                            <div className="flex gap-3">
                                                <button onClick={() => handleCompletePlan(selectedJustification.id)} className="flex-1 bg-green-600 text-white py-2.5 rounded-lg text-sm font-bold hover:bg-green-700 flex justify-center items-center gap-2 shadow-sm transition-colors">
                                                    <CheckCircle size={16} /> Confirmar Conclusão
                                                </button>
                                                {selectedJustification.status === 'Em andamento' && (
                                                    <button onClick={() => handleActionPlanSubmit(selectedJustification.id, 'Atrasado')} className="flex-1 bg-orange-600 text-white py-2.5 rounded-lg text-sm font-bold hover:bg-orange-700 flex justify-center items-center gap-2 shadow-sm transition-colors">
                                                        <AlertTriangle size={16} /> Marcar Atrasado
                                                    </button>
                                                )}
                                            </div>
                                        ) : (
                                            /* Other roles with edit access (Package Managers / Area Managers) can execute and save progress */
                                            <div className="space-y-2">
                                                <button onClick={() => handleUpdateExecution(selectedJustification.id)} className="w-full bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-bold hover:bg-indigo-700 flex justify-center items-center gap-2 shadow-sm transition-colors">
                                                    <CheckCircle size={16} /> Salvar Progresso da Execução
                                                </button>
                                                <p className="text-[10px] text-center text-gray-500 font-semibold italic">
                                                    Aguardando aprovação e finalização da Diretoria ou Gerente de Entidade.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {selectedJustification.status === 'Concluído' && (
                        <div className="bg-green-100/50 border border-green-200 rounded-lg p-4 mt-4">
                            <div className="flex items-center gap-2 text-green-800 font-bold mb-2">
                                <CheckCircle size={18} /> Plano Concluído & Aprovado
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm mb-2">
                                <div>
                                    <span className="block text-xs text-green-600 font-bold">Valor Recuperado</span>
                                    <span className="font-bold text-gray-800">{formatCurrency(selectedJustification.recoveredValue || 0)}</span>
                                </div>
                            </div>
                            <p className="text-xs text-green-900 italic border-t border-green-200 pt-2 mt-2">
                                "{selectedJustification.completionObservation || 'Sem observações adicionais.'}"
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
