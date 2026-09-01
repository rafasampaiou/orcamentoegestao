
import React, { useState, useRef } from 'react';
import Sidebar from './components/Sidebar';
import TimelineView from './components/TimelineView';

import ForecastTable, { buildForecastRows } from './components/ForecastTable';
import { normalizeHotelName } from './services/mockData';
import GMDView from './components/GMDView';
import OccupancyView from './components/OccupancyView';
import OccupancyMonthlyRealView from './components/OccupancyMonthlyRealView';
import ComparativesView from './components/ComparativesView';
import DreSegmentadaView from './components/DreSegmentadaView';
import AnaliseABView from './components/AnaliseABView';
import BudgetLaborView from './components/BudgetLaborView';
import BudgetExtraRevView from './components/BudgetExtraRevView';
import BudgetDREView from './components/BudgetDREView';
import UnifiedAdministrationView from './components/UnifiedAdministrationView';
import ReplicateBudgetModal, { ReplicationOptions } from './components/ReplicateBudgetModal';
import ErrorBoundary from './components/ErrorBoundary';
import Header from './components/Header';
import Auth from './components/Auth';
import DefinePasswordView from './components/DefinePasswordView';
import LoadingScreen from './components/LoadingScreen';
import ValidationsView from './components/ValidationsView';
import BudgetReviewHome from './components/BudgetReviewHome';
import BudgetReviewOccupancy from './components/BudgetReviewOccupancy';
import BudgetReviewDRE from './components/BudgetReviewDRE';
import BudgetReviewComparatives from './components/BudgetReviewComparatives';
import { supabase } from './services/supabaseClient';
import { supabaseService } from './services/supabaseService';
import { Session } from '@supabase/supabase-js';
import { ViewState, ImportedRow, User, Hotel, HotelCategory, HotelRegion, CostCenter, CostPackage, Account, GMDConfiguration, ModuleType, UserRole, BudgetVersion, LaborParameters, ScheduleItem, ProjectionType, ValidationRecord, DreSection, KpiCalculation, hasRole, hasPermission, PermissionMatrix, Meeting } from './types';
import { DEFAULT_PERMISSIONS_MATRIX, mergePermissionsMatrix } from './utils/permissionsCatalog';
import { resolveMeetingKind, getMeetingLabel, LEGACY_MEETING_VALUES } from './utils/meetings';
import { SLIDES_CAPTURE_TARGETS } from './utils/slidesCaptureTargets';
import { captureSlideTarget, getPngBlobSize } from './utils/captureElement';
import { resolveKpiTerm, parseSelfRatioDenominator } from './utils/kpiEngine';
import {
    ensureGoogleAccessToken, ensureDriveFolder, copyTemplatePresentation, uploadImageAndGetPublicUrl,
    getPresentationStructure, addContentSlideFromMold, deleteSlide, fillCoverPlaceholders,
} from './services/googleSlidesService';
import { Calendar, ArrowLeft, ArrowRight, Building2 as Building2Icon, Layers } from 'lucide-react';
import { mockUsers, mockHotels, mockCostCenters, mockPackages, mockAccounts, mockGMDConfigs } from './services/mockData';
import { Toaster, toast } from 'react-hot-toast';

// Reads OccupancyView's `${hotel}_${year}_${month}_${versionId}__${projectionType}` in-memory
// keys and rebuilds the `__projections` snapshot to merge back into a real BudgetVersion's
// `occupancy_data` JSONB on save. Always rebuilt from the FULL realOccupancyData map — never
// only when a projection version happens to be the one currently selected on screen — so a
// plain Realizado edit/save never clobbers previously saved reunião/Fechamento history.
// Sonda tanto os IDs de reunião dinâmicos (qualquer `Meeting` desse hotel+ano, de qualquer mês —
// cada um só vai ter dado de fato no mês a que pertence) quanto as 4 strings LEGADAS de antes
// desta migração (`LEGACY_MEETING_VALUES`) — sem isso, um save feito depois da migração
// reconstruiria o snapshot só com os IDs novos e perderia silenciosamente dado antigo ainda em
// memória.
function buildProjectionsSnapshot(
  realOccMap: Record<string, Record<string, number>>,
  hotel: string,
  year: number,
  versionId: string,
  meetings: Meeting[]
): Record<string, Record<string, (number | null)[]>> {
  const projections: Record<string, Record<string, (number | null)[]>> = {};
  const probeValues = [
    ...meetings.filter(m => m.hotelId === hotel && m.year === year).map(m => m.id),
    ...LEGACY_MEETING_VALUES,
  ];
  probeValues.forEach(pt => {
    const rowsForType: Record<string, (number | null)[]> = {};
    let hasAny = false;
    for (let i = 0; i < 12; i++) {
      const key = `${hotel}_${year}_${i + 1}_${versionId}__${pt}`;
      const monthData = realOccMap[key] || {};
      Object.keys(monthData).forEach(rowId => {
        // O preenchimento tem que ser null, não 0 — um mês nunca tocado (null) é diferente de um
        // mês resetado/digitado como 0 de propósito. Com 0 aqui, um campo com dado real em
        // qualquer outro mês fazia esse mês "voltar" como zero explícito ao recarregar (em vez de
        // sumir de vez), reintroduzindo depois de um reset o mesmo valor que deveria ter zerado —
        // já que "0 salvo" e "nunca preenchido" bloqueiam do mesmo jeito o fallback pra Meta.
        if (!rowsForType[rowId]) rowsForType[rowId] = Array(12).fill(null);
        rowsForType[rowId][i] = monthData[rowId];
        hasAny = true;
      });
    }
    if (hasAny) projections[pt] = rowsForType;
  });
  return projections;
}

// OTB (On the books) — mesma ideia de buildProjectionsSnapshot, mas lendo a chave com o sufixo
// extra "__OTB". Antes desta migração só Reunião de Ritmo/FCA N1/FCA N2 tinham OTB (Fechamento
// oficial não tinha) — agora TODA reunião criada tem o fluxo completo de OTB (decisão do usuário),
// então sonda qualquer `Meeting` do hotel+ano, sem exceção de kind, junto das 3 strings legadas
// que já tinham OTB antes. Guardado num campo IRMÃO (__otbProjections), não aninhado dentro de
// __projections, pra não quebrar o formato Record<rowId, number[12]> que já existe lá.
function buildOtbProjectionsSnapshot(
  realOccMap: Record<string, Record<string, number>>,
  hotel: string,
  year: number,
  versionId: string,
  meetings: Meeting[]
): Record<string, Record<string, (number | null)[]>> {
  const projections: Record<string, Record<string, (number | null)[]>> = {};
  const probeValues = [
    ...meetings.filter(m => m.hotelId === hotel && m.year === year).map(m => m.id),
    'Reunião de Ritmo', 'FCA N1', 'FCA N2', // legado — Fechamento oficial nunca teve OTB
  ];
  probeValues.forEach(pt => {
    const rowsForType: Record<string, (number | null)[]> = {};
    let hasAny = false;
    for (let i = 0; i < 12; i++) {
      const key = `${hotel}_${year}_${i + 1}_${versionId}__${pt}__OTB`;
      const monthData = realOccMap[key] || {};
      Object.keys(monthData).forEach(rowId => {
        // O preenchimento tem que ser null, não 0 — um mês nunca tocado (null) é diferente de um
        // mês resetado/digitado como 0 de propósito. Com 0 aqui, um campo com dado real em
        // qualquer outro mês fazia esse mês "voltar" como zero explícito ao recarregar (em vez de
        // sumir de vez), reintroduzindo depois de um reset o mesmo valor que deveria ter zerado —
        // já que "0 salvo" e "nunca preenchido" bloqueiam do mesmo jeito o fallback pra Meta.
        if (!rowsForType[rowId]) rowsForType[rowId] = Array(12).fill(null);
        rowsForType[rowId][i] = monthData[rowId];
        hasAny = true;
      });
    }
    if (hasAny) projections[pt] = rowsForType;
  });
  return projections;
}

const App: React.FC = () => {
  const [currentModule, setCurrentModule] = useState<ModuleType>('REAL');
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  // "Gerar Apresentação" (Google Slides, botão na DRE Forecast) — ver handleGenerateSlides.
  const [isGeneratingSlides, setIsGeneratingSlides] = useState(false);
  const [slideGenProgress, setSlideGenProgress] = useState<{ label: string; percent: number } | null>(null);
  const [selectedHotel, setSelectedHotel] = useState('Atibaia');
  const [selectedHotelType, setSelectedHotelType] = useState<string>('Todos');
  const [selectedHotelCategory, setSelectedHotelCategory] = useState<string>('Todas');
  const [selectedHotelRegion, setSelectedHotelRegion] = useState<string>('Todas');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  // Set when the user arrives via the "Enviar e-mail de redefinição" link — Supabase fires a
  // distinct PASSWORD_RECOVERY event for that flow, which we intercept to show
  // DefinePasswordView instead of dropping them straight into the app with a bare session.
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  React.useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthChecking(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
      }
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

  // --- REVISÃO DE METAS (Budget) STATE ---
  // Qual BudgetVersion está sendo revisada agora (a original escolhida, ou a réplica criada pra
  // revisão) — só Budget, nunca cria/afeta uma Versão Real em paralelo (Real/Prévia continuam
  // ligados ao activeRealVersionId de sempre, iguais nas duas, de propósito).
  const [budgetReviewVersionId, setBudgetReviewVersionId] = useState<string>('');
  const [budgetReviewMonths, setBudgetReviewMonths] = useState<number[]>([]);
  // Versão de onde "Calcular Forecast" lê os KPIs — a "última meta importada no sistema que foi
  // pra DRE Forecast", sempre ao vivo (nunca um snapshot congelado): se usar a versão original
  // diretamente, é ela mesma; se criar réplica, é a ORIGINAL que foi replicada.
  const [budgetReviewSourceVersionId, setBudgetReviewSourceVersionId] = useState<string>('');

  // --- PROJECTION TYPE STATE ---
  // Sem valor fixo de fábrica — as "reuniões" agora são criadas dinamicamente (ver `meetings`
  // abaixo), então não existe mais um "Reunião de Ritmo" que já exista de saída. Fica vazio até
  // o usuário escolher uma reunião existente ou criar uma nova (ForecastTable abre o popup de
  // criação sozinho quando não há nenhuma reunião pro hotel/mês/ano selecionado).
  const [activeProjectionType, setActiveProjectionType] = useState<ProjectionType>('');
  // Incrementado sempre que uma navegação (ex.: "Ir para Forecast" em Validações) escolhe a
  // Versão do Forecast de propósito ao mesmo tempo que troca hotel/mês — avisa o ForecastTable
  // pra não sobrescrever essa escolha com o auto-select de "última versão do mês".
  const [versionNavToken, setVersionNavToken] = useState(0);
  const [validations, setValidations] = useState<ValidationRecord[]>([]);
  // Reuniões dinâmicas da "Versão do Forecast" (substituem a lista fixa de 5 nomes) — carregadas
  // 1x no boot, junto de `validations`.
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  // Sinalizado pelo wizard "Iniciar Projeção" (OTB) na DRE Forecast — semeia o modo "On the
  // books" já ligado ao chegar na Ocupação, mesmo mecanismo de activeProjectionType semeando
  // `period` lá.
  const [otbNavSignal, setOtbNavSignal] = useState(false);
  // Mês que estava ativo na DRE Forecast no momento de "Iniciar Projeção" — semeia o filtro de
  // meses da aba Ocupação, já mostrando só o mês em questão em vez dos 12.
  const [occupancyNavMonth, setOccupancyNavMonth] = useState<number | null>(null);
  // Sinalizado pelo "Iniciar Fechamento" (Realizado) — pede pra Administração → Importação já
  // abrir direto na sub-aba de Despesas.
  const [importNavSignal, setImportNavSignal] = useState<'expenses' | undefined>(undefined);

  // --- REAL VERSIONING STATE ---
  const [realVersions, setRealVersions] = useState<BudgetVersion[]>([]);
  const [activeRealVersionId, setActiveRealVersionId] = useState<string>('');



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

  const [realOccupancyData, setRealOccupancyData] = useState<Record<string, Record<string, number>>>({});
  const realOccupancyDataRef = useRef(realOccupancyData);
  React.useEffect(() => { realOccupancyDataRef.current = realOccupancyData; }, [realOccupancyData]);

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
        supabaseService.upsertBudgetVersion(versionToSave).catch(console.error);
      }
    }, 2000); // 2 seconds debounce
    return () => clearTimeout(timeout);
  }, [budgetOccupancyDataMap, globalLaborDataMap, extraRevenueDataMap, activeBudgetVersionId, budgetVersions]);

  // Auto-Save da versão em Revisão de Metas — mesmo padrão do efeito acima, só que pra
  // `budgetReviewVersionId` em vez de `activeBudgetVersionId` (podem ser versões diferentes: a
  // Revisão de Metas edita uma versão que não precisa ser a "principal" ativa do hotel).
  React.useEffect(() => {
    if (isInitialMount.current || !budgetReviewVersionId) return;
    const timeout = setTimeout(() => {
      const version = budgetVersions.find(v => v.id === budgetReviewVersionId);
      if (version) {
        const versionToSave = {
          ...version,
          occupancyData: budgetOccupancyDataMapRef.current[budgetReviewVersionId] || {},
        };
        supabaseService.upsertBudgetVersion(versionToSave).catch(console.error);
      }
    }, 2000);
    return () => clearTimeout(timeout);
  }, [budgetOccupancyDataMap, budgetReviewVersionId, budgetVersions]);

  // Central Auto-Save Effect for Real Occupancy
  React.useEffect(() => {
    if (isInitialMount.current) return;
    if (!activeRealVersionId) return;

    const timeout = setTimeout(() => {
      const version = realVersions.find(v => v.id === activeRealVersionId);
      if (version && version.id.startsWith('r')) {
        const baseBudgetData = budgetOccupancyDataMapRef.current[activeBudgetVersionId] || {};
        const occupancyDataToSave: Record<string, number[]> = {};

        Object.keys(baseBudgetData).forEach(key => {
          occupancyDataToSave[key] = [...baseBudgetData[key]];
        });

        let hasData = false;
        for (let i = 0; i < 12; i++) {
          const contextKey = `${selectedHotel}_${selectedDate.getFullYear()}_${i + 1}_${activeRealVersionId}`;
          const monthData = realOccupancyDataRef.current[contextKey] || {};
          
          Object.keys(monthData).forEach(key => {
            if (key.endsWith('_forecast')) {
              const baseKey = key.replace('_forecast', '');
              if (!occupancyDataToSave[baseKey]) {
                occupancyDataToSave[baseKey] = Array(12).fill(0);
              }
              occupancyDataToSave[baseKey][i] = monthData[key];
              hasData = true;
            }
          });

          const contextKeyLY = `${selectedHotel}_${selectedDate.getFullYear() - 1}_${i + 1}_${activeRealVersionId}`;
          const monthDataLY = realOccupancyDataRef.current[contextKeyLY] || {};

          Object.keys(monthDataLY).forEach(key => {
            if (key.endsWith('_forecast')) {
              const baseKey = key.replace('_forecast', '') + '_LY';
              if (!occupancyDataToSave[baseKey]) {
                occupancyDataToSave[baseKey] = Array(12).fill(0);
              }
              occupancyDataToSave[baseKey][i] = monthDataLY[key];
              hasData = true;
            }
          });
        }

        // Sempre reconstrói __projections a partir do mapa completo — independente de qual
        // Versão do Forecast está selecionada na tela agora — para nunca apagar o histórico de
        // Reunião de Ritmo/FCA N1/FCA N2/Fechamento com um autosave disparado por uma edição comum.
        const projections = buildProjectionsSnapshot(realOccupancyDataRef.current, selectedHotel, selectedDate.getFullYear(), activeRealVersionId, meetings);
        const otbProjections = buildOtbProjectionsSnapshot(realOccupancyDataRef.current, selectedHotel, selectedDate.getFullYear(), activeRealVersionId, meetings);
        const finalOccupancyData: any = { ...occupancyDataToSave, __projections: projections, __otbProjections: otbProjections };

        if (hasData || Object.keys(occupancyDataToSave).length > 0 || Object.keys(projections).length > 0) {
          supabaseService.upsertBudgetVersion({ ...version, occupancyData: finalOccupancyData }).catch(console.error);
        }
      }
    }, 2000);
    return () => clearTimeout(timeout);
  }, [realOccupancyData, activeRealVersionId, selectedHotel, selectedDate, realVersions, activeBudgetVersionId, meetings]);

  // --- REGISTRY STATE (LIFTED FROM SETTINGS) ---
  // This ensures data persists when switching tabs
  const [users, setUsers] = useState<User[]>([]);
  // Tracks whether the profiles fetch has completed at least once, so the "no matching
  // profile" gate below doesn't false-positive on a valid user while `users` is still loading.
  const [profilesLoaded, setProfilesLoaded] = useState(false);

  // Matriz de Permissões — nasce já com o catálogo default (= comportamento atual do `hasRole`
  // hardcoded que está sendo substituído), nunca fica vazia; o boot acima sobrescreve com o que
  // estiver salvo no Supabase, se houver. Como toda tela só renderiza depois de `profilesLoaded`,
  // nenhum componente vê essa matriz antes dela estar populada.
  const [permissionsMatrix, setPermissionsMatrix] = useState<PermissionMatrix>(DEFAULT_PERMISSIONS_MATRIX);

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

  // Log de auditoria (Administração > Usuários > Logs) — só o App.tsx tem `currentUser` e
  // `selectedHotel` juntos ao mesmo tempo, então o helper mora aqui e é passado como prop pras
  // telas que precisam registrar uma ação (ForecastTable, GMDView, OccupancyView,
  // OccupancyMonthlyRealView, UnifiedAdministrationView). Fire-and-forget de propósito: uma falha
  // ao gravar o log (ex. tabela `user_logs` ainda não criada) nunca deve travar a ação real.
  const logUserAction = React.useCallback((action: string) => {
    supabaseService.saveUserLog({
      userId: currentUser.id,
      userName: currentUser.name,
      userUnit: selectedHotel || '',
      action,
    }).catch(err => console.error('Falha ao gravar log de auditoria', err));
  }, [currentUser, selectedHotel]);

  const [hotels, setHotels] = useState<Hotel[]>([]);

  // The automatic useEffects that synced selectedHotel based on activeRealVersionId 
  // and activeBudgetVersionId have been removed to prevent infinite loops when multiple versions exist.
  // Synchronization is now handled explicitly in the UI handlers (onCreateVersion, onSelectVersion).
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [packages, setPackages] = useState<CostPackage[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [gmdConfigs, setGmdConfigs] = useState<GMDConfiguration[]>([]);
  const [dreConfigs, setDreConfigs] = useState<Record<string, DreSection[]>>({});
  const [packageKpiConfigs, setPackageKpiConfigs] = useState<Record<string, KpiCalculation>>({});
  const [hotelCategories, setHotelCategories] = useState<HotelCategory[]>([]);
  const [hotelRegions, setHotelRegions] = useState<HotelRegion[]>([]);

  React.useEffect(() => {
    const userHotelIds = currentUser?.hotelIds && currentUser.hotelIds.length > 0
      ? currentUser.hotelIds
      : (currentUser?.hotelId ? [currentUser.hotelId] : []);
    if (hotels.length === 0 || !currentUser || userHotelIds.length === 0) return;

    const isRestricted = !hasRole(currentUser, UserRole.ADMIN) &&
                         !hasRole(currentUser, UserRole.DIRETORIA) &&
                         !hasRole(currentUser, UserRole.PACKAGE_MANAGER);

    if (isRestricted) {
      const userHotels = userHotelIds
        .map(id => hotels.find(h => h.id === id || h.code === id))
        .filter((h): h is Hotel => !!h);
      // Só força a troca quando o hotel selecionado não é nenhum dos atribuídos ao usuário —
      // com várias unidades, ele pode escolher entre elas livremente (ver Header.tsx).
      if (userHotels.length > 0 && !userHotels.some(h => h.name === selectedHotel)) {
        setSelectedHotel(userHotels[0].name);
      }
    }
  }, [currentUser, hotels, selectedHotel]);

  React.useEffect(() => {
    // We want to update the active budget and real versions whenever the hotel changes
    if (budgetVersions.length === 0 || hotels.length === 0) return;

    const selectedHotelObj = hotels.find(h => h.name === selectedHotel);
    const hotelCode = selectedHotelObj?.code || selectedHotel;

    // --- BUDGET VERSION SYNC ---
    const currentActiveBudget = budgetVersions.find(v => v.id === activeBudgetVersionId);
    const isCurrentBudgetValid = currentActiveBudget && (currentActiveBudget.hotelId === hotelCode || currentActiveBudget.hotelId === selectedHotel || !currentActiveBudget.hotelId);

    if (!isCurrentBudgetValid || activeBudgetVersionId === '') {
      const matchingBudget =
        budgetVersions.find(v => (v.hotelId === hotelCode || v.hotelId === selectedHotel) && v.isMain) ||
        budgetVersions.find(v => v.hotelId === hotelCode || v.hotelId === selectedHotel) ||
        budgetVersions.find(v => !v.hotelId && v.isMain) ||
        budgetVersions.find(v => !v.hotelId);

      if (matchingBudget && matchingBudget.id !== activeBudgetVersionId) {
        setActiveBudgetVersionId(matchingBudget.id);
      } else if (!matchingBudget && activeBudgetVersionId) {
        setActiveBudgetVersionId('');
      }
    }

    // --- REAL VERSION SYNC ---
    if (realVersions.length > 0) {
      const currentActiveReal = realVersions.find(v => v.id === activeRealVersionId);
      const isCurrentRealValid = currentActiveReal && (currentActiveReal.hotelId === hotelCode || currentActiveReal.hotelId === selectedHotel || !currentActiveReal.hotelId);

      if (!isCurrentRealValid || activeRealVersionId === '') {
        const matchingReal =
          realVersions.find(v => (v.hotelId === hotelCode || v.hotelId === selectedHotel) && v.isMain) ||
          realVersions.find(v => v.hotelId === hotelCode || v.hotelId === selectedHotel) ||
          realVersions.find(v => !v.hotelId && v.isMain) ||
          realVersions.find(v => !v.hotelId);

        if (matchingReal && matchingReal.id !== activeRealVersionId) {
          setActiveRealVersionId(matchingReal.id);
        } else if (!matchingReal && activeRealVersionId) {
          setActiveRealVersionId('');
        }
      }
    }

  }, [selectedHotel, budgetVersions, realVersions, hotels, activeBudgetVersionId, activeRealVersionId, currentModule]);
  // -- SUPABASE INTEGRATION: Fetch Real Data on Auth --
  React.useEffect(() => {
    if (!session) return;

    let isMounted = true;

    const fetchRealData = async () => {
      if (hasLoadedFromSupabase.current) return; // Prevent multiple global fetches
      
      try {
        // All of these reads are independent of each other — fetching them concurrently
        // (instead of one round-trip at a time) cuts the startup wait from the sum of every
        // call's latency down to whichever single call is slowest.
        const fetchFinancialData = async () => {
          // Supabase/PostgREST caps rows per request (default 1000) regardless of .limit(),
          // so large tables must be paged with .range() to retrieve every row.
          const remoteFinancial: any[] = [];
          const pageSize = 1000;
          let from = 0;
          while (true) {
            const { data: page, error } = await (supabase as any)
              .from('financial_data')
              .select('*')
              .range(from, from + pageSize - 1);
            if (error) throw error;
            if (!page || page.length === 0) break;
            remoteFinancial.push(...page);
            if (page.length < pageSize) break;
            from += pageSize;
          }
          return remoteFinancial;
        };

        const [
          remoteHotels,
          remoteCostCenters,
          remoteAccounts,
          remoteProfiles,
          remoteGmd,
          remoteDreConfigs,
          remotePackageKpiConfigs,
          remoteValidations,
          remoteCategories,
          remoteRegions,
          remoteVersions,
          remoteFinancial,
          remotePermissions,
          remoteMeetings
        ] = await Promise.all([
          supabaseService.getHotels(),
          supabaseService.getCostCenters(),
          supabaseService.getAccounts(),
          supabaseService.getProfiles(),
          supabaseService.getGmdConfigs(),
          supabaseService.getDreConfigs(),
          supabaseService.getPackageKpiConfigs(),
          supabaseService.getValidations().catch(valError => {
            // Don't let a missing 'validations' table (e.g. before the migration has been
            // run) abort the rest of this startup fetch.
            console.warn('Could not fetch validations from Supabase.', valError);
            return null;
          }),
          supabaseService.getHotelCategories(),
          supabaseService.getHotelRegions(),
          supabaseService.getBudgetVersions(),
          fetchFinancialData().catch(finError => {
            console.warn('Could not fetch financial data from Supabase.', finError);
            return [] as any[];
          }),
          // Matriz de Permissões — mesmo padrão defensivo de validations/financial: uma falha
          // aqui não pode travar o boot do app inteiro, só cai pro catálogo default (que já é
          // uma foto do comportamento atual, então nada muda pra ninguém nesse caso).
          supabaseService.getPermissions().catch(permError => {
            console.warn('Could not fetch permissions from Supabase.', permError);
            return {} as PermissionMatrix;
          }),
          // Reuniões dinâmicas da "Versão do Forecast" — mesmo padrão defensivo: uma falha aqui
          // não pode travar o boot; sem nenhuma reunião carregada, o pior caso é o popup de
          // criação abrir de novo (nada é perdido, os dados legados continuam com fallback).
          supabaseService.getMeetings().catch(meetingsError => {
            console.warn('Could not fetch meetings from Supabase.', meetingsError);
            return [] as Meeting[];
          })
        ]);

        if (!isMounted) return;

        if (remoteHotels) setHotels(remoteHotels);
        if (remoteCostCenters) setCostCenters(remoteCostCenters);

        if (remoteAccounts) {
          setAccounts(remoteAccounts);
          // Auto-migration for factory account configurations
          if (!localStorage.getItem('accounts_migrated_v4')) {
            const merged = remoteAccounts.map(rAcc => {
              const mAcc = mockAccounts.find(m => m.name === rAcc.name);
              if (mAcc) {
                return { ...rAcc, expenseType: mAcc.expenseType, expenseDriver: mAcc.expenseDriver };
              }
              return rAcc;
            });
            supabaseService.upsertAccounts(merged).then(() => {
              setAccounts(merged);
              localStorage.setItem('accounts_migrated_v4', 'true');
              console.log('Migrated accounts successfully to factory defaults.');
            }).catch(console.error);
          }
        }

        if (remoteProfiles) setUsers(remoteProfiles);
        if (remoteGmd) setGmdConfigs(remoteGmd);

        if (remoteDreConfigs) {
          const configRecord: Record<string, DreSection[]> = {};
          remoteDreConfigs.forEach(cfg => {
            configRecord[cfg.name] = cfg.structure;
          });
          setDreConfigs(configRecord);
        }

        if (remotePackageKpiConfigs) setPackageKpiConfigs(remotePackageKpiConfigs);
        if (remoteValidations) setValidations(remoteValidations);
        if (remoteMeetings) setMeetings(remoteMeetings);
        if (remoteCategories) setHotelCategories(remoteCategories);
        if (remoteRegions) setHotelRegions(remoteRegions);
        setPermissionsMatrix(mergePermissionsMatrix(DEFAULT_PERMISSIONS_MATRIX, remotePermissions || {}));

        hasLoadedFromSupabase.current = true;

        if (remoteVersions && remoteVersions.length > 0) {
          setBudgetVersions(remoteVersions.filter(v => v.id.startsWith('v')));
          setRealVersions(remoteVersions.filter(v => v.id.startsWith('r')));

          const newOccMap: Record<string, Record<string, number[]>> = {};
          const newLaborMap: Record<string, Record<string, any>> = {};
          const newExtraMap: Record<string, any[]> = {};
          const newRealOccMap: Record<string, Record<string, number>> = {};

          remoteVersions.forEach(v => {
            if (v.id.startsWith('v')) {
              if (v.occupancyData) newOccMap[v.id] = v.occupancyData;
              if (v.laborData) newLaborMap[v.id] = v.laborData;
              if (v.extraRevenueData) newExtraMap[v.id] = v.extraRevenueData;
            } else if (v.id.startsWith('r')) {
              if (v.occupancyData) {
                // Resolve hotel name from hotelId to match how the UI accesses it via selectedHotel (which stores the name)
                const hotelName = remoteHotels.find(h => h.code === v.hotelId || h.id === v.hotelId)?.name || v.hotelId;
                for (let i = 0; i < 12; i++) {
                  const contextKey = `${hotelName}_${v.year}_${i + 1}_${v.id}`;
                  const monthData: Record<string, number> = {};
                  const contextKeyLY = `${hotelName}_${v.year - 1}_${i + 1}_${v.id}`;
                  const monthDataLY: Record<string, number> = {};
                  Object.keys(v.occupancyData).forEach(rowId => {
                    if (rowId === '__projections' || rowId === '__otbProjections') return; // handled separately below, not a month-array row
                    if (rowId.endsWith('_LY')) {
                      const val = v.occupancyData![rowId][i];
                      if (val !== undefined && val !== null) {
                        const baseId = rowId.replace('_LY', '');
                        monthDataLY[`${baseId}_forecast`] = val;
                        monthDataLY[`${baseId}_previa`] = val;
                      }
                    } else {
                      const val = v.occupancyData![rowId][i];
                      if (val !== undefined && val !== null) {
                        monthData[`${rowId}_forecast`] = val;
                        monthData[`${rowId}_previa`] = val;
                      }
                    }
                  });
                  newRealOccMap[contextKey] = monthData;
                  newRealOccMap[contextKeyLY] = monthDataLY;
                }

                // Histórico por Versão do Forecast (Reunião de Ritmo/FCA N1/FCA N2/Fechamento),
                // guardado à parte em __projections — mesmo desempacotamento acima, mas com a
                // chave de contexto sufixada por projectionType em vez de _forecast/_previa.
                const projections = (v.occupancyData as any).__projections as Record<string, Record<string, number[]>> | undefined;
                if (projections) {
                  Object.keys(projections).forEach(projectionType => {
                    const rowsForType = projections[projectionType];
                    for (let i = 0; i < 12; i++) {
                      const key = `${hotelName}_${v.year}_${i + 1}_${v.id}__${projectionType}`;
                      const monthData: Record<string, number> = {};
                      Object.keys(rowsForType).forEach(rowId => {
                        const val = rowsForType[rowId][i];
                        if (val !== undefined && val !== null) monthData[rowId] = val;
                      });
                      newRealOccMap[key] = monthData;
                    }
                  });
                }

                // OTB (On the books) — mesmo desempacotamento, chave com sufixo extra "__OTB".
                const otbProjections = (v.occupancyData as any).__otbProjections as Record<string, Record<string, number[]>> | undefined;
                if (otbProjections) {
                  Object.keys(otbProjections).forEach(projectionType => {
                    const rowsForType = otbProjections[projectionType];
                    for (let i = 0; i < 12; i++) {
                      const key = `${hotelName}_${v.year}_${i + 1}_${v.id}__${projectionType}__OTB`;
                      const monthData: Record<string, number> = {};
                      Object.keys(rowsForType).forEach(rowId => {
                        const val = rowsForType[rowId][i];
                        if (val !== undefined && val !== null) monthData[rowId] = val;
                      });
                      newRealOccMap[key] = monthData;
                    }
                  });
                }
              }
            }
          });
          setBudgetOccupancyDataMap(newOccMap);
          setGlobalLaborDataMap(newLaborMap);
          setExtraRevenueDataMap(newExtraMap);
          setRealOccupancyData(newRealOccMap);

          const activeBudget = remoteVersions.find(v => v.isMain && v.id.startsWith('v'));
          const activeReal = remoteVersions.find(v => v.isMain && v.id.startsWith('r'));
          if (activeBudget) setActiveBudgetVersionId(activeBudget.id);
          if (activeReal) setActiveRealVersionId(activeReal.id);
        }

        if (remoteFinancial.length > 0) {
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
            importId: r.import_id || '',
            projectionType: r.projection_type || '',
            status: 'valid' as const,
          }));
          setImportedFinancialData(mapped);
        }
      } catch (error) {
        console.warn('Could not fetch real data from Supabase, falling back to mockData.', error);
      } finally {
        if (isMounted) setProfilesLoaded(true);
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

  const handleDeleteImport = (id: string) => {
    setImportedFinancialData(prevData => prevData.filter(row => row.importId !== id));
  };

  // "Resetar etapa" do balancete OTB (passo 3 do timeline de projeção) — remove os lançamentos
  // daquele contexto tanto do Supabase quanto do estado local, pra ficar como se nunca tivesse
  // sido importado.
  const handleDeleteOtbBalancete = async (hotel: string, year: number, month: number, versionId: string) => {
    try {
      await supabaseService.deleteFinancialDataByContext(hotel, year, month, versionId, 'OTB');
      setImportedFinancialData(prevData => prevData.filter(row =>
        !(row.hotel.trim().toUpperCase() === hotel.trim().toUpperCase() &&
          row.ano === String(year) && row.mes === String(month) &&
          (row.versionId || '') === versionId &&
          (row.cenario || '').trim().toUpperCase() === 'OTB')
      ));
    } catch (err) {
      console.error('Failed to reset balancete OTB:', err);
      toast.error('Erro ao resetar as despesas do balancete importado.');
    }
  };

  // "Resetar etapa" de Salvar projeção (passo 8) — desfaz a validação daquele contexto.
  const handleResetValidation = async (hotelId: string, year: number, month: number, projectionType: ProjectionType) => {
    try {
      await supabaseService.deleteValidationByContext(hotelId, year, month, projectionType);
      setValidations(prev => prev.filter(v =>
        !(v.hotelId === hotelId && v.year === year && v.month === month && v.projectionType === projectionType)
      ));
    } catch (err) {
      console.error('Failed to reset validation:', err);
      toast.error('Erro ao resetar a validação salva.');
    }
  };

  // Excluir uma reunião em Validações (botão novo, pedido do usuário) — apaga a reunião de
  // verdade e tudo que foi salvo sob ela (financial_data/overrides, validação, comentários,
  // apresentações), decisão confirmada com o usuário. Não usa o autosave genérico de ocupação
  // (esse só cobre o hotel/versão ATUALMENTE selecionado no menu principal) — repersiste
  // explicitamente a versão do hotel da própria validação, que pode ser outro.
  const handleDeleteMeeting = async (validation: ValidationRecord) => {
    const hotel = hotels.find(h => h.id === validation.hotelId || h.name === validation.hotelId || h.code === validation.hotelId);
    const hotelName = hotel?.name || validation.hotelId;
    const matchedVersion = realVersions.find(v =>
      v.year === validation.year && (v.hotelId === hotel?.id || v.hotelId === hotel?.code || v.hotel === hotel?.name)
    );
    const versionId = matchedVersion?.id || '';

    try {
      await supabaseService.deleteMeetingCascade({
        meetingId: validation.projectionType,
        hotelId: hotelName,
        year: validation.year,
        month: validation.month,
        versionId,
      });

      const remainingMeetings = meetings.filter(m => m.id !== validation.projectionType);
      setMeetings(remainingMeetings);
      setValidations(prev => prev.filter(v => v.id !== validation.id));

      const nextOccupancy = { ...realOccupancyData };
      for (let i = 1; i <= 12; i++) {
        delete nextOccupancy[`${hotelName}_${validation.year}_${i}_${versionId}__${validation.projectionType}`];
        delete nextOccupancy[`${hotelName}_${validation.year}_${i}_${versionId}__${validation.projectionType}__OTB`];
      }
      setRealOccupancyData(nextOccupancy);

      if (matchedVersion && versionId) {
        const projections = buildProjectionsSnapshot(nextOccupancy, hotelName, validation.year, versionId, remainingMeetings);
        const otbProjections = buildOtbProjectionsSnapshot(nextOccupancy, hotelName, validation.year, versionId, remainingMeetings);
        const finalOccupancyData: any = { ...(matchedVersion.occupancyData || {}), __projections: projections, __otbProjections: otbProjections };
        await supabaseService.upsertBudgetVersion({ ...matchedVersion, occupancyData: finalOccupancyData });
      }

      toast.success('Reunião excluída com sucesso.');
      logUserAction(`Excluiu a reunião "${validation.meetingLabel || validation.projectionType}" de ${hotelName} — ${validation.month}/${validation.year}`);
    } catch (err) {
      console.error('Failed to delete meeting:', err);
      toast.error('Erro ao excluir a reunião.');
    }
  };

  // Botão "Sincronizar importações" em Validações (ADMIN) — cobre o histórico já existente
  // de ANTES do auto-validar-Realizado-na-importação (ver handleSaveExpensesForecast em
  // UnifiedAdministrationView.tsx) ter sido ligado: varre financial_data por combinações
  // hotel+ano+mês com cenário 'REAL' (Despesas/Impostos/Receita importados como Realizado —
  // nunca 'Real', que é o Ano Anterior, nem override_* salvo pela própria DRE Forecast) e cria
  // a validação "Realizado" que estiver faltando. Idempotente — rodar de novo não duplica nada.
  const handleBackfillRealizadoValidations = async () => {
    const slug = (s: string) => (s || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const combos = new Map<string, { hotel: string; year: number; month: number }>();
    importedFinancialData.forEach(r => {
      if ((r.cenario || '') !== 'REAL') return;
      const hotel = (r.hotel || '').trim();
      const year = parseInt(r.ano, 10);
      const month = parseInt(r.mes, 10);
      if (!hotel || !year || !month) return;
      combos.set(`${hotel}|${year}|${month}`, { hotel, year, month });
    });

    let created = 0;
    try {
      for (const { hotel, year, month } of combos.values()) {
        const id = `val_${slug(hotel)}_${year}_${month}_realizado`;
        if (validations.some(v => v.id === id)) continue;
        const record: ValidationRecord = {
          id, hotelId: hotel, userId: currentUser?.id || '', userName: currentUser?.name || 'Sistema (sincronização)',
          month, year, projectionType: 'Realizado', meetingLabel: 'Realizado',
          validatedAt: new Date().toISOString(), status: 'Validado',
        };
        await supabaseService.saveValidation(record);
        setValidations(prev => [...prev.filter(v => v.id !== id), record]);
        created++;
      }
      toast.success(created > 0 ? `${created} validação(ões) "Realizado" criada(s) a partir de importações já existentes.` : 'Nada pra sincronizar — todas as importações já têm validação.');
      if (created > 0) logUserAction(`Sincronizou ${created} validação(ões) "Realizado" a partir de importações existentes`);
    } catch (err) {
      console.error('Failed to backfill Realizado validations:', err);
      toast.error('Erro ao sincronizar validações.');
    }
  };

  // Espera um elemento aparecer no DOM (usado depois de trocar de tela pra capturar outra seção)
  // — poll simples em vez de um delay fixo, já que telas mais pesadas (Análise de A&B) podem
  // demorar mais pra terminar de calcular/renderizar do que outras.
  const waitForElement = (elementId: string, timeoutMs = 6000): Promise<void> => {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const check = () => {
        if (document.getElementById(elementId)) { resolve(); return; }
        if (Date.now() - start > timeoutMs) { reject(new Error(`Elemento "${elementId}" não apareceu a tempo.`)); return; }
        setTimeout(check, 150);
      };
      check();
    });
  };

  // Espera qualquer indicador de "carregando" (marcado com data-slide-loading-indicator, ex.:
  // Análise de A&B) desaparecer do DOM antes de capturar — sem isso, uma tela que ainda está
  // buscando dados no Supabase podia ser capturada no meio do carregamento, com números zerados.
  const waitForNoLoadingIndicator = (timeoutMs = 8000): Promise<void> => {
    return new Promise(resolve => {
      const start = Date.now();
      const check = () => {
        if (!document.querySelector('[data-slide-loading-indicator]')) { resolve(); return; }
        if (Date.now() - start > timeoutMs) { resolve(); return; } // melhor capturar tarde que travar pra sempre
        setTimeout(check, 150);
      };
      check();
    });
  };

  // "Gerar Apresentação" (Google Slides) — botão na DRE Forecast, liberado só quando o Status da
  // prévia estiver 8/8 concluído (ver ForecastTable.tsx). Percorre SLIDES_CAPTURE_TARGETS,
  // trocando de tela quando necessário pra capturar cada seção exatamente como está na hora.
  const handleGenerateSlides = async () => {
    if (isGeneratingSlides) return;
    setIsGeneratingSlides(true);
    const originalView = currentView;
    const targets = SLIDES_CAPTURE_TARGETS;
    // Passos fixos (login, checagem de duplicidade, pastas do Drive, cópia do modelo, capa,
    // finalização) + 1 por slide de conteúdo — só pra render de uma barra de progresso com %,
    // não precisa ser exato, só dar uma noção real de andamento.
    const totalSteps = targets.length + 6;
    let stepsDone = 0;
    const setProgress = (label: string) => {
      stepsDone++;
      setSlideGenProgress({ label, percent: Math.min(100, Math.round((stepsDone / totalSteps) * 100)) });
    };
    setSlideGenProgress({ label: 'Conectando à sua conta Google...', percent: 0 });
    try {
      const token = await ensureGoogleAccessToken();
      const hotelName = selectedHotel;
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth() + 1;
      const projectionType = activeProjectionType;
      // Só pra EXIBIÇÃO (nome do arquivo, capa) — projectionType em si continua sendo o ID/chave
      // de armazenamento (comboId), nunca o label.
      const projectionLabel = getMeetingLabel(projectionType, meetings);
      const monthName = selectedDate.toLocaleString('pt-BR', { month: 'long' });

      const slug = (s: string) => (s || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const comboId = `slidedeck_${slug(hotelName)}_${year}_${month}_${slug(projectionType)}`;

      // Cada clique cria uma apresentação NOVA (V1, V2, V3...) — nunca substitui/apaga uma
      // anterior. A contagem é só pra numerar/rotular a nova, não decide nada.
      setProgress('Verificando versões existentes...');
      const previousVersions = await supabaseService.getSlidePresentations(hotelName, year, month, projectionType);
      const versionNumber = previousVersions.length + 1;
      const recordId = `${comboId}_v${versionNumber}_${Date.now()}`;

      setProgress('Preparando pastas no Google Drive...');
      const rootFolderId = await ensureDriveFolder(token, 'Apresentações Forecast');
      const hotelFolderId = await ensureDriveFolder(token, hotelName, rootFolderId);
      const yearFolderId = await ensureDriveFolder(token, String(year), hotelFolderId);

      setProgress('Copiando o modelo da apresentação...');
      const deckName = `Forecast - ${hotelName} - ${monthName} ${year} - ${projectionLabel} (V${versionNumber})`;
      const { id: presentationId, url } = await copyTemplatePresentation(token, deckName, yearFolderId);

      const structure = await getPresentationStructure(token, presentationId);
      if (structure.slideIds.length < 4) {
        throw new Error('O template precisa ter pelo menos 4 slides (capa, subcapa, molde de conteúdo, fechamento).');
      }
      const moldSlideId = structure.slideIds[2];

      setProgress('Preenchendo a capa...');
      // Nomes dos placeholders assumidos no template — ajuste aqui se forem diferentes.
      await fillCoverPlaceholders(token, presentationId, {
        '{{VERSAO}}': projectionLabel,
        '{{HOTEL_DATA}}': `${hotelName} — ${new Date().toLocaleDateString('pt-BR')}`,
      });

      for (let i = 0; i < targets.length; i++) {
        const target = targets[i];
        setProgress(`Capturando: ${target.title} (${i + 1}/${targets.length})`);
        // Sempre troca (mesmo repetindo a mesma tela do slide anterior) e sempre espera o elemento
        // + um instante de assentamento — depender de comparar com a tela atual pra decidir se
        // troca é arriscado aqui: essa comparação usa o valor de currentView "congelado" no exato
        // instante em que este clique começou (closure do React), que nunca muda dentro da mesma
        // execução mesmo depois de setCurrentView já ter trocado a tela de fato — então sempre
        // trocar/esperar é o jeito confiável de garantir que a captura reflete a tela certa.
        setCurrentView(target.view);
        const firstCapture = target.captures[0];
        const firstElementId = firstCapture.kind === 'element' ? firstCapture.elementId : firstCapture.containerId;
        await waitForElement(firstElementId);
        await waitForNoLoadingIndicator();
        await new Promise(r => setTimeout(r, 300)); // layout/gráficos terminarem de assentar
        const blob = await captureSlideTarget(target);
        const imageSize = await getPngBlobSize(blob);
        const imageUrl = await uploadImageAndGetPublicUrl(token, blob, `${target.id}.png`, yearFolderId);
        await addContentSlideFromMold(token, presentationId, moldSlideId, 2 + i, target.title, imageUrl, imageSize, structure.pageSize);
      }

      setProgress('Finalizando apresentação...');
      await deleteSlide(token, presentationId, moldSlideId);

      await supabaseService.upsertSlidePresentation({
        id: recordId, hotel: hotelName, year, month, projectionType,
        presentationId, presentationUrl: url, driveFolderId: yearFolderId,
        createdByUserId: currentUser?.id, createdByUserName: currentUser?.name,
      });
      setSlideGenProgress({ label: 'Concluído!', percent: 100 });

      setCurrentView(originalView);
      toast.success((t) => (
        <span>
          Apresentação V{versionNumber} gerada!{' '}
          <button onClick={() => { window.open(url, '_blank'); toast.dismiss(t.id); }} className="underline font-bold">Abrir</button>
        </span>
      ));
    } catch (err: any) {
      console.error('Erro ao gerar apresentação:', err);
      toast.error('Erro ao gerar apresentação: ' + (err?.message || String(err)));
      setCurrentView(originalView);
    } finally {
      setIsGeneratingSlides(false);
      setSlideGenProgress(null);
    }
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

  const handleSaveRealOccupancy = async () => {
    const version = realVersions.find(v => v.id === activeRealVersionId);
    if (!version) return;

    const baseBudgetData = budgetOccupancyDataMap[activeBudgetVersionId] || {};
    const occupancyDataToSave: Record<string, number[]> = {};

    // Copy budget layout/base data
    Object.keys(baseBudgetData).forEach(key => {
      occupancyDataToSave[key] = [...baseBudgetData[key]];
    });

    // Override with realOccupancyData values
    for (let i = 0; i < 12; i++) {
      const contextKey = `${selectedHotel}_${selectedDate.getFullYear()}_${i + 1}_${activeRealVersionId}`;
      const monthData = realOccupancyData[contextKey] || {};
      
      Object.keys(monthData).forEach(key => {
        if (key.endsWith('_forecast')) {
          const rowId = key.replace('_forecast', '');
          if (!occupancyDataToSave[rowId]) occupancyDataToSave[rowId] = Array(12).fill(0);
          occupancyDataToSave[rowId][i] = monthData[key];
        }
      });

      const contextKeyLY = `${selectedHotel}_${selectedDate.getFullYear() - 1}_${i + 1}_${activeRealVersionId}`;
      const monthDataLY = realOccupancyData[contextKeyLY] || {};

      Object.keys(monthDataLY).forEach(key => {
        if (key.endsWith('_forecast')) {
          const rowId = key.replace('_forecast', '') + '_LY';
          if (!occupancyDataToSave[rowId]) occupancyDataToSave[rowId] = Array(12).fill(0);
          occupancyDataToSave[rowId][i] = monthDataLY[key];
        }
      });
    }

    // Mesma regra do autosave debounced: reconstrói __projections do zero, sempre, a partir do
    // mapa completo — nunca só quando a versão ativa é uma das 4 — para o salvamento manual
    // também não apagar o histórico de outras Versões do Forecast.
    const projections = buildProjectionsSnapshot(realOccupancyData, selectedHotel, selectedDate.getFullYear(), activeRealVersionId, meetings);
    const otbProjections = buildOtbProjectionsSnapshot(realOccupancyData, selectedHotel, selectedDate.getFullYear(), activeRealVersionId, meetings);
    const finalOccupancyData: any = { ...occupancyDataToSave, __projections: projections, __otbProjections: otbProjections };

    const updatedVersion = {
      ...version,
      occupancyData: finalOccupancyData
    };

    try {
      await supabaseService.upsertBudgetVersion(updatedVersion);
      setRealVersions(prev => prev.map(v => v.id === version.id ? updatedVersion : v));
      logUserAction(`Salvou a Ocupação de ${selectedHotel} — ${version.name} (${selectedDate.getFullYear()})`);
    } catch (error) {
      console.error('Erro ao salvar ocupação real:', error);
    }
  };

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

      // 4. Sync the selected hotel explicitly
      const hotelName = hotels.find(h => h.code === hotelId || h.id === hotelId)?.name;
      if (hotelName) {
        setSelectedHotel(hotelName);
      }

      toast.success(`Versões ${name} criadas com sucesso!`);
      logUserAction(`Criou a versão "${name}" (${year})${hotelName ? ` — ${hotelName}` : ''}`);
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
      logUserAction(`Replicou a versão "${options.name}" (${replicateTarget.year})`);

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

  // Revisão de Metas — réplica SÓ do lado Budget (ocupação + financial_data cenário Meta), sem
  // criar/mexer em nenhuma versão Real em paralelo (diferente de handleReplicateBudget acima, que
  // sempre cria o par Real+Budget). Mesmo ano/mês da origem — não desloca período nenhum, é uma
  // cópia pra revisar em paralelo à mesma versão original.
  const handleCreateBudgetReviewReplica = async (sourceVersionId: string): Promise<string | null> => {
    const source = budgetVersions.find(v => v.id === sourceVersionId);
    if (!source) return null;

    const timestamp = Date.now();
    const newId = `v-review-${timestamp}`;
    const newVersion: BudgetVersion = {
      id: newId,
      name: `${source.name} (Revisão)`,
      year: source.year,
      month: source.month,
      isMain: false,
      isLocked: false,
      hotelId: source.hotelId,
      occupancyData: source.occupancyData || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      await supabaseService.upsertBudgetVersion(newVersion);

      const sourceFinancialData = await supabaseService.getFinancialDataByVersion(sourceVersionId);
      const sourceMetaRows = sourceFinancialData.filter(r => (r.cenario || '').trim().toLowerCase() === 'meta');
      const newRows: ImportedRow[] = sourceMetaRows.map(row => ({ ...row, versionId: newId }));
      if (newRows.length > 0) {
        await supabaseService.saveFinancialData(newRows);
      }

      setBudgetVersions(prev => [...prev, newVersion]);
      setBudgetOccupancyDataMap(prev => ({ ...prev, [newId]: newVersion.occupancyData! }));
      if (newRows.length > 0) setImportedFinancialData(prev => [...prev, ...newRows]);

      logUserAction(`Criou réplica "${newVersion.name}" pra Revisão de Metas, a partir de "${source.name}" (${source.year})`);
      return newId;
    } catch (err) {
      console.error('Budget review replication error:', err);
      toast.error('Erro ao criar a réplica pra revisão. Verifique a conexão.');
      return null;
    }
  };

  // Único caso, em toda a Revisão de Metas, de uma conta com KPI escrever fora de financial_data —
  // mesmo mapa usado em ForecastTable.tsx (handleKpiValueChange) pras 2 linhas de Receita Extra,
  // que não têm Meta própria em financial_data (vem de budgetOccupancyDataMap).
  const BUDGET_REVIEW_REVENUE_EXTRA_SOURCE: Record<string, string> = {
    'REV-EXTRA-LAZER': 'lazer_extra_rev',
    'REV-EXTRA-EVENTOS': 'event_extra_rev',
  };

  // Reescreve, no Supabase e no state local, só as contas de um mês que MUDARAM (`changesByMonth`),
  // preservando as demais contas daquele mês/versão — precisa ser feito como
  // "apaga o mês inteiro + reinsere tudo" porque saveFinancialData só faz insert puro (sem
  // upsert), mas o "tudo" inclui as contas NÃO tocadas (lidas do state atual), não só as novas.
  const persistBudgetReviewMonthChanges = async (
    hotel: string, year: number, versionId: string, changesByMonth: Record<number, ImportedRow[]>,
    // contas pra remover SEM gravar substituto nenhum (ex.: override_<pacoteId> obsoleto de uma
    // versão antiga do cálculo, que fazia a Revisão de Metas gravar um valor fixo por pacote em
    // vez de deixar o pacote somar as contas — precisa sumir, não só parar de ser recriado).
    extraContasToDelete: Record<number, string[]> = {}
  ) => {
    const months = Array.from(new Set([...Object.keys(changesByMonth).map(Number), ...Object.keys(extraContasToDelete).map(Number)]));
    if (months.length === 0) return;

    for (const month of months) {
      const newRowsForMonth = changesByMonth[month] || [];
      const touchedContas = new Set([...newRowsForMonth.map(r => r.conta), ...(extraContasToDelete[month] || [])]);
      const keptRowsForMonth = importedFinancialData.filter(r =>
        r.hotel === hotel && r.versionId === versionId && (r.cenario || '').trim().toLowerCase() === 'meta' &&
        parseInt(r.ano) === year && parseInt(r.mes) === month && !touchedContas.has(r.conta)
      );
      const finalSet = [...keptRowsForMonth, ...newRowsForMonth];
      await supabaseService.deleteFinancialDataByContext(hotel, year, month, versionId, 'Meta');
      if (finalSet.length > 0) await supabaseService.saveFinancialData(finalSet);
    }

    setImportedFinancialData(prev => {
      const touched = new Set<string>();
      months.forEach(m => {
        (changesByMonth[m] || []).forEach(r => touched.add(`${m}|${r.conta}`));
        (extraContasToDelete[m] || []).forEach(conta => touched.add(`${m}|${conta}`));
      });
      const kept = prev.filter(r => {
        if (!(r.hotel === hotel && r.versionId === versionId && (r.cenario || '').trim().toLowerCase() === 'meta' && parseInt(r.ano) === year && months.includes(parseInt(r.mes)))) return true;
        return !touched.has(`${parseInt(r.mes)}|${r.conta}`);
      });
      const allNew = months.flatMap(m => changesByMonth[m] || []);
      return [...kept, ...allNew];
    });
  };

  // Resolve de qual BudgetVersion a Revisão de Metas deve puxar os KPIs de despesa "importados
  // anteriormente" — usado tanto por "Calcular Forecast" quanto pela própria tela (que já mostra
  // esse KPI de cara, antes de qualquer clique, ver BudgetReviewDRE). "A última meta que foi
  // construída do respectivo ano/unidade" = a OUTRA BudgetVersion mais recentemente atualizada
  // pra esse mesmo hotel+ano (excluindo a própria versão em revisão) — não depende de isMain nem
  // de activeBudgetVersionId (nenhum dos dois se mostrou confiável pra isso). Independe de ser
  // "versão original" ou "réplica": a réplica sempre é mais nova que a original, então já fica
  // automaticamente excluída como candidata, sobrando a original de verdade.
  // Ao criar uma versão pela tela "Versões", o Real e o Budget nascem em par, com o MESMO sufixo
  // de timestamp ("r-<ts>" e "v-<ts>") — ver UnifiedAdministrationView.tsx. Achamos despesa de
  // Meta de João Pessoa/2026 gravada sob "r-<ts>" (o par Real) em vez de "v-<ts>" (o Budget de
  // verdade), provavelmente por causa de um `activeBudgetVersionId` variando entre a tela de
  // Importação e a de Versões nesse período. Sem essa checagem, "Revisão de Metas" nunca acha
  // essa despesa (mesmo já incluindo linha sem versionId), porque ela TEM versionId — só que é
  // o do par errado.
  const pairedVersionId = (id: string): string | null => {
    if (id.startsWith('v-')) return 'r-' + id.slice(2);
    if (id.startsWith('r-')) return 'v-' + id.slice(2);
    return null;
  };

  const resolveBudgetReviewMainVersion = (reviewVersion: BudgetVersion): BudgetVersion | null => {
    const hotel = hotels.find(h => h.code === reviewVersion.hotelId || h.id === reviewVersion.hotelId)?.name || reviewVersion.hotel || selectedHotel;
    const normReviewHotel = normalizeHotelName(hotel);
    // Casa o hotel de qualquer um dos 3 jeitos possíveis (hotelId direto, campo legado `.hotel`,
    // ou resolvendo o nome de cada candidata pela lista de hotéis) — ano é preferência, não
    // obrigatório, pra não ficar de mãos vazias por uma inconsistência de dado num dos dois lados.
    // Exclui QUALQUER réplica de Revisão de Metas (nome termina em "(Revisão)") — não só a desta
    // sessão. Sessões de teste anteriores deixam réplicas "órfãs" pra trás (nunca são apagadas
    // sozinhas), e uma dessas podia ser mais recente que a versão de verdade importada via
    // Administração, ganhando errado na ordenação por "mais recente".
    const candidates = budgetVersions.filter(v => {
      if (v.id === reviewVersion.id) return false;
      if (v.name.trim().endsWith('(Revisão)')) return false;
      const vHotelName = hotels.find(h => h.code === v.hotelId || h.id === v.hotelId)?.name || v.hotel || '';
      return v.hotelId === reviewVersion.hotelId || normalizeHotelName(v.hotel || '') === normReviewHotel || normalizeHotelName(vHotelName) === normReviewHotel;
    });
    if (candidates.length === 0) return reviewVersion; // não achou nenhuma outra — só existe ela mesma

    // "Mais recentemente atualizada" sozinho não basta: pode existir mais de uma BudgetVersion
    // pro mesmo hotel/ano (ex.: uma criada vazia antes da importação de verdade acontecer), e a
    // vazia pode ter updatedAt mais novo. Prioriza quem realmente TEM despesa de Meta importada
    // — só cai pra "mais recente sem checar dado" se nenhuma candidata tiver despesa nenhuma.
    // Conta linha SEM versionId como pertencente a qualquer candidata do hotel/ano certo — boa
    // parte da despesa de Meta foi importada ANTES do recurso de múltiplas versões existir (ou
    // sem escolher uma versão-alvo no import), então fica sem versionId no financial_data e só
    // aparece na DRE Forecast pelo mecanismo "sem versionId = vale pra qualquer versão ativa"
    // (getDynamicForecastData/getForecastData); exigir `r.versionId === v.id` aqui simplesmente
    // nunca achava esse tipo de linha.
    const hasDespesaImportada = (v: BudgetVersion) => {
      const vHotelName = hotels.find(h => h.code === v.hotelId || h.id === v.hotelId)?.name || v.hotel || '';
      const normVHotel = normalizeHotelName(vHotelName);
      const vPairedId = pairedVersionId(v.id);
      return importedFinancialData.some(r =>
        (r.versionId === v.id || (vPairedId && r.versionId === vPairedId) || !r.versionId) && (r.cenario || '').trim().toLowerCase() === 'meta' &&
        (r.tipo || '').trim().toLowerCase() === 'despesa' && !(r.conta || '').toLowerCase().startsWith('override_') &&
        parseInt(r.ano) === v.year && normalizeHotelName(r.hotel) === normVHotel
      );
    };
    const withData = candidates.filter(hasDespesaImportada);
    const pool = withData.length > 0 ? withData : candidates;
    if (withData.length === 0) {
      // Log como STRING (JSON.stringify) de propósito — um console.warn com objeto/array cru
      // aparece "colapsado" (só "Object"/"Array") no console do navegador até clicar pra abrir;
      // como string já vem legível pra copiar e colar direto.
      console.warn('[Revisão de Metas] Nenhuma candidata tem despesa — candidatas encontradas: ' + JSON.stringify(candidates.map(v => ({
        id: v.id, name: v.name, year: v.year, hotelId: v.hotelId, hotel: v.hotel, updatedAt: v.updatedAt || v.createdAt
      }))));
    }

    pool.sort((a, b) => {
      const aYear = a.year === reviewVersion.year ? 1 : 0;
      const bYear = b.year === reviewVersion.year ? 1 : 0;
      if (aYear !== bYear) return bYear - aYear;
      return (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt);
    });
    return pool[0];
  };

  // "Calcular Forecast" da Revisão de Metas (etapa 5) — mesmo motor de linhas/KPI da DRE Forecast
  // (buildForecastRows + resolveKpiTerm/parseSelfRatioDenominator), não uma versão simplificada:
  // pra cada linha com KPI (conta Variável, pacote, Impostos, GOP, ou Receita Extra/ISS
  // precomputado), pega a taxa (valor ÷ denominador) da versão resolvida acima (lida AO VIVO,
  // nunca um snapshot congelado) e persiste como override — a tela já mostrava esse mesmo valor
  // projetado antes de clicar; isso só torna oficial (grava no Supabase).
  const handleCalcularBudgetReviewForecast = async () => {
    if (!budgetReviewVersionId || budgetReviewMonths.length === 0) return;
    const version = budgetVersions.find(v => v.id === budgetReviewVersionId);
    if (!version) return;
    const hotel = hotels.find(h => h.code === version.hotelId || h.id === version.hotelId)?.name || version.hotel || selectedHotel;
    const year = version.year;

    const mainSourceVersion = resolveBudgetReviewMainVersion(version);
    if (!mainSourceVersion) {
      toast.error('Não encontrei a versão de Meta desse hotel pra pegar os KPIs. Verifique em Versões.');
      return;
    }
    const sourceHotel = hotels.find(h => h.code === mainSourceVersion.hotelId || h.id === mainSourceVersion.hotelId)?.name || mainSourceVersion.hotel || hotel;
    const normHotel = normalizeHotelName(hotel);
    const normSourceHotel = normalizeHotelName(sourceHotel);
    // Inclui linhas SEM versionId (despesa de Meta importada antes do recurso de versões existir,
    // ou sem escolher versão-alvo no import) — mesma regra de "sem versionId vale pra qualquer
    // versão ativa" que getDynamicForecastData/getForecastData já aplicam pra montar a DRE
    // Forecast normal. Exigir versionId igual deixava essas despesas (a maioria, na prática)
    // completamente invisíveis aqui. A sem-versionId só entra se for do mesmo hotel/ano.
    const scopedFinancialData = importedFinancialData.filter(r =>
      r.versionId === budgetReviewVersionId || (!r.versionId && parseInt(r.ano) === year && normalizeHotelName(r.hotel) === normHotel)
    );
    const mainSourcePairedId = pairedVersionId(mainSourceVersion.id);
    const scopedSourceData = importedFinancialData.filter(r =>
      r.versionId === mainSourceVersion.id || (mainSourcePairedId && r.versionId === mainSourcePairedId) ||
      (!r.versionId && parseInt(r.ano) === mainSourceVersion.year && normalizeHotelName(r.hotel) === normSourceHotel)
    );
    const sourceOccupancyData = budgetOccupancyDataMap[mainSourceVersion.id] || {};
    if (scopedSourceData.length === 0) {
      console.warn(`[Revisão de Metas] Nenhum financial_data encontrado pra versão-fonte id="${mainSourceVersion.id}" name="${mainSourceVersion.name}" year=${mainSourceVersion.year} sourceHotel="${sourceHotel}" normSourceHotel="${normSourceHotel}"`);
      // Diagnóstico: lista toda combinação (hotel/ano/cenario/tipo/versionId) de despesa que bate
      // pelo nome do hotel (ignorando maiúscula/acento), pra achar sob qual versionId/grafia a
      // despesa de verdade está, já que nem por versionId nem por "sem versionId" achamos nada.
      const sameHotelDespesaRows = importedFinancialData.filter(r => normalizeHotelName(r.hotel) === normSourceHotel && (r.tipo || '').trim().toLowerCase() === 'despesa');
      const combos = new Map<string, number>();
      sameHotelDespesaRows.forEach(r => {
        const key = `hotel="${r.hotel}" ano=${r.ano} cenario="${r.cenario}" versionId="${r.versionId || '(vazio)'}"`;
        combos.set(key, (combos.get(key) || 0) + 1);
      });
      console.warn('[Revisão de Metas] Diagnóstico — despesas encontradas pra esse hotel (qualquer ano/cenário/versão): ' + JSON.stringify(Object.fromEntries(combos)));
    }

    try {
      const changesByMonth: Record<number, ImportedRow[]> = {};
      const occupancyUpdates: Record<string, number> = {}; // `${sourceId}_${monthIdx}` -> valor
      // Pacote é sempre a SOMA das contas dele nesta tela (nunca um valor próprio calculado por
      // KPI de pacote) — "o valor total de Custos e Despesas Operacionais é a soma de cada
      // pacote". Um clique anterior (de antes dos fixes de versão-fonte) pode ter deixado
      // override_<pacoteId> gravado com um valor errado (geralmente 0, calculado com a
      // versão-fonte vazia de antes) — isso trava o pacote nesse valor fixo pra sempre (o guard
      // isManualBudgetOverride impede a soma normal de sobrescrever), então limpamos aqui.
      const staleOverridesToDelete: Record<number, string[]> = {};

      // Passa o id "par" (Real/Budget nascem juntos com o mesmo sufixo, ver pairedVersionId acima)
      // como activeRealVersionId — buildForecastRows aceita QUALQUER um dos dois (matchesBudget OU
      // matchesReal) pra deixar a linha passar no filtro por versão, então isso cobre a despesa que
      // foi gravada sob o id errado do par sem precisar remapear nada linha por linha.
      const reviewVersionPairedId = pairedVersionId(budgetReviewVersionId);
      budgetReviewMonths.forEach(month => {
        const baselineRows = buildForecastRows(dreConfigs, month, mainSourceVersion.year, scopedSourceData, sourceHotel, hotels, {}, mainSourcePairedId || undefined, mainSourceVersion.id, accounts, packages, sourceOccupancyData, undefined, []);
        const currentRows = buildForecastRows(dreConfigs, month, year, scopedFinancialData, hotel, hotels, {}, reviewVersionPairedId || undefined, budgetReviewVersionId, accounts, packages, budgetOccupancyDataMap[budgetReviewVersionId] || {}, undefined, []);
        const monthChanges: ImportedRow[] = [];
        const monthDeletions: string[] = [];

        baselineRows.forEach(baseRow => {
          if (baseRow.isHeader && baseRow.indentLevel === 0) return; // cabeçalho de seção, nunca tem KPI
          if (baseRow.category === 'Package') {
            // Nunca escreve override de pacote aqui — o pacote precisa continuar somando as
            // contas normalmente. Se um clique antigo deixou um override_<pacoteId> preso, marca
            // pra deletar (sem substituto).
            monthDeletions.push(`override_${baseRow.id}`);
            return;
          }
          const calc = baseRow.rowConfig?.kpiCalculation;
          const precomputedKpi = baseRow.rowConfig?.precomputedKpi;
          const currentRow = currentRows.find(r => r.id === baseRow.id);
          if (!currentRow) return;

          if (calc) {
            const selfDenom = parseSelfRatioDenominator(calc.formula, baseRow.label);
            if (!selfDenom) return;
            const baseDenom = resolveKpiTerm(selfDenom, baselineRows, 'budget');
            if (!baseDenom) return;
            const rate = baseRow.budget / baseDenom;
            const currentDenom = resolveKpiTerm(selfDenom, currentRows, 'budget');
            const newValue = rate * currentDenom;
            monthChanges.push({
              ano: String(year), cenario: 'Meta', tipo: 'Despesa', hotel, conta: `override_${baseRow.id}`,
              cr: '', mes: String(month), valor: newValue.toFixed(2), status: 'valid', versionId: budgetReviewVersionId,
            });
          } else if (precomputedKpi?.denominator) {
            const sourceId = BUDGET_REVIEW_REVENUE_EXTRA_SOURCE[baseRow.id];
            const baseDenom = precomputedKpi.denominator.budget;
            if (!sourceId || !baseDenom) return;
            const rate = baseRow.budget / baseDenom;
            const currentDenom = currentRow.rowConfig?.precomputedKpi?.denominator?.budget || 0;
            occupancyUpdates[`${sourceId}_${month - 1}`] = rate * currentDenom;
          }
        });

        if (monthChanges.length > 0) changesByMonth[month] = monthChanges;
        if (monthDeletions.length > 0) staleOverridesToDelete[month] = monthDeletions;
      });

      await persistBudgetReviewMonthChanges(hotel, year, budgetReviewVersionId, changesByMonth, staleOverridesToDelete);

      if (Object.keys(occupancyUpdates).length > 0) {
        setBudgetOccupancyDataMap(prev => {
          const current = { ...(prev[budgetReviewVersionId] || {}) };
          Object.entries(occupancyUpdates).forEach(([key, value]) => {
            const lastSep = key.lastIndexOf('_');
            const sourceId = key.slice(0, lastSep);
            const monthIdx = parseInt(key.slice(lastSep + 1));
            const arr = [...(current[sourceId] || Array(12).fill(0))];
            arr[monthIdx] = value;
            current[sourceId] = arr;
          });
          return { ...prev, [budgetReviewVersionId]: current };
        });
      }

      const totalChanges = Object.values(changesByMonth).reduce((s, arr) => s + arr.length, 0);
      if (totalChanges === 0 && Object.keys(occupancyUpdates).length === 0) {
        toast.error(`Nenhuma conta com KPI encontrada em "${mainSourceVersion.name}" pra projetar. Confira se essa versão tem despesas de Meta importadas.`);
      } else {
        toast.success(`Despesas projetadas (${totalChanges} conta(s)/mês) a partir dos KPIs de "${mainSourceVersion.name}".`);
      }
      logUserAction(`Calculou o Forecast da Revisão de Metas "${version.name}" (${year})`);
    } catch (err) {
      console.error('Budget review Calcular Forecast error:', err);
      toast.error('Erro ao projetar as despesas. Verifique a conexão.');
    }
  };

  // Edição manual de valor/KPI na DRE da Revisão de Metas — BudgetReviewDRE resolve o back-solve
  // do KPI (usa a mesma resolveKpiTerm/parseSelfRatioDenominator) e só manda pra cá o valor final
  // já calculado por (linha, mês); aqui só falta persistir como override_<rowId>, igual
  // "Salvar Projeção" já faz na DRE Forecast normal.
  const handleSaveBudgetReviewEdits = async (edits: { rowId: string; month: number; value: number }[]) => {
    if (!budgetReviewVersionId || edits.length === 0) return;
    const version = budgetVersions.find(v => v.id === budgetReviewVersionId);
    if (!version) return;
    const hotel = hotels.find(h => h.code === version.hotelId || h.id === version.hotelId)?.name || version.hotel || selectedHotel;

    const changesByMonth: Record<number, ImportedRow[]> = {};
    edits.forEach(({ rowId, month, value }) => {
      if (!changesByMonth[month]) changesByMonth[month] = [];
      changesByMonth[month].push({
        ano: String(version.year), cenario: 'Meta', tipo: 'Despesa', hotel, conta: `override_${rowId}`,
        cr: '', mes: String(month), valor: value.toFixed(2), status: 'valid', versionId: budgetReviewVersionId,
      });
    });

    try {
      await persistBudgetReviewMonthChanges(hotel, version.year, budgetReviewVersionId, changesByMonth);
      toast.success('Alterações da Revisão de Metas salvas.');
      logUserAction(`Editou valores/KPI da Revisão de Metas "${version.name}" (${version.year})`);
    } catch (err) {
      console.error('Budget review save edits error:', err);
      toast.error('Erro ao salvar as alterações. Verifique a conexão.');
    }
  };

  const renderContent = () => {
    // Whether the month is "closed" is now controlled entirely by which Forecast version is
    // selected — selecting a reunião do tipo "Fechamento" é o que marca o mês como fechado.
    const isClosed = resolveMeetingKind(activeProjectionType, meetings) === 'Fechamento';
    const activeRealVersionName = realVersions.find(v => v.id === activeRealVersionId)?.name;

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
              const version = realVersions.find(v => v.id === id);
              if (version) {
                const hotelName = hotels.find(h => h.code === version.hotelId || h.id === version.hotelId)?.name;
                if (hotelName) setSelectedHotel(hotelName);
              }
            }}
            onToggleLock={async (id) => {
              const version = realVersions.find(v => v.id === id);
              if (!version) return;
              const updated = { ...version, isLocked: !version.isLocked };
              setRealVersions(prev => prev.map(bv => bv.id === id ? updated : bv));
              try {
                await supabaseService.upsertBudgetVersion(updated);
                logUserAction(`${updated.isLocked ? 'Bloqueou' : 'Desbloqueou'} a versão "${version.name}" (${version.year})`);
              } catch(e) { console.error(e); }
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
                const mainVersion = newVersions.find(v => v.id === id);
                if (mainVersion) logUserAction(`Tornou "${mainVersion.name}" (${mainVersion.year}) a versão principal`);
              } catch(e) { console.error(e); }
            }}
            onDelete={async (id) => {
              try {
                const deletedVersion = realVersions.find(v => v.id === id);
                await supabaseService.deleteFinancialDataByVersion(id);
                await supabaseService.deleteBudgetVersion(id);
                setRealVersions(prev => prev.filter(v => v.id !== id));
                if (deletedVersion) logUserAction(`Excluiu a versão "${deletedVersion.name}" (${deletedVersion.year})`);
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
        <div className="max-w-[98%] mx-auto px-4 py-6 min-h-[calc(100vh-5rem)]">
          <div className="bg-white rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-gray-100 p-2 flex flex-col">
            <ForecastTable
              selectedMonth={selectedDate.getMonth() + 1}
              selectedYear={selectedDate.getFullYear()}
              financialData={importedFinancialData}
              selectedHotel={selectedHotel}
              accounts={accounts}
              packages={packages}
              packageKpiConfigs={packageKpiConfigs}
              hotels={hotels}
              isMonthClosed={isClosed}
              realOccupancyData={realOccupancyData}
              setRealOccupancyData={setRealOccupancyData}
              budgetOccupancyData={budgetOccupancyDataMap[activeBudgetVersionId] || {}}
              activeRealVersionId={activeRealVersionId}
              activeRealVersionName={activeRealVersionName}
              activeBudgetVersionId={activeBudgetVersionId}
              realVersions={realVersions}
              budgetVersions={budgetVersions}
              budgetOccupancyDataMap={budgetOccupancyDataMap}
              setBudgetOccupancyDataMap={setBudgetOccupancyDataMap}
              activeProjectionType={activeProjectionType}
              setActiveProjectionType={setActiveProjectionType}
              versionNavToken={versionNavToken}
              meetings={meetings}
              setMeetings={setMeetings}
              validations={validations}
              setValidations={setValidations}
              currentUser={currentUser}
              permissionsMatrix={permissionsMatrix}
              onLogAction={logUserAction}
              onNavigateToOccupancy={(otbMode) => { setOtbNavSignal(!!otbMode); setOccupancyNavMonth(selectedDate.getMonth() + 1); setCurrentView('occupancy_monthly'); }}
              onNavigateToImportacao={(tab) => { setImportNavSignal(tab); setCurrentView('admin_geral_import'); }}
              onImportData={handleImportData}
              onDeleteOtbBalancete={handleDeleteOtbBalancete}
              onResetValidation={handleResetValidation}
              onGenerateSlides={handleGenerateSlides}
              isGeneratingSlides={isGeneratingSlides}
            />
          </div>
        </div>
      );
      case 'budget_review_home': return (
        <BudgetReviewHome
          hotels={hotels}
          selectedHotel={selectedHotel}
          setSelectedHotel={setSelectedHotel}
          budgetVersions={budgetVersions}
          onCreateReplica={handleCreateBudgetReviewReplica}
          onStartReview={(versionId, months, sourceVersionId) => {
            setBudgetReviewVersionId(versionId);
            setBudgetReviewMonths(months);
            setBudgetReviewSourceVersionId(sourceVersionId);
            setCurrentView('budget_review_occupancy');
          }}
        />
      );
      case 'budget_review_occupancy': {
        const reviewVersion = budgetVersions.find(v => v.id === budgetReviewVersionId);
        if (!reviewVersion) {
          // Não chama setCurrentView aqui dentro (é durante o render) — só avisa e deixa o
          // botão "Voltar" levar de volta ao wizard, pra escolher a versão de novo.
          return (
            <div className="p-8 text-center text-gray-500">
              Nenhuma versão em revisão selecionada.
              <button onClick={() => setCurrentView('budget_review_home')} className="block mx-auto mt-3 text-[#F8981C] font-bold hover:underline">
                ← Voltar pra Revisão de Metas
              </button>
            </div>
          );
        }
        return (
          <BudgetReviewOccupancy
            version={reviewVersion}
            reviewMonths={budgetReviewMonths}
            budgetOccupancyDataMap={budgetOccupancyDataMap}
            setBudgetOccupancyDataMap={setBudgetOccupancyDataMap}
            currentUser={currentUser}
            permissionsMatrix={permissionsMatrix}
            onBack={() => setCurrentView('budget_review_home')}
            onGoToDRE={() => setCurrentView('budget_review_dre')}
          />
        );
      }
      case 'budget_review_dre': {
        const reviewVersion = budgetVersions.find(v => v.id === budgetReviewVersionId);
        if (!reviewVersion) {
          return (
            <div className="p-8 text-center text-gray-500">
              Nenhuma versão em revisão selecionada.
              <button onClick={() => setCurrentView('budget_review_home')} className="block mx-auto mt-3 text-[#F8981C] font-bold hover:underline">
                ← Voltar pra Revisão de Metas
              </button>
            </div>
          );
        }
        const mainSourceVersionForDisplay = resolveBudgetReviewMainVersion(reviewVersion);
        return (
          <BudgetReviewDRE
            version={reviewVersion}
            mainSourceVersionId={mainSourceVersionForDisplay?.id || ''}
            budgetVersions={budgetVersions}
            reviewMonths={budgetReviewMonths}
            accounts={accounts}
            packages={packages}
            packageKpiConfigs={packageKpiConfigs}
            hotels={hotels}
            dreConfigs={dreConfigs}
            financialData={importedFinancialData}
            budgetOccupancyDataMap={budgetOccupancyDataMap}
            setBudgetOccupancyDataMap={setBudgetOccupancyDataMap}
            currentUser={currentUser}
            permissionsMatrix={permissionsMatrix}
            onBack={() => setCurrentView('budget_review_occupancy')}
            onGoToOccupancy={() => setCurrentView('budget_review_occupancy')}
            onGoToComparatives={() => setCurrentView('budget_review_comparatives')}
            onCalcularForecast={handleCalcularBudgetReviewForecast}
            onSaveEdits={handleSaveBudgetReviewEdits}
          />
        );
      }
      case 'budget_review_comparatives': {
        const reviewVersion = budgetVersions.find(v => v.id === budgetReviewVersionId);
        if (!reviewVersion) {
          return (
            <div className="p-8 text-center text-gray-500">
              Nenhuma versão em revisão selecionada.
              <button onClick={() => setCurrentView('budget_review_home')} className="block mx-auto mt-3 text-[#F8981C] font-bold hover:underline">
                ← Voltar pra Revisão de Metas
              </button>
            </div>
          );
        }
        return (
          <BudgetReviewComparatives
            hotels={hotels}
            budgetVersions={budgetVersions}
            accounts={accounts}
            financialData={importedFinancialData}
            budgetOccupancyDataMap={budgetOccupancyDataMap}
            realOccupancyData={realOccupancyData}
            activeRealVersionId={activeRealVersionId}
            initialNewVersionId={budgetReviewVersionId}
            initialMonths={budgetReviewMonths}
            onBack={() => setCurrentView('budget_review_dre')}
          />
        );
      }
      case 'dre_segmentada': return (
        <DreSegmentadaView
          selectedMonth={selectedDate.getMonth() + 1}
          selectedYear={selectedDate.getFullYear()}
          financialData={importedFinancialData}
          selectedHotel={selectedHotel}
          accounts={accounts}
          packages={packages}
          hotels={hotels}
          realOccupancyData={realOccupancyData}
          activeRealVersionId={activeRealVersionId}
          activeBudgetVersionId={activeBudgetVersionId}
          budgetOccupancyData={budgetOccupancyDataMap[activeBudgetVersionId] || {}}
        />
      );
      case 'ab_analysis': return (
        <AnaliseABView
          selectedMonth={selectedDate.getMonth() + 1}
          selectedYear={selectedDate.getFullYear()}
          financialData={importedFinancialData}
          selectedHotel={selectedHotel}
          accounts={accounts}
          packages={packages}
          hotels={hotels}
          realOccupancyData={realOccupancyData}
          activeRealVersionId={activeRealVersionId}
          activeRealVersionName={activeRealVersionName}
          activeBudgetVersionId={activeBudgetVersionId}
          budgetOccupancyData={budgetOccupancyDataMap[activeBudgetVersionId] || {}}
          activeProjectionType={activeProjectionType}
          setActiveProjectionType={setActiveProjectionType}
          meetings={meetings}
          currentUser={currentUser}
          permissionsMatrix={permissionsMatrix}
        />
      );
      case 'occupancy_real': return (
        <OccupancyView
          isBudget={false}
          selectedMonth={selectedDate.getMonth() + 1}
          selectedYear={selectedDate.getFullYear()}
          selectedHotel={selectedHotel}
          hotels={hotels}
          budgetVersions={budgetVersions}
          budgetOccupancyDataMap={budgetOccupancyDataMap}
          realVersions={realVersions}
          budgetData={budgetOccupancyDataMap[activeBudgetVersionId] || {}}
          realOccupancyData={realOccupancyData}
          setRealOccupancyData={setRealOccupancyData}
          onSaveOccupancy={handleSaveRealOccupancy}
          financialData={importedFinancialData}
          activeProjectionType={activeProjectionType}
          setActiveProjectionType={setActiveProjectionType}
          activeRealVersionId={activeRealVersionId}
          activeRealVersionName={activeRealVersionName}
          currentUser={currentUser}
          permissionsMatrix={permissionsMatrix}
          onLogAction={logUserAction}
        />
      );
      case 'occupancy_monthly': return (
        <OccupancyMonthlyRealView
          selectedYear={selectedDate.getFullYear()}
          selectedHotel={selectedHotel}
          hotels={hotels}
          realOccupancyData={realOccupancyData}
          setRealOccupancyData={setRealOccupancyData}
          onSaveOccupancy={handleSaveRealOccupancy}
          budgetData={budgetOccupancyDataMap[activeBudgetVersionId] || {}}
          setBudgetOccupancyDataMap={setBudgetOccupancyDataMap}
          activeBudgetVersionId={activeBudgetVersionId}
          activeRealVersionId={activeRealVersionId}
          activeRealVersionName={activeRealVersionName}
          currentUser={currentUser}
          permissionsMatrix={permissionsMatrix}
          activeProjectionType={activeProjectionType}
          setActiveProjectionType={setActiveProjectionType}
          meetings={meetings}
          initialOtbMode={otbNavSignal}
          initialSelectedMonth={occupancyNavMonth || undefined}
          financialData={importedFinancialData}
          validations={validations}
          onNavigateToForecast={() => setCurrentView('dashboard')}
          onLogAction={logUserAction}
        />
      );
      case 'comparatives': return (
        <ComparativesView
          selectedMonth={selectedDate.getMonth() + 1}
          selectedYear={selectedDate.getFullYear()}
          financialData={importedFinancialData}
          accounts={accounts}
          packages={packages}
          hotels={hotels}
          realOccupancyData={realOccupancyData}
          activeRealVersionId={activeRealVersionId}
          activeBudgetVersionId={activeBudgetVersionId}
          budgetOccupancyData={budgetOccupancyDataMap[activeBudgetVersionId] || {}}
          validations={validations}
          realVersions={realVersions}
          budgetVersions={budgetVersions}
          budgetOccupancyDataMap={budgetOccupancyDataMap}
        />
      );
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
          activeRealVersionName={activeRealVersionName}
          activeRealVersionId={activeRealVersionId}
          activeProjectionType={activeProjectionType}
          setActiveProjectionType={setActiveProjectionType}
          meetings={meetings}
          currentUser={currentUser}
          permissionsMatrix={permissionsMatrix}
          onLogAction={logUserAction}
        />
      );
      case 'validations': return (
        <ValidationsView
            validations={validations}
            hotels={hotels}
            currentUser={currentUser}
            permissionsMatrix={permissionsMatrix}
            onDeleteMeeting={handleDeleteMeeting}
            onBackfillRealizado={handleBackfillRealizadoValidations}
            onNavigateToValidation={(validation) => {
              const hotel = hotels.find(h => h.id === validation.hotelId || h.name === validation.hotelId || h.code === validation.hotelId);
              const matchedVersion = realVersions.find(v =>
                v.year === validation.year && (v.hotelId === hotel?.id || v.hotelId === hotel?.code || v.hotel === hotel?.name)
              );
              if (hotel) setSelectedHotel(hotel.name);
              setSelectedDate(new Date(validation.year, validation.month - 1));
              if (matchedVersion) setActiveRealVersionId(matchedVersion.id);
              setActiveProjectionType(validation.projectionType);
              // Sinaliza pro ForecastTable que a versão foi escolhida de propósito por essa
              // navegação — sem isso, o auto-select de "última versão do mês" (que dispara ao
              // trocar hotel/mês) sobrescreveria pra outra reunião/Realizado, perdendo o destino.
              setVersionNavToken(t => t + 1);
              setCurrentView('dashboard');
            }}
        />
      );
      // Admin > Tauá Real
      case 'admin_real_versions':
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
        if (!hasPermission(permissionsMatrix, currentUser, 'Administração — Acesso', 'Acessar Área de Administração')) {
          return (
            <div className="p-8 text-center text-red-500 font-bold bg-white rounded-2xl border border-red-200 max-w-xl mx-auto shadow-sm mt-12">
              Acesso negado. Apenas perfis Administradores possuem acesso à área administrativa.
            </div>
          );
        }
        return (
          <UnifiedAdministrationView
            currentView={currentView}
            currentUser={currentUser}
            permissionsMatrix={permissionsMatrix}
            initialImportTab={importNavSignal}
            onValidationSaved={(record) => setValidations(prev => [...prev.filter(v => v.id !== record.id), record])}
            onPermissionsChange={setPermissionsMatrix}
            users={users}
            setUsers={setUsers}
            hotels={hotels} setHotels={setHotels}
            costCenters={costCenters} setCostCenters={setCostCenters}
            packages={packages} setPackages={setPackages}
            accounts={accounts} setAccounts={setAccounts}
            gmdConfigs={gmdConfigs} setGmdConfigs={setGmdConfigs}
            setCurrentView={setCurrentView}
            onImportData={handleImportData}
            onDeleteImport={handleDeleteImport}
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
            packageKpiConfigs={packageKpiConfigs}
            setPackageKpiConfigs={setPackageKpiConfigs}
            hotelCategories={hotelCategories}
            setHotelCategories={setHotelCategories}
            hotelRegions={hotelRegions}
            setHotelRegions={setHotelRegions}
            onLogAction={logUserAction}
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

  if (isPasswordRecovery) {
    return <DefinePasswordView onDone={() => setIsPasswordRecovery(false)} />;
  }

  if (!session) {
    return <Auth />;
  }

  // Dados iniciais (hotéis, contas, financeiro etc.) ainda não chegaram do Supabase — sem isso,
  // a tela renderizava na hora com tudo zerado e só preenchia alguns segundos depois.
  if (!profilesLoaded) {
    return <LoadingScreen />;
  }

  // Authenticated with Supabase but no matching row in `profiles` — this can happen with
  // self-service sign-in (Google) for an account the admin never provisioned. Block instead
  // of falling through to the ADMIN-fallback in `currentUser` below.
  if (profilesLoaded && !loggedInProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f172a] p-4">
        <div className="max-w-md w-full text-center bg-white rounded-2xl shadow-2xl p-8 border border-red-200">
          <h1 className="text-xl font-bold text-red-600 mb-2">Acesso não autorizado</h1>
          <p className="text-sm text-gray-600 mb-6">
            O e-mail <span className="font-semibold">{session.user.email}</span> não está cadastrado no sistema.
            Contate o administrador para solicitar acesso.
          </p>
          <button
            onClick={handleLogout}
            className="px-5 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold transition-colors"
          >
            Sair
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex bg-gray-50 min-h-screen font-['Inter',sans-serif]">
      <Toaster position="top-right" />

      {isGeneratingSlides && (
        <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-96">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin shrink-0" />
              <span className="font-bold text-gray-700 text-sm truncate">{slideGenProgress?.label || 'Gerando apresentação...'}</span>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                style={{ width: `${slideGenProgress?.percent ?? 0}%` }}
              />
            </div>
            <div className="text-right text-xs font-bold text-gray-400 mt-1">{slideGenProgress?.percent ?? 0}%</div>
          </div>
        </div>
      )}
      <Sidebar
        currentView={currentView}
        currentModule={currentModule}
        onChangeView={setCurrentView}
        onModuleChange={handleModuleChange}
        user={currentUser}
        permissionsMatrix={permissionsMatrix}
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
          versions={(currentModule as string) === 'BUDGET' ? budgetVersions : realVersions}
          activeVersionId={(currentModule as string) === 'BUDGET' ? activeBudgetVersionId : activeRealVersionId}
          setActiveVersionId={(id) => {
            const isBudget = (currentModule as string) === 'BUDGET';
            const selectedV = (isBudget ? budgetVersions : realVersions).find(v => v.id === id);
            if (isBudget) {
              setActiveBudgetVersionId(id);
              if (selectedV) {
                const pairedReal = realVersions.find(r => r.name === selectedV.name && r.year === selectedV.year && (r.hotelId === selectedV.hotelId || (!r.hotelId && !selectedV.hotelId)));
                if (pairedReal) setActiveRealVersionId(pairedReal.id);
              }
            } else {
              setActiveRealVersionId(id);
              if (selectedV) {
                const pairedBudget = budgetVersions.find(b => b.name === selectedV.name && b.year === selectedV.year && (b.hotelId === selectedV.hotelId || (!b.hotelId && !selectedV.hotelId)));
                if (pairedBudget) setActiveBudgetVersionId(pairedBudget.id);
              }
            }
          }}
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
