import { Account, ExpenseDriver, ImportedRow } from '../types';

// DRE macro da Revisão de Metas (etapas 4/5) — Receita/Impostos vêm direto da Ocupação (Meta já é
// entrada direta lá, não precisa recalcular nada); só Despesas usa contas do Plano de Contas
// (Account.expenseType/expenseDriver), exatamente os mesmos parâmetros que a DRE Forecast normal
// usa em "Calcular Forecast" (ver getDriverValue em ForecastTable.tsx) — só que aqui a "base" é o
// mês/ocupação ANTES da revisão (baseline capturada ao iniciar a revisão) e o "novo driver" é a
// ocupação de CADA mês revisado, em vez de Meta→Real como na tela normal.

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

// Só os drivers que dá pra resolver com dado só de Ocupação (sem GMD/mão de obra) — os outros
// (Emocionadores, Emocionadores (CLT), Extras, KPI de produtividade) caem no `null` e a conta é
// tratada como "Fixo" (replica o valor de referência) por quem chama.
export function getMonthlyDriverValue(driver: ExpenseDriver | undefined, occupancyData: Record<string, number[]>, monthIdx: number): number | null {
    if (driver === 'UH Ocupada') return occ(occupancyData, 'geral_sold', monthIdx);
    if (driver === 'PAX') return occ(occupancyData, 'geral_pax', monthIdx);
    if (driver === 'Receita' || driver === 'Receita Bruta') return computeMonthlyRevenueSummary(occupancyData, monthIdx).receitaBrutaTotal;
    return null;
}

const matchesAccount = (row: ImportedRow, account: Account) => row.conta === account.name || row.conta === account.code;

export function getAccountValueForMonth(
    financialData: ImportedRow[], account: Account, hotel: string, year: number, month: number, versionId: string
): number {
    const row = financialData.find(r =>
        (r.cenario || '').trim().toLowerCase() === 'meta' &&
        r.hotel === hotel &&
        r.versionId === versionId &&
        parseInt(r.ano) === year &&
        parseInt(r.mes) === month &&
        matchesAccount(r, account)
    );
    return row ? parseFloat(row.valor) || 0 : 0;
}

export function sumPackageValueForMonth(
    financialData: ImportedRow[], accounts: Account[], packageName: string, hotel: string, year: number, month: number, versionId: string
): number {
    return accounts
        .filter(a => a.package === packageName && !a.outOfScope)
        .reduce((sum, a) => sum + getAccountValueForMonth(financialData, a, hotel, year, month, versionId), 0);
}

// "Calcular Forecast" da Revisão de Metas: pra cada conta, acha a taxa (valor ÷ driver) na
// OCUPAÇÃO/DESPESA DE BASE (antes da revisão começar) e aplica essa mesma taxa em cima da
// ocupação JÁ REVISADA de cada mês selecionado — mesma lógica de "Meta ratio × novo driver" da
// DRE Forecast normal, só que aqui a "Meta" de referência é o estado da própria versão antes de
// mexer na ocupação (baseline), e o "novo driver" é a ocupação revisada de cada mês.
export function projectExpensesAcrossMonths(
    accounts: Account[],
    baselineFinancialData: ImportedRow[],
    baselineOccupancyData: Record<string, number[]>,
    revisedOccupancyData: Record<string, number[]>,
    hotel: string,
    year: number,
    versionId: string,
    months: number[]
): ImportedRow[] {
    const result: ImportedRow[] = [];

    accounts.forEach(account => {
        if (account.outOfScope) return;

        const driver = account.expenseType === 'Variável' ? account.expenseDriver : undefined;

        months.forEach(month => {
            const monthIdx = month - 1;
            const baseValue = getAccountValueForMonth(baselineFinancialData, account, hotel, year, month, versionId);
            const baseDriver = getMonthlyDriverValue(driver, baselineOccupancyData, monthIdx);

            let newValue = baseValue; // Fixo, ou driver não suportado aqui — replica o valor base
            if (driver && baseDriver !== null && baseDriver > 0) {
                const rate = baseValue / baseDriver;
                const newDriver = getMonthlyDriverValue(driver, revisedOccupancyData, monthIdx) || 0;
                newValue = rate * newDriver;
            }

            result.push({
                ano: String(year),
                cenario: 'Meta',
                tipo: 'Despesa',
                hotel,
                conta: account.name,
                cr: '',
                mes: String(month),
                valor: newValue.toFixed(2),
                status: 'valid',
                versionId,
                pacote: account.package,
                pacoteMaster: account.masterPackage,
            });
        });
    });

    return result;
}
