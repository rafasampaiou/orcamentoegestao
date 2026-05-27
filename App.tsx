
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
import { ViewState, ImportedRow, User, Hotel, HotelCategory, HotelRegion, CostCenter, CostPackage, Account, GMDConfiguration, ModuleType, UserRole, BudgetVersion, LaborParameters, ScheduleItem, ProjectionType, ValidationRecord, DreSection } from './types';
import { Calendar, ArrowLeft, ArrowRight, Building2 as Building2Icon, Layers } from 'lucide-react';
import { mockUsers, mockHotels, mockCostCenters, mockPackages, mockAccounts, mockGMDConfigs } from './services/mockData';
import { Toaster, toast } from 'react-hot-toast';

const App: React.FC = () => {
  const [currentModule, setCurrentModule] = useState<ModuleType>('REAL');
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  const [selectedHotel, setSelectedHotel] = useState('Atibaia');
  const [selectedHotelType, setSelectedHotelType] = useState<string>('Todos');
  const [selectedHotelCategory, setSelectedHotelCategory] = useState<string>('Todas');
  const [selectedHotelRegion, setSelectedHotelRegion] = useState<string>('Todas');
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
  const [budgetVersions, setBudgetVersions] = useState<BudgetVersion[]>([]);
  const [activeBudgetVersionId, setActiveBudgetVersionId] = useState<string>('');
  const [replicateModalOpen, setReplicateModalOpen] = useState(false);
  const [replicateTarget, setReplicateTarget] = useState<{ year: number, month: number } | null>(null);
  const [replicateMode, setReplicateMode] = useState<'BUDGET' | 'REAL'>('BUDGET');
  const [projectedBudgetVersionId] = useState<string>('v2');
  
  // --- PROJECTION TYPE STATE ---
  const [activeProjectionType, setActiveProjectionType] = useState<ProjectionType>('Reunião de Ritmo');
  const [validations, setValidations] = useState<ValidationRecord[]>([]);

  // --- REAL VERSIONING STATE ---
  const [realVersions, setRealVersions] = useState<BudgetVersion[]>([]);
  const [activeRealVersionId, setActiveRealVersionId] = useState<string>('');

  // Sync selectedHotel when a version is selected
  React.useEffect(() => {
    if (activeRealVersionId) {
      const version = realVersions.find(v => v.id === activeRealVersionId);
      if (version && version.hotel) {
        setSelectedHotel(version.hotel);
      }
    }
  }, [activeRealVersionId, realVersions]);

  React.useEffect(() => {
    if (activeBudgetVersionId) {
      const version = budgetVersions.find(v => v.id === activeBudgetVersionId);
      if (version && version.hotel) {
        setSelectedHotel(version.hotel);
      }
    }
  }, [activeBudgetVersionId, budgetVersions]);

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

  const defaultUser: User = {
    id: 'admin-1',
    name: 'Rafael Souza',
    email: 'rafael.souza@taua.com.br',
    role: UserRole.ADMIN,
    hotelId: '7'
  };

  // Date State for Forecast - Defaults to Today
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Month Status State (New)
  // Record<"YYYY-MM", "open" | "closed">
  const getIsMonthClosed = (year: number, month: number) => {
    const version = realVersions.find(v => v.id === activeRealVersionId);
    if (!version) return false;
    return version.closedMonths?.includes(month) || false;
  };

  const isClosed = getIsMonthClosed(selectedDate.getFullYear(), selectedDate.getMonth() + 1);

  const handleToggleMonthClosure = async (month: number) => {
    const version = realVersions.find(v => v.id === activeRealVersionId);
    if (!version) return;

    const currentClosed = version.closedMonths || [];
    const newClosed = currentClosed.includes(month)
      ? currentClosed.filter(m => m !== month)
      : [...currentClosed, month];
    
    const updatedVersion = { ...version, closedMonths: newClosed };
    
    setRealVersions(prev => prev.map(v => v.id === version.id ? updatedVersion : v));
    
    try {
      await supabaseService.upsertBudgetVersion(updatedVersion);
    } catch (e) {
      console.error('Falha ao salvar fechamento de mês', e);
    }
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

  const [extraRevenueDataMapRef] = [useRef(extraRevenueDataMap)];
  React.useEffect(() => { extraRevenueDataMapRef.current = extraRevenueDataMap; }, [extraRevenueDataMap]);

  React.useEffect(() => {
    const newOccMap: Record<string, Record<string, number[]>> = {};
    const newLaborMap: Record<string, Record<string, any>> = {};
    const newExtraMap: Record<string, any[]> = {};
    budgetVersions.forEach(v => {
      if (v.occupancyData) newOccMap[v.id] = v.occupancyData;
      if (v.laborData) newLaborMap[v.id] = v.laborData;
      if (v.extraRevenueData) newExtraMap[v.id] = v.extraRevenueData;
    });
    setBudgetOccupancyDataMap(prev => ({ ...prev, ...newOccMap }));
    setGlobalLaborDataMap(prev => ({ ...prev, ...newLaborMap }));
    setExtraRevenueDataMap(prev => ({ ...prev, ...newExtraMap }));
  }, [budgetVersions]);

  const isInitialMount = useRef(true);
  const hasLoadedFromSupabase = useRef(false);

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
  const [users, setUsers] = useState<User[]>([]);

  const loggedInProfile = React.useMemo(() => {
    if (!session) return null;
    return users.find(u => u.email.toLowerCase() === session.user.email?.toLowerCase()) || null;
  }, [session, users]);

  const currentUser = React.useMemo<User>(() => {
    if (!session) return defaultUser;
    if (loggedInProfile) return loggedInProfile;
    return {
      id: session.user.id,
      name: session.user.email?.split('@')[0] || 'Usuário',
      email: session.user.email || '',
      role: UserRole.ADMIN, // Default fallback
      hotelId: '7'
    };
  }, [session, loggedInProfile]);

  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [packages, setPackages] = useState<CostPackage[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [gmdConfigs, setGmdConfigs] = useState<GMDConfiguration[]>([]);
  const [dreConfigs, setDreConfigs] = useState<Record<string, DreSection[]>>({});
  const [hotelCategories, setHotelCategories] = useState<HotelCategory[]>([]);
  const [hotelRegions, setHotelRegions] = useState<HotelRegion[]>([]);

  React.useEffect(() => {
    if (hotels.length === 0 || !currentUser || !currentUser.hotelId) return;
    
    const isRestricted = currentUser.role !== UserRole.ADMIN && 
                         currentUser.role !== UserRole.DIRETORIA && 
                         currentUser.role !== UserRole.PACKAGE_MANAGER;
                         
    if (isRestricted) {
      const userHotel = hotels.find(h => h.id === currentUser.hotelId || h.code === currentUser.hotelId);
      if (userHotel && selectedHotel !== userHotel.name) {
        setSelectedHotel(userHotel.name);
      }
    }
  }, [currentUser, hotels, selectedHotel]);

  React.useEffect(() => {
    // We want to update the active budget version whenever the hotel changes,
    // even in REAL mode, so that indicators (Meta) can be retrieved correctly.
    if (budgetVersions.length === 0 || hotels.length === 0) return;

    const selectedHotelObj = hotels.find(h => h.name === selectedHotel);
    const hotelCode = selectedHotelObj?.code || selectedHotel;

    const currentActiveVersion = budgetVersions.find(v => v.id === activeBudgetVersionId);
    const isCurrentValid = currentActiveVersion && (currentActiveVersion.hotelId === hotelCode || currentActiveVersion.hotelId === selectedHotel || !currentActiveVersion.hotelId);

    // If the currently selected version is valid for the current hotel, don't force an override.
    if (isCurrentValid && activeBudgetVersionId !== '') {
      return;
    }

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
    } else if (activeBudgetVersionId) {
      // Clear version if found mismatch/fallback
      setActiveBudgetVersionId('');
    }
  }, [selectedHotel, budgetVersions, hotels, activeBudgetVersionId, currentModule]);
  // -- SUPABASE INTEGRATION: Fetch Real Data on Auth --
  React.useEffect(() => {
    if (!session) return;

    let isMounted = true;

    const fetchRealData = async () => {
      if (hasLoadedFromSupabase.current) return; // Prevent multiple global fetches
      
      try {
        const remoteHotels = await supabaseService.getHotels();
        if (remoteHotels && isMounted) setHotels(remoteHotels);

        const remoteCostCenters = await supabaseService.getCostCenters();
        if (remoteCostCenters && isMounted) setCostCenters(remoteCostCenters);

        const remoteAccounts = await supabaseService.getAccounts();
        if (remoteAccounts && isMounted) setAccounts(remoteAccounts);

        const remoteProfiles = await supabaseService.getProfiles();
        if (remoteProfiles && isMounted) setUsers(remoteProfiles);

        const remoteGmd = await supabaseService.getGmdConfigs();
        if (remoteGmd && isMounted) setGmdConfigs(remoteGmd);

        const remoteDreConfigs = await supabaseService.getDreConfigs();
        if (remoteDreConfigs && isMounted) {
          const configRecord: Record<string, DreSection[]> = {};
          remoteDreConfigs.forEach(cfg => {
            configRecord[cfg.name] = cfg.structure;
          });
          setDreConfigs(configRecord);
        }
        
        const remoteCategories = await supabaseService.getHotelCategories();
        if (remoteCategories && isMounted) setHotelCategories(remoteCategories);

        const remoteRegions = await supabaseService.getHotelRegions();
        if (remoteRegions && isMounted) setHotelRegions(remoteRegions);
        
        hasLoadedFromSupabase.current = true;

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
    setCurrentView('dashboard'); 
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

  const onCreateVersion = async (year: number, month: number, name: string, hotelId: string) => {
    const timestamp = Date.now();
    const realId = `r-${timestamp}`;
    const budgetId = `v-${timestamp}`;

    const newRealVersion: BudgetVersion = {
      id: realId,
      name: name,
      year: year,
      month: month,
      isMain: false,
      isLocked: false,
      hotelId: hotelId,
      occupancyData: {},
      laborData: {},
      extraRevenueData: [],
      closedMonths: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const newBudgetVersion: BudgetVersion = {
      id: budgetId,
      name: name,
      year: year,
      month: month,
      isMain: false,
      isLocked: false,
      hotelId: hotelId,
      occupancyData: {},
      laborData: {},
      extraRevenueData: [],
      closedMonths: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      // 1. Save both to Supabase
      await supabaseService.upsertBudgetVersion(newRealVersion);
      await supabaseService.upsertBudgetVersion(newBudgetVersion);

      // 2. Update local state
      setRealVersions(prev => [...prev, newRealVersion]);
      setBudgetVersions(prev => [...prev, newBudgetVersion]);

      // 3. Set active Realized/Budget version
      setActiveRealVersionId(realId);
      setActiveBudgetVersionId(budgetId);

      toast.success(`Versões ${name} criadas com sucesso!`);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao criar novas versões.');
    }
  };

  const handleReplicateBudget = async (sourceVersionId: string, options: ReplicationOptions) => {
    if (!replicateTarget) return;

    try {
      const isSourceReal = sourceVersionId.startsWith('r');
      
      // Find source versions (both real and budget if possible, to replicate paired versions)
      const sourceRealVersion = isSourceReal 
        ? realVersions.find(v => v.id === sourceVersionId)
        : realVersions.find(v => {
            const bv = budgetVersions.find(b => b.id === sourceVersionId);
            return bv && v.name === bv.name && v.year === bv.year && v.hotelId === bv.hotelId;
          });
          
      const sourceBudgetVersion = !isSourceReal
        ? budgetVersions.find(v => v.id === sourceVersionId)
        : budgetVersions.find(v => {
            const rv = realVersions.find(r => r.id === sourceVersionId);
            return rv && v.name === rv.name && v.year === rv.year && v.hotelId === rv.hotelId;
          });

      const timestamp = Date.now();
      const newRealVersionId = `r-${timestamp}`;
      const newBudgetVersionId = `v-${timestamp}`;

      // Create new version records with replicated metadata
      const newRealVersion: BudgetVersion = {
        id: newRealVersionId,
        name: options.name,
        year: replicateTarget.year,
        month: replicateTarget.month,
        isMain: false,
        isLocked: false,
        hotelId: sourceRealVersion?.hotelId || sourceBudgetVersion?.hotelId,
        occupancyData: sourceRealVersion?.occupancyData || {},
        laborData: sourceRealVersion?.laborData || {},
        extraRevenueData: sourceRealVersion?.extraRevenueData || [],
        closedMonths: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const newBudgetVersion: BudgetVersion = {
        id: newBudgetVersionId,
        name: options.name,
        year: replicateTarget.year,
        month: replicateTarget.month,
        isMain: false,
        isLocked: false,
        hotelId: sourceBudgetVersion?.hotelId || sourceRealVersion?.hotelId,
        occupancyData: sourceBudgetVersion?.occupancyData || {},
        laborData: sourceBudgetVersion?.laborData || {},
        extraRevenueData: sourceBudgetVersion?.extraRevenueData || [],
        closedMonths: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // 1. Save new versions to database
      await supabaseService.upsertBudgetVersion(newRealVersion);
      await supabaseService.upsertBudgetVersion(newBudgetVersion);

      // 2. Replicate financial data in DB
      let replicatedRealData: ImportedRow[] = [];
      let replicatedBudgetData: ImportedRow[] = [];

      if (options.type === 'pull_budget_meta' && options.budgetYear) {
        // Pull Meta from Budget to Real
        await supabaseService.pullBudgetMetaToReal(options.budgetYear, newRealVersionId);
        replicatedRealData = await supabaseService.getFinancialDataByVersion(newRealVersionId);
      } else {
        // Replicate Real financial data
        if (sourceRealVersion) {
          const sourceRealData = await supabaseService.getFinancialDataByVersion(sourceRealVersion.id);
          const newData: ImportedRow[] = sourceRealData.map(row => {
            let newValue = parseFloat(row.valor) || 0;
            return {
              ...row,
              valor: newValue.toFixed(2),
              versionId: newRealVersionId,
              ano: replicateTarget.year.toString(),
              mes: replicateTarget.month?.toString() || row.mes
            };
          });
          if (newData.length > 0) {
            await supabaseService.saveFinancialData(newData);
            replicatedRealData = newData;
          }
        }

        // Replicate Budget financial data
        if (sourceBudgetVersion) {
          const sourceBudgetData = await supabaseService.getFinancialDataByVersion(sourceBudgetVersion.id);
          const newData: ImportedRow[] = sourceBudgetData.map(row => {
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
              versionId: newBudgetVersionId,
              ano: replicateTarget.year.toString(),
              mes: replicateTarget.month?.toString() || row.mes
            };
          });
          if (newData.length > 0) {
            await supabaseService.saveFinancialData(newData);
            replicatedBudgetData = newData;
          }
        }
      }

      // 3. Update React States
      setRealVersions(prev => [...prev, newRealVersion]);
      setBudgetVersions(prev => [...prev, newBudgetVersion]);
      
      const allNewData = [...replicatedRealData, ...replicatedBudgetData];
      if (allNewData.length > 0) {
        setImportedFinancialData(prev => [...prev, ...allNewData]);
      }

      // Sync local maps for occupancy, labor and extra revenue
      if (newRealVersion.occupancyData) {
        setBudgetOccupancyDataMap(prev => ({
          ...prev,
          [newRealVersionId]: newRealVersion.occupancyData!,
          [newBudgetVersionId]: newBudgetVersion.occupancyData!
        }));
      }
      if (newRealVersion.laborData) {
        setGlobalLaborDataMap(prev => ({
          ...prev,
          [newRealVersionId]: newRealVersion.laborData!,
          [newBudgetVersionId]: newBudgetVersion.laborData!
        }));
      }
      if (newRealVersion.extraRevenueData) {
        setExtraRevenueDataMap(prev => ({
          ...prev,
          [newRealVersionId]: newRealVersion.extraRevenueData!,
          [newBudgetVersionId]: newBudgetVersion.extraRevenueData!
        }));
      }

      // Copy labor parameters (for UI config parameter map)
      const sourceId = sourceRealVersion?.id || sourceBudgetVersion?.id;
      if (sourceId && laborParametersMap[sourceId]) {
        setLaborParametersMap(prev => ({
          ...prev,
          [newRealVersionId]: { ...prev[sourceId] },
          [newBudgetVersionId]: { ...prev[sourceId] }
        }));
      }

      // Set active versions
      setActiveRealVersionId(newRealVersionId);
      setActiveBudgetVersionId(newBudgetVersionId);

      toast.success(`Versão ${options.name} replicada com sucesso!`);
      
      // Close modal
      setReplicateModalOpen(false);
      setReplicateTarget(null);

      // Navigate to dashboard
      setCurrentView('dashboard');
    } catch (err) {
      console.error('Replication Error:', err);
      toast.error('Erro ao replicar dados. Verifique a conexão.');
    }
  };

  const renderContent = () => {
    const isClosed = getIsMonthClosed(selectedDate.getFullYear(), selectedDate.getMonth() + 1);

    switch (currentView) {
      // --- REAL MODULE ---
      case 'real_home': return (
        <div className="p-8 max-w-7xl mx-auto w-full">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Gestão Forecast & GMD</h1>
            <p className="text-gray-500">Selecione uma versão de realizado para trabalhar.</p>
          </div>
          <TimelineView
            title="Planejamentos (Realizado)"
            versions={realVersions}
            activeVersionId={activeRealVersionId}
            onSelectVersion={(id) => {
              setActiveRealVersionId(id);
              setCurrentView('dashboard');
            }}
            onToggleLock={async (id) => {
              const version = realVersions.find(v => v.id === id);
              if (!version) return;
              const updated = { ...version, isLocked: !version.isLocked };
              setRealVersions(prev => prev.map(bv => bv.id === id ? updated : bv));
              try { await supabaseService.upsertBudgetVersion(updated); } catch(e) { console.error(e); }
            }}
            onCreateVersion={onCreateVersion}
            onReplicateVersion={(year, month) => {
              setReplicateTarget({ year, month });
              setReplicateMode('REAL');
              setReplicateModalOpen(true);
            }}
            showCreateOption={true}
            hotels={hotels}
            onSetMain={async (id) => {
              const newVersions = realVersions.map(v => ({ ...v, isMain: v.id === id }));
              setRealVersions(newVersions);
              try {
                // Persist all changes (since isMain changed for potentially two versions)
                for (const v of newVersions) {
                    await supabaseService.upsertBudgetVersion(v);
                }
              } catch(e) { console.error(e); }
            }}
            onDelete={async (id) => {
              try {
                const deletedVersion = realVersions.find(v => v.id === id);
                await supabaseService.deleteFinancialDataByVersion(id);
                await supabaseService.deleteBudgetVersion(id);
                setRealVersions(prev => prev.filter(v => v.id !== id));
                if (activeRealVersionId === id) {
                  setActiveRealVersionId(realVersions.find(v => v.id !== id)?.id || '');
                }

                // Paired Budget deletion
                if (deletedVersion) {
                  const pairedBudget = budgetVersions.find(v =>
                    v.name === deletedVersion.name &&
                    v.year === deletedVersion.year &&
                    v.hotelId === deletedVersion.hotelId
                  );
                  if (pairedBudget) {
                    try {
                      await supabaseService.deleteFinancialDataByVersion(pairedBudget.id);
                      await supabaseService.deleteBudgetVersion(pairedBudget.id);
                      setBudgetVersions(prev => prev.filter(v => v.id !== pairedBudget.id));
                      if (activeBudgetVersionId === pairedBudget.id) {
                        setActiveBudgetVersionId(budgetVersions.find(v => v.id !== pairedBudget.id)?.id || '');
                      }
                    } catch (pairErr) {
                      console.warn('Could not delete paired Budget version:', pairErr);
                    }
                  }
                }
                toast.success('Versões excluídas com sucesso!');
              } catch (e) {
                console.error('Failed to delete version from Supabase', e);
                toast.error('Erro ao excluir versão.');
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
        <div className="max-w-[98%] mx-auto px-4 py-6">
          <div className="bg-white rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-gray-100 p-2">
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
          </div>
        </div>
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
          currentUser={currentUser}
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
          costCenters={costCenters}
          selectedMonth={selectedDate.getMonth() + 1}
          selectedYear={selectedDate.getFullYear()}
          initialSelectedHotel={selectedHotel}
          currentUser={currentUser}
        />
      );
      case 'validations': return (
        <ValidationsView
            validations={validations}
            hotels={hotels}
            currentUser={currentUser}
        />
      );
      // Admin > Tauá Real
      case 'admin_real_versions':
      case 'admin_real_closure':
      case 'admin_real_import':
      case 'admin_real_schedule':
      case 'admin_real_dre':
      // Admin > Tauá Geral
      case 'admin_geral_accounts':
      case 'admin_geral_hotels':
      case 'admin_geral_costcenters':
      case 'admin_geral_users':
      case 'admin_geral_logs':
      case 'admin_geral_gmd':
      case 'admin_geral_permissions':
      case 'admin_geral_import':
      // Legacy
      case 'admin_geral':
      case 'admin_real':
      case 'admin_users':
      case 'admin_hotels':
      case 'admin_gmd':
      case 'admin':
        if (currentUser.role !== UserRole.ADMIN) {
          return (
            <div className="p-8 text-center text-red-500 font-bold bg-white rounded-2xl border border-red-200 max-w-xl mx-auto shadow-sm mt-12">
              Acesso negado. Apenas perfis Administradores possuem acesso à área administrativa.
            </div>
          );
        }
        return (
          <UnifiedAdministrationView
            currentView={currentView}
            users={users}
            setUsers={setUsers}
            hotels={hotels} setHotels={setHotels}
            costCenters={costCenters} setCostCenters={setCostCenters}
            packages={packages} setPackages={setPackages}
            accounts={accounts} setAccounts={setAccounts}
            gmdConfigs={gmdConfigs} setGmdConfigs={setGmdConfigs}
            setCurrentView={setCurrentView}
            onToggleMonthClosure={handleToggleMonthClosure}
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
            dreConfigs={dreConfigs}
            setDreConfigs={setDreConfigs}
            hotelCategories={hotelCategories}
            setHotelCategories={setHotelCategories}
            hotelRegions={hotelRegions}
            setHotelRegions={setHotelRegions}
          />
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

      <div className={`flex-1 ${sidebarCollapsed ? 'ml-20' : 'ml-[280px]'} flex flex-col h-screen overflow-hidden transition-all duration-300`}>
        <Header
          sidebarCollapsed={sidebarCollapsed}
          setSidebarCollapsed={setSidebarCollapsed}
          hotels={hotels}
          selectedHotel={selectedHotel}
          setSelectedHotel={setSelectedHotel}
          selectedHotelType={selectedHotelType}
          setSelectedHotelType={setSelectedHotelType}
          selectedHotelCategory={selectedHotelCategory}
          setSelectedHotelCategory={setSelectedHotelCategory}
          selectedHotelRegion={selectedHotelRegion}
          setSelectedHotelRegion={setSelectedHotelRegion}
          hotelCategories={hotelCategories}
          hotelRegions={hotelRegions}
          currentModule={currentModule}
          handleMonthChange={handleMonthChange}
          formattedDate={formattedDate}
          currentUser={{
            ...currentUser,
            name: session.user.email?.split('@')[0] || currentUser.name,
            email: session.user.email || currentUser.email
          }}
          onLogout={handleLogout}
          currentView={currentView}
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
