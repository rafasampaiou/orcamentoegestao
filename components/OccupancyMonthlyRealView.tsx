import React, { useMemo, useState, useEffect } from 'react';
import { Save, CheckCircle } from 'lucide-react';
import { User, UserRole, ProjectionType } from '../types';
import { BudgetRow, BudgetOccupancyTable, geralRows, lazerRows, eventRows, OccupancyVersionOption, MEETING_VERSIONS, OWN_SNAPSHOT_VERSIONS } from './OccupancyView';
import { VersionInfoBanner } from './VersionInfoBanner';

interface OccupancyMonthlyRealViewProps {
    selectedYear: number;
    selectedHotel: string;
    realOccupancyData: Record<string, Record<string, number>>;
    setRealOccupancyData: React.Dispatch<React.SetStateAction<Record<string, Record<string, number>>>>;
    budgetData: Record<string, number[]>;
    setBudgetOccupancyDataMap?: React.Dispatch<React.SetStateAction<Record<string, Record<string, number[]>>>>;
    activeBudgetVersionId?: string;
    activeRealVersionId?: string;
    activeRealVersionName?: string;
    currentUser?: User;
    onSaveOccupancy?: () => void;
    activeProjectionType?: ProjectionType;
    setActiveProjectionType?: React.Dispatch<React.SetStateAction<ProjectionType>>;
    // Sinalizado pelo wizard "Iniciar Projeção" (OTB) na DRE Forecast — semeia o modo "On the
    // books" já ligado ao chegar aqui, mesmo padrão de activeProjectionType semeando `period`.
    initialOtbMode?: boolean;
    // Mês ativo na DRE Forecast no momento de "Iniciar Projeção" — semeia o filtro de meses já
    // mostrando só esse mês, em vez dos 12.
    initialSelectedMonth?: number;
}

// Rótulo curto de cada Versão do Forecast pra exibir nos botões/badge (mesmo padrão do
// dropdown "Versão do Forecast" na DRE Forecast, que já mostra "Fechamento" em vez do valor
// completo do enum "Fechamento oficial").
const PERIOD_LABELS: Record<OccupancyVersionOption, string> = {
    'Reunião de Ritmo': 'Reunião de Ritmo',
    'FCA N2': 'FCA N2',
    'FCA N1': 'FCA N1',
    'Fechamento oficial': 'Fechamento',
    'Realizado': 'Realizado',
    'Meta': 'Meta',
    'Ano anterior': 'Ano anterior',
};
const PERIOD_ORDER: OccupancyVersionOption[] = ['Reunião de Ritmo', 'FCA N2', 'FCA N1', 'Fechamento oficial', 'Realizado', 'Meta', 'Ano anterior'];

// Reunião de Ritmo / FCA N1 / FCA N2 — linhas restritas para preenchimento manual: só Aptos
// vendidos, DM bruta e os Coef. Occ ficam editáveis (Coef. Occ vem sugerido da Meta, mas o
// usuário pode mudar); Receita/Adultos/CHD/Pax/% ocupação são derivados, ao invés do contrário.
// Em "Geral" a maioria das linhas é somatório de Lazer+Eventos, nada fica editável — exceção:
// Mão de obra só existe no nível Geral (não tem quebra por Lazer/Eventos), então CLT/Extra
// precisam ser editáveis ali mesmo.
// Ordem pedida especificamente para esta tabela restrita (não é a mesma ordem de
// Realizado/Meta/Ano anterior) — Coef. Occ Geral e N° de Hóspedes entram aqui também.
const MEETING_ROW_SUFFIXES = ['sold', 'occ_pct', 'dm_fap', 'rev_fap', 'coef_ad', 'coef_chd', 'coef_total', 'pax', 'adults', 'chd'];
const MEETING_EDITABLE_SUFFIXES = ['sold', 'dm_fap', 'coef_ad', 'coef_chd'];
const MEETING_GERAL_LABOR_SUFFIXES = ['mo_total', 'mo_clt', 'mo_extra'];
const MEETING_GERAL_LABOR_EDITABLE_SUFFIXES = ['mo_clt', 'mo_extra'];
const getMeetingRows = (baseRows: BudgetRow[], prefix: string): BudgetRow[] => {
    const suffixes = prefix === 'geral' ? [...MEETING_ROW_SUFFIXES, ...MEETING_GERAL_LABOR_SUFFIXES] : MEETING_ROW_SUFFIXES;
    const mapped: (BudgetRow | null)[] = suffixes.map(suffix => {
        const id = `${prefix}_${suffix}`;
        const base = baseRows.find(r => r.id === id);
        if (!base) return null;
        const isGeralLaborInput = prefix === 'geral' && MEETING_GERAL_LABOR_EDITABLE_SUFFIXES.includes(suffix);
        const isEditable = isGeralLaborInput || (prefix !== 'geral' && MEETING_EDITABLE_SUFFIXES.includes(suffix));
        return { ...base, isInput: isEditable, isManualReal: isEditable, isCalculated: !isEditable };
    });
    return mapped.filter((r): r is BudgetRow => !!r);
};

// "On the books" — mesma tabela restrita acima, mais Receita Extra Lazer/Evento (não existe em
// Reunião de Ritmo/FCA N1/FCA N2 normal). Só Lazer/Eventos ganham a linha extra — em Geral,
// "Receitas Extras" continua sendo a soma dos dois (igual Mão de obra Total), nunca editável ali.
const getOtbRows = (baseRows: BudgetRow[], prefix: string): BudgetRow[] => {
    const meetingRows = getMeetingRows(baseRows, prefix);
    if (prefix === 'geral') return meetingRows;
    const extraRow = baseRows.find(r => r.id === `${prefix}_extra_rev`);
    if (!extraRow) return meetingRows;
    return [...meetingRows, { ...extraRow, isInput: true, isManualReal: true, isCalculated: false }];
};

const OccupancyMonthlyRealView: React.FC<OccupancyMonthlyRealViewProps> = ({
    selectedYear,
    selectedHotel,
    realOccupancyData,
    setRealOccupancyData,
    budgetData,
    setBudgetOccupancyDataMap,
    activeBudgetVersionId,
    activeRealVersionId,
    activeRealVersionName,
    currentUser,
    onSaveOccupancy,
    activeProjectionType,
    setActiveProjectionType,
    initialOtbMode,
    initialSelectedMonth
}) => {
    const canEditOccupancy = currentUser?.role === UserRole.ADMIN ||
        currentUser?.role === UserRole.ENTITY_MANAGER ||
        currentUser?.role === UserRole.COST_ANALYST;

    const [decimalOverrides, setDecimalOverrides] = useState<Record<string, number>>({});
    const [savedIndicator, setSavedIndicator] = useState(false);
    // Semeado uma única vez a partir do mês ativo na DRE Forecast — assim "Iniciar Projeção" já
    // chega aqui filtrado no mês certo, em vez de mostrar os 12 meses.
    const [visibleMonthsFilter, setVisibleMonthsFilter] = useState<number[]>(
        initialSelectedMonth ? [initialSelectedMonth - 1] : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
    );
    // Semeado uma única vez a partir da Versão do Forecast ativa (mesmo padrão de
    // `initialSelectedHotel` em GMDView) — assim "Iniciar Projeção" na DRE Forecast já chega
    // aqui filtrado na versão certa.
    const [period, setPeriod] = useState<OccupancyVersionOption>(activeProjectionType || 'Realizado');
    // Controla qual tabela/fórmula renderiza (restrita vs. completa).
    const isMeetingMode = MEETING_VERSIONS.includes(period);
    // Controla a CHAVE DE CONTEXTO usada para ler/escrever em realOccupancyData — mais ampla que
    // isMeetingMode, pois Fechamento oficial também precisa do próprio snapshot isolado (mesmo
    // usando a tabela completa). "Realizado" fica de fora de propósito: é o único que continua
    // no balde original sem sufixo, preservando qualquer dado já existente.
    const usesProjectionSnapshot = OWN_SNAPSHOT_VERSIONS.includes(period);
    // "On the books" é um MODO dentro de Reunião de Ritmo/FCA N1/FCA N2, não uma versão nova —
    // cada versão guarda seu próprio OTB isolado (chave de contexto com sufixo extra "__OTB").
    const [otbMode, setOtbMode] = useState(initialOtbMode || false);
    const handlePeriodChange = (value: OccupancyVersionOption) => {
        setPeriod(value);
        if (!MEETING_VERSIONS.includes(value)) setOtbMode(false);
        if (setActiveProjectionType && value !== 'Meta' && value !== 'Ano anterior') {
            setActiveProjectionType(value);
        }
    };
    const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    const toggleDecimals = (rowId: string) => {
        setDecimalOverrides(prev => {
            const current = prev[rowId] ?? -1;
            const allRows = [...geralRows, ...lazerRows, ...eventRows];
            const found = allRows.find(r => r.id === rowId);
            const standard = found?.format === 'integer' ? 0 : 2;

            let next;
            if (current === -1) {
                next = (standard + 1) % 5;
            } else {
                next = (current + 1) % 5;
            }
            return { ...prev, [rowId]: next };
        });
    };

    const handleManualSave = () => {
        if (onSaveOccupancy) {
            onSaveOccupancy();
        }
        setSavedIndicator(true);
        setTimeout(() => setSavedIndicator(false), 2500);
    };

    // Replicate the pure calculation logic
    const recalculateRealForMonth = (currentData: Record<string, number>, monthIdx: number) => {
        const newData = { ...currentData };
        const get = (key: string) => newData[key] || 0;
        const set = (key: string, val: number) => { newData[key] = val; };

        const getDaysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();

        // For Monthly View, we update both forecast and previa if they edit it manually
        const suffixes = ['forecast', 'previa'];

        suffixes.forEach(s => {
            const currentDays = currentData[`days_month_${s}`];
            let days = currentDays !== undefined && currentDays > 0 ? currentDays : (budgetData['days_month']?.[monthIdx] || 0);
            if (days === 0) days = getDaysInMonth(selectedYear, monthIdx + 1);
            set(`days_month_${s}`, days);

            const currentCap = currentData[`geral_capacity_${s}`];
            const baseCap = currentCap !== undefined ? currentCap : (budgetData['geral_capacity']?.[monthIdx] || budgetData['lazer_capacity']?.[monthIdx] || 0);

            // Replicate capacity
            const lzCap = baseCap;
            set(`lazer_capacity_${s}`, lzCap);
            const lzAvail = lzCap * days;
            set(`lazer_avail_${s}`, lzAvail);

            const lzSold = get(`lazer_sold_${s}`);
            const lzAd = get(`lazer_adults_${s}`);
            const lzChd = get(`lazer_chd_${s}`);

            const lzDmFap = budgetData['lazer_dm_fap']?.[monthIdx] || 0;
            const lzPax = lzAd + lzChd;
            let lzRevFap = get(`lazer_rev_fap_${s}`);
            if (!lzRevFap) lzRevFap = lzSold * lzDmFap;

            let lzRevHosp = get(`lazer_rev_hosp_${s}`) || 0;

            const receitaFapLz = lzRevFap || 0;
            const receitaHospLz = lzRevHosp || 0;
            const adultosLz = lzAd || 0;
            const criancasLz = lzChd || 0;

            const diferencaReceitaLz = receitaFapLz - receitaHospLz;

            set(`lazer_rate_ad_${s}`, adultosLz > 0 ? diferencaReceitaLz / adultosLz : 0);
            set(`lazer_rate_chd_${s}`, criancasLz > 0 ? diferencaReceitaLz / criancasLz : 0);

            set(`lazer_occ_pct_${s}`, lzAvail > 0 ? (lzSold / lzAvail) * 100 : 0);
            set(`lazer_pax_${s}`, lzPax);
            set(`lazer_coef_total_${s}`, lzSold > 0 ? lzPax / lzSold : 0);
            set(`lazer_coef_ad_${s}`, lzSold > 0 ? lzAd / lzSold : 0);
            set(`lazer_coef_chd_${s}`, lzSold > 0 ? lzChd / lzSold : 0);

            set(`lazer_rev_fap_${s}`, lzRevFap);
            set(`lazer_rev_hosp_${s}`, lzRevHosp);
            set(`lazer_dm_fap_${s}`, lzSold > 0 ? lzRevFap / lzSold : 0);
            set(`lazer_dm_hosp_${s}`, lzSold > 0 ? lzRevHosp / lzSold : 0);
            set(`lazer_revpar_${s}`, lzAvail > 0 ? lzRevFap / lzAvail : 0);

            // Replicate capacity
            const evCap = baseCap;
            set(`event_capacity_${s}`, evCap);
            const evAvail = evCap * days;
            set(`event_avail_${s}`, evAvail);

            const evSold = get(`event_sold_${s}`);
            const evAd = get(`event_adults_${s}`);
            const evChd = get(`event_chd_${s}`);

            const evDmFap = budgetData['event_dm_fap']?.[monthIdx] || 0;
            const evPax = evAd + evChd;
            let evRevFap = get(`event_rev_fap_${s}`);
            if (!evRevFap) evRevFap = evSold * evDmFap;

            let evRevHosp = get(`event_rev_hosp_${s}`) || 0;

            const receitaFapEv = evRevFap || 0;
            const receitaHospEv = evRevHosp || 0;
            const adultosEv = evAd || 0;
            const criancasEv = evChd || 0;

            const diferencaReceitaEv = receitaFapEv - receitaHospEv;

            set(`event_rate_ad_${s}`, adultosEv > 0 ? diferencaReceitaEv / adultosEv : 0);
            set(`event_rate_chd_${s}`, criancasEv > 0 ? diferencaReceitaEv / criancasEv : 0);

            set(`event_occ_pct_${s}`, evAvail > 0 ? (evSold / evAvail) * 100 : 0);
            set(`event_pax_${s}`, evPax);
            set(`event_coef_total_${s}`, evSold > 0 ? evPax / evSold : 0);
            set(`event_coef_ad_${s}`, evSold > 0 ? evAd / evSold : 0);
            set(`event_coef_chd_${s}`, evSold > 0 ? evChd / evSold : 0);

            set(`event_rev_fap_${s}`, evRevFap);
            set(`event_rev_hosp_${s}`, evRevHosp);
            set(`event_dm_fap_${s}`, evSold > 0 ? evRevFap / evSold : 0);
            set(`event_dm_hosp_${s}`, evSold > 0 ? evRevHosp / evSold : 0);
            set(`event_revpar_${s}`, evAvail > 0 ? evRevFap / evAvail : 0);

            const gCap = baseCap;
            set(`geral_capacity_${s}`, gCap);
            const gAvail = gCap * days;
            set(`geral_avail_${s}`, gAvail);

            const gSold = lzSold + evSold;
            const gAd = lzAd + evAd;
            const gChd = lzChd + evChd;
            const gPax = gAd + gChd;
            const gRevFap = lzRevFap + evRevFap;
            const gRevHosp = lzRevHosp + evRevHosp;

            set(`geral_sold_${s}`, gSold);
            set(`geral_occ_pct_${s}`, gAvail > 0 ? (gSold / gAvail) * 100 : 0);
            set(`geral_pax_${s}`, gPax);
            set(`geral_coef_total_${s}`, gSold > 0 ? gPax / gSold : 0);
            set(`geral_adults_${s}`, gAd);
            set(`geral_coef_ad_${s}`, gSold > 0 ? gAd / gSold : 0);
            set(`geral_chd_${s}`, gChd);
            set(`geral_coef_chd_${s}`, gSold > 0 ? gChd / gSold : 0);

            const diferencaReceitaGeral = gRevFap - gRevHosp;
            set(`geral_rate_ad_${s}`, gAd > 0 ? diferencaReceitaGeral / gAd : 0);
            set(`geral_rate_chd_${s}`, gChd > 0 ? diferencaReceitaGeral / gChd : 0);

            set(`geral_rev_fap_${s}`, gRevFap);
            set(`geral_rev_hosp_${s}`, gRevHosp);

            const lzExtra = get(`lazer_extra_rev_${s}`);
            const evExtra = get(`event_extra_rev_${s}`);
            const gExtra = lzExtra + evExtra;
            set(`geral_extra_rev_${s}`, gExtra);

            set(`geral_dm_fap_${s}`, gSold > 0 ? gRevFap / gSold : 0);
            set(`geral_dm_hosp_${s}`, gSold > 0 ? gRevHosp / gSold : 0);
            set(`geral_revpar_${s}`, gAvail > 0 ? gRevFap / gAvail : 0);
            set(`geral_trevpor_${s}`, gSold > 0 ? (gRevFap + gExtra) / gSold : 0);
            set(`geral_trevpar_${s}`, gAvail > 0 ? (gRevFap + gExtra) / gAvail : 0);

            set(`lazer_trevpor_${s}`, lzSold > 0 ? (lzRevFap + lzExtra) / lzSold : 0);
            set(`lazer_trevpar_${s}`, lzAvail > 0 ? (lzRevFap + lzExtra) / lzAvail : 0);

            set(`event_trevpor_${s}`, evSold > 0 ? (evRevFap + evExtra) / evSold : 0);
            set(`event_trevpar_${s}`, evAvail > 0 ? (evRevFap + evExtra) / evAvail : 0);
        });

        return newData;
    };

    // Reunião de Ritmo / FCA N1 / FCA N2 — inverte a direção da fórmula em relação ao modo
    // Realizado: aqui DM bruta e os Coef. Occ são as entradas manuais (Coef. Occ vem sugerido
    // da Meta do mesmo mês, mas editável), e Receita/Adultos/CHD são derivados.
    const recalculateMeetingProjectionForMonth = (currentData: Record<string, number>, monthIdx: number) => {
        const newData = { ...currentData };
        const get = (key: string) => newData[key] || 0;
        const set = (key: string, val: number) => { newData[key] = val; };
        const metaGet = (id: string) => budgetData?.[id]?.[monthIdx] || 0;
        const getDaysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();

        const suffixes = ['forecast', 'previa'];
        suffixes.forEach(s => {
            const days = metaGet('days_month') || getDaysInMonth(selectedYear, monthIdx + 1);
            set(`days_month_${s}`, days);
            const baseCap = metaGet('geral_capacity') || metaGet('lazer_capacity');

            (['lazer', 'event'] as const).forEach(prefix => {
                set(`${prefix}_capacity_${s}`, baseCap);
                const avail = baseCap * days;
                set(`${prefix}_avail_${s}`, avail);

                const sold = get(`${prefix}_sold_${s}`);
                const dmFap = get(`${prefix}_dm_fap_${s}`);
                const revFap = dmFap * sold;
                set(`${prefix}_rev_fap_${s}`, revFap);

                // Coef. Occ default = Meta do mesmo hotel/mês, só usado enquanto o usuário não
                // tiver digitado o próprio valor (currentData ainda não tem a chave).
                const metaSold = metaGet(`${prefix}_sold`);
                const metaCoefAd = metaSold > 0 ? metaGet(`${prefix}_adults`) / metaSold : 0;
                const metaCoefChd = metaSold > 0 ? metaGet(`${prefix}_chd`) / metaSold : 0;
                const coefAd = currentData[`${prefix}_coef_ad_${s}`] !== undefined ? currentData[`${prefix}_coef_ad_${s}`] : metaCoefAd;
                const coefChd = currentData[`${prefix}_coef_chd_${s}`] !== undefined ? currentData[`${prefix}_coef_chd_${s}`] : metaCoefChd;
                set(`${prefix}_coef_ad_${s}`, coefAd);
                set(`${prefix}_coef_chd_${s}`, coefChd);

                const adults = coefAd * sold;
                const chd = coefChd * sold;
                set(`${prefix}_adults_${s}`, adults);
                set(`${prefix}_chd_${s}`, chd);
                const pax = adults + chd;
                set(`${prefix}_pax_${s}`, pax);
                set(`${prefix}_coef_total_${s}`, sold > 0 ? pax / sold : 0);
                set(`${prefix}_occ_pct_${s}`, avail > 0 ? (sold / avail) * 100 : 0);
            });

            const lzSold = get(`lazer_sold_${s}`), evSold = get(`event_sold_${s}`);
            const lzAd = get(`lazer_adults_${s}`), evAd = get(`event_adults_${s}`);
            const lzChd = get(`lazer_chd_${s}`), evChd = get(`event_chd_${s}`);
            const lzRevFap = get(`lazer_rev_fap_${s}`), evRevFap = get(`event_rev_fap_${s}`);

            set(`geral_capacity_${s}`, baseCap);
            const gAvail = baseCap * days;
            set(`geral_avail_${s}`, gAvail);
            const gSold = lzSold + evSold;
            set(`geral_sold_${s}`, gSold);
            set(`geral_occ_pct_${s}`, gAvail > 0 ? (gSold / gAvail) * 100 : 0);
            const gAd = lzAd + evAd, gChd = lzChd + evChd;
            set(`geral_adults_${s}`, gAd);
            set(`geral_chd_${s}`, gChd);
            const gPax = gAd + gChd;
            set(`geral_pax_${s}`, gPax);
            set(`geral_coef_total_${s}`, gSold > 0 ? gPax / gSold : 0);
            set(`geral_coef_ad_${s}`, gSold > 0 ? gAd / gSold : 0);
            set(`geral_coef_chd_${s}`, gSold > 0 ? gChd / gSold : 0);
            const gRevFap = lzRevFap + evRevFap;
            set(`geral_rev_fap_${s}`, gRevFap);
            set(`geral_dm_fap_${s}`, gSold > 0 ? gRevFap / gSold : 0);

            // Mão de obra só existe no nível Geral (não há quebra por Lazer/Eventos) — CLT e
            // Extra são entrada manual direta aqui, Total é só a soma dos dois.
            const gMoClt = get(`geral_mo_clt_${s}`);
            const gMoExtra = get(`geral_mo_extra_${s}`);
            set(`geral_mo_total_${s}`, gMoClt + gMoExtra);

            // Receita Extra Lazer/Evento — só existe de verdade no modo "On the books", mas é
            // seguro repassar sempre (dá zero quando não preenchido, e nada mais lê esses campos
            // fora do modo OTB).
            const lzExtra = get(`lazer_extra_rev_${s}`);
            const evExtra = get(`event_extra_rev_${s}`);
            set(`lazer_extra_rev_${s}`, lzExtra);
            set(`event_extra_rev_${s}`, evExtra);
            set(`geral_extra_rev_${s}`, lzExtra + evExtra);
        });

        return newData;
    };

    // Transform data into a 12-month array format for BudgetOccupancyTable
    const tableData: Record<string, number[]> = useMemo(() => {
        if (period === 'Meta') {
            return budgetData || {};
        }

        const result: Record<string, number[]> = {};
        const allRowIds = [...geralRows, ...lazerRows, ...eventRows].map(r => r.id);

        allRowIds.forEach(id => {
            result[id] = Array(12).fill(0);
        });

        const targetYear = period === 'Ano anterior' ? selectedYear - 1 : selectedYear;
        const getDaysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();

        for (let i = 0; i < 12; i++) {
            // Reunião de Ritmo/FCA N1/FCA N2/Fechamento têm seu próprio snapshot isolado (sufixo
            // pela versão), nunca misturado com o balde "Realizado" de sempre nem entre si. "On
            // the books" ganha mais um sufixo em cima disso, também isolado por versão.
            const contextKey = otbMode
                ? `${selectedHotel}_${selectedYear}_${i + 1}_${activeRealVersionId || ''}__${period}__OTB`
                : usesProjectionSnapshot
                    ? `${selectedHotel}_${selectedYear}_${i + 1}_${activeRealVersionId || ''}__${period}`
                    : `${selectedHotel}_${targetYear}_${i + 1}_${activeRealVersionId || ''}`;
            const rawMonthData = realOccupancyData?.[contextKey] || {};
            const monthData = isMeetingMode
                ? recalculateMeetingProjectionForMonth(rawMonthData, i)
                : recalculateRealForMonth(rawMonthData, i);

            const daysInMonth = getDaysInMonth(targetYear, i + 1);
            let baseCap = 0;
            if (monthData['geral_capacity_forecast'] !== undefined) {
                baseCap = monthData['geral_capacity_forecast'];
            } else if (budgetData && budgetData['geral_capacity'] && budgetData['geral_capacity'][i] !== undefined) {
                baseCap = budgetData['geral_capacity'][i];
            } else if (budgetData && budgetData['lazer_capacity'] && budgetData['lazer_capacity'][i] !== undefined) {
                baseCap = budgetData['lazer_capacity'][i];
            }

            allRowIds.forEach(id => {
                if (id === 'days_month') {
                    result[id][i] = daysInMonth;
                    return;
                }

                if (id === 'lazer_capacity' || id === 'event_capacity' || id === 'geral_capacity') {
                    result[id][i] = baseCap;
                    return;
                }

                if (id === 'lazer_avail' || id === 'event_avail' || id === 'geral_avail') {
                    result[id][i] = baseCap * daysInMonth;
                    return;
                }

                const val = monthData[`${id}_forecast`];
                if (val !== undefined) {
                    result[id][i] = val;
                } else if (budgetData && budgetData[id] && budgetData[id][i] !== undefined) {
                    result[id][i] = budgetData[id][i];
                }
            });
        }
        return result;
    }, [realOccupancyData, selectedHotel, selectedYear, budgetData, period, activeRealVersionId]);

    const recalculateBudget = (data: Record<string, number[]>) => {
        const newData = { ...data };
        const months = Array.from({ length: 12 }, (_, i) => i);
        const get = (key: string, idx: number) => newData[key]?.[idx] || 0;
        const set = (key: string, idx: number, val: number) => {
            if (!newData[key]) newData[key] = Array(12).fill(0);
            else if (newData[key] === data[key]) newData[key] = [...newData[key]];
            newData[key][idx] = val;
        };
        const getDaysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();

        months.forEach(i => {
            const currentDays = get('days_month', i);
            const days = currentDays > 0 ? currentDays : getDaysInMonth(selectedYear, i + 1);
            if (currentDays === 0) set('days_month', i, days);
            const gCap = get('geral_capacity', i);

            const lzCap = gCap;
            const lzAvail = lzCap * days;
            set('lazer_capacity', i, lzCap);
            set('lazer_avail', i, lzAvail);

            const lzSold = get('lazer_sold', i);
            const lzAd = get('lazer_adults', i);
            const lzChd = get('lazer_chd', i);
            const lzRevFap = get('lazer_rev_fap', i);
            const lzPax = lzAd + lzChd;
            let lzRevHosp = get('lazer_rev_hosp', i);
            if (!lzRevHosp && lzRevHosp !== 0) lzRevHosp = 0;
            
            const lzRateAd = lzAd > 0 ? (lzRevFap - lzRevHosp) / lzAd : 0;
            const lzRateChd = lzChd > 0 ? (lzRevFap - lzRevHosp) / lzChd : 0;

            set('lazer_occ_pct', i, lzAvail > 0 ? (lzSold / lzAvail) * 100 : 0);
            set('lazer_pax', i, lzPax);
            set('lazer_coef_total', i, lzSold > 0 ? lzPax / lzSold : 0);
            set('lazer_coef_ad', i, lzSold > 0 ? lzAd / lzSold : 0);
            set('lazer_coef_chd', i, lzSold > 0 ? lzChd / lzSold : 0);
            set('lazer_rev_fap', i, lzRevFap);
            set('lazer_rev_hosp', i, lzRevHosp);
            set('lazer_dm_fap', i, lzSold > 0 ? lzRevFap / lzSold : 0);
            set('lazer_dm_hosp', i, lzSold > 0 ? lzRevHosp / lzSold : 0);
            set('lazer_revpar', i, lzAvail > 0 ? lzRevFap / lzAvail : 0);
            set('lazer_rate_ad', i, lzRateAd);
            set('lazer_rate_chd', i, lzRateChd);

            const evCap = gCap;
            const evAvail = evCap * days;
            set('event_capacity', i, evCap);
            set('event_avail', i, evAvail);

            const evSold = get('event_sold', i);
            const evAd = get('event_adults', i);
            const evChd = get('event_chd', i);
            const evRevFap = get('event_rev_fap', i);
            const evPax = evAd + evChd;
            let evRevHosp = get('event_rev_hosp', i);
            if (!evRevHosp && evRevHosp !== 0) evRevHosp = 0;
            
            const evRateAd = evAd > 0 ? (evRevFap - evRevHosp) / evAd : 0;
            const evRateChd = evChd > 0 ? (evRevFap - evRevHosp) / evChd : 0;

            set('event_occ_pct', i, evAvail > 0 ? (evSold / evAvail) * 100 : 0);
            set('event_pax', i, evPax);
            set('event_coef_total', i, evSold > 0 ? evPax / evSold : 0);
            set('event_pax', i, evPax);
            set('event_coef_ad', i, evSold > 0 ? evAd / evSold : 0);
            set('event_coef_chd', i, evSold > 0 ? evChd / evSold : 0);
            set('event_rev_fap', i, evRevFap);
            set('event_rev_hosp', i, evRevHosp);
            set('event_dm_fap', i, evSold > 0 ? evRevFap / evSold : 0);
            set('event_dm_hosp', i, evSold > 0 ? evRevHosp / evSold : 0);
            set('event_revpar', i, evAvail > 0 ? evRevFap / evAvail : 0);
            set('event_rate_ad', i, evRateAd);
            set('event_rate_chd', i, evRateChd);

            const gAvail = gCap * days;
            set('geral_avail', i, gAvail);

            const gSold = lzSold + evSold;
            const gAd = lzAd + evAd;
            const gChd = lzChd + evChd;
            const gPax = gAd + gChd;
            const gRevFap = lzRevFap + evRevFap;
            const gRevHosp = lzRevHosp + evRevHosp;

            set('geral_sold', i, gSold);
            set('geral_occ_pct', i, gAvail > 0 ? (gSold / gAvail) * 100 : 0);
            set('geral_pax', i, gPax);
            set('geral_coef_total', i, gSold > 0 ? gPax / gSold : 0);
            set('geral_adults', i, gAd);
            set('geral_coef_ad', i, gSold > 0 ? gAd / gSold : 0);
            set('geral_chd', i, gChd);
            set('geral_coef_chd', i, gSold > 0 ? gChd / gSold : 0);

            set('geral_rate_ad', i, gAd > 0 ? (gRevFap - gRevHosp) / gAd : 0); 
            set('geral_rate_chd', i, gChd > 0 ? (gRevFap - gRevHosp) / gChd : 0); 

            set('geral_rev_fap', i, gRevFap);
            set('geral_rev_hosp', i, gRevHosp);

            const lzExtra = get('lazer_extra_rev', i);
            const evExtra = get('event_extra_rev', i);
            const gExtra = lzExtra + evExtra;
            set('geral_extra_rev', i, gExtra);

            const gOrExtras = get('geral_or_extras', i);
            const gOrHosp = get('geral_or_hosp', i);

            set('geral_dm_fap', i, gSold > 0 ? gRevFap / gSold : 0);
            set('geral_dm_hosp', i, gSold > 0 ? gRevHosp / gSold : 0);
            set('geral_revpar', i, gAvail > 0 ? gRevFap / gAvail : 0);
            set('geral_trevpor', i, gSold > 0 ? (gRevFap + gExtra + gOrExtras + gOrHosp) / gSold : 0);
            set('geral_trevpar', i, gAvail > 0 ? (gRevFap + gExtra + gOrExtras + gOrHosp) / gAvail : 0);

            set('lazer_trevpor', i, lzSold > 0 ? (lzRevFap + lzExtra) / lzSold : 0);
            set('lazer_trevpar', i, lzAvail > 0 ? (lzRevFap + lzExtra) / lzAvail : 0);

            set('event_trevpor', i, evSold > 0 ? (evRevFap + evExtra) / evSold : 0);
            set('event_trevpar', i, evAvail > 0 ? (evRevFap + evExtra) / evAvail : 0);
        });

        return newData;
    };

    const handleUpdate = (rowId: string, monthIndex: number, value: number) => {
        if (period === 'Meta') {
            if (setBudgetOccupancyDataMap && activeBudgetVersionId) {
                setBudgetOccupancyDataMap(prev => {
                    const versionData = prev[activeBudgetVersionId] || {};
                    const newRowData = [...(versionData[rowId] || Array(12).fill(0))];
                    newRowData[monthIndex] = value;
                    const newData = { ...versionData, [rowId]: newRowData };
                    const recalculated = recalculateBudget(newData);
                    return {
                        ...prev,
                        [activeBudgetVersionId]: recalculated
                    };
                });
            }
            return;
        }

        if (!setRealOccupancyData) return;

        const targetYear = period === 'Ano anterior' ? selectedYear - 1 : selectedYear;
        const month = monthIndex + 1;
        const contextKey = otbMode
            ? `${selectedHotel}_${selectedYear}_${month}_${activeRealVersionId || ''}__${period}__OTB`
            : usesProjectionSnapshot
                ? `${selectedHotel}_${selectedYear}_${month}_${activeRealVersionId || ''}__${period}`
                : `${selectedHotel}_${targetYear}_${month}_${activeRealVersionId || ''}`;

        setRealOccupancyData(prev => {
            const contextData = prev[contextKey] || {};
            const newData = {
                ...contextData,
                [`${rowId}_forecast`]: value,
                [`${rowId}_previa`]: value
            };
            const recalculated = isMeetingMode
                ? recalculateMeetingProjectionForMonth(newData, monthIndex)
                : recalculateRealForMonth(newData, monthIndex);

            return {
                ...prev,
                [contextKey]: recalculated
            };
        });
    };

    return (
        // Cabeçalho + filtros ficam FORA da área que rola — evita depender de position:sticky
        // (que, aninhado dentro do padding-top do <main> global, deixava uma fresta por onde uma
        // linha da tabela aparecia por cima do quadro). Aqui o cabeçalho nunca rola de verdade.
        <div className="h-full flex flex-col bg-gray-50">
        <div className="px-8 pt-6 shrink-0">
        <div className="max-w-[1600px] mx-auto px-8 pt-8 pb-6 bg-white shadow-sm border border-gray-200 rounded-2xl">
            <VersionInfoBanner versionName={activeRealVersionName} />
            <div className="mb-6 flex items-start justify-between">
                <div>
                    <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-bold text-gray-900">Ocupação</h2>
                        <span className="bg-indigo-50 border border-indigo-200 text-indigo-700 text-sm rounded-lg py-1 px-3 font-bold">
                            {PERIOD_LABELS[period]}
                        </span>
                    </div>
                    <p className="text-gray-500 mt-1">Visão anual de ocupação. As alterações feitas aqui alimentam automaticamente as colunas correspondentes no DRE Forecast.</p>
                </div>
                {canEditOccupancy && (
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleManualSave}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all shadow-sm border ${savedIndicator
                                ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                                : 'bg-indigo-600 text-white border-indigo-700 hover:bg-indigo-700'
                                }`}
                        >
                            {savedIndicator ? <CheckCircle size={16} /> : <Save size={16} />}
                            {savedIndicator ? 'Salvo!' : 'Salvar Ocupação'}
                        </button>
                    </div>
                )}
            </div>

            <div className="flex flex-wrap gap-4 items-center">
                <div className="flex items-center bg-gray-100 p-1 rounded-lg">
                    {PERIOD_ORDER.map(p => (
                        <button
                            key={p}
                            onClick={() => handlePeriodChange(p)}
                            className={`px-4 py-1.5 text-sm font-bold rounded-md transition-all ${
                                period === p
                                    ? 'bg-white text-indigo-600 shadow-sm border border-gray-200'
                                    : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            {PERIOD_LABELS[p]}
                        </button>
                    ))}
                </div>

                {isMeetingMode && (
                    <div className="flex items-center bg-gray-100 p-1 rounded-lg">
                        <button
                            onClick={() => setOtbMode(false)}
                            className={`px-4 py-1.5 text-sm font-bold rounded-md transition-all ${
                                !otbMode ? 'bg-white text-indigo-600 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            {PERIOD_LABELS[period]}
                        </button>
                        <button
                            onClick={() => setOtbMode(true)}
                            className={`px-4 py-1.5 text-sm font-bold rounded-md transition-all ${
                                otbMode ? 'bg-white text-indigo-600 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            On the books
                        </button>
                    </div>
                )}

                <div className="h-6 w-px bg-gray-300"></div>
                
                <div className="flex items-center flex-wrap gap-1">
                    <span className="text-sm font-bold text-gray-700 mr-2">Filtrar Meses:</span>
                    {MONTHS.map((m, idx) => (
                        <button
                            key={m}
                            onClick={() => {
                                setVisibleMonthsFilter(prev =>
                                    prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx].sort((a, b) => a - b)
                                );
                            }}
                            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                                visibleMonthsFilter.includes(idx)
                                    ? 'bg-indigo-100 text-indigo-700 border border-indigo-200 shadow-sm'
                                    : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
                            }`}
                        >
                            {m}
                        </button>
                    ))}
                    <button
                        onClick={() => setVisibleMonthsFilter(visibleMonthsFilter.length === 12 ? [] : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])}
                        className="px-3 py-1 text-xs font-bold rounded-md transition-all bg-gray-100 text-gray-600 hover:bg-gray-200 ml-2 border border-gray-200"
                    >
                        {visibleMonthsFilter.length === 12 ? 'Deselecionar Todos' : 'Selecionar Todos'}
                    </button>
                </div>
            </div>
        </div>
        </div>

        <div className="flex-1 overflow-y-auto px-8 pt-6 pb-8">
        <div className="max-w-[1600px] mx-auto">

            <BudgetOccupancyTable
                title="Geral"
                rows={isMeetingMode ? (otbMode ? getOtbRows(geralRows, 'geral') : getMeetingRows(geralRows, 'geral')) : geralRows}
                data={tableData}
                onUpdate={handleUpdate}
                decimalOverrides={decimalOverrides}
                onToggleDecimals={toggleDecimals}
                canEdit={canEditOccupancy}
                isRealMode={true}
                visibleMonths={visibleMonthsFilter}
            />
            <BudgetOccupancyTable
                title="Lazer"
                rows={isMeetingMode ? (otbMode ? getOtbRows(lazerRows, 'lazer') : getMeetingRows(lazerRows, 'lazer')) : lazerRows}
                data={tableData}
                onUpdate={handleUpdate}
                decimalOverrides={decimalOverrides}
                onToggleDecimals={toggleDecimals}
                canEdit={canEditOccupancy}
                isRealMode={true}
                visibleMonths={visibleMonthsFilter}
            />
            <BudgetOccupancyTable
                title="Eventos Corporativos"
                rows={isMeetingMode ? (otbMode ? getOtbRows(eventRows, 'event') : getMeetingRows(eventRows, 'event')) : eventRows}
                data={tableData}
                onUpdate={handleUpdate}
                decimalOverrides={decimalOverrides}
                onToggleDecimals={toggleDecimals}
                canEdit={canEditOccupancy}
                isRealMode={true}
                visibleMonths={visibleMonthsFilter}
            />
        </div>
        </div>
        </div>
    );
};

export default OccupancyMonthlyRealView;
