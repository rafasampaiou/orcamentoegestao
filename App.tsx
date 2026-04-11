
import React, { useState, useRef } from 'react';
import Sidebar from './components/Sidebar';
import TimelineView from './components/TimelineView';

import ForecastTable from './components/ForecastTable';
import GMDView from './components/GMDView';
import OccupancyView from './components/OccupancyView';
import ComparativesView from './components/ComparativesView';
import BudgetLaborView from './components/BudgetLaborView';
import BudgetExtraRevView from './components/BudgetExtraRevView';
import BudgetDREView from './components/BudgetDREView';
import UnifiedAdministrationView from './components/UnifiedAdministrationView';
import ReplicateBudgetModal, { ReplicationOptions } from './components/ReplicateBudgetModal';
import ErrorBoundary from './components/ErrorBoundary';
import Header from './components/Header';
import Auth from './components/Auth';
import ValidationsView from './components/ValidationsView';
import { supabase } from './services/supabaseClient';
import { supabaseService } from './services/supabaseService';
import { Session } from '@supabase/supabase-js';
import { ViewState, ImportedRow, User, Hotel, CostCenter, CostPackage, Account, GMDConfiguration, ModuleType, UserRole, BudgetVersion, LaborParameters, ScheduleItem, ProjectionType, ValidationRecord } from './types';
import { Calendar, ArrowLeft, ArrowRight, Building2 as Building2Icon, Layers } from 'lucide-react';
import { mockUsers, mockHotels, mockCostCenters, mockPackages, mockAccounts, mockGMDConfigs } from './services/mockData';
import { Toaster, toast } from 'react-hot-toast';

const App: React.FC = () => {
  const [currentModule, setCurrentModule] = useState<ModuleType>('REAL');
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  const [selectedHotel, setSelectedHotel] = useState('Atibaia');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [authChecking, setAuthChecking] = useState(true);

  React.useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthChecking(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // --- BUDGET VERSIONING STATE ---
  const [budgetVersions, setBudgetVersions] = useState<BudgetVersion[]>([
    { id: 'v1', name: '2025 Oficial', year: 2025, isLocked: false, createdAt: '2024-10-01', isMain: false },
    { id: 'v2', name: '2026 Oficial', year: 2026, isLocked: false, createdAt: '2025-10-01', isMain: true }
  ]);
  const [activeBudgetVersionId, setActiveBudgetVersionId] = useState<string>('v2');
  const [replicateModalOpen, setReplicateModalOpen] = useState(false);
  const [replicateTarget, setReplicateTarget] = useState<{ year: number, month: number } | null>(null);
  const [replicateMode, setReplicateMode] = useState<'BUDGET' | 'REAL'>('BUDGET');
  const [projectedBudgetVersionId] = useState<string>('v2');
  
  // --- PROJECTION TYPE STATE ---
  const [activeProjectionType, setActiveProjectionType] = useState<ProjectionType>('Reunião de Ritmo');
  const [validations, setValidations] = useState<ValidationRecord[]>([]);

  // --- REAL VERSIONING STATE ---
  const [realVersions, setRealVersions] = useState<BudgetVersion[]>([
    { id: 'r1', name: '2024 Oficial', year: 2024, isLocked: true, createdAt: '2024-01-01' },
    { id: 'r2', name: '2025 Oficial', year: 2025, isLocked: false, createdAt: '2025-01-01' }
  ]);
  const [activeRealVersionId, setActiveRealVersionId] = useState<string>('r2');

  // --- LABOR PARAMETERS STATE ---
  const defaultLaborParams: LaborParameters = {
    dissidioPct: 5.0,
    dissidioMonth: 5,
    fgtsPct: 8.0,
    inssPct: 20.0,
    pisPct: 1.0,
    chargesPct: 32.0,
    issRevenuePct: 5.0,
    issServicePct: 2.0,
    patMealValue: 15.0,
    overtimeHourValue: 25.0,
    benefitsEligibility: 'emocionador',
    benefitsOthersCount: 0
  };

  const [laborParametersMap, setLaborParametersMap] = useState<Record<string, LaborParameters>>({
    'v1': { ...defaultLaborParams },
    'v2': { ...defaultLaborParams },
    'r1': { ...defaultLaborParams },
    'r2': { ...defaultLaborParams }
  });

  const [globalLaborDataMap, setGlobalLaborDataMap] = useState<Record<string, Record<string, any>>>({});
  const [extraRevenueDataMap, setExtraRevenueDataMap] = useState<Record<string, any[]>>({});

  // --- BUDGET SCHEDULE STATE ---
  const [budgetSchedule, setBudgetSchedule] = useState<ScheduleItem[]>([
    { id: 's1', step: 'Premissas e Ocupação', startDate: '2025-09-01', endDate: '2025-09-15', status: 'completed' },
    { id: 's2', step: 'Mão de Obra', startDate: '2025-09-16', endDate: '2025-09-30', status: 'active' },
    { id: 's3', step: 'Despesas Operacionais', startDate: '2025-10-01', endDate: '2025-10-15', status: 'pending' },
    { id: 's4', step: 'Revisão Final', startDate: '2025-10-16', endDate: '2025-10-31', status: 'pending' }
  ]);

  // Mock current user - In a real app, this would come from auth
  const [currentUser] = useState<User>({
    id: 'admin-1',
    name: 'Rafael Souza',
    email: 'rafael.souza@taua.com.br',
    role: UserRole.ADMIN,
    hotelId: '7'
  });

  // Date State for Forecast - Defaults to Today
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Month Status State (New)
  // Record<"YYYY-MM", "open" | "closed">
  const [monthStatus, setMonthStatus] = useState<Record<string, 'open' | 'closed'>>({});

  const getIsMonthClosed = (year: number, month: number) => {
    const key = `${year}-${String(month).padStart(2, '0')}`;
    return monthStatus[key] === 'closed';
  };

  // Financial Data State (Source of Truth)
  const [importedFinancialData, setImportedFinancialData] = useState<ImportedRow[]>([]);

  // --- BUDGET OCCUPANCY STATE (LIFTED) ---
  const [budgetOccupancyDataMap, setBudgetOccupancyDataMap] = useState<Record<string, Record<string, number[]>>>({});
  // Ref always holds the latest value to avoid stale closure in save callbacks
  const budgetOccupancyDataMapRef = useRef(budgetOccupancyDataMap);
  React.useEffect(() => { budgetOccupancyDataMapRef.current = budgetOccupancyDataMap; }, [budgetOccupancyDataMap]);

  const globalLaborDataMapRef = useRef(globalLaborDataMap);
  React.useEffect(() => { globalLaborDataMapRef.current = globalLaborDataMap; }, [globalLaborDataMap]);

  const extraRevenueDataMapRef = useRef(extraRevenueDataMap);
  React.useEffect(() => { extraRevenueDataMapRef.current = extraRevenueDataMap; }, [extraRevenueDataMap]);

  const isInitialMount = useRef(true);

  // Central Auto-Save Effect (Debounces and sends everything to Supabase)
  React.useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (!activeBudgetVersionId) return;
    const timeout = setTimeout(() => {
      const version = budgetVersions.find(v => v.id === activeBudgetVersionId);
      if (version && version.id.startsWith('v')) {
        // Use REFS to guarantee we save the latest data, never stale closure values
        const versionToSave = {
          ...version,
          occupancyData: budgetOccupancyDataMapRef.current[activeBudgetVersionId] || {},
          laborData: globalLaborDataMapRef.current[activeBudgetVersionId] || {},
          extraRevenueData: extraRevenueDataMapRef.current[activeBudgetVersionId] || []
        };
        supabaseService.upsertBudgetVersion(versionToSave).catch(e => console.error('Erro ao salvar planejamento auto-save', e));
      }
    }, 1500); // 1.5 seconds debounce
    return () => clearTimeout(timeout);
  }, [
    activeBudgetVersionId,
    budgetVersions,
    budgetOccupancyDataMap,
    globalLaborDataMap,
    extraRevenueDataMap
  ]);


  const [realOccupancyData, setRealOccupancyData] = useState<Record<string, Record<string, number>>>({});

  // --- REGISTRY STATE (LIFTED FROM SETTINGS) ---
  // This ensures data persists when switching tabs
  const [users, setUsers] = useState<User[]>(mockUsers);
  const [hotels, setHotels] = useState<Hotel[]>(mockHotels);
  const [costCenters, setCostCenters] = useState<CostCenter[]>(mockCostCenters);
  const [packages, setPackages] = useState<CostPackage[]>(mockPackages);
  const [accounts, setAccounts] = useState<Account[]>(mockAccounts);
  const [gmdConfigs, setGmdConfigs] = useState<GMDConfiguration[]>(mockGMDConfigs);

  React.useEffect(() => {
    // We want to update the active budget version whenever the hotel changes,
    // even in REAL mode, so that indicators (Meta) can be retrieved correctly.
    if (budgetVersions.length === 0 || hotels.length === 0) return;

    const selectedHotelObj = hotels.find(h => h.name === selectedHotel);
    const hotelCode = selectedHotelObj?.code || selectedHotel;

    // Matching logic:
    // 1. Version matches hotel and is main
    // 2. Version matches hotel
    // 3. Main version with null hotelId (Global main)
    // 4. Any version with null hotelId
    const matchingVersion =
      budgetVersions.find(v => (v.hotelId === hotelCode || v.hotelId === selectedHotel) && v.isMain) ||
      budgetVersions.find(v => v.hotelId === hotelCode || v.hotelId === selectedHotel) ||
      budgetVersions.find(v => !v.hotelId && v.isMain) ||
      budgetVersions.find(v => !v.hotelId);

    if (matchingVersion) {
      if (matchingVersion.id !== activeBudgetVersionId) {
        setActiveBudgetVersionId(matchingVersion.id);
      }
    } else if (activeBudgetVersionId && currentModule === 'BUDGET') {
      // Only clear the version if we are strictly in the Budget module and found no mismatch/fallback
      setActiveBudgetVersionId('');
    }
  }, [selectedHotel, budgetVersions, hotels, activeBudgetVersionId, currentModule]);
  // -- SUPABASE INTEGRATION: Fetch Real Data on Auth --
  React.useEffect(() => {
    if (!session) return;

    let isMounted = true;

    const fetchRealData = async () => {
      try {
        const remoteHotels = await supabaseService.getHotels();
        if (remoteHotels && remoteHotels.length > 0 && isMounted) {
          setHotels(remoteHotels);
        }

        const remoteCostCenters = await supabaseService.getCostCenters();
        if (remoteCostCenters && remoteCostCenters.length > 0 && isMounted) {
          setCostCenters(remoteCostCenters);
        }

        const remoteAccounts = await supabaseService.getAccounts();
        if (remoteAccounts && remoteAccounts.length > 0 && isMounted) {
          setAccounts(remoteAccounts);
        }

        const remoteProfiles = await supabaseService.getProfiles();
        if (remoteProfiles && remoteProfiles.length > 0 && isMounted) {
          setUsers(remoteProfiles);
        }

        const remoteGmd = await supabaseService.getGmdConfigs();
        if (remoteGmd && remoteGmd.length > 0 && isMounted) {
          setGmdConfigs(remoteGmd);
        }

        const remoteVersions = await supabaseService.getBudgetVersions();
        if (remoteVersions && remoteVersions.length > 0 && isMounted) {
          setBudgetVersions(remoteVersions.filter(v => v.id.startsWith('v')));
          setRealVersions(remoteVersions.filter(v => v.id.startsWith('r')));

          const newOccMap: Record<string, Record<string, number[]>> = {};
          const newLaborMap: Record<string, Record<string, any>> = {};
          const newExtraMap: Record<string, any[]> = {};
          remoteVersions.forEach(v => {
            if (v.id.startsWith('v')) {
              if (v.occupancyData) newOccMap[v.id] = v.occupancyData;
              if (v.laborData) newLaborMap[v.id] = v.laborData;
              if (v.extraRevenueData) newExtraMap[v.id] = v.extraRevenueData;
            }
          });
          setBudgetOccupancyDataMap(newOccMap);
          setGlobalLaborDataMap(newLaborMap);
          setExtraRevenueDataMap(newExtraMap);

          const activeBudget = remoteVersions.find(v => v.isMain && v.id.startsWith('v'));
          const activeReal = remoteVersions.find(v => v.isMain && v.id.startsWith('r'));
          if (activeBudget) setActiveBudgetVersionId(activeBudget.id);
          if (activeReal) setActiveRealVersionId(activeReal.id);
        }

        // --- FETCH FINANCIAL DATA ---
        // Increase limit to 50,000 to ensure we get all records even in large datasets
        const { data: remoteFinancial, error: finError } = await (supabase as any)
          .from('financial_data')
          .select('*')
          .limit(50000);

        if (remoteFinancial && !finError && isMounted) {
          const mapped = remoteFinancial.map((r: any) => ({
            ano: String(r.year),
            cenario: r.scenario,
            tipo: r.type || '',
            hotel: r.hotel,
            conta: r.account_name,
            cr: r.cost_center || '',
            mes: String(r.month),
            valor: String(r.value || '0'),
            escopo: r.scope || '',
            departamento: r.department || '',
            pacote: r.package || '',
            pacoteMaster: r.master_package || '',
            diretoria: r.directorate || '',
            versionId: r.version_id || '',
            status: 'valid' as const,
          }));
          setImportedFinancialData(mapped);
        }
      } catch (error) {
        console.warn('Could not fetch real data from Supabase, falling back to mockData.', error);
      }
    };

    fetchRealData();

    return () => { isMounted = false; };
  }, [session]);

  const handleImportData = (newData: ImportedRow[], mode: 'append' | 'replace') => {
    setImportedFinancialData(prevData => {
      if (mode === 'append') {
        // Simple append
        return [...prevData, ...newData];
      } else {
        // SMART REPLACE:
        // Only remove existing data that matches the context (Hotel + Year + Month + Scenario) of the NEW data.

        // 1. Identify the contexts present in the new import
        const contextsToReplace = new Set<string>();

        newData.forEach(row => {
          // Create a unique key for the context. 
          // Normalizing strings to uppercase/trimmed to ensure matches.
          const key = `${row.hotel.trim().toUpperCase()}|${row.ano}|${row.mes}|${row.cenario.trim().toUpperCase()}|${row.versionId || ''}`;
          contextsToReplace.add(key);
        });

        // 2. Filter out OLD data that matches these contexts
        const preservedData = prevData.filter(row => {
          const key = `${row.hotel.trim().toUpperCase()}|${row.ano}|${row.mes}|${row.cenario.trim().toUpperCase()}|${row.versionId || ''}`;
          // Keep the row IF its context is NOT in the set of contexts being replaced
          return !contextsToReplace.has(key);
        });

        // 3. Merge preserved data with new data
        return [...preservedData, ...newData];
      }
    });
  };

  const handleMonthChange = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    if (direction === 'prev') {
      if (newDate.getMonth() > 0) newDate.setMonth(newDate.getMonth() - 1);
    } else {
      if (newDate.getMonth() < 11) newDate.setMonth(newDate.getMonth() + 1);
    }
    setSelectedDate(newDate);
  };

  const handleModuleChange = (module: ModuleType) => {
    setCurrentModule(module);
    if (module === 'REAL') {
      setCurrentView('real_home');
    } else if (module === 'BUDGET') {
      setCurrentView('budget_home');
    }
  };

  React.useEffect(() => {
    const version = realVersions.find(v => v.id === activeRealVersionId);
    if (version && selectedDate.getFullYear() !== version.year) {
      setSelectedDate(prev => {
        const newDate = new Date(prev);
        newDate.setFullYear(version.year);
        return newDate;
      });
    }
  }, [activeRealVersionId, realVersions, selectedDate]);

  const handleReplicateBudget = (sourceVersionId: string, options: ReplicationOptions) => {
    if (!replicateTarget) return;

    const sourceVersion = budgetVersions.find(v => v.id === sourceVersionId) || realVersions.find(v => v.id === sourceVersionId);

    const newVersionId = `${replicateMode === 'REAL' ? 'r' : 'b'}${Date.now()}`;
    const newVersion: BudgetVersion = {
      id: newVersionId,
      name: options.name,
      year: replicateTarget.year,
      month: replicateTarget.month,
      isMain: false,
      isLocked: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (replicateMode === 'REAL') {
      setRealVersions(prev => [...prev, newVersion]);
      setActiveRealVersionId(newVersionId);
    } else {
      setBudgetVersions(prev => [...prev, newVersion]);
      setActiveBudgetVersionId(newVersionId);
    }

    // --- DATA REPLICATION LOGIC ---
    const runReplication = async () => {
      try {
        if (options.type === 'pull_budget_meta' && options.budgetYear) {
          // PULL FROM BUDGET DATABASE TO FINANCIAL_DATA
          await supabaseService.pullBudgetMetaToReal(options.budgetYear, newVersionId);

          // Refresh local state by fetching this version's data
          const newData = await supabaseService.getFinancialDataByVersion(newVersionId);
          setImportedFinancialData(prev => [...prev, ...newData]);

          toast.success(`Meta de ${options.budgetYear} importada com sucesso!`);
        } else if (sourceVersionId) {
          // Replicate Financial Data (ImportedRows)
          const sourceData = importedFinancialData.filter(row => row.versionId === sourceVersionId);
          const newData: ImportedRow[] = sourceData.map(row => {
            let newValue = parseFloat(row.valor) || 0;

            if (options.type === 'new_projected') {
              const account = accounts.find(a => a.name === row.conta || a.code === row.conta);
              if (account) {
                if (account.type === 'Fixed' && options.projectFixedWithInflation && options.inflationRate !== undefined) {
                  newValue = newValue * (1 + options.inflationRate / 100);
                }
              }
            }

            return {
              ...row,
              valor: newValue.toFixed(2),
              versionId: newVersionId,
              ano: replicateTarget.year.toString(),
              mes: replicateTarget.month?.toString() || row.mes
            };
          });

          if (newData.length > 0) {
            setImportedFinancialData(prev => [...prev, ...newData]);
          }
        }
      } catch (err) {
        console.error('Replication Error:', err);
        toast.error('Erro ao replicar dados. Verifique a conexão.');
      }
    };

    runReplication();

    // 2. Replicate Occupancy Data
    if (sourceVersionId && budgetOccupancyDataMap[sourceVersionId]) {
      setBudgetOccupancyDataMap(prev => ({
        ...prev,
        [newVersionId]: JSON.parse(JSON.stringify(prev[sourceVersionId]))
      }));
    }

    // 3. Replicate Labor Parameters
    if (sourceVersionId && laborParametersMap[sourceVersionId]) {
      setLaborParametersMap(prev => ({
        ...prev,
        [newVersionId]: { ...prev[sourceVersionId] }
      }));
    }

    setReplicateModalOpen(false);
    setReplicateTarget(null);

    // Navigation logic based on user choice
    if (replicateMode === 'BUDGET') {
      if (options.type === 'new_projected' && options.insertNewOccupancy) {
        setCurrentView('occupancy_budget');
      } else {
        setCurrentView('dre_budget');
      }
    } else {
      setCurrentView('dashboard');
    }
  };

  const renderContent = () => {
    const isClosed = getIsMonthClosed(selectedDate.getFullYear(), selectedDate.getMonth() + 1);

    switch (currentView) {
      // --- REAL MODULE ---
      case 'real_home': return (
        <div className="p-8 max-w-7xl mx-auto w-full">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Tauá Real</h1>
            <p className="text-gray-500">Selecione uma versão de realizado para trabalhar ou crie uma nova.</p>
          </div>
          <TimelineView
            title="Planejamentos (Realizado)"
            versions={realVersions}
            activeVersionId={activeRealVersionId}
            onSelectVersion={(id) => {
              setActiveRealVersionId(id);
              setCurrentView('dashboard');
            }}
            onToggleLock={(id) => setRealVersions(prev => prev.map(bv => bv.id === id ? { ...bv, isLocked: !bv.isLocked } : bv))}
            onCreateVersion={() => { }} // Disabled as we use replication only
            onReplicateVersion={(year, month) => {
              setReplicateTarget({ year, month });
              setReplicateMode('REAL');
              setReplicateModalOpen(true);
            }}
            showCreateOption={false}
            onSetMain={(id) => setRealVersions(prev => prev.map(v => ({ ...v, isMain: v.id === id })))}
            onDelete={async (id) => {
              try {
                await supabaseService.deleteBudgetVersion(id);
                setRealVersions(prev => prev.filter(v => v.id !== id));
                if (activeRealVersionId === id) {
                  setActiveRealVersionId(realVersions.find(v => v.id !== id)?.id || '');
                }
              } catch (e) {
                console.error('Failed to delete version from Supabase', e);
              }
            }}
          />
          {replicateTarget && replicateMode === 'REAL' && (
            <ReplicateBudgetModal
              isOpen={replicateModalOpen}
              onClose={() => {
                setReplicateModalOpen(false);
                setReplicateTarget(null);
              }}
              targetYear={replicateTarget.year}
              targetMonth={replicateTarget.month}
              availableVersions={realVersions}
              budgetVersions={budgetVersions}
              mode="REAL"
              onReplicate={handleReplicateBudget}
            />
          )}
        </div>
      );
      case 'dashboard': return (
        <ForecastTable
          selectedMonth={selectedDate.getMonth() + 1}
          selectedYear={selectedDate.getFullYear()}
          financialData={importedFinancialData}
          selectedHotel={selectedHotel}
          accounts={accounts}
          packages={packages}
          hotels={hotels}
          isMonthClosed={isClosed}
          realOccupancyData={realOccupancyData}
          budgetOccupancyData={budgetOccupancyDataMap[activeBudgetVersionId] || {}}
          activeRealVersionId={activeRealVersionId}
          activeBudgetVersionId={activeBudgetVersionId}
          activeProjectionType={activeProjectionType}
          setActiveProjectionType={setActiveProjectionType}
          validations={validations}
          setValidations={setValidations}
          currentUser={currentUser}
        />
      );
      case 'occupancy_real': return (
        <OccupancyView
          isBudget={false}
          selectedMonth={selectedDate.getMonth() + 1}
          selectedYear={selectedDate.getFullYear()}
          selectedHotel={selectedHotel}
          budgetData={budgetOccupancyDataMap[projectedBudgetVersionId] || {}}
          realOccupancyData={realOccupancyData}
          setRealOccupancyData={setRealOccupancyData}
          financialData={importedFinancialData}
          activeProjectionType={activeProjectionType}
          setActiveProjectionType={setActiveProjectionType}
        />
      );
      case 'comparatives': return <ComparativesView />;
      case 'gmd': return (
        <GMDView
          gmdConfigs={gmdConfigs}
          accounts={accounts}
          packages={packages}
          hotels={hotels}
          financialData={importedFinancialData}
          users={users}
          selectedMonth={selectedDate.getMonth() + 1}
          selectedYear={selectedDate.getFullYear()}
          initialSelectedHotel={selectedHotel}
        />
      );
      case 'validations': return (
        <ValidationsView
            validations={validations}
            hotels={hotels}
            currentUser={currentUser}
        />
      );
      case 'admin':
        return (
          <UnifiedAdministrationView
            users={users}
            setUsers={setUsers}
            hotels={hotels} setHotels={setHotels}
            costCenters={costCenters} setCostCenters={setCostCenters}
            packages={packages} setPackages={setPackages}
            accounts={accounts} setAccounts={setAccounts}
            gmdConfigs={gmdConfigs} setGmdConfigs={setGmdConfigs}
            monthStatus={monthStatus}
            setMonthStatus={setMonthStatus}
            onImportData={handleImportData}
            budgetVersions={budgetVersions}
            setBudgetVersions={setBudgetVersions}
            activeBudgetVersionId={activeBudgetVersionId}
            setActiveBudgetVersionId={setActiveBudgetVersionId}
            realVersions={realVersions}
            setRealVersions={setRealVersions}
            activeRealVersionId={activeRealVersionId}
            setActiveRealVersionId={setActiveRealVersionId}
            laborParametersMap={laborParametersMap}
            setLaborParametersMap={setLaborParametersMap}
            budgetSchedule={budgetSchedule}
            setBudgetSchedule={setBudgetSchedule}
          />
        );

      // --- BUDGET MODULE ---
      case 'budget_home': return (
        <div className="p-8 max-w-7xl mx-auto w-full">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Tauá Budget</h1>
            <p className="text-gray-500">Selecione uma versão de orçamento para trabalhar ou crie uma nova.</p>
          </div>
          <TimelineView
            title="Planejamentos (Orçamento)"
            versions={budgetVersions.filter(v => !v.hotelId || v.hotelId === (hotels.find(h => h.name === selectedHotel)?.code || selectedHotel))}
            activeVersionId={activeBudgetVersionId}
            onSelectVersion={(id) => {
              setActiveBudgetVersionId(id);
              const isAdm = selectedHotel === 'Administradora' || hotels.find(h => h.name === selectedHotel)?.code === 'ADM';
              setCurrentView(isAdm ? 'dre_budget' : 'occupancy_budget');
            }}
            onToggleLock={(id) => setBudgetVersions(prev => prev.map(bv => bv.id === id ? { ...bv, isLocked: !bv.isLocked } : bv))}
            onCreateVersion={async (year, month, name) => {
              const selectedHotelObj = hotels.find(h => h.name === selectedHotel || h.code === selectedHotel);
              const hotelId = selectedHotelObj?.code || selectedHotelObj?.id || selectedHotel;

              const newVersion: BudgetVersion = {
                id: `v-${Date.now()}`,
                name,
                year: year,
                month: month || 1,
                createdAt: new Date().toISOString(),
                isLocked: false,
                isMain: budgetVersions.length === 0,
                hotelId: hotelId,
                occupancyData: {}
              };

              // Save to Supabase right away
              try {
                await supabaseService.upsertBudgetVersion(newVersion);
              } catch (e) {
                console.error('Failed to create version in Supabase', e);
              }

              setBudgetVersions(prev => [...prev, newVersion]);
              setActiveBudgetVersionId(newVersion.id);
              setBudgetOccupancyDataMap(prev => ({ ...prev, [newVersion.id]: {} }));

              const isAdm = selectedHotelObj?.code === 'ADM' || selectedHotel === 'Administradora';
              setCurrentView(isAdm ? 'dre_budget' : 'occupancy_budget');
            }}
            onReplicateVersion={(year, month) => {
              setReplicateTarget({ year, month });
              setReplicateMode('BUDGET');
              setReplicateModalOpen(true);
            }}
            onSetMain={(id) => setBudgetVersions(prev => prev.map(v => ({ ...v, isMain: v.id === id })))}
            onDelete={async (id) => {
              try {
                await supabaseService.deleteBudgetVersion(id);
                setBudgetVersions(prev => prev.filter(v => v.id !== id));
                if (activeBudgetVersionId === id) {
                  setActiveBudgetVersionId(budgetVersions.find(v => v.id !== id)?.id || '');
                }
              } catch (e) {
                console.error('Failed to delete version from Supabase', e);
              }
            }}
          />
          {replicateTarget && replicateMode === 'BUDGET' && (
            <ReplicateBudgetModal
              isOpen={replicateModalOpen}
              onClose={() => {
                setReplicateModalOpen(false);
                setReplicateTarget(null);
              }}
              targetYear={replicateTarget.year}
              targetMonth={replicateTarget.month}
              availableVersions={budgetVersions}
              budgetVersions={budgetVersions}
              mode="BUDGET"
              onReplicate={handleReplicateBudget}
            />
          )}
        </div>
      );
      case 'occupancy_budget': return (
        <OccupancyView
          isBudget={true}
          budgetData={budgetOccupancyDataMap[activeBudgetVersionId] || {}}
          setBudgetData={(newData) => {
            setBudgetOccupancyDataMap(prev => ({
              ...prev,
              [activeBudgetVersionId]: typeof newData === 'function' ? newData(prev[activeBudgetVersionId] || {}) : newData
            }));
          }}
          onSaveOccupancy={async () => {
            const version = budgetVersions.find(v => v.id === activeBudgetVersionId);
            if (version) {
              // Use refs to always read the LATEST state, avoiding stale closure bug
              const latestOccupancy = budgetOccupancyDataMapRef.current[activeBudgetVersionId] || {};
              const latestLabor = globalLaborDataMapRef.current[activeBudgetVersionId] || {};
              const latestExtra = extraRevenueDataMapRef.current[activeBudgetVersionId] || [];
              const versionToSave = {
                ...version,
                occupancyData: latestOccupancy,
                laborData: latestLabor,
                extraRevenueData: latestExtra
              };
              try {
                await supabaseService.upsertBudgetVersion(versionToSave);
                toast.success('Ocupação salva com sucesso!');
              } catch (e) {
                toast.error('Erro ao salvar ocupação.');
                console.error(e);
              }
            }
          }}
          onClearOccupancy={async () => {
            setBudgetOccupancyDataMap(prev => ({ ...prev, [activeBudgetVersionId]: {} }));
            const version = budgetVersions.find(v => v.id === activeBudgetVersionId);
            if (version) {
              const versionToSave = {
                ...version,
                occupancyData: {},
                laborData: globalLaborDataMapRef.current[activeBudgetVersionId] || {},
                extraRevenueData: extraRevenueDataMapRef.current[activeBudgetVersionId] || []
              };
              try {
                await supabaseService.upsertBudgetVersion(versionToSave);
                toast.success('Dados de ocupação apagados.');
              } catch (e) {
                toast.error('Erro ao limpar ocupação.');
                console.error(e);
              }
            }
          }}
        />
      );
      case 'labor_budget': return (
        <ErrorBoundary>
          <BudgetLaborView
            key={activeBudgetVersionId}
            costCenters={costCenters}
            laborParameters={laborParametersMap[activeBudgetVersionId] || defaultLaborParams}
            accounts={accounts}
            packages={packages}
            budgetOccupancyData={budgetOccupancyDataMap[activeBudgetVersionId] || {}}
            laborData={globalLaborDataMap[activeBudgetVersionId]}
            setLaborData={(data) => setGlobalLaborDataMap(prev => ({ ...prev, [activeBudgetVersionId]: data }))}
          />
        </ErrorBoundary>
      );
      case 'extra_revenue_budget': return (
        <ErrorBoundary>
          <BudgetExtraRevView
            key={activeBudgetVersionId}
            budgetOccupancyData={budgetOccupancyDataMap[activeBudgetVersionId] || {}}
            extraRevenueData={extraRevenueDataMap[activeBudgetVersionId]}
            setExtraRevenueData={(data) => setExtraRevenueDataMap(prev => ({ ...prev, [activeBudgetVersionId]: data }))}
          />
        </ErrorBoundary>
      );
      case 'dre_budget': return (
        <ErrorBoundary>
          <BudgetDREView
            accounts={accounts}
            costCenters={costCenters}
            sidebarCollapsed={sidebarCollapsed}
            onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
            selectedHotel={selectedHotel}
            selectedYear={budgetVersions.find(v => v.id === activeBudgetVersionId)?.year || selectedDate.getFullYear()}
            activeBudgetVersionId={activeBudgetVersionId}
          />
        </ErrorBoundary>
      );

      default: return (
        <div className="p-8 text-center text-gray-500">
          Selecione uma opção no menu lateral.
        </div>
      );
    }
  };

  // Date Formatter (Only Month)
  const formattedDate = selectedDate.toLocaleDateString('pt-BR', { month: 'long' });

  if (authChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f172a]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  return (
    <div className="flex bg-gray-50 min-h-screen font-['Inter',sans-serif]">
      <Sidebar
        currentView={currentView}
        currentModule={currentModule}
        onChangeView={setCurrentView}
        onModuleChange={handleModuleChange}
        user={currentUser}
        collapsed={sidebarCollapsed}
      />

      <div className={`flex-1 ${sidebarCollapsed ? 'ml-20' : 'ml-64'} flex flex-col h-screen overflow-hidden transition-all duration-300`}>
        <Header
          sidebarCollapsed={sidebarCollapsed}
          setSidebarCollapsed={setSidebarCollapsed}
          hotels={hotels}
          selectedHotel={selectedHotel}
          setSelectedHotel={setSelectedHotel}
          currentModule={currentModule}
          handleMonthChange={handleMonthChange}
          formattedDate={formattedDate}
          currentUser={{
            ...currentUser,
            name: session.user.email?.split('@')[0] || currentUser.name,
            email: session.user.email || currentUser.email
          }}
          onLogout={handleLogout}
        />

        {/* Main Scrollable Content */}
        <main className="flex-1 overflow-auto p-4">
          <div className="w-full h-full">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
