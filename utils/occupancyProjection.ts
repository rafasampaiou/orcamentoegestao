// Extraída de OccupancyMonthlyRealView.tsx (era um closure local do componente) pra poder ser
// reaproveitada por quem PRECISA gravar Ocupação/Receita do Forecast fora daquela tela (ex.:
// ForecastTable.tsx, ao puxar da planilha externa na etapa 4) sem duplicar as fórmulas na mão —
// isso já causou bug 2x (fórmula esquecida/duplicada errado) antes dessa extração.
//
// Recalcula o Orçamento de Ocupação (grade de 12 meses da Meta/Budget — Geral/Lazer/Eventos).
// Extraída de OccupancyView.tsx (era `recalculateBudget`, closure local) pelo mesmo motivo acima —
// reaproveitada por BudgetReviewOccupancy.tsx (Revisão de Metas), que edita uma BudgetVersion que
// não é necessariamente a "principal" ativa do hotel.
export function recalculateBudgetOccupancy(data: Record<string, number[]>, selectedYear: number): Record<string, number[]> {
    const newData = { ...data };
    const months = Array.from({ length: 12 }, (_, i) => i);

    const get = (key: string, idx: number) => newData[key]?.[idx] || 0;
    const set = (key: string, idx: number, val: number) => {
        if (!newData[key]) {
            newData[key] = Array(12).fill(0);
        } else if (newData[key] === data[key]) {
            newData[key] = [...newData[key]];
        }
        newData[key][idx] = val;
    };

    const getDaysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();

    months.forEach(i => {
        const currentDays = get('days_month', i);
        const days = currentDays > 0 ? currentDays : getDaysInMonth(selectedYear, i + 1);
        if (currentDays === 0) {
            set('days_month', i, days);
        }
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
        if (!lzRevHosp && lzRevHosp !== 0) {
            lzRevHosp = 0;
        }

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
        if (!evRevHosp && evRevHosp !== 0) {
            evRevHosp = 0;
        }

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

        const gMoClt = get('geral_mo_clt', i);
        const gMoExtra = get('geral_mo_extra', i);
        set('geral_mo_total', i, gMoClt + gMoExtra);
    });

    return newData;
}

// Reunião de Ritmo / FCA N1 / FCA N2 — inverte a direção da fórmula em relação ao modo Realizado:
// aqui DM bruta e os Coef. Occ são as entradas manuais (Coef. Occ vem sugerido da Meta do mesmo
// mês, mas o usuário pode mudar), e Receita/Adultos/CHD/Geral são derivados.
export function recalculateMeetingProjectionForMonth(
    currentData: Record<string, number>,
    monthIdx: number,
    budgetData: Record<string, number[]> | undefined,
    selectedYear: number
): Record<string, number> {
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

        // Mão de obra só existe no nível Geral (não há quebra por Lazer/Eventos) — CLT e Extra
        // partem do valor da Meta enquanto o usuário não tiver digitado o próprio número (mesmo
        // default usado em Coef. Occ Adultos/CHD acima), mas continuam editáveis; Total é só a
        // soma dos dois.
        const metaMoClt = metaGet('geral_mo_clt');
        const metaMoExtra = metaGet('geral_mo_extra');
        const gMoClt = currentData[`geral_mo_clt_${s}`] !== undefined ? currentData[`geral_mo_clt_${s}`] : metaMoClt;
        const gMoExtra = currentData[`geral_mo_extra_${s}`] !== undefined ? currentData[`geral_mo_extra_${s}`] : metaMoExtra;
        set(`geral_mo_clt_${s}`, gMoClt);
        set(`geral_mo_extra_${s}`, gMoExtra);
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
}
