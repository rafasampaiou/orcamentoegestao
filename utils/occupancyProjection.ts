// Extraída de OccupancyMonthlyRealView.tsx (era um closure local do componente) pra poder ser
// reaproveitada por quem PRECISA gravar Ocupação/Receita do Forecast fora daquela tela (ex.:
// ForecastTable.tsx, ao puxar da planilha externa na etapa 4) sem duplicar as fórmulas na mão —
// isso já causou bug 2x (fórmula esquecida/duplicada errado) antes dessa extração.
//
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
