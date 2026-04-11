export enum UserRole {
  ENTITY_MANAGER = 'Gestor de Entidade',
  PACKAGE_MANAGER = 'Gestor de Pacote',
  ACCOUNT_MANAGER = 'Gestor de Conta',
  ADMIN = 'Administrador'
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
  hotelId?: string; // Link user to a specific Hotel/Entity
  tempPassword?: string; // Storing temporary password for admin viewing
}

// Profile represents a user account managed in the `profiles` table in Supabase.
// It links to auth.users via the `id` field.
export interface Profile {
  id: string;           // UUID from auth.users
  email: string;
  full_name: string | null;
  hotel_id: string | null;
  role: string;         // e.g. 'admin', 'user'
  can_access_admin: boolean;     // Administração
  can_access_geral: boolean;     // Tauá Geral
  can_access_cadastros: boolean; // Cadastros
  avatar_url: string | null;
  temp_password?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Hotel {
  id: string;
  code: string;
  name: string;
}

export interface CostPackage {
  id: string;
  code: string;
  name: string;
  managerId: string;
}

export interface CostCenter {
  id: string;
  code: string;
  name: string; // Represents "Setor"
  // New fields
  directorate: string; // Diretoria
  department: string; // Departamento
  type: 'CR' | 'PDV'; // Centro de Resultado ou Ponto de Venda
  hotelName?: string;
  hierarchicalCode?: string;
  companyCode?: string;
}

export interface Account {
  id: string;
  code: string;
  name: string;
  packageId?: string; // Optional now, as GMD defines the link
  package?: string;
  packageCode?: string;
  masterPackage?: string;
  masterPackageCode?: string;
  type: 'Fixed' | 'Variable_PAX' | 'Variable_UH' | 'Variable_Revenue' | 'Variable_Staff';
  sortOrder?: number;
  outOfScope?: boolean;
  level?: 'master' | 'pkg' | 'account';
}

export interface GMDConfiguration {
  id: string;
  hotelId: string;
  
  // Changed to array to support multiple managers
  entityManagerIds: string[]; 
  
  packageId: string;
  packageManagerId: string;
  
  // New field for support users
  supportUserIds: string[];

  linkedAccountIds: string[]; // Accounts belonging to this GMD Package
  
  costCenterId: string; // The CR justifying the expense
  accountManagerId: string; // "Dono do Pacote" / "Gestor da Conta"
}

export type ExpenseType = 'Fixo' | 'Variável';
// Updated Driver List per user request
export type ExpenseDriver = 'UH Ocupada' | 'PAX' | 'Receita' | 'Emocionadores' | 'Extras';
export type ForecastOperator = 'multiply' | 'divide';

export interface ForecastConfig {
  method: 'Fixed' | 'Variable';
  driver?: ExpenseDriver;
  operator?: ForecastOperator;
  factor?: number; // The number with 2 decimals
  manualValue?: number; // Value typed when Fixed
}

export interface ForecastRow {
  id: string;
  accountCode?: string; // e.g. "3.01.005"
  category: string;
  label: string;
  isHeader?: boolean;
  isTotal?: boolean;
  real: number;
  budget: number;
  lastYear: number;
  indentLevel?: number;
  // Computed fields
  deltaBudgetVal?: number;
  deltaBudgetPct?: number;
  deltaLYVal?: number;
  deltaLYPct?: number;
  // Previa Fields
  previa: number;
  deltaPreviaVal?: number;
  deltaPreviaPct?: number;
  deltaPreviaBudgetVal?: number;
  deltaPreviaBudgetPct?: number;
  
  // GMD Integration
  gmdManagerName?: string; // The person responsible for this line in the Matrix
  // Configuration for UI
  indicatorSection?: string; // NEW: Grouping for Indicators (Gerais, Lazer, Eventos)
  
  // Unified Config Object
  forecastConfig: ForecastConfig;
  previaConfig?: ForecastConfig; // New: Config for Previa calculations
  
  rowConfig?: {
    inputType?: 'expense' | 'tax' | 'none';
    expenseType?: ExpenseType;
    expenseDriver?: ExpenseDriver;
    taxRate?: number;
    format?: 'currency' | 'percent' | 'integer' | 'decimal'; // Added decimal for ratios
  }
}

export type ViewState = 
  // REAL Module
  | 'real_home'
  | 'dashboard' // Forecast
  | 'occupancy_real' 
  | 'comparatives'
  | 'gmd'
  | 'validations' // New: Validations Log
  | 'settings' // Administrativo
  
  // BUDGET Module
  | 'budget_home'
  | 'occupancy_budget'
  | 'labor_budget'
  | 'extra_revenue_budget'
  | 'dre_budget'
  | 'admin_budget'
  | 'admin';

export type ModuleType = 'REAL' | 'BUDGET';

export interface ColumnVisibility {
  previa: boolean;
  real: boolean;
  budget: boolean;
  deltaBudget: boolean;
  deltaBudgetPct: boolean;
  deltaPreviaBudget: boolean;
  deltaPreviaBudgetPct: boolean;
  lastYear: boolean;
  deltaLY: boolean;
  deltaLYPct: boolean;
}

export interface ImportedRow {
    ano: string;
    cenario: string; // Real / Meta
    tipo: string; // Receita / Despesa
    hotel: string; // Filial
    conta: string; // Descrição da Conta
    cr: string; // CR Certo
    mes: string;
    valor: string;
    classificacao?: string;
    status: 'valid' | 'error';
    msg?: string;
    originalLine?: number;
    versionId?: string;
    
    // New fields for the 12-column format
    escopo?: string; // Escopo ou Fora
    departamento?: string; // Departamento
    pacote?: string; // Pacote
    pacoteMaster?: string; // Pacote Master
    diretoria?: string; // Diretoria
}

export interface ImportedCostCenter {
    id: string;
    hierarchicalCode: string;
    hotelName: string;
    name: string;
    type: 'CR' | 'PDV';
    directorate: string;
    department: string;
    companyCode: string;
    status: 'valid' | 'error';
    msg?: string;
    originalLine?: number;
}

export interface ImportedAccount {
    id: string;
    name: string;
    package?: string;
    masterPackage?: string;
    status: 'valid' | 'error';
    msg?: string;
    originalLine?: number;
}

// NEW: Workflow for GMD Deviations
export interface LaborPlan {
    id: string;
    hotelId: string;
    costCenterId: string;
    position: string;
    quantity: number;
    avgSalary: number;
    chargesPct: number;
}

export interface BudgetVersion {
    id: string;
    name: string;
    year: number;
    month?: number; // 1-12
    isLocked: boolean;
    createdAt: string;
    updatedAt?: string;
    isMain?: boolean;
    hotelId?: string;
    occupancyData?: Record<string, number[]>;
    laborData?: Record<string, any>;
    extraRevenueData?: any[];
}

export interface LaborParameters {
    dissidioPct: number;
    dissidioMonth: number; // 1-12
    fgtsPct: number;
    inssPct: number;
    pisPct: number;
    chargesPct: number;
    issRevenuePct: number;
    issServicePct: number;
    patMealValue: number;
    overtimeHourValue: number;
    benefitsEligibility?: 'emocionador' | 'emocionador_extra' | 'emocionador_extra_others';
    benefitsOthersCount?: number;
}

export interface ScheduleItem {
    id: string;
    step: string;
    startDate: string;
    endDate: string;
    status: 'pending' | 'active' | 'completed';
}

export interface RevenueDriverConfig {
    id: string;
    hotelId: string;
    accountId: string;
    driver: 'PAX' | 'UH Ocupada';
    budgetFactor: number;
}

export type ProjectionType = 'Reunião de Ritmo' | 'FCA N1' | 'FCA N2' | 'Fechamento oficial';

export interface ValidationRecord {
    id: string;
    hotelId: string;
    userId: string;
    userName: string;
    month: number;
    year: number;
    projectionType: ProjectionType;
    validatedAt: string;
    status: 'Validado';
}

export interface Justification {
  id: string;
  gmdConfigId: string;
  accountId: string;
  accountName: string;
  month: number;
  year: number;
  projectionType?: ProjectionType;
  
  meta: number;
  forecast: number;
  previa: number;
  deltaR: number; // forecast - previa
  deltaPct: number;

  explanation: string;
  // Action Plan System Statuses
  status: 'Pendentes' | 'Em andamento' | 'Atrasado' | 'Concluído';
  
  rejectionReason?: string;
  
  // Action Plan Fields
  actionPlan?: string;
  actionPlanStartDate?: string;
  actionPlanEndDate?: string;
  actionPlanPresentationDate?: string;
  
  // Completion Fields
  recoveredValue?: number;
  completionObservation?: string;
}

