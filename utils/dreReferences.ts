import { Account } from '../types';

// Every "line of the DRE Forecast" that can be picked as a term in a KPI calculation.
export interface DreReferenceOption {
  group: 'Contas' | 'Pacotes' | 'Indicadores' | 'Receita e Resultado';
  label: string;
}

// Indicators and revenue/result lines that actually exist as rows in the DRE Forecast
// (kept in sync with the row labels generated in services/mockData.ts).
const INDICATOR_LABELS = ['UH Ocupada', 'PAX', 'Mão de obra (Total)', 'Mão de obra (CLT)', 'Mão de obra (Extra)'];
const REVENUE_RESULT_LABELS = [
  'RECEITA BRUTA TOTAL',
  'RECEITA LÍQUIDA',
  'GOP COM DEDUÇÃO DE IMPOSTOS (R$)',
  'GOP SEM DEDUÇÃO DE IMPOSTOS (R$)',
  'Receita de Apartamentos',
  // "Lazer" e "Eventos" existem em dobro na DRE (dentro de Receita de Apartamentos e de
  // Receitas Extras, com o mesmo nome de linha) — aqui entram já qualificados, mesmo padrão
  // usado no import por template (ver IMPORT_LABEL_MAP em ForecastTable.tsx). O motor de KPI
  // (resolveKpiTerm) sabe resolver esse formato pro id certo, mesmo a linha na DRE continuando
  // a se chamar só "Lazer"/"Eventos".
  'Receita de Apartamentos (Lazer)',
  'Receita de Apartamentos (Eventos)',
  'OR de hospedagem',
  'Receitas Extras',
  'Receitas Extras (Lazer)',
  'Receitas Extras (Eventos)',
  'OR Extras',
  'Cancelamento de Time Share',
  'Receita de ISS',
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
