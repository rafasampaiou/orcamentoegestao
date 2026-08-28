// Usado por BudgetReviewComparatives.tsx pra somar Receita/Impostos direto da Ocupação (Meta já é
// entrada direta lá, não precisa recalcular nada). A parte de Despesas/"Calcular Forecast" da
// Revisão de Metas foi migrada pra reaproveitar o motor de verdade da DRE Forecast — ver
// buildForecastRows (components/ForecastTable.tsx) + utils/kpiEngine.ts.

const occ = (data: Record<string, number[]>, id: string, monthIdx: number) => data[id]?.[monthIdx] || 0;

export interface MonthlyRevenueSummary {
    receitaApt: number;
    receitaExtra: number;
    timeShare: number;
    receitaIss: number;
    receitaBrutaTotal: number;
    impostos: number;
    receitaLiquida: number;
}

export function computeMonthlyRevenueSummary(occupancyData: Record<string, number[]>, monthIdx: number): MonthlyRevenueSummary {
    const receitaApt = occ(occupancyData, 'lazer_rev_fap', monthIdx) + occ(occupancyData, 'event_rev_fap', monthIdx) + occ(occupancyData, 'geral_or_hosp', monthIdx);
    const receitaExtra = occ(occupancyData, 'lazer_extra_rev', monthIdx) + occ(occupancyData, 'event_extra_rev', monthIdx) + occ(occupancyData, 'geral_or_extras', monthIdx);
    const timeShare = occ(occupancyData, 'geral_cancel_ts', monthIdx);
    const receitaIss = occ(occupancyData, 'geral_iss_rev', monthIdx);
    const receitaBrutaTotal = receitaApt + receitaExtra + timeShare + receitaIss;
    const impostos = occ(occupancyData, 'geral_impostos', monthIdx);
    const receitaLiquida = receitaBrutaTotal - impostos;
    return { receitaApt, receitaExtra, timeShare, receitaIss, receitaBrutaTotal, impostos, receitaLiquida };
}
