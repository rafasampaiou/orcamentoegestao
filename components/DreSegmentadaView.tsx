import React, { useEffect, useMemo, useState } from 'react';
import { Account, CostPackage, ForecastRow, Hotel, ImportedRow } from '../types';
import { buildForecastRows, formatValue, formatPointsDiff } from './ForecastTable';

interface DreSegmentadaViewProps {
    selectedMonth?: number;
    selectedYear?: number;
    financialData?: ImportedRow[];
    selectedHotel?: string;
    accounts: Account[];
    packages: CostPackage[];
    hotels: Hotel[];
    realOccupancyData?: Record<string, Record<string, number>>;
    activeRealVersionId?: string;
    activeBudgetVersionId?: string;
    budgetOccupancyData?: Record<string, number[]>;
}

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const FILTER_GROUP_CLASS = 'flex items-center flex-wrap gap-0.5 bg-gray-100 p-1 rounded-lg';
const filterPillClass = (active: boolean) => `px-2.5 py-1 text-sm font-bold rounded-md transition-all ${active
    ? 'bg-white text-indigo-600 shadow-sm border border-gray-200'
    : 'text-gray-500 hover:text-gray-700'}`;

interface Agg { atual: number; anterior: number; }
const zeroAgg = (): Agg => ({ atual: 0, anterior: 0 });

// Uma linha já pronta pra exibir numa das 2 tabelas (Lazer/Eventos) — currency ou percent, com
// indentação/negrito reaproveitados das linhas de despesa originais da DRE Forecast.
interface DisplayRow {
    id: string;
    label: string;
    atual: number;
    anterior: number;
    format: 'currency' | 'percent';
    indentLevel: number;
    bold: boolean;
    // Pra despesa/imposto, "subir" (atual > anterior) é ruim — inverte a cor do Δ.
    higherIsWorse?: boolean;
    // Linha de conta contábil (category 'Account' na DRE Forecast) — some quando "Ocultar Contas"
    // está ativo, deixando só Receita/Impostos/Receita Líquida/pacotes/GOP.
    isAccountRow?: boolean;
}

const diffColorClass = (diff: number, higherIsWorse?: boolean) => {
    if (diff === 0) return 'text-gray-500';
    const good = higherIsWorse ? diff < 0 : diff > 0;
    return good ? 'text-emerald-700' : 'text-red-700';
};

const DreSegmentadaView: React.FC<DreSegmentadaViewProps> = ({
    selectedMonth, selectedYear, financialData, selectedHotel, accounts, packages, hotels,
    realOccupancyData, activeRealVersionId, activeBudgetVersionId, budgetOccupancyData,
}) => {
    // Mesmo padrão de filtro de mês (multi-seleção, soma do período) já usado na Tabela de GOP —
    // resetado quando o ano muda, não quando o mês muda (usuário pode ter escolhido vários meses
    // de propósito e só troca de ano ocasionalmente).
    const [visibleMonths, setVisibleMonths] = useState<number[]>(() => selectedMonth ? [selectedMonth] : [1]);
    useEffect(() => {
        setVisibleMonths(selectedMonth ? [selectedMonth] : [1]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedYear]);

    // % de Despesas/Impostos alocado a Eventos (o resto vai pra Lazer) — null enquanto o usuário
    // não tiver ajustado manualmente, usando como default a mesma % que a Receita (ano atual) já
    // tem entre os dois segmentos. Client-side, não persiste (mesmo padrão do WHAT IF % da Tabela
    // de GOP).
    const [despesaPctEventos, setDespesaPctEventos] = useState<number | null>(null);
    const [impostoPctEventos, setImpostoPctEventos] = useState<number | null>(null);

    // "Ocultar Contas" (mesmo nome/comportamento do botão da DRE Forecast, ForecastTable.tsx) —
    // esconde as linhas de conta contábil (category 'Account'), deixando só Receita/Impostos/
    // Receita Líquida/cabeçalhos de pacote/GOP.
    const [showAccounts, setShowAccounts] = useState(false);

    const hotelObj = hotels.find(h => h.name === selectedHotel);
    const isAdminEntity = hotelObj?.type === 'Administradora';

    // Uma chamada de buildForecastRows por mês selecionado, sempre na versão Realizado (decisão
    // confirmada com o usuário: a DRE Segmentada não cai pra prévia validada, só conta o que já
    // foi lançado como Realizado). Mesmo padrão de `AnaliseABView.tsx` (monthlyDreRows).
    const monthlyDreRows = useMemo(() => {
        if (!selectedHotel || isAdminEntity) return [];
        return visibleMonths.map(m => buildForecastRows(
            undefined, m, selectedYear, financialData, selectedHotel, hotels,
            realOccupancyData || {}, activeRealVersionId, activeBudgetVersionId, accounts, packages,
            budgetOccupancyData || {}, 'Realizado'
        ));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visibleMonths, selectedYear, financialData, selectedHotel, hotels, isAdminEntity, realOccupancyData, activeRealVersionId, activeBudgetVersionId, accounts, packages, budgetOccupancyData]);

    // Estrutura (ids/labels/indentação) não varia por mês — usa o primeiro conjunto disponível só
    // pra saber QUAIS linhas de despesa existem e em que ordem/indentação mostrar.
    const referenceRows: ForecastRow[] = monthlyDreRows[0] || [];
    const despesaRows = useMemo(() => referenceRows.filter(r => r.category === 'Costs' || r.category === 'Package' || r.category === 'Account'), [referenceRows]);

    // Soma (Ano Atual = .previa, Ano Anterior = .lastYear) de cada linha across os meses
    // selecionados — um Map por id, montado uma vez só (não recalcula por linha).
    const aggMap = useMemo(() => {
        const perMonthMaps = monthlyDreRows.map(rows => new Map(rows.map(r => [r.id, r])));
        const map = new Map<string, Agg>();
        const idsToTrack = new Set<string>(['REV-APT-LAZER', 'REV-APT-EVENTOS', 'REV-EXTRA-LAZER', 'REV-EXTRA-EVENTOS', 'REV-IMP', 'CST-HEAD']);
        despesaRows.forEach(r => idsToTrack.add(r.id));
        idsToTrack.forEach(id => {
            let atual = 0, anterior = 0;
            perMonthMaps.forEach(m => {
                const row = m.get(id);
                atual += row?.previa || 0;
                anterior += row?.lastYear || 0;
            });
            map.set(id, { atual, anterior });
        });
        return map;
    }, [monthlyDreRows, despesaRows]);
    const agg = (id: string): Agg => aggMap.get(id) || zeroAgg();

    // % de receita Lazer/Eventos, ano atual e ano anterior — alimenta os cards informativos E o
    // default dos sliders de Despesa/Imposto.
    const receitaSplit = useMemo(() => {
        const lazerAtual = agg('REV-APT-LAZER').atual + agg('REV-EXTRA-LAZER').atual;
        const eventosAtual = agg('REV-APT-EVENTOS').atual + agg('REV-EXTRA-EVENTOS').atual;
        const lazerAnterior = agg('REV-APT-LAZER').anterior + agg('REV-EXTRA-LAZER').anterior;
        const eventosAnterior = agg('REV-APT-EVENTOS').anterior + agg('REV-EXTRA-EVENTOS').anterior;
        const totalAtual = lazerAtual + eventosAtual;
        const totalAnterior = lazerAnterior + eventosAnterior;
        return {
            pctEventosAtual: totalAtual ? (eventosAtual / totalAtual) * 100 : 50,
            pctEventosAnterior: totalAnterior ? (eventosAnterior / totalAnterior) * 100 : 50,
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [aggMap]);

    const effectiveDespesaPctEventos = despesaPctEventos ?? receitaSplit.pctEventosAtual;
    const effectiveImpostoPctEventos = impostoPctEventos ?? receitaSplit.pctEventosAtual;

    // Monta as linhas de exibição de UM segmento (Lazer ou Eventos) — mesma % de Despesa/Imposto
    // aplicada igual no Ano Atual e no Ano Anterior (não tem um slicer por ano).
    const buildSegmentRows = (segment: 'lazer' | 'eventos'): { rows: DisplayRow[]; receitaAtual: number; receitaAnterior: number } => {
        const isEventos = segment === 'eventos';
        const despesaFrac = (isEventos ? effectiveDespesaPctEventos : (100 - effectiveDespesaPctEventos)) / 100;
        const impostoFrac = (isEventos ? effectiveImpostoPctEventos : (100 - effectiveImpostoPctEventos)) / 100;

        const revApt = agg(isEventos ? 'REV-APT-EVENTOS' : 'REV-APT-LAZER');
        const revExtra = agg(isEventos ? 'REV-EXTRA-EVENTOS' : 'REV-EXTRA-LAZER');
        const receitaAtual = revApt.atual + revExtra.atual;
        const receitaAnterior = revApt.anterior + revExtra.anterior;

        const impostoTotal = agg('REV-IMP');
        const impostoAtual = impostoTotal.atual * impostoFrac;
        const impostoAnterior = impostoTotal.anterior * impostoFrac;

        const receitaLiqAtual = receitaAtual - impostoAtual;
        const receitaLiqAnterior = receitaAnterior - impostoAnterior;

        const despesaTotal = agg('CST-HEAD');
        const despesaTotalAtual = despesaTotal.atual * despesaFrac;
        const despesaTotalAnterior = despesaTotal.anterior * despesaFrac;

        const gopAtual = receitaLiqAtual - despesaTotalAtual;
        const gopAnterior = receitaLiqAnterior - despesaTotalAnterior;
        const gopPctAtual = receitaLiqAtual ? (gopAtual / receitaLiqAtual) * 100 : 0;
        const gopPctAnterior = receitaLiqAnterior ? (gopAnterior / receitaLiqAnterior) * 100 : 0;

        const rows: DisplayRow[] = [
            { id: 'REV-APT', label: 'Receita de Apartamentos', atual: revApt.atual, anterior: revApt.anterior, format: 'currency', indentLevel: 1, bold: false },
            { id: 'REV-EXTRA', label: 'Receitas Extras', atual: revExtra.atual, anterior: revExtra.anterior, format: 'currency', indentLevel: 1, bold: false },
            { id: 'REV-TOTAL-SEG', label: 'RECEITA BRUTA', atual: receitaAtual, anterior: receitaAnterior, format: 'currency', indentLevel: 0, bold: true },
            { id: 'REV-IMP-SEG', label: 'IMPOSTOS', atual: impostoAtual, anterior: impostoAnterior, format: 'currency', indentLevel: 0, bold: false, higherIsWorse: true },
            { id: 'REV-NET-SEG', label: 'RECEITA LÍQUIDA', atual: receitaLiqAtual, anterior: receitaLiqAnterior, format: 'currency', indentLevel: 0, bold: true },
            ...despesaRows.map(r => {
                const a = agg(r.id);
                return {
                    id: r.id, label: r.label, atual: a.atual * despesaFrac, anterior: a.anterior * despesaFrac,
                    format: 'currency' as const, indentLevel: r.indentLevel || 0, bold: !!(r.isHeader || r.isTotal), higherIsWorse: true,
                    isAccountRow: r.category === 'Account',
                };
            }),
            { id: 'GOP-SEG', label: 'GOP (R$)', atual: gopAtual, anterior: gopAnterior, format: 'currency', indentLevel: 0, bold: true },
            { id: 'GOP-PCT-SEG', label: 'GOP (%)', atual: gopPctAtual, anterior: gopPctAnterior, format: 'percent', indentLevel: 0, bold: true },
        ];
        return { rows, receitaAtual, receitaAnterior };
    };

    const lazerData = useMemo(() => buildSegmentRows('lazer'), [aggMap, despesaRows, effectiveDespesaPctEventos, effectiveImpostoPctEventos]);
    const eventosData = useMemo(() => buildSegmentRows('eventos'), [aggMap, despesaRows, effectiveDespesaPctEventos, effectiveImpostoPctEventos]);

    const renderPctInput = (label: string, value: number, onChange: (v: number) => void) => (
        <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">{label}</p>
            <div className="flex items-center gap-2">
                <input
                    type="number" min={0} max={100} step={0.1}
                    value={Math.round(value * 10) / 10}
                    onChange={e => {
                        const raw = Number(e.target.value);
                        const clamped = Math.min(100, Math.max(0, isNaN(raw) ? 0 : raw));
                        onChange(clamped);
                    }}
                    className="w-16 text-center font-black text-indigo-700 border border-indigo-200 rounded px-1 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
                <span className="text-[11px] font-black text-indigo-700">% Eventos</span>
                <span className="text-[11px] text-gray-400">({(100 - value).toFixed(1)}% Lazer)</span>
            </div>
        </div>
    );

    const renderTable = (title: string, data: { rows: DisplayRow[] }) => (
        <div className="bg-white rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-gray-100 p-6 min-w-0">
            <h3 className="text-lg font-black text-gray-900 mb-3">{title}</h3>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-gray-50 text-gray-500 text-xs font-black uppercase tracking-wide">
                            <th className="text-left px-3 py-2">Descrição</th>
                            <th className="text-right px-3 py-2">Ano Anterior</th>
                            <th className="text-right px-3 py-2">Ano Atual</th>
                            <th className="text-right px-3 py-2">Diferença</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.rows.filter(row => showAccounts || !row.isAccountRow).map(row => {
                            const diff = row.atual - row.anterior;
                            return (
                                <tr key={row.id} className={`border-b border-gray-100 ${row.bold ? 'bg-gray-50/60 font-black' : ''}`}>
                                    <td className="px-3 py-1.5" style={{ paddingLeft: `${0.75 + row.indentLevel * 1.25}rem` }}>{row.label}</td>
                                    <td className="text-right px-3 py-1.5 tabular-nums">{formatValue(row.anterior, row.format)}</td>
                                    <td className="text-right px-3 py-1.5 tabular-nums">{formatValue(row.atual, row.format)}</td>
                                    <td className={`text-right px-3 py-1.5 tabular-nums font-bold ${diffColorClass(diff, row.higherIsWorse)}`}>
                                        {row.format === 'percent' ? formatPointsDiff(diff) : `${diff >= 0 ? '+' : ''}${formatValue(diff, 'currency')}`}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );

    if (!selectedHotel) {
        return (
            <div className="px-4 py-6">
                <div className="bg-white rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-gray-100 p-6 text-gray-500">
                    Selecione um hotel pra ver a DRE Segmentada.
                </div>
            </div>
        );
    }

    if (isAdminEntity) {
        return (
            <div className="px-4 py-6">
                <div className="bg-white rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-gray-100 p-6 text-gray-500">
                    {selectedHotel} não tem receita/ocupação própria (hotel Administradora) — a DRE Segmentada (Lazer vs Eventos) não se aplica a ele.
                </div>
            </div>
        );
    }

    return (
        <div className="px-4 py-6 min-h-[calc(100vh-5rem)] space-y-4">
            <div className="bg-white rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-black text-gray-900">DRE Segmentada — Lazer vs Eventos</h2>
                    <button
                        onClick={() => setShowAccounts(prev => !prev)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors border ${!showAccounts
                            ? 'bg-indigo-100 text-indigo-700 border-indigo-200'
                            : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50 shadow-sm'
                            }`}
                        title={showAccounts ? 'Ocultar contas contábeis, deixando só Receita/Impostos/pacotes' : 'Mostrar as contas contábeis dentro de cada pacote'}
                    >
                        {showAccounts ? 'Ocultar Contas' : 'Mostrar Contas'}
                    </button>
                </div>

                <div className="mb-4">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Mês</p>
                    <div className="flex items-center gap-2">
                        <div className={`${FILTER_GROUP_CLASS} max-w-xl`}>
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
                                        className={filterPillClass(active)}
                                    >
                                        {label}
                                    </button>
                                );
                            })}
                        </div>
                        <button
                            onClick={() => setVisibleMonths(visibleMonths.length === 12 ? [selectedMonth || 1] : Array.from({ length: 12 }, (_, i) => i + 1))}
                            className="px-3 py-1 text-sm font-bold rounded-md transition-all bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200"
                        >
                            {visibleMonths.length === 12 ? 'Desmarcar Todos' : 'Selecionar Todos'}
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Receita — Ano Anterior</p>
                        <div className="flex justify-between text-sm font-black text-gray-700">
                            <span>Lazer: {(100 - receitaSplit.pctEventosAnterior).toFixed(1)}%</span>
                            <span>Eventos: {receitaSplit.pctEventosAnterior.toFixed(1)}%</span>
                        </div>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Receita — Ano Atual</p>
                        <div className="flex justify-between text-sm font-black text-gray-700">
                            <span>Lazer: {(100 - receitaSplit.pctEventosAtual).toFixed(1)}%</span>
                            <span>Eventos: {receitaSplit.pctEventosAtual.toFixed(1)}%</span>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap gap-6 mb-2">
                    {renderPctInput('% Despesas alocado', effectiveDespesaPctEventos, v => setDespesaPctEventos(v))}
                    {renderPctInput('% Impostos alocado', effectiveImpostoPctEventos, v => setImpostoPctEventos(v))}
                </div>
                <p className="text-[11px] text-gray-400">
                    Despesa e Imposto não são lançados por segmento — esses % distribuem o total real (sempre da versão Realizado) entre Lazer e Eventos, e valem igual pro Ano Atual e pro Ano Anterior. Ajuste livremente; o valor inicial acompanha a % da Receita.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {renderTable(`Lazer — ${selectedHotel}`, lazerData)}
                {renderTable(`Eventos — ${selectedHotel}`, eventosData)}
            </div>

            <p className="text-[11px] text-gray-400 px-2">
                Receitas de "Outras Receitas" (OR), Cancelamento de Time Share e ISS não têm segmento próprio nos dados — ficam de fora das duas tabelas acima, então a soma delas não bate 100% com a Receita Bruta Total do hotel.
            </p>
        </div>
    );
};

export default DreSegmentadaView;
