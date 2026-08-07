import React, { useState, useEffect, useMemo } from 'react';
import jsPDF from 'jspdf';
import toast from 'react-hot-toast';
import { Account, CostPackage, Hotel, ImportedRow, ProjectionType, ValidationRecord } from '../types';
import { buildForecastRows, formatValue, formatPercentDiff, formatPointsDiff } from './ForecastTable';
import { captureElementByIdAsPngBlob, getPngBlobSize } from '../utils/captureElement';

const TABLE_WRAPPER_ID = 'tabela-gop-projecao-wrapper';

const blobToDataUrl = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
});

interface ComparativesViewProps {
    selectedMonth?: number;
    selectedYear?: number;
    financialData?: ImportedRow[];
    accounts: Account[];
    packages: CostPackage[];
    hotels: Hotel[];
    realOccupancyData?: Record<string, Record<string, number>>;
    activeRealVersionId?: string;
    activeBudgetVersionId?: string;
    budgetOccupancyData?: Record<string, number[]>;
    activeProjectionType?: ProjectionType;
    setActiveProjectionType?: React.Dispatch<React.SetStateAction<ProjectionType>>;
    validations?: ValidationRecord[];
}

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const ALL_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
// Ordem de "mais avançado" — usada pra achar, dado um mês já validado em mais de uma versão
// (raro, mas possível), qual delas prevalece. Mesma ordem de PROJECTION_TYPE_OPTIONS, invertida.
const PROJECTION_RANK: ProjectionType[] = ['Realizado', 'Fechamento oficial', 'FCA N1', 'FCA N2', 'Reunião de Ritmo'];

// Mesmas 5 versões do resto do app — ver AnaliseABView.tsx.
const PROJECTION_TYPE_OPTIONS: { value: ProjectionType; label: string }[] = [
    { value: 'Reunião de Ritmo', label: 'Reunião de Ritmo' },
    { value: 'FCA N2', label: 'FCA N2' },
    { value: 'FCA N1', label: 'FCA N1' },
    { value: 'Fechamento oficial', label: 'Fechamento' },
    { value: 'Realizado', label: 'Realizado' },
];

// "João Pessoa" entra 2x na ordem final (ver montagem de gopBlocks): uma vez como hotel próprio,
// e o hotel some/entra na comparação do "Grupo" x "Grupo com JP" — pedido explícito do usuário
// pra poder comparar o resultado do grupo com e sem esse hotel.
const DIACRITICS_REGEX = new RegExp("[\u0300-\u036f]", "g");
const normalizeName = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(DIACRITICS_REGEX, '');
const isJoaoPessoa = (name: string) => normalizeName(name) === 'joao pessoa';

// Ordem fixa pedida pelo usu\u00e1rio (2026-08-05), independente da ordem que `hotels` venha do
// backend \u2014 hot\u00e9is fora dessa lista entram no final, na ordem em que j\u00e1 vinham.
const HOTEL_ORDER = ['Atibaia', 'Caet\u00e9', 'Alex\u00e2nia', 'Arax\u00e1', 'Alegro', 'Administradora'];
const hotelOrderIndex = (name: string): number => {
    const idx = HOTEL_ORDER.findIndex(n => normalizeName(n) === normalizeName(name));
    return idx === -1 ? HOTEL_ORDER.length : idx;
};

interface PeriodTotals { previa: number; budget: number; lastYear: number; }
const zeroTotals = (): PeriodTotals => ({ previa: 0, budget: 0, lastYear: 0 });
const addTotals = (a: PeriodTotals, b: PeriodTotals): PeriodTotals => ({ previa: a.previa + b.previa, budget: a.budget + b.budget, lastYear: a.lastYear + b.lastYear });
const subTotals = (a: PeriodTotals, b: PeriodTotals): PeriodTotals => ({ previa: a.previa - b.previa, budget: a.budget - b.budget, lastYear: a.lastYear - b.lastYear });
// Percentuais (GOP %, % da receita) nunca são somados direto entre meses acumulados — sempre
// recalculados a partir dos totais em R$ já somados (mesmo padrão de AnaliseABView.tsx:344,
// cmvAlimentos), senão "acumular meses" daria uma % sem sentido (média de médias).
const pctOf = (num: PeriodTotals, den: PeriodTotals): PeriodTotals => ({
    previa: den.previa ? (num.previa / den.previa) * 100 : 0,
    budget: den.budget ? (num.budget / den.budget) * 100 : 0,
    lastYear: den.lastYear ? (num.lastYear / den.lastYear) * 100 : 0,
});

type RowKind = 'receita' | 'despesa';
type RowFormat = 'currency' | 'percent';

interface IndicatorRow { label: string; format: RowFormat; kind: RowKind; values: PeriodTotals; }

interface GopBlock {
    key: string;
    name: string;
    isAdm: boolean;
    ppm: number | null; // GOP PPM (hotéis normais/Grupo) ou Despesa PPM (Administradora)
    rows: IndicatorRow[];
}

// Verde ≥100%, amarelo 80–99,99%, vermelho <80% — confirmado com o usuário a partir do exemplo
// (Atibaia 106,2% verde; Grupo 87,5% amarelo; demais hotéis <80% vermelho).
const gopPpmClass = (ppm: number | null): string => {
    if (ppm === null || !isFinite(ppm)) return 'bg-gray-50 text-gray-400';
    if (ppm >= 100) return 'bg-emerald-100 text-emerald-800';
    if (ppm >= 80) return 'bg-amber-100 text-amber-800';
    return 'bg-red-100 text-red-800';
};
// Pra Administradora (só despesa, sem GOP) a lógica é invertida: gastar mais que o orçado é
// ruim, não bom. Bandas espelhadas (20 p.p.) — não há um corte exato pedido pelo usuário pro
// lado da despesa, fácil de ajustar aqui se ele pedir outro valor.
const despesaPpmClass = (ppm: number | null): string => {
    if (ppm === null || !isFinite(ppm)) return 'bg-gray-50 text-gray-400';
    if (ppm <= 100) return 'bg-emerald-100 text-emerald-800';
    if (ppm <= 120) return 'bg-amber-100 text-amber-800';
    return 'bg-red-100 text-red-800';
};

// Cor da célula de diferença: pra receita/GOP, "maior" é bom (verde); pra despesa/imposto, é o
// oposto — mesmo padrão de AnaliseABView.tsx (diffCellClass).
const diffCellClass = (diff: number, kind: RowKind): string => {
    const base = 'px-1.5 py-1 text-right tabular-nums whitespace-nowrap';
    if (!diff) return `${base} text-gray-400`;
    const isGood = kind === 'receita' ? diff > 0 : diff < 0;
    return `${base} ${isGood ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`;
};

// Coluna "Δ" (valor absoluto) — pra linhas percentuais mostra pontos percentuais (p.p.), igual à
// DRE Forecast (ForecastTable.tsx: isPercentFormatRow ? formatPointsDiff : ...).
const formatDelta = (diff: number, format: RowFormat): string => {
    if (format === 'percent') return formatPointsDiff(diff);
    if (!diff) return '-';
    return `${diff > 0 ? '+' : '-'}${formatValue(Math.abs(diff), 'currency')}`;
};
// Coluna "%" — pra linhas percentuais repete o mesmo p.p. (mesmo padrão da DRE Forecast); pra
// linhas em R$, mostra a variação percentual de fato.
const formatDeltaPct = (diff: number, base: number, format: RowFormat): string => {
    if (format === 'percent') return formatPointsDiff(diff);
    if (!base) return '-';
    return formatPercentDiff((diff / base) * 100);
};

const ComparativesView: React.FC<ComparativesViewProps> = ({
    selectedMonth, selectedYear, financialData, accounts, packages, hotels,
    realOccupancyData, activeRealVersionId, activeBudgetVersionId, budgetOccupancyData,
    activeProjectionType, setActiveProjectionType, validations,
}) => {
    // "Projetar": ano inteiro por hotel — meses já validados usam Real/Prévia, os demais repetem
    // a Meta (escalada pelo WHAT IF % daquele hotel). Simulação client-side, não persiste.
    const [projectionMode, setProjectionMode] = useState(false);
    const [whatIfByHotel, setWhatIfByHotel] = useState<Record<string, number>>({});
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    // Print da tabela (exatamente como está na tela, com o WHAT IF de cada hotel) num PDF pra
    // baixar — mesma técnica de captura (html2canvas) já usada na feature "Gerar Apresentação".
    const handleGeneratePdf = async () => {
        setIsGeneratingPdf(true);
        try {
            const blob = await captureElementByIdAsPngBlob(TABLE_WRAPPER_ID);
            const { width, height } = await getPngBlobSize(blob);
            const dataUrl = await blobToDataUrl(blob);
            // A captura sai em retina (scale 2) — desfaz pra converter px@96dpi em pt (72/96).
            const widthPt = (width / 2) * 0.75;
            const heightPt = (height / 2) * 0.75;
            const marginTop = 40;
            const doc = new jsPDF({ unit: 'pt', format: [Math.max(widthPt, 300), heightPt + marginTop + 20] });
            doc.setFontSize(14);
            doc.text(`Tabela de GOP — Projeção ${selectedYear}`, 20, 24);
            doc.addImage(dataUrl, 'PNG', 0, marginTop, widthPt, heightPt);
            doc.save(`tabela-de-gop-projecao-${selectedYear}.pdf`);
            toast.success('PDF gerado!');
        } catch (err: any) {
            console.error('Erro ao gerar PDF da projeção:', err);
            toast.error('Erro ao gerar o PDF: ' + (err?.message || String(err)));
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    // Só conta como "mês já trabalhado" se existir uma validação com status "Validado" pra esse
    // hotel+ano+mês — "Em construção" ainda entra na repetição de Meta.
    const findValidatedVersion = (hotelId: string, month: number): ProjectionType | null => {
        const matches = (validations || []).filter(v => v.hotelId === hotelId && v.year === selectedYear && v.month === month && v.status === 'Validado');
        if (matches.length === 0) return null;
        return PROJECTION_RANK.find(rank => matches.some(v => v.projectionType === rank)) || null;
    };
    // Meses considerados — por padrão só o mês corrente, mas dá pra acumular vários (soma do
    // período), mesmo padrão/UI do filtro "Filtrar Meses" da Análise de A&B.
    const [visibleMonths, setVisibleMonths] = useState<number[]>(() => selectedMonth ? [selectedMonth] : [1]);
    useEffect(() => {
        setVisibleMonths(selectedMonth ? [selectedMonth] : [1]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedYear]);
    const isSingleMonth = visibleMonths.length === 1;

    // Hotéis incluídos na comparativa — múltipla escolha, default = todos (a tela é
    // inerentemente comparativa entre filiais, não faz sentido restringir a um único hotel).
    const [selectedHotelNames, setSelectedHotelNames] = useState<string[] | null>(null);
    useEffect(() => {
        if (selectedHotelNames === null && hotels.length > 0) setSelectedHotelNames(hotels.map(h => h.name));
    }, [hotels, selectedHotelNames]);
    const effectiveSelectedNames = selectedHotelNames ?? hotels.map(h => h.name);
    const toggleHotel = (name: string) => setSelectedHotelNames(prev => {
        const base = prev ?? hotels.map(h => h.name);
        return base.includes(name) ? base.filter(n => n !== name) : [...base, name];
    });

    // Linhas "sem imposto" só aparecem se o usuário pedir — a tabela já tem bastante coisa.
    const [hideSemImposto, setHideSemImposto] = useState(false);

    const yy = String(selectedYear || new Date().getFullYear()).slice(-2);
    const yyLY = String((selectedYear || new Date().getFullYear()) - 1).slice(-2);

    // Uma chamada de buildForecastRows por hotel selecionado × mês selecionado — mesma função
    // que já monta a DRE Forecast completa (ForecastTable.tsx:3603), reaproveitada sem duplicar
    // lógica de cálculo (mesmo padrão usado em AnaliseABView.tsx:177-181).
    const perHotelMonthlyRows = useMemo(() => {
        const selected = hotels.filter(h => effectiveSelectedNames.includes(h.name));
        return selected.map(hotel => ({
            hotel,
            monthsRows: visibleMonths.map(m => buildForecastRows(
                undefined, m, selectedYear, financialData, hotel.name, hotels,
                realOccupancyData || {}, activeRealVersionId, activeBudgetVersionId, accounts, packages,
                budgetOccupancyData || {}, activeProjectionType
            )),
        }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hotels, effectiveSelectedNames, visibleMonths, selectedYear, financialData, realOccupancyData, activeRealVersionId, activeBudgetVersionId, accounts, packages, budgetOccupancyData, activeProjectionType]);

    const sumField = (monthsRows: ReturnType<typeof buildForecastRows>[], rowId: string): PeriodTotals =>
        monthsRows.reduce((acc, rows) => {
            const r = rows.find(x => x.id === rowId);
            return { previa: acc.previa + (r?.previa || 0), budget: acc.budget + (r?.budget || 0), lastYear: acc.lastYear + (r?.lastYear || 0) };
        }, zeroTotals());

    // Estágio 1 (caro): pra cada hotel × cada um dos 12 meses do ano, descobre se o mês já foi
    // validado (e em qual versão) e busca Receita/Imposto/Despesa desse mês nessa versão — não
    // depende do WHAT IF, só recalcula se os dados/hotéis/validações mudarem.
    const perHotelMonthlyAnnual = useMemo(() => {
        if (!projectionMode) return [];
        const selected = hotels.filter(h => effectiveSelectedNames.includes(h.name));
        return selected.map(hotel => ({
            hotel,
            months: ALL_MONTHS.map(m => {
                const validated = findValidatedVersion(hotel.id, m);
                const rows = buildForecastRows(
                    undefined, m, selectedYear, financialData, hotel.name, hotels,
                    realOccupancyData || {}, activeRealVersionId, activeBudgetVersionId, accounts, packages,
                    budgetOccupancyData || {}, validated || activeProjectionType
                );
                return {
                    worked: !!validated,
                    revenue: rows.find(r => r.id === 'REV-TOTAL'),
                    tax: rows.find(r => r.id === 'REV-IMP'),
                    expense: rows.find(r => r.id === 'CST-HEAD'),
                };
            }),
        }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectionMode, hotels, effectiveSelectedNames, selectedYear, financialData, realOccupancyData, activeRealVersionId, activeBudgetVersionId, accounts, packages, budgetOccupancyData, activeProjectionType, validations]);

    // Estágio 2 (barato): aplica o WHAT IF % de cada hotel nos meses ainda não trabalhados —
    // arrastar o slider só recalcula isso, não repete as 12 chamadas de buildForecastRows.
    const perHotelProjectedTotals = useMemo(() => perHotelMonthlyAnnual.map(({ hotel, months }) => {
        const pct = (whatIfByHotel[hotel.id] ?? 100) / 100;
        const combine = (field: 'revenue' | 'tax' | 'expense'): PeriodTotals => months.reduce((acc, mo) => {
            const r = mo[field];
            const previaContribution = mo.worked ? (r?.previa || 0) : (r?.budget || 0) * pct;
            return {
                previa: acc.previa + previaContribution,
                budget: acc.budget + (r?.budget || 0),
                lastYear: acc.lastYear + (r?.lastYear || 0),
            };
        }, zeroTotals());
        return { hotel, isAdm: hotel.type === 'Administradora', revenue: combine('revenue'), tax: combine('tax'), expense: combine('expense') };
    }), [perHotelMonthlyAnnual, whatIfByHotel]);

    const gopBlocks: GopBlock[] = useMemo(() => {
        type RawBlock = { hotel: Hotel; isAdm: boolean; revenue: PeriodTotals; tax: PeriodTotals; expense: PeriodTotals };
        const raw: RawBlock[] = projectionMode ? perHotelProjectedTotals : perHotelMonthlyRows.map(({ hotel, monthsRows }) => ({
            hotel,
            isAdm: hotel.type === 'Administradora',
            revenue: sumField(monthsRows, 'REV-TOTAL'),
            tax: sumField(monthsRows, 'REV-IMP'),
            expense: sumField(monthsRows, 'CST-HEAD'),
        }));

        // Receita total do grupo (só hotéis com receita própria) — usada no "% da receita" da
        // Administradora, já que ela não tem receita própria pra comparar a despesa contra.
        const groupRevenue = raw.filter(b => !b.isAdm).reduce((acc, b) => addTotals(acc, b.revenue), zeroTotals());

        const buildNormalRows = (revenue: PeriodTotals, tax: PeriodTotals, expense: PeriodTotals) => {
            const gopR = subTotals(subTotals(revenue, tax), expense);
            const gopRSemImp = subTotals(revenue, expense);
            const gopPct = pctOf(gopR, revenue);
            const gopPctSemImp = pctOf(gopRSemImp, revenue);
            const rows: IndicatorRow[] = [
                { label: 'Receita', format: 'currency', kind: 'receita', values: revenue },
                { label: 'Imposto', format: 'currency', kind: 'despesa', values: tax },
                { label: 'Despesa', format: 'currency', kind: 'despesa', values: expense },
                { label: 'GOP R$', format: 'currency', kind: 'receita', values: gopR },
                { label: 'GOP %', format: 'percent', kind: 'receita', values: gopPct },
                ...(hideSemImposto ? [] : [
                    { label: 'GOP R$ sem imposto', format: 'currency' as const, kind: 'receita' as const, values: gopRSemImp },
                    { label: 'GOP % sem imposto', format: 'percent' as const, kind: 'receita' as const, values: gopPctSemImp },
                ]),
            ];
            const ppm = gopR.budget ? (gopR.previa / gopR.budget) * 100 : null;
            return { rows, ppm };
        };
        const blockFor = (b: RawBlock): GopBlock => {
            if (b.isAdm) {
                const pctReceita = pctOf(b.expense, groupRevenue);
                const rows: IndicatorRow[] = [
                    { label: 'Despesa', format: 'currency', kind: 'despesa', values: b.expense },
                    { label: '% da receita', format: 'percent', kind: 'despesa', values: pctReceita },
                ];
                const ppm = b.expense.budget ? (b.expense.previa / b.expense.budget) * 100 : null;
                return { key: b.hotel.id, name: b.hotel.name, isAdm: true, ppm, rows };
            }
            const { rows, ppm } = buildNormalRows(b.revenue, b.tax, b.expense);
            return { key: b.hotel.id, name: b.hotel.name, isAdm: false, ppm, rows };
        };

        // Ordem final pedida pelo usuário: todos os hotéis normais (na ordem em que já vêm em
        // `hotels`) + Administradora, depois "Grupo" (soma sem João Pessoa), depois João Pessoa
        // como hotel próprio (se selecionado), e por fim "Grupo com JP" (soma incluindo ele) — pra
        // comparar o resultado do grupo com e sem esse hotel.
        const jpRaw = raw.find(b => isJoaoPessoa(b.hotel.name));
        const nonJpRaw = raw.filter(b => !isJoaoPessoa(b.hotel.name))
            .sort((a, b) => hotelOrderIndex(a.hotel.name) - hotelOrderIndex(b.hotel.name));

        const blocks: GopBlock[] = nonJpRaw.map(blockFor);

        if (nonJpRaw.length > 0) {
            const grpRevenue = nonJpRaw.reduce((acc, b) => addTotals(acc, b.revenue), zeroTotals());
            const grpTax = nonJpRaw.reduce((acc, b) => addTotals(acc, b.tax), zeroTotals());
            const grpExpense = nonJpRaw.reduce((acc, b) => addTotals(acc, b.expense), zeroTotals());
            const { rows, ppm } = buildNormalRows(grpRevenue, grpTax, grpExpense);
            blocks.push({ key: 'grupo', name: 'Grupo', isAdm: false, ppm, rows });
        }

        if (jpRaw) {
            blocks.push(blockFor(jpRaw));
            const grpRevenue = raw.reduce((acc, b) => addTotals(acc, b.revenue), zeroTotals());
            const grpTax = raw.reduce((acc, b) => addTotals(acc, b.tax), zeroTotals());
            const grpExpense = raw.reduce((acc, b) => addTotals(acc, b.expense), zeroTotals());
            const { rows, ppm } = buildNormalRows(grpRevenue, grpTax, grpExpense);
            blocks.push({ key: 'grupo-com-jp', name: 'Grupo com JP', isAdm: false, ppm, rows });
        }
        return blocks;
    }, [perHotelMonthlyRows, perHotelProjectedTotals, projectionMode, hideSemImposto]);

    return (
        <div className="px-4 py-6 min-h-[calc(100vh-5rem)] space-y-4">
            <div className="inline-block max-w-full bg-white rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-black text-gray-900">Tabela de GOP</h2>
                    <div className="flex items-center gap-2">
                        {projectionMode && (
                            <button
                                onClick={handleGeneratePdf}
                                disabled={isGeneratingPdf}
                                className="px-4 py-2 rounded-lg text-sm font-bold transition-all bg-white text-indigo-700 border border-indigo-200 hover:bg-indigo-50 disabled:opacity-50"
                            >
                                {isGeneratingPdf ? 'Gerando PDF...' : 'Gerar PDF'}
                            </button>
                        )}
                        <button
                            onClick={() => setProjectionMode(v => !v)}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${projectionMode
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'}`}
                        >
                            {projectionMode ? 'Projeção ativa — clique pra sair' : 'Projetar'}
                        </button>
                    </div>
                </div>

                {projectionMode && (
                    <p className="text-sm text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 font-bold mb-4">
                        Modo Projeção: meses já validados usam Real/Prévia; os demais repetem a Meta, escalada pelo WHAT IF % de cada hotel — sempre o ano inteiro (Jan–Dez).
                    </p>
                )}

                <div className="flex flex-wrap items-start gap-6 mb-3">
                    {setActiveProjectionType && (
                        <div>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Versão</p>
                            <div className="flex items-center bg-gray-100 p-1 rounded-lg">
                                {PROJECTION_TYPE_OPTIONS.map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => setActiveProjectionType(opt.value)}
                                        className={`px-3 py-1.5 text-sm font-bold rounded-md transition-all ${activeProjectionType === opt.value
                                            ? 'bg-white text-indigo-600 shadow-sm border border-gray-200'
                                            : 'text-gray-500 hover:text-gray-700'}`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className={projectionMode ? 'opacity-40 pointer-events-none' : ''}>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Mês {projectionMode && '(ano inteiro no modo Projeção)'}</p>
                        <div className="flex items-center flex-wrap gap-1">
                            {MONTH_LABELS.map((label, idx) => {
                                const monthNum = idx + 1;
                                const active = visibleMonths.includes(monthNum);
                                return (
                                    <button
                                        key={label}
                                        disabled={projectionMode}
                                        onClick={() => setVisibleMonths(prev => {
                                            const next = prev.includes(monthNum) ? prev.filter(m => m !== monthNum) : [...prev, monthNum].sort((a, b) => a - b);
                                            return next.length === 0 ? prev : next;
                                        })}
                                        className={`px-2.5 py-1 text-sm font-bold rounded-md transition-all ${active
                                            ? 'bg-indigo-100 text-indigo-700 border border-indigo-200 shadow-sm'
                                            : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}
                                    >
                                        {label}
                                    </button>
                                );
                            })}
                            <button
                                disabled={projectionMode}
                                onClick={() => setVisibleMonths(visibleMonths.length === 12 ? [selectedMonth || 1] : Array.from({ length: 12 }, (_, i) => i + 1))}
                                className="px-3 py-1 text-sm font-bold rounded-md transition-all bg-gray-100 text-gray-600 hover:bg-gray-200 ml-2 border border-gray-200"
                            >
                                {visibleMonths.length === 12 ? 'Deselecionar Todos' : 'Selecionar Todos'}
                            </button>
                        </div>
                    </div>

                    <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Hotel</p>
                        <div className="flex items-center flex-wrap gap-1 max-w-2xl">
                            {hotels.map(h => {
                                const active = effectiveSelectedNames.includes(h.name);
                                return (
                                    <button
                                        key={h.id}
                                        onClick={() => toggleHotel(h.name)}
                                        className={`px-2.5 py-1 text-sm font-bold rounded-md transition-all ${active
                                            ? 'bg-indigo-100 text-indigo-700 border border-indigo-200 shadow-sm'
                                            : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}
                                    >
                                        {h.name}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <label className="flex items-center gap-2 mb-4 cursor-pointer select-none">
                    <input type="checkbox" checked={hideSemImposto} onChange={e => setHideSemImposto(e.target.checked)} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                    <span className="text-sm font-bold text-gray-600">Ocultar GOP R$ / GOP % sem imposto</span>
                </label>

                {!isSingleMonth && !projectionMode && (
                    <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 font-bold mb-4">
                        Vários meses selecionados — os valores mostrados são a soma do período.
                    </p>
                )}

                <div id={TABLE_WRAPPER_ID} className="inline-block max-w-full overflow-x-auto border border-gray-200 rounded-xl">
                    <table className="text-xs table-fixed">
                        <colgroup>
                            <col style={{ width: '88px' }} />
                            <col style={{ width: '130px' }} />
                            <col style={{ width: '90px' }} />
                            <col style={{ width: '90px' }} />
                            <col style={{ width: '85px' }} />
                            <col style={{ width: '65px' }} />
                            <col style={{ width: '90px' }} />
                            <col style={{ width: '85px' }} />
                            <col style={{ width: '65px' }} />
                            <col style={{ width: '75px' }} />
                            {projectionMode && <col style={{ width: '90px' }} />}
                        </colgroup>
                        <thead className="bg-emerald-800 text-white">
                            <tr>
                                <th className="px-2 py-2 text-center font-bold uppercase tracking-wide">Filial</th>
                                <th className="px-2 py-2 text-left font-bold uppercase tracking-wide">Indicador</th>
                                <th className="px-2 py-2 text-right font-bold uppercase tracking-wide">{projectionMode ? 'PROJETADO' : 'REAL'} {selectedYear}</th>
                                <th className="px-2 py-2 text-right font-bold uppercase tracking-wide">META {selectedYear}</th>
                                <th className="px-2 py-2 text-right font-bold uppercase tracking-wide">R{yy}-M{yy}</th>
                                <th className="px-2 py-2 text-right font-bold uppercase tracking-wide">%</th>
                                <th className="px-2 py-2 text-right font-bold uppercase tracking-wide">REAL {(selectedYear || new Date().getFullYear()) - 1}</th>
                                <th className="px-2 py-2 text-right font-bold uppercase tracking-wide">R{yy}-R{yyLY}</th>
                                <th className="px-2 py-2 text-right font-bold uppercase tracking-wide">%</th>
                                <th className="px-2 py-2 text-center font-bold uppercase tracking-wide">GOP PPM</th>
                                {projectionMode && <th className="px-2 py-2 text-center font-bold uppercase tracking-wide">WHAT IF %</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {gopBlocks.length === 0 && (
                                <tr><td colSpan={projectionMode ? 11 : 10} className="text-center text-gray-400 italic py-8">Selecione ao menos um hotel.</td></tr>
                            )}
                            {gopBlocks.map((block, blockIdx) => {
                                const rowsJsx = block.rows.map((row, i) => {
                                const diffMeta = row.values.previa - row.values.budget;
                                const diffLY = row.values.previa - row.values.lastYear;
                                return (
                                    <tr key={`${block.key}-${i}`} className={`${row.label.startsWith('GOP') ? 'bg-gray-100/70' : (blockIdx % 2 === 1 ? 'bg-gray-50/60' : 'bg-white')} border-b border-gray-100`}>
                                        {i === 0 && (
                                            <td rowSpan={block.rows.length} className="px-2 py-1.5 text-center align-middle font-black text-gray-900 border-r border-gray-200 truncate">
                                                {block.name}
                                            </td>
                                        )}
                                        <td className="px-2 py-1 text-gray-600 font-semibold truncate">{row.label}</td>
                                        <td className="px-2 py-1 text-right tabular-nums font-semibold text-gray-800 truncate">{formatValue(row.values.previa, row.format)}</td>
                                        <td className="px-2 py-1 text-right tabular-nums text-gray-500 truncate">{formatValue(row.values.budget, row.format)}</td>
                                        <td className={diffCellClass(diffMeta, row.kind)}>{formatDelta(diffMeta, row.format)}</td>
                                        <td className={diffCellClass(diffMeta, row.kind)}>{formatDeltaPct(diffMeta, row.values.budget, row.format)}</td>
                                        <td className="px-2 py-1 text-right tabular-nums text-gray-500 truncate">{formatValue(row.values.lastYear, row.format)}</td>
                                        <td className={diffCellClass(diffLY, row.kind)}>{formatDelta(diffLY, row.format)}</td>
                                        <td className={diffCellClass(diffLY, row.kind)}>{formatDeltaPct(diffLY, row.values.lastYear, row.format)}</td>
                                        {i === 0 && (
                                            <td rowSpan={block.rows.length} className={`px-2 py-1.5 text-center align-middle font-black border-l border-gray-200 ${block.isAdm ? despesaPpmClass(block.ppm) : gopPpmClass(block.ppm)}`}>
                                                {block.ppm === null ? '-' : formatValue(block.ppm, 'percent')}
                                            </td>
                                        )}
                                        {projectionMode && i === 0 && (
                                            <td rowSpan={block.rows.length} className="px-2 py-1.5 text-center align-middle border-l border-gray-200">
                                                {(block.key === 'grupo' || block.key === 'grupo-com-jp') ? (
                                                    <span className="text-gray-400">-</span>
                                                ) : (
                                                    <div className="flex items-center justify-center gap-1">
                                                        <input
                                                            type="number" min={0} max={100}
                                                            value={whatIfByHotel[block.key] ?? 100}
                                                            onChange={e => {
                                                                const raw = Number(e.target.value);
                                                                const clamped = Math.min(100, Math.max(0, isNaN(raw) ? 100 : raw));
                                                                setWhatIfByHotel(prev => ({ ...prev, [block.key]: clamped }));
                                                            }}
                                                            className="w-12 text-center font-black text-indigo-700 border border-indigo-200 rounded px-1 py-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                                        />
                                                        <span className="text-[11px] font-black text-indigo-700">%</span>
                                                    </div>
                                                )}
                                            </td>
                                        )}
                                    </tr>
                                );
                                });
                                // Pequeno espaço em branco entre "Grupo" e "João Pessoa" — deixa claro que o que vem
                                // depois é uma comparação separada (com/sem esse hotel), não parte do mesmo bloco.
                                if (block.key === 'grupo') {
                                    rowsJsx.push(
                                        <tr key={`${block.key}-spacer`}>
                                            <td colSpan={projectionMode ? 11 : 10} className="h-3 p-0 bg-white border-0"></td>
                                        </tr>
                                    );
                                }
                                return rowsJsx;
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ComparativesView;
