import React, { useState, useEffect, useMemo } from 'react';
import { Account, CostPackage, Hotel, ImportedRow, ProjectionType } from '../types';
import { buildForecastRows, formatValue, formatPercentDiff, formatPointsDiff } from './ForecastTable';

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
}

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// Mesmas 5 versões do resto do app — ver AnaliseABView.tsx.
const PROJECTION_TYPE_OPTIONS: { value: ProjectionType; label: string }[] = [
    { value: 'Reunião de Ritmo', label: 'Reunião de Ritmo' },
    { value: 'FCA N2', label: 'FCA N2' },
    { value: 'FCA N1', label: 'FCA N1' },
    { value: 'Fechamento oficial', label: 'Fechamento' },
    { value: 'Realizado', label: 'Realizado' },
];

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
    const base = 'px-2 py-1.5 text-right tabular-nums whitespace-nowrap';
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
    activeProjectionType, setActiveProjectionType,
}) => {
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

    const gopBlocks: GopBlock[] = useMemo(() => {
        type RawBlock = { hotel: Hotel; isAdm: boolean; revenue: PeriodTotals; tax: PeriodTotals; expense: PeriodTotals };
        const raw: RawBlock[] = perHotelMonthlyRows.map(({ hotel, monthsRows }) => ({
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
                { label: 'GOP R$ sem imposto', format: 'currency', kind: 'receita', values: gopRSemImp },
                { label: 'GOP % sem imposto', format: 'percent', kind: 'receita', values: gopPctSemImp },
            ];
            const ppm = gopR.budget ? (gopR.previa / gopR.budget) * 100 : null;
            return { rows, ppm };
        };

        const blocks: GopBlock[] = raw.map(b => {
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
        });

        // Linha "Grupo" — soma de todos os hotéis selecionados (inclui a despesa da
        // Administradora), recalculando o GOP a partir dos totais somados (nunca somando GOP%
        // diretamente entre hotéis).
        if (raw.length > 0) {
            const grpRevenue = raw.reduce((acc, b) => addTotals(acc, b.revenue), zeroTotals());
            const grpTax = raw.reduce((acc, b) => addTotals(acc, b.tax), zeroTotals());
            const grpExpense = raw.reduce((acc, b) => addTotals(acc, b.expense), zeroTotals());
            const { rows, ppm } = buildNormalRows(grpRevenue, grpTax, grpExpense);
            blocks.push({ key: 'grupo', name: 'Grupo', isAdm: false, ppm, rows });
        }
        return blocks;
    }, [perHotelMonthlyRows]);

    return (
        <div className="px-4 py-6 min-h-[calc(100vh-5rem)] space-y-4">
            <div className="inline-block max-w-full bg-white rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-gray-100 p-6">
                <h2 className="text-xl font-black text-gray-900 mb-4">Tabela de GOP</h2>

                <div className="flex flex-wrap items-start gap-6 mb-4">
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

                    <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Mês</p>
                        <div className="flex items-center flex-wrap gap-1">
                            {MONTH_LABELS.map((label, idx) => {
                                const monthNum = idx + 1;
                                const active = visibleMonths.includes(monthNum);
                                return (
                                    <button
                                        key={label}
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
                            <button
                                onClick={() => setSelectedHotelNames(effectiveSelectedNames.length === hotels.length ? [] : hotels.map(h => h.name))}
                                className="px-3 py-1 text-sm font-bold rounded-md transition-all bg-gray-100 text-gray-600 hover:bg-gray-200 ml-2 border border-gray-200"
                            >
                                {effectiveSelectedNames.length === hotels.length ? 'Deselecionar Todos' : 'Selecionar Todos'}
                            </button>
                        </div>
                    </div>
                </div>

                {!isSingleMonth && (
                    <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 font-bold mb-4">
                        Vários meses selecionados — os valores mostrados são a soma do período.
                    </p>
                )}

                <div className="overflow-x-auto border border-gray-200 rounded-xl">
                    <table className="min-w-full text-sm">
                        <thead className="bg-emerald-800 text-white">
                            <tr>
                                <th className="px-3 py-2.5 text-left font-bold uppercase tracking-wide text-sm">Filial</th>
                                <th className="px-3 py-2.5 text-left font-bold uppercase tracking-wide text-sm">Indicador</th>
                                <th className="px-3 py-2.5 text-right font-bold uppercase tracking-wide text-sm">REAL {selectedYear}</th>
                                <th className="px-3 py-2.5 text-right font-bold uppercase tracking-wide text-sm">META {selectedYear}</th>
                                <th className="px-3 py-2.5 text-right font-bold uppercase tracking-wide text-sm">R{yy}-M{yy}</th>
                                <th className="px-3 py-2.5 text-right font-bold uppercase tracking-wide text-sm">%</th>
                                <th className="px-3 py-2.5 text-right font-bold uppercase tracking-wide text-sm">REAL {(selectedYear || new Date().getFullYear()) - 1}</th>
                                <th className="px-3 py-2.5 text-right font-bold uppercase tracking-wide text-sm">R{yy}-R{yyLY}</th>
                                <th className="px-3 py-2.5 text-right font-bold uppercase tracking-wide text-sm">%</th>
                                <th className="px-3 py-2.5 text-center font-bold uppercase tracking-wide text-sm">GOP PPM</th>
                            </tr>
                        </thead>
                        <tbody>
                            {gopBlocks.length === 0 && (
                                <tr><td colSpan={10} className="text-center text-gray-400 italic py-8">Selecione ao menos um hotel.</td></tr>
                            )}
                            {gopBlocks.map((block, blockIdx) => block.rows.map((row, i) => {
                                const diffMeta = row.values.previa - row.values.budget;
                                const diffLY = row.values.previa - row.values.lastYear;
                                return (
                                    <tr key={`${block.key}-${i}`} className={`${blockIdx % 2 === 1 ? 'bg-gray-50/60' : 'bg-white'} border-b border-gray-100`}>
                                        {i === 0 && (
                                            <td rowSpan={block.rows.length} className="px-3 py-2 align-middle font-black text-gray-900 border-r border-gray-200 whitespace-nowrap">
                                                {block.name}
                                            </td>
                                        )}
                                        <td className="px-3 py-1.5 text-gray-600 font-semibold whitespace-nowrap">{row.label}</td>
                                        <td className="px-3 py-1.5 text-right tabular-nums font-semibold text-gray-800">{formatValue(row.values.previa, row.format)}</td>
                                        <td className="px-3 py-1.5 text-right tabular-nums text-gray-500">{formatValue(row.values.budget, row.format)}</td>
                                        <td className={diffCellClass(diffMeta, row.kind)}>{formatDelta(diffMeta, row.format)}</td>
                                        <td className={diffCellClass(diffMeta, row.kind)}>{formatDeltaPct(diffMeta, row.values.budget, row.format)}</td>
                                        <td className="px-3 py-1.5 text-right tabular-nums text-gray-500">{formatValue(row.values.lastYear, row.format)}</td>
                                        <td className={diffCellClass(diffLY, row.kind)}>{formatDelta(diffLY, row.format)}</td>
                                        <td className={diffCellClass(diffLY, row.kind)}>{formatDeltaPct(diffLY, row.values.lastYear, row.format)}</td>
                                        {i === 0 && (
                                            <td rowSpan={block.rows.length} className={`px-3 py-2 text-center align-middle font-black border-l border-gray-200 ${block.isAdm ? despesaPpmClass(block.ppm) : gopPpmClass(block.ppm)}`}>
                                                {block.ppm === null ? '-' : formatValue(block.ppm, 'percent')}
                                            </td>
                                        )}
                                    </tr>
                                );
                            }))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ComparativesView;
