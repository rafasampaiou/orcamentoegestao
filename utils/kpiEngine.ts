import { ForecastRow, KpiCalculation } from '../types';
import { evaluateFormula } from './formulaEngine';

// Extraído de ForecastTable.tsx (eram funções/consts de módulo, não presas ao componente) pra
// poder ser reaproveitado por BudgetReviewDRE.tsx (Revisão de Metas) sem duplicar o motor de KPI —
// mesma decisão de extração já tomada antes pra Ocupação (ver utils/occupancyProjection.ts).

export const blueRowIds = ['REV-TOTAL', 'REV-NET', 'CST-HEAD', 'RES-OP', 'RES-PCT', 'REV-IMP', 'RES-OP-SEM-IMP', 'RES-OP-COM-IMP', 'RES-OP-SEM-IMP-PCT', 'RES-OP-COM-IMP-PCT', 'LABOR-TOTAL'];

// "Lazer" e "Eventos" existem em dobro na DRE (dentro de Receita de Apartamentos e de Receitas
// Extras, com o mesmo nome de linha) — o seletor de fórmula oferece essas 4 combinações já
// qualificadas, e aqui é onde isso resolve pro id certo.
export const QUALIFIED_KPI_TERM_ROW_IDS: Record<string, string> = {
    'receita de apartamentos (lazer)': 'REV-APT-LAZER',
    'receita de apartamentos (eventos)': 'REV-APT-EVENTOS',
    'receitas extras (lazer)': 'REV-EXTRA-LAZER',
    'receitas extras (eventos)': 'REV-EXTRA-EVENTOS',
};

// Resolve o valor de qualquer termo de fórmula de KPI (uma conta, pacote, indicador ou linha de
// receita/resultado, casado pelo label da linha na DRE) pro campo pedido (previa/real/budget/otb).
export function resolveKpiTerm(termLabel: string | undefined, allRows: ForecastRow[], field: 'previa' | 'real' | 'budget' | 'otb'): number {
    if (!termLabel) return 0;
    const target = termLabel.trim().toLowerCase();
    const qualifiedId = QUALIFIED_KPI_TERM_ROW_IDS[target];
    const row = qualifiedId
        ? allRows.find(r => r.id === qualifiedId)
        : allRows.find(r => r.label.trim().toLowerCase() === target);
    if (!row) return 0;
    if (field === 'otb') return row.otb || 0;
    const usesMetaOnForecast = row.category === 'Indicators' || row.id === 'REV-TOTAL';
    if (field === 'real' && usesMetaOnForecast) return row.budget;
    if (field === 'real') return row.real;
    if (field === 'previa') return row.previa;
    return row.budget;
}

// A fórmula do KPI é uma expressão livre estilo planilha ("@[Linha A] + @[Linha B] / @[Linha C]"),
// avaliada com o mesmo motor já usado pelas linhas calculadas da DRE Inteligente.
export function evaluateKpiCalculation(calc: KpiCalculation | undefined, allRows: ForecastRow[], field: 'previa' | 'real' | 'budget' | 'otb'): number {
    if (!calc || !calc.formula || !calc.formula.trim()) return 0;
    const context = { getValue: (name: string) => resolveKpiTerm(name, allRows, field) };
    return evaluateFormula(calc.formula, context);
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// "Calcular Forecast" só consegue auto-projetar um valor quando a fórmula é a razão simples
// "@[Esta conta] / @[Denominador]" — qualquer outra coisa (termos extras, +, -, multiplicação, ou
// um numerador que não seja a própria conta) não tem uma única "taxa" pra reaplicar sobre a Meta.
export function parseSelfRatioDenominator(formula: string | undefined, selfName: string): string | null {
    if (!formula) return null;
    const self = escapeRegExp(selfName.trim());
    const pattern = new RegExp(`^\\s*@\\[?${self}\\]?\\s*/\\s*@\\[?([^/*+\\-]+?)\\]?\\s*$`, 'i');
    const match = formula.trim().match(pattern);
    return match ? match[1].trim() : null;
}

export interface KpiInfoForRow {
    hideKpi: boolean;
    hasKpi: boolean;
    kpiFormatType: 'currency' | 'percent' | 'integer' | 'decimal';
    kpiValue: (field: 'previa' | 'real' | 'budget' | 'otb') => number;
    rowKpiCalc: KpiCalculation | undefined;
}

// Resolve qual fórmula/KPI vale pra uma linha (conta, pacote, GOP, Impostos ou precomputado de
// Receita Extra/ISS) e devolve um getter pro valor em qualquer campo — mesma lógica usada no
// render de cada linha da DRE Forecast (accountKpiCalc/packageKpiCalc/gopKpiCalc/impostoKpiCalc/
// precomputedKpi), parametrizada por packageKpiConfigs em vez de vir de dentro do componente.
export function getKpiInfoForRow(row: ForecastRow, allRows: ForecastRow[], packageKpiConfigs: Record<string, KpiCalculation>): KpiInfoForRow {
    const isSectionHeader = !!row.isHeader && row.indentLevel === 0;
    const isBlueHighlight = blueRowIds.includes(row.id);
    const isTotal = !!row.isTotal;
    const isGopRsRow = row.id === 'RES-OP-COM-IMP' || row.id === 'RES-OP-SEM-IMP';
    const isImpostoKpiRow = row.id === 'REV-IMP';
    const precomputedKpi = row.rowConfig?.precomputedKpi;
    const hideKpi = (!isGopRsRow && !isImpostoKpiRow && (isSectionHeader || isBlueHighlight || isTotal)) || row.category === 'Indicators' || (row.category === 'Revenue' && !precomputedKpi && !isImpostoKpiRow);
    const accountKpiCalc = (row.category === 'Costs' || row.category === 'Account') && row.rowConfig?.expenseType === 'Variável' ? row.rowConfig?.kpiCalculation : undefined;
    const packageKpiCalc = !hideKpi && row.category === 'Package' ? packageKpiConfigs[row.label.trim()] : undefined;
    const gopKpiCalc: KpiCalculation | undefined = isGopRsRow ? { formula: `@[${row.label}] / @[UH Disponível]`, format: 'number' } as KpiCalculation : undefined;
    const impostoKpiCalc: KpiCalculation | undefined = isImpostoKpiRow ? row.rowConfig?.kpiCalculation : undefined;
    const rowKpiCalc = accountKpiCalc || packageKpiCalc || gopKpiCalc || impostoKpiCalc;
    const hasKpi = !!(rowKpiCalc || precomputedKpi);
    const kpiFormatType = precomputedKpi ? precomputedKpi.format : (rowKpiCalc?.format === 'percent' ? 'percent' : 'decimal');
    const kpiValue = (field: 'previa' | 'real' | 'budget' | 'otb') => {
        if (precomputedKpi) return precomputedKpi.format === 'percent' ? (precomputedKpi[field] || 0) * 100 : (precomputedKpi[field] || 0);
        const raw = evaluateKpiCalculation(rowKpiCalc, allRows, field);
        return rowKpiCalc?.format === 'percent' ? raw * 100 : raw;
    };
    return { hideKpi, hasKpi, kpiFormatType, kpiValue, rowKpiCalc };
}

// Mesma lógica de kpiSelfDenominator/isEditableKpi do render da DRE Forecast — se a fórmula for
// uma razão simples (self ÷ denominador) OU a linha tiver precomputedKpi.denominator (Receita
// Extra/ISS), o KPI pode ser digitado direto (back-solve pro valor).
export function isEditableKpiForRow(row: ForecastRow, info: KpiInfoForRow, packageKpiConfigs: Record<string, KpiCalculation>): boolean {
    const calc = row.category === 'Package' ? packageKpiConfigs[row.label.trim()] : row.rowConfig?.kpiCalculation;
    const isImpostoKpiRow = row.id === 'REV-IMP';
    const impostoKpiCalc = isImpostoKpiRow ? row.rowConfig?.kpiCalculation : undefined;
    const kpiSelfDenominator = calc
        ? parseSelfRatioDenominator(calc.formula, row.label)
        : (impostoKpiCalc ? parseSelfRatioDenominator(impostoKpiCalc.formula, row.label) : null);
    return !!kpiSelfDenominator || !!row.rowConfig?.precomputedKpi?.denominator;
}
