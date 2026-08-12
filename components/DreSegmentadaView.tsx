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

// Uma linha já pronta pra exibir na tabela única (Lazer | distribuição | Eventos).
interface CombinedRow {
    id: string;
    label: string;
    format: 'currency' | 'percent';
    indentLevel: number;
    bold: boolean;
    // Pra despesa/imposto, "subir" (atual > anterior) é ruim — inverte a cor do Δ.
    higherIsWorse?: boolean;
    isAccountRow?: boolean;
    lazerAtual: number; lazerAnterior: number;
    eventosAtual: number; eventosAnterior: number;
    // Só pras linhas de PACOTE de despesa — id do pacote pra achar/editar o % de distribuição.
    editablePkgId?: string;
}

const diffColorClass = (diff: number, higherIsWorse?: boolean) => {
    if (diff === 0) return 'text-gray-500';
    const good = higherIsWorse ? diff < 0 : diff > 0;
    return good ? 'text-emerald-700' : 'text-red-700';
};

const renderDiffCell = (diff: number, format: 'currency' | 'percent', higherIsWorse?: boolean) => (
    <span className={`font-bold ${diffColorClass(diff, higherIsWorse)}`}>
        {format === 'percent' ? formatPointsDiff(diff) : `${diff >= 0 ? '+' : ''}${formatValue(diff, 'currency')}`}
    </span>
);

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

    // % de Eventos na distribuição da Despesa, POR PACOTE (o resto do pacote vai pra Lazer) — só
    // guarda os pacotes que o usuário já ajustou manualmente; os demais usam como default a mesma
    // % que a Receita (ano atual) tem entre os dois segmentos (ver `receitaSplit`). Client-side,
    // não persiste (mesmo padrão do WHAT IF % da Tabela de GOP).
    const [despesaPctByPackage, setDespesaPctByPackage] = useState<Record<string, number>>({});

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

    // Estrutura (ids/labels/indentação/categoria) não varia por mês — usa o primeiro conjunto
    // disponível só pra saber QUAIS linhas de despesa existem e em que ordem/indentação mostrar.
    const referenceRows: ForecastRow[] = monthlyDreRows[0] || [];
    const despesaRows = useMemo(() => referenceRows.filter(r => r.category === 'Costs' || r.category === 'Package' || r.category === 'Account'), [referenceRows]);
    const packageRows = useMemo(() => despesaRows.filter(r => r.category === 'Package'), [despesaRows]);

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

    // % de receita Eventos, ano atual e ano anterior — alimenta o card informativo, o % de
    // Impostos (sempre igual ao da Receita, por pedido do usuário) e o default do % de cada
    // pacote de despesa (até o usuário ajustar manualmente).
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

    const pkgPctEventos = (pkgId: string): number => despesaPctByPackage[pkgId] ?? receitaSplit.pctEventosAtual;
    const setPkgPctEventos = (pkgId: string, raw: number) => {
        const clamped = Math.min(100, Math.max(0, isNaN(raw) ? 0 : raw));
        setDespesaPctByPackage(prev => ({ ...prev, [pkgId]: clamped }));
    };

    // Todas as linhas da tabela única — Receita (já vem segmentada, sem % nenhum), Impostos
    // (% igual ao da Receita, cada ano com a sua própria %), Receita Líquida, Despesa (cada
    // pacote com seu próprio % de distribuição, contas herdam o % do pacote-pai) e GOP.
    const allRows: CombinedRow[] = useMemo(() => {
        const revAptLazer = agg('REV-APT-LAZER'), revAptEventos = agg('REV-APT-EVENTOS');
        const revExtraLazer = agg('REV-EXTRA-LAZER'), revExtraEventos = agg('REV-EXTRA-EVENTOS');
        const receitaLazerAtual = revAptLazer.atual + revExtraLazer.atual;
        const receitaEventosAtual = revAptEventos.atual + revExtraEventos.atual;
        const receitaLazerAnterior = revAptLazer.anterior + revExtraLazer.anterior;
        const receitaEventosAnterior = revAptEventos.anterior + revExtraEventos.anterior;

        const impostoTotal = agg('REV-IMP');
        const impostoEventosAtual = impostoTotal.atual * (receitaSplit.pctEventosAtual / 100);
        const impostoLazerAtual = impostoTotal.atual - impostoEventosAtual;
        const impostoEventosAnterior = impostoTotal.anterior * (receitaSplit.pctEventosAnterior / 100);
        const impostoLazerAnterior = impostoTotal.anterior - impostoEventosAnterior;

        const receitaLiqLazerAtual = receitaLazerAtual - impostoLazerAtual;
        const receitaLiqEventosAtual = receitaEventosAtual - impostoEventosAtual;
        const receitaLiqLazerAnterior = receitaLazerAnterior - impostoLazerAnterior;
        const receitaLiqEventosAnterior = receitaEventosAnterior - impostoEventosAnterior;

        let cstLazerAtual = 0, cstLazerAnterior = 0, cstEventosAtual = 0, cstEventosAnterior = 0;
        packageRows.forEach(p => {
            const a = agg(p.id);
            const fracEventos = pkgPctEventos(p.id) / 100;
            cstEventosAtual += a.atual * fracEventos;
            cstLazerAtual += a.atual * (1 - fracEventos);
            cstEventosAnterior += a.anterior * fracEventos;
            cstLazerAnterior += a.anterior * (1 - fracEventos);
        });

        let currentPkgId: string | null = null;
        const despesaCombined: CombinedRow[] = despesaRows.map(r => {
            if (r.category === 'Package') currentPkgId = r.id;
            if (r.id === 'CST-HEAD') {
                return {
                    id: r.id, label: r.label, format: 'currency', indentLevel: 0, bold: true, higherIsWorse: true,
                    lazerAtual: cstLazerAtual, lazerAnterior: cstLazerAnterior, eventosAtual: cstEventosAtual, eventosAnterior: cstEventosAnterior,
                };
            }
            const pkgId = r.category === 'Account' ? currentPkgId : r.id;
            const fracEventos = pkgId ? pkgPctEventos(pkgId) / 100 : 0;
            const a = agg(r.id);
            return {
                id: r.id, label: r.label, format: 'currency', indentLevel: r.indentLevel || 0,
                bold: !!(r.isHeader || r.isTotal), higherIsWorse: true, isAccountRow: r.category === 'Account',
                lazerAtual: a.atual * (1 - fracEventos), lazerAnterior: a.anterior * (1 - fracEventos),
                eventosAtual: a.atual * fracEventos, eventosAnterior: a.anterior * fracEventos,
                editablePkgId: r.category === 'Package' ? r.id : undefined,
            };
        });

        const gopLazerAtual = receitaLiqLazerAtual - cstLazerAtual;
        const gopEventosAtual = receitaLiqEventosAtual - cstEventosAtual;
        const gopLazerAnterior = receitaLiqLazerAnterior - cstLazerAnterior;
        const gopEventosAnterior = receitaLiqEventosAnterior - cstEventosAnterior;
        const gopPctLazerAtual = receitaLiqLazerAtual ? (gopLazerAtual / receitaLiqLazerAtual) * 100 : 0;
        const gopPctEventosAtual = receitaLiqEventosAtual ? (gopEventosAtual / receitaLiqEventosAtual) * 100 : 0;
        const gopPctLazerAnterior = receitaLiqLazerAnterior ? (gopLazerAnterior / receitaLiqLazerAnterior) * 100 : 0;
        const gopPctEventosAnterior = receitaLiqEventosAnterior ? (gopEventosAnterior / receitaLiqEventosAnterior) * 100 : 0;

        return [
            { id: 'REV-APT', label: 'Receita de Apartamentos', format: 'currency', indentLevel: 1, bold: false,
                lazerAtual: revAptLazer.atual, lazerAnterior: revAptLazer.anterior, eventosAtual: revAptEventos.atual, eventosAnterior: revAptEventos.anterior },
            { id: 'REV-EXTRA', label: 'Receitas Extras', format: 'currency', indentLevel: 1, bold: false,
                lazerAtual: revExtraLazer.atual, lazerAnterior: revExtraLazer.anterior, eventosAtual: revExtraEventos.atual, eventosAnterior: revExtraEventos.anterior },
            { id: 'REV-TOTAL-SEG', label: 'RECEITA BRUTA', format: 'currency', indentLevel: 0, bold: true,
                lazerAtual: receitaLazerAtual, lazerAnterior: receitaLazerAnterior, eventosAtual: receitaEventosAtual, eventosAnterior: receitaEventosAnterior },
            { id: 'REV-IMP-SEG', label: 'IMPOSTOS', format: 'currency', indentLevel: 0, bold: false, higherIsWorse: true,
                lazerAtual: impostoLazerAtual, lazerAnterior: impostoLazerAnterior, eventosAtual: impostoEventosAtual, eventosAnterior: impostoEventosAnterior },
            { id: 'REV-NET-SEG', label: 'RECEITA LÍQUIDA', format: 'currency', indentLevel: 0, bold: true,
                lazerAtual: receitaLiqLazerAtual, lazerAnterior: receitaLiqLazerAnterior, eventosAtual: receitaLiqEventosAtual, eventosAnterior: receitaLiqEventosAnterior },
            ...despesaCombined,
            { id: 'GOP-SEG', label: 'GOP (R$)', format: 'currency', indentLevel: 0, bold: true,
                lazerAtual: gopLazerAtual, lazerAnterior: gopLazerAnterior, eventosAtual: gopEventosAtual, eventosAnterior: gopEventosAnterior },
            { id: 'GOP-PCT-SEG', label: 'GOP (%)', format: 'percent', indentLevel: 0, bold: true,
                lazerAtual: gopPctLazerAtual, lazerAnterior: gopPctLazerAnterior, eventosAtual: gopPctEventosAtual, eventosAnterior: gopPctEventosAnterior },
        ];
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [aggMap, despesaRows, packageRows, despesaPctByPackage, receitaSplit]);

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

                <div className="grid grid-cols-2 gap-4">
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
            </div>

            <div className="bg-white rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-gray-100 p-6">
                <h3 className="text-lg font-black text-gray-900 mb-1">{selectedHotel}</h3>
                <p className="text-[11px] text-gray-400 mb-3">
                    Impostos usam sempre o mesmo % de distribuição da Receita (de cada ano). Despesa não é lançada por segmento — ajuste o % de cada pacote nas colunas do meio; o valor inicial acompanha a % da Receita do ano atual, e vale igual pro Ano Atual e pro Ano Anterior desse pacote.
                </p>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50 text-gray-500 text-[10px] font-black uppercase tracking-wide">
                                <th rowSpan={2} className="text-left px-3 py-2 align-bottom">Descrição</th>
                                <th colSpan={3} className="text-center px-3 py-1 border-l border-gray-200">Lazer</th>
                                <th colSpan={2} className="text-center px-3 py-1 border-l border-gray-200 bg-indigo-50 text-indigo-600">Distribuição da Despesa</th>
                                <th colSpan={3} className="text-center px-3 py-1 border-l border-gray-200">Eventos</th>
                            </tr>
                            <tr className="bg-gray-50 text-gray-500 text-xs font-black uppercase tracking-wide">
                                <th className="text-right px-3 py-2 border-l border-gray-200">Ano Anterior</th>
                                <th className="text-right px-3 py-2">Ano Atual</th>
                                <th className="text-right px-3 py-2">Diferença</th>
                                <th className="text-center px-3 py-2 border-l border-gray-200 bg-indigo-50 text-indigo-600">% Lazer</th>
                                <th className="text-center px-3 py-2 bg-indigo-50 text-indigo-600">% Eventos</th>
                                <th className="text-right px-3 py-2 border-l border-gray-200">Ano Anterior</th>
                                <th className="text-right px-3 py-2">Ano Atual</th>
                                <th className="text-right px-3 py-2">Diferença</th>
                            </tr>
                        </thead>
                        <tbody>
                            {allRows.filter(row => showAccounts || !row.isAccountRow).map(row => {
                                const diffLazer = row.lazerAtual - row.lazerAnterior;
                                const diffEventos = row.eventosAtual - row.eventosAnterior;
                                return (
                                    <tr key={row.id} className={`border-b border-gray-100 ${row.bold ? 'bg-gray-50/60 font-black' : ''}`}>
                                        <td className="px-3 py-1.5" style={{ paddingLeft: `${0.75 + row.indentLevel * 1.25}rem` }}>{row.label}</td>
                                        <td className="text-right px-3 py-1.5 tabular-nums border-l border-gray-200">{formatValue(row.lazerAnterior, row.format)}</td>
                                        <td className="text-right px-3 py-1.5 tabular-nums">{formatValue(row.lazerAtual, row.format)}</td>
                                        <td className="text-right px-3 py-1.5 tabular-nums">{renderDiffCell(diffLazer, row.format, row.higherIsWorse)}</td>
                                        <td className="text-center px-2 py-1 border-l border-gray-200 bg-indigo-50/40">
                                            {row.editablePkgId ? (
                                                <input
                                                    type="number" min={0} max={100} step={0.1}
                                                    value={Math.round((100 - pkgPctEventos(row.editablePkgId)) * 10) / 10}
                                                    onChange={e => setPkgPctEventos(row.editablePkgId!, 100 - Number(e.target.value))}
                                                    className="w-14 text-center font-black text-indigo-700 border border-indigo-200 rounded px-1 py-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                                />
                                            ) : <span className="text-gray-300">—</span>}
                                        </td>
                                        <td className="text-center px-2 py-1 bg-indigo-50/40">
                                            {row.editablePkgId ? (
                                                <input
                                                    type="number" min={0} max={100} step={0.1}
                                                    value={Math.round(pkgPctEventos(row.editablePkgId) * 10) / 10}
                                                    onChange={e => setPkgPctEventos(row.editablePkgId!, Number(e.target.value))}
                                                    className="w-14 text-center font-black text-indigo-700 border border-indigo-200 rounded px-1 py-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                                />
                                            ) : <span className="text-gray-300">—</span>}
                                        </td>
                                        <td className="text-right px-3 py-1.5 tabular-nums border-l border-gray-200">{formatValue(row.eventosAnterior, row.format)}</td>
                                        <td className="text-right px-3 py-1.5 tabular-nums">{formatValue(row.eventosAtual, row.format)}</td>
                                        <td className="text-right px-3 py-1.5 tabular-nums">{renderDiffCell(diffEventos, row.format, row.higherIsWorse)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            <p className="text-[11px] text-gray-400 px-2">
                Receitas de "Outras Receitas" (OR), Cancelamento de Time Share e ISS não têm segmento próprio nos dados — ficam de fora da tabela acima, então a soma de Lazer + Eventos não bate 100% com a Receita Bruta Total do hotel.
            </p>
        </div>
    );
};

export default DreSegmentadaView;
