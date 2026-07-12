import { Account } from '../types';

// Every "line of the DRE Forecast" that can be picked as a term in a KPI calculation.
export interface DreReferenceOption {
  group: 'Contas' | 'Pacotes' | 'Indicadores' | 'Receita e Resultado';
  label: string;
}

// Indicators and revenue/result lines that actually exist as rows in the DRE Forecast
// (kept in sync with the row labels generated in services/mockData.ts).
const INDICATOR_LABELS = ['UH Ocupada', 'PAX', 'KPI de produtividade'];
const REVENUE_RESULT_LABELS = [
  'RECEITA BRUTA TOTAL',
  'RECEITA LÍQUIDA',
  'GOP COM DEDUÇÃO DE IMPOSTOS (R$)',
  'GOP SEM DEDUÇÃO DE IMPOSTOS (R$)',
];

export function getDreReferenceOptions(accounts: Account[]): DreReferenceOption[] {
  const accountOptions: DreReferenceOption[] = Array.from(new Set(accounts.map(a => a.name).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b))
    .map(label => ({ group: 'Contas', label }));

  const packageOptions: DreReferenceOption[] = Array.from(new Set(accounts.map(a => (a.package || '').trim()).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b))
    .map(label => ({ group: 'Pacotes', label }));

  const indicatorOptions: DreReferenceOption[] = INDICATOR_LABELS.map(label => ({ group: 'Indicadores', label }));

  const revenueResultOptions: DreReferenceOption[] = REVENUE_RESULT_LABELS.map(label => ({ group: 'Receita e Resultado', label }));

  return [...revenueResultOptions, ...indicatorOptions, ...packageOptions, ...accountOptions];
}
