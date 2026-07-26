import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Account, CostPackage, Hotel, ImportedRow, ProjectionType, ForecastRow } from '../types';
import { buildForecastRows, formatValue, formatPointsDiff, parseNum } from './ForecastTable';
import { normalizeAccountName } from '../services/mockData';
import { supabaseService } from '../services/supabaseService';
import { VersionInfoBanner } from './VersionInfoBanner';
import toast from 'react-hot-toast';

interface AnaliseABViewProps {
    selectedMonth?: number;
    selectedYear?: number;
    financialData?: ImportedRow[];
    selectedHotel?: string;
    accounts: Account[];
    packages: CostPackage[];
    hotels: Hotel[];
    realOccupancyData?: Record<string, Record<string, number>>;
    activeRealVersionId?: string;
    activeRealVersionName?: string;
    activeBudgetVersionId?: string;
    budgetOccupancyData?: Record<string, number[]>;
    activeProjectionType?: ProjectionType;
    setActiveProjectionType?: React.Dispatch<React.SetStateAction<ProjectionType>>;
}

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const ALL_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

interface AggregatedFields { real: number; budget: number; lastYear: number; previa: number; }
const emptyAgg = (): AggregatedFields => ({ real: 0, budget: 0, lastYear: 0, previa: 0 });
const addAgg = (a: AggregatedFields, row: ForecastRow | undefined): AggregatedFields => ({
    real: a.real + (row?.real || 0),
    budget: a.budget + (row?.budget || 0),
    lastYear: a.lastYear + (row?.lastYear || 0),
    previa: a.previa + (row?.previa || 0),
});

// Mesmas 5 versões que já existem no resto do app (Reunião de Ritmo/FCA N1/FCA N2/Fechamento/
// Realizado) — é esse seletor, e não o filtro genérico de Tipo/Categoria/Região do topo, que
// define de qual versão a Análise de A&B está puxando os dados (inclusive os que vêm da DRE
// Forecast), igual ao padrão já usado na aba Ocupação.
const PROJECTION_TYPE_OPTIONS: { value: ProjectionType; label: string }[] = [
    { value: 'Reunião de Ritmo', label: 'Reunião de Ritmo' },
    { value: 'FCA N2', label: 'FCA N2' },
    { value: 'FCA N1', label: 'FCA N1' },
    { value: 'Fechamento oficial', label: 'Fechamento' },
    { value: 'Realizado', label: 'Realizado' },
];

type Scenario = 'REALIZADO' | 'META' | 'ANO_ANTERIOR';
const SCENARIOS: Scenario[] = ['REALIZADO', 'META', 'ANO_ANTERIOR'];

// Nomes das contas contábeis (Plano de Contas) que alimentam cada linha editável de receita —
// vêm da importação independente de Receitas (Administração > Importação > Receitas).
const LINE_DEFS: { key: string; label: string; accounts: string[] }[] = [
    { key: 'alimentos_inclusos', label: 'Inclusos', accounts: ['Receita de Alimentos - Incluso na diária', 'Receita de Café da Manhã - Incluso na diária'] },
    { key: 'alimentos_extras', label: 'Extras', accounts: ['Receita de Alimentos', 'Receita de Coffee Break'] },
    { key: 'bebidas_inclusas', label: 'Inclusas', accounts: ['Receita de Bebidas - Incluso na diária'] },
    { key: 'bebidas_extras', label: 'Extras', accounts: ['Receita de Bebidas', 'Receita de Bebidas Monofásicas'] },
];

// Nomes de contas de Custo "replicados" da DRE Forecast (mesmo Account.name do Plano de Contas).
const CUSTO_ALIMENTOS_ACCOUNTS = [
    'Carnes / Aves / Peixes', 'Condimentos / Conservas', 'Embutidos / Massas', 'Frios',
    'Guloseimas', 'Hortifrutigranjeiros', 'Laticinios', 'Outros custos',
    'Paes / Biscoitos', 'Secos',
];
const CUSTO_BEBIDAS_ACCOUNTS = ['Bebidas alcoolicas', 'Bebidas nao alcoolicas'];

const scenarioBucket = (cenario: string): Scenario => {
    const c = (cenario || '').toLowerCase();
    if (c.includes('meta')) return 'META';
    if (c.includes('anterior')) return 'ANO_ANTERIOR';
    return 'REALIZADO';
};

// As despesas (Custo de Alimentos/Bebidas) puxam o Realizado da coluna Prévia/Fechamento da DRE
// Forecast (campo previa), não da coluna Forecast (campo real) — pedido explícito, já que é a
// Prévia quem reflete o valor sendo trabalhado/fechado. Hóspedes (Adultos/CHD) continuam vindo
// do campo real, que é o que a própria DRE usa pra essas linhas de indicador. Quando mais de um
// mês está selecionado (visão acumulada), `agg` já é a soma desses campos mês a mês.
const fieldForScenario = (agg: AggregatedFields, scenario: Scenario, realizadoField: 'real' | 'previa' = 'real'): number => {
    if (scenario === 'META') return agg.budget;
    if (scenario === 'ANO_ANTERIOR') return agg.lastYear;
    return realizadoField === 'previa' ? agg.previa : agg.real;
};

type RowFormat = 'currency' | 'percent' | 'integer' | 'currency2';

// Custo por PAX é sempre em R$ com 2 casas decimais — os demais formatos (valores grandes de
// receita/custo, %, contagem de hóspedes) seguem o padrão sem decimais já usado na DRE Forecast.
const formatCurrency2 = (val: number) => `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatByType = (val: number, format: RowFormat) => format === 'currency2' ? formatCurrency2(val) : formatValue(val, format);

const formatDiff = (diff: number, format: RowFormat) => {
    if (format === 'percent') return formatPointsDiff(diff);
    if (!diff) return '-';
    const sign = diff > 0 ? '+' : '-';
    return `${sign}${formatByType(Math.abs(diff), format)}`;
};

// Cor da coluna Diferença representa se o desvio é bom ou ruim: para linhas de receita, "maior"
// é bom (verde); para linhas de despesa/custo, "maior" é ruim (vermelho) — o oposto.
type RowKind = 'receita' | 'despesa' | 'neutral';
const diffCellClass = (diff: number, kind: RowKind) => {
    const base = 'px-2 py-1 text-right tabular-nums whitespace-nowrap';
    if (kind === 'neutral' || !diff) return `${base} text-gray-500`;
    const isGood = kind === 'receita' ? diff > 0 : diff < 0;
    return `${base} ${isGood ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`;
};

interface RowValues { realizado: number; meta: number; anoAnterior: number; }

const EditableCell: React.FC<{ value: number; onCommit: (v: number) => void }> = ({ value, onCommit }) => {
    const [text, setText] = useState(() => formatValue(value, 'currency'));
    const [focused, setFocused] = useState(false);
    useEffect(() => {
        if (!focused) setText(formatValue(value, 'currency'));
    }, [value, focused]);
    return (
        <input
            type="text"
            className="w-full bg-transparent text-right tabular-nums outline-none text-indigo-900 font-semibold focus:bg-indigo-50/40 rounded px-1"
            value={text}
            onFocus={() => setFocused(true)}
            onChange={e => setText(e.target.value)}
            onBlur={() => {
                setFocused(false);
                onCommit(parseNum(text));
            }}
        />
    );
};

const AnaliseABView: React.FC<AnaliseABViewProps> = ({
    selectedMonth, selectedYear, financialData, selectedHotel, accounts, packages, hotels,
    realOccupancyData, activeRealVersionId, activeRealVersionName, activeBudgetVersionId,
    budgetOccupancyData, activeProjectionType, setActiveProjectionType,
}) => {
    const [revenueRows, setRevenueRows] = useState<any[]>([]);
    const [overrides, setOverrides] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [pendingEdits, setPendingEdits] = useState<Record<string, number>>({});
    const pendingEditsRef = useRef(pendingEdits);
    pendingEditsRef.current = pendingEdits;

    // Meses considerados na análise — por padrão só o mês corrente, mas dá pra selecionar vários
    // pra ver o acumulado do período (soma dos meses escolhidos), igual ao filtro de meses da
    // aba Ocupação.
    const [visibleMonths, setVisibleMonths] = useState<number[]>(() => selectedMonth ? [selectedMonth] : [1]);
    useEffect(() => {
        setVisibleMonths(selectedMonth ? [selectedMonth] : [1]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedHotel, selectedYear]);
    const isSingleMonth = visibleMonths.length === 1;

    useEffect(() => {
        let cancelled = false;
        setIsLoading(true);
        Promise.all([supabaseService.getRevenueImportData(), supabaseService.getAbAnalysisOverrides()])
            .then(([rev, ov]) => {
                if (cancelled) return;
                setRevenueRows(rev);
                setOverrides(ov);
            })
            .catch(err => console.error('Erro ao carregar dados de Análise de A&B', err))
            .finally(() => { if (!cancelled) setIsLoading(false); });
        return () => { cancelled = true; };
    }, [selectedHotel, selectedYear]);

    // Troca de contexto (hotel/ano/meses/versão) descarta edições ainda não salvas dessa tela.
    useEffect(() => { setPendingEdits({}); }, [selectedHotel, selectedYear, visibleMonths, activeRealVersionId]);

    // Linhas "replicadas" da DRE Forecast — mesmo cálculo, sem duplicar lógica. Uma chamada por
    // mês selecionado; os campos usados (real/budget/lastYear/previa) são somados entre os meses
    // logo abaixo, pra viabilizar a visão acumulada.
    const monthlyDreRows = useMemo(() => visibleMonths.map(m => buildForecastRows(
        undefined, m, selectedYear, financialData, selectedHotel, hotels,
        realOccupancyData || {}, activeRealVersionId, activeBudgetVersionId, accounts, packages,
        budgetOccupancyData || {}, activeProjectionType
    )), [visibleMonths, selectedYear, financialData, selectedHotel, hotels, realOccupancyData, activeRealVersionId, activeBudgetVersionId, accounts, packages, budgetOccupancyData, activeProjectionType]);

    const findAccountRowIn = (rows: ForecastRow[], targetName: string) => rows.find(r => r.category === 'Account' && normalizeAccountName(r.label) === normalizeAccountName(targetName));

    // Só pra exibir nome/id das linhas (não varia por mês) — usa o primeiro conjunto disponível.
    const referenceRows = monthlyDreRows[0] || [];
    const custoAlimentosRows = CUSTO_ALIMENTOS_ACCOUNTS.map(name => findAccountRowIn(referenceRows, name)).filter((r): r is ForecastRow => !!r);
    const custoBebidasRows = CUSTO_BEBIDAS_ACCOUNTS.map(name => findAccountRowIn(referenceRows, name)).filter((r): r is ForecastRow => !!r);

    const adultosAgg = useMemo(() => monthlyDreRows.reduce((acc, rows) => addAgg(acc, rows.find(r => r.id === 'IND-ADULTOS')), emptyAgg()), [monthlyDreRows]);
    const chdAgg = useMemo(() => monthlyDreRows.reduce((acc, rows) => addAgg(acc, rows.find(r => r.id === 'IND-CHD')), emptyAgg()), [monthlyDreRows]);
    const custoAlimentosAgg = useMemo(() => CUSTO_ALIMENTOS_ACCOUNTS.map(name =>
        monthlyDreRows.reduce((acc, rows) => addAgg(acc, findAccountRowIn(rows, name)), emptyAgg())
    ), [monthlyDreRows]);
    const custoBebidasAgg = useMemo(() => CUSTO_BEBIDAS_ACCOUNTS.map(name =>
        monthlyDreRows.reduce((acc, rows) => addAgg(acc, findAccountRowIn(rows, name)), emptyAgg())
    ), [monthlyDreRows]);

    // Resumo mensal (painel à direita) — SEMPRE os 12 meses do ano, independente do filtro
    // "Filtrar Meses" acima (que só afeta as tabelas principais). Cálculo isolado, não reaproveita
    // nem altera monthlyDreRows/visibleMonths, pra não interferir no restante da tela.
    const allMonthsDreRows = useMemo(() => ALL_MONTHS.map(m => buildForecastRows(
        undefined, m, selectedYear, financialData, selectedHotel, hotels,
        realOccupancyData || {}, activeRealVersionId, activeBudgetVersionId, accounts, packages,
        budgetOccupancyData || {}, activeProjectionType
    )), [selectedYear, financialData, selectedHotel, hotels, realOccupancyData, activeRealVersionId, activeBudgetVersionId, accounts, packages, budgetOccupancyData, activeProjectionType]);

    const monthlySummary = useMemo(() => allMonthsDreRows.map(rows => {
        const adultosRow = rows.find(r => r.id === 'IND-ADULTOS');
        const chdRow = rows.find(r => r.id === 'IND-CHD');
        const paxReal = (adultosRow?.real || 0) + (chdRow?.real || 0);
        const paxMeta = (adultosRow?.budget || 0) + (chdRow?.budget || 0);

        const custoRows = CUSTO_ALIMENTOS_ACCOUNTS.map(name => findAccountRowIn(rows, name));
        const custoReal = custoRows.reduce((s, r) => s + (r?.previa || 0), 0);
        const custoMeta = custoRows.reduce((s, r) => s + (r?.budget || 0), 0);

        return {
            pax: { real: paxReal, meta: paxMeta },
            custoAlimentos: { real: custoReal, meta: custoMeta },
            custoPorPax: { real: paxReal ? custoReal / paxReal : 0, meta: paxMeta ? custoMeta / paxMeta : 0 },
        };
    }), [allMonthsDreRows]);

    // Linhas de receita importadas (Administração > Importação > Receitas), filtradas pro
    // contexto atual (hotel + meses selecionados). O ano é conferido por linha: Realizado/Meta
    // esperam o ano selecionado; Ano anterior espera o ano selecionado - 1 — os dois sinais da
    // planilha (coluna Ano + coluna Real/Meta) são usados juntos pra evitar ambiguidade.
    const contextRevenueRows = useMemo(() => revenueRows.filter(r =>
        normalizeAccountName(r.hotel || '') === normalizeAccountName(selectedHotel || '') &&
        visibleMonths.includes(Number(r.month))
    ), [revenueRows, selectedHotel, visibleMonths]);

    const sumImportedForAccounts = (targetNames: string[], scenario: Scenario) => {
        const targets = targetNames.map(normalizeAccountName);
        const expectedYear = scenario === 'ANO_ANTERIOR' ? (selectedYear || 0) - 1 : selectedYear;
        return contextRevenueRows
            .filter(r => targets.includes(normalizeAccountName(r.conta_matched || r.conta || ''))
                && scenarioBucket(r.cenario) === scenario
                && Number(r.year) === expectedYear)
            .reduce((sum, r) => sum + (Number(r.value) || 0), 0);
    };

    // Overrides manuais só valem quando um único mês está selecionado — não há um mês só pra
    // gravar a edição quando a visão é acumulada de vários meses.
    const overrideMap = useMemo(() => {
        const map = new Map<string, number>();
        if (!isSingleMonth) return map;
        const targetMonth = visibleMonths[0];
        overrides.forEach(o => {
            if (normalizeAccountName(o.hotel || '') !== normalizeAccountName(selectedHotel || '')) return;
            if (Number(o.month) !== targetMonth) return;
            if (Number(o.year) !== selectedYear) return;
            if ((o.version_id || '') !== (activeRealVersionId || '')) return;
            map.set(`${o.line_key}__${o.scenario}`, Number(o.value) || 0);
        });
        return map;
    }, [overrides, selectedHotel, selectedYear, activeRealVersionId, isSingleMonth, visibleMonths]);

    const lineValues = useMemo(() => {
        const result: Record<string, Record<Scenario, number>> = {};
        LINE_DEFS.forEach(def => {
            result[def.key] = { REALIZADO: 0, META: 0, ANO_ANTERIOR: 0 };
            SCENARIOS.forEach(scenario => {
                const overrideKey = `${def.key}__${scenario}`;
                result[def.key][scenario] = overrideMap.has(overrideKey)
                    ? overrideMap.get(overrideKey)!
                    : sumImportedForAccounts(def.accounts, scenario);
            });
        });
        return result;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [overrideMap, contextRevenueRows, selectedYear]);

    const getCellValue = (lineKey: string, scenario: Scenario) => {
        const key = `${lineKey}__${scenario}`;
        return key in pendingEdits ? pendingEdits[key] : (lineValues[lineKey]?.[scenario] ?? 0);
    };

    const handleCommitCell = (lineKey: string, scenario: Scenario, value: number) => {
        if (!isSingleMonth) return; // edição manual só existe com um único mês selecionado
        setPendingEdits(prev => ({ ...prev, [`${lineKey}__${scenario}`]: value }));
    };

    // Autosave com debounce — só grava as células alteradas desde o último save.
    useEffect(() => {
        const keys = Object.keys(pendingEdits);
        if (keys.length === 0) return;
        const timeout = setTimeout(async () => {
            const toSave = keys.map(k => {
                const sep = k.lastIndexOf('__');
                const lineKey = k.slice(0, sep);
                const scenario = k.slice(sep + 2);
                return {
                    hotel: selectedHotel || '', year: selectedYear || 0, month: visibleMonths[0] || selectedMonth || 0,
                    versionId: activeRealVersionId || null, lineKey, scenario, value: pendingEditsRef.current[k],
                };
            });
            try {
                await supabaseService.upsertAbAnalysisOverrides(toSave);
                setOverrides(prev => {
                    const map = new Map(prev.map(o => [`${o.hotel}|${o.year}|${o.month}|${o.version_id}|${o.line_key}|${o.scenario}`, o]));
                    toSave.forEach(r => {
                        const vid = r.versionId || '';
                        map.set(`${r.hotel}|${r.year}|${r.month}|${vid}|${r.lineKey}|${r.scenario}`, {
                            hotel: r.hotel, year: r.year, month: r.month, version_id: vid,
                            line_key: r.lineKey, scenario: r.scenario, value: r.value,
                        });
                    });
                    return Array.from(map.values());
                });
                setPendingEdits({});
            } catch (err: any) {
                toast.error('Erro ao salvar Análise de A&B: ' + (err?.message || String(err)));
            }
        }, 800);
        return () => clearTimeout(timeout);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pendingEdits]);

    const computeForScenario = (scenario: Scenario) => {
        const alimentosInclusos = getCellValue('alimentos_inclusos', scenario);
        const alimentosExtras = getCellValue('alimentos_extras', scenario);
        const bebidasInclusas = getCellValue('bebidas_inclusas', scenario);
        const bebidasExtras = getCellValue('bebidas_extras', scenario);
        const receitaAlimentos = alimentosInclusos + alimentosExtras;
        const receitaBebidas = bebidasInclusas + bebidasExtras;

        const adultos = fieldForScenario(adultosAgg, scenario);
        const chd = fieldForScenario(chdAgg, scenario);
        const hospedes = adultos + chd;

        const custoAlimentosItems = custoAlimentosAgg.map(agg => fieldForScenario(agg, scenario, 'previa'));
        const custoAlimentos = custoAlimentosItems.reduce((a, b) => a + b, 0);
        const custoBebidasItems = custoBebidasAgg.map(agg => fieldForScenario(agg, scenario, 'previa'));
        const custoBebidas = custoBebidasItems.reduce((a, b) => a + b, 0);

        return {
            alimentosInclusos, alimentosExtras, receitaAlimentos,
            bebidasInclusas, bebidasExtras, receitaBebidas,
            adultos, chd, hospedes,
            custoAlimentosItems, custoAlimentos, custoBebidasItems, custoBebidas,
            custoPaxAlimentos: hospedes ? custoAlimentos / hospedes : 0,
            cmvAlimentos: receitaAlimentos ? (custoAlimentos / receitaAlimentos) * 100 : 0,
            custoPaxBebidas: hospedes ? custoBebidas / hospedes : 0,
            cmvBebidas: receitaBebidas ? (custoBebidas / receitaBebidas) * 100 : 0,
            custoPaxAB: hospedes ? (custoAlimentos + custoBebidas) / hospedes : 0,
            cmvAB: (receitaAlimentos + receitaBebidas) ? ((custoAlimentos + custoBebidas) / (receitaAlimentos + receitaBebidas)) * 100 : 0,
        };
    };

    const realizado = computeForScenario('REALIZADO');
    const meta = computeForScenario('META');
    const anoAnterior = computeForScenario('ANO_ANTERIOR');

    // Custo por PAX de uma linha contábil específica (não do pacote inteiro): custo da própria
    // linha dividido pelo total de Hóspedes do mesmo cenário.
    const itemPax = (kind: 'custoAlimentosItems' | 'custoBebidasItems', idx: number): RowValues => ({
        realizado: realizado.hospedes ? (realizado[kind][idx] || 0) / realizado.hospedes : 0,
        meta: meta.hospedes ? (meta[kind][idx] || 0) / meta.hospedes : 0,
        anoAnterior: anoAnterior.hospedes ? (anoAnterior[kind][idx] || 0) / anoAnterior.hospedes : 0,
    });

    const Row: React.FC<{
        label: string; indent?: number; bold?: boolean; asHeader?: boolean; format?: RowFormat; kind?: RowKind;
        values: RowValues; editableLineKey?: string; editableScenarios?: Scenario[]; hideLabel?: boolean;
    }> = ({ label, indent = 0, bold, asHeader, format = 'currency', kind = 'neutral', values, editableLineKey, editableScenarios, hideLabel }) => {
        const diff1 = values.realizado - values.meta;
        const diff2 = values.realizado - values.anoAnterior;
        const isBold = bold || asHeader;
        const textClass = asHeader ? 'text-indigo-900' : (isBold ? 'text-gray-900' : 'text-gray-700');
        const cellClass = `px-2 py-1 text-right tabular-nums whitespace-nowrap ${isBold ? `font-black ${textClass}` : textClass}`;
        const renderCell = (scenario: Scenario, value: number) => {
            if (editableLineKey && isSingleMonth && (!editableScenarios || editableScenarios.includes(scenario))) {
                return <EditableCell value={value} onCommit={v => handleCommitCell(editableLineKey, scenario, v)} />;
            }
            return <>{formatByType(value, format)}</>;
        };
        return (
            <tr className={asHeader ? 'bg-indigo-50/60' : 'border-b border-gray-100 hover:bg-gray-50/50'}>
                {!hideLabel && (
                    <td className={`px-3 py-1 truncate ${asHeader ? 'font-black text-indigo-900 text-sm uppercase tracking-wide' : (isBold ? 'font-black text-gray-900' : 'text-gray-600')}`} style={{ paddingLeft: `${12 + indent * 20}px` }}>
                        {label}
                    </td>
                )}
                <td className={cellClass}>{renderCell('REALIZADO', values.realizado)}</td>
                <td className={cellClass}>{renderCell('META', values.meta)}</td>
                <td className={diffCellClass(diff1, kind)}>{formatDiff(diff1, format)}</td>
                <td className={cellClass}>{renderCell('ANO_ANTERIOR', values.anoAnterior)}</td>
                <td className={diffCellClass(diff2, kind)}>{formatDiff(diff2, format)}</td>
            </tr>
        );
    };

    const SectionHeader: React.FC<{ label: string }> = ({ label }) => (
        <tr className="bg-indigo-50/60">
            <td colSpan={6} className="px-3 py-1 font-black text-indigo-900 text-sm uppercase tracking-wide">{label}</td>
        </tr>
    );

    const TableShell: React.FC<{ title?: string; reserveTitleSpace?: boolean; hideLabelColumn?: boolean; children: React.ReactNode }> = ({ title, reserveTitleSpace, hideLabelColumn, children }) => (
        <div>
            {title ? (
                <div className="text-sm font-black text-gray-500 uppercase tracking-wide mb-1 px-1">{title}</div>
            ) : reserveTitleSpace ? (
                <div className="text-sm font-black mb-1 px-1 invisible">.</div>
            ) : null}
            <div className="inline-block max-w-full overflow-x-auto border border-gray-200 rounded-xl align-top">
                <table className="text-base" style={{ fontFamily: 'Calibri, sans-serif' }}>
                    <colgroup>
                        {!hideLabelColumn && <col style={{ width: '270px' }} />}
                        <col style={{ width: '120px' }} />
                        <col style={{ width: '120px' }} />
                        <col style={{ width: '105px' }} />
                        <col style={{ width: '120px' }} />
                        <col style={{ width: '105px' }} />
                    </colgroup>
                    <thead className="bg-gray-50 text-gray-500 uppercase font-bold text-sm sticky top-0">
                        <tr>
                            {!hideLabelColumn && <th className="px-3 py-1 text-left">Linha</th>}
                            <th className="px-2 py-1 text-right">Realizado</th>
                            <th className="px-2 py-1 text-right">Meta</th>
                            <th className="px-2 py-1 text-right">Diferença</th>
                            <th className="px-2 py-1 text-right">Ano anterior</th>
                            <th className="px-2 py-1 text-right">Diferença</th>
                        </tr>
                    </thead>
                    <tbody>{children}</tbody>
                </table>
            </div>
        </div>
    );

    const vals = (get: (r: ReturnType<typeof computeForScenario>) => number): RowValues => ({
        realizado: get(realizado), meta: get(meta), anoAnterior: get(anoAnterior),
    });

    // Painel do resumo mensal (um mês por linha, Real/Meta/Diferença em colunas), separado por
    // semestre com subtotal de cada um e total do ano — componente isolado, não reaproveita
    // Row/TableShell pra não arriscar afetar as tabelas principais da tela. Sem colgroup — a
    // largura fica no tamanho natural do conteúdo (mais estreita que as tabelas da esquerda).
    const MonthlyStripTable: React.FC<{
        title: string; format: RowFormat; kind: RowKind; getMonth: (monthIdx: number) => { real: number; meta: number };
        // Pra métricas que são uma razão (ex.: Custo por PAX), o subtotal do semestre/ano não pode
        // ser a soma dos valores mensais já divididos — precisa recalcular a razão a partir da
        // soma dos dois componentes originais (custo somado / pax somado). Quando informado, essa
        // função substitui a soma padrão pro cálculo dos subtotais.
        aggregateOverride?: (monthIdxs: number[]) => { real: number; meta: number };
    }> = ({ title, format, kind, getMonth, aggregateOverride }) => {
        const months = ALL_MONTHS.map((_, idx) => ({ idx, ...getMonth(idx) }));
        const sem1 = months.slice(0, 6);
        const sem2 = months.slice(6, 12);
        const idxSem1 = sem1.map(d => d.idx);
        const idxSem2 = sem2.map(d => d.idx);
        const sumOf = (arr: { real: number; meta: number }[]) => arr.reduce((acc, d) => ({ real: acc.real + d.real, meta: acc.meta + d.meta }), { real: 0, meta: 0 });
        const sem1Sum = aggregateOverride ? aggregateOverride(idxSem1) : sumOf(sem1);
        const sem2Sum = aggregateOverride ? aggregateOverride(idxSem2) : sumOf(sem2);
        const yearSum = aggregateOverride ? aggregateOverride([...idxSem1, ...idxSem2]) : { real: sem1Sum.real + sem2Sum.real, meta: sem1Sum.meta + sem2Sum.meta };

        const renderRow = (label: string, real: number, meta: number, bold?: boolean) => {
            const diff = real - meta;
            return (
                <tr key={label} className={bold ? 'bg-indigo-50/60' : 'border-b border-gray-100 last:border-b-0 hover:bg-gray-50/50'}>
                    <td className={`px-2 py-1 text-left ${bold ? 'font-black text-indigo-900 text-xs uppercase tracking-wide' : 'text-gray-600 font-semibold'}`}>{label}</td>
                    <td className={`px-2 py-1 text-right tabular-nums whitespace-nowrap ${bold ? 'font-black text-indigo-900' : 'font-semibold text-gray-800'}`}>{formatByType(real, format)}</td>
                    <td className={`px-2 py-1 text-right tabular-nums whitespace-nowrap ${bold ? 'font-black text-indigo-900' : 'text-gray-600'}`}>{formatByType(meta, format)}</td>
                    <td className={diffCellClass(diff, kind)}>{formatDiff(diff, format)}</td>
                </tr>
            );
        };

        return (
            <div>
                <div className="text-sm font-black text-gray-500 uppercase tracking-wide mb-1 px-1">{title}</div>
                <div className="inline-block max-w-full overflow-x-auto border border-gray-200 rounded-xl align-top">
                    <table className="text-sm" style={{ fontFamily: 'Calibri, sans-serif' }}>
                        <colgroup>
                            <col style={{ width: '110px' }} />
                            <col style={{ width: '110px' }} />
                            <col style={{ width: '110px' }} />
                            <col style={{ width: '95px' }} />
                        </colgroup>
                        <thead className="bg-gray-50 text-gray-500 uppercase font-bold sticky top-0">
                            <tr>
                                <th className="px-2 py-1 text-left">Mês</th>
                                <th className="px-2 py-1 text-right">Real</th>
                                <th className="px-2 py-1 text-right">Meta</th>
                                <th className="px-2 py-1 text-right">Dif.</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sem1.map(d => renderRow(MONTH_LABELS[d.idx], d.real, d.meta))}
                            {renderRow('1º Semestre', sem1Sum.real, sem1Sum.meta, true)}
                            {sem2.map(d => renderRow(MONTH_LABELS[d.idx], d.real, d.meta))}
                            {renderRow('2º Semestre', sem2Sum.real, sem2Sum.meta, true)}
                            {renderRow('Total Ano', yearSum.real, yearSum.meta, true)}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    return (
        <div className="px-4 py-6 min-h-[calc(100vh-5rem)] space-y-4">
            <div className="inline-block bg-white rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-gray-100 p-6">
                <VersionInfoBanner versionName={activeRealVersionName} />
                <h2 className="text-xl font-black text-gray-900 mb-4">Análise de A&B</h2>

                <div className="flex flex-wrap items-center gap-4 mb-6">
                    <div className="flex items-center bg-gray-100 p-1 rounded-lg">
                        {PROJECTION_TYPE_OPTIONS.map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => setActiveProjectionType?.(opt.value)}
                                className={`px-4 py-1.5 text-sm font-bold rounded-md transition-all ${activeProjectionType === opt.value
                                    ? 'bg-white text-indigo-600 shadow-sm border border-gray-200'
                                    : 'text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>

                    <div className="h-6 w-px bg-gray-300"></div>

                    <div className="flex items-center flex-wrap gap-1">
                        <span className="text-sm font-bold text-gray-700 mr-2">Filtrar Meses:</span>
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
                                    className={`px-3 py-1 text-sm font-bold rounded-md transition-all ${active
                                        ? 'bg-indigo-100 text-indigo-700 border border-indigo-200 shadow-sm'
                                        : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
                                        }`}
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

                {!isSingleMonth && (
                    <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 font-bold mb-4">
                        Vários meses selecionados — os valores mostrados são a soma do período. Selecione um único mês para editar as receitas manualmente.
                    </p>
                )}

                {isLoading && <div className="py-6 text-center text-gray-400 italic text-sm">Carregando...</div>}

                <div className="space-y-4">
                    <TableShell>
                        <Row label="Receita de Alimentos" asHeader kind="receita" values={vals(r => r.receitaAlimentos)} />
                        <Row label="Inclusos" indent={1} kind="receita" values={vals(r => r.alimentosInclusos)} editableLineKey="alimentos_inclusos" />
                        <Row label="Extras" indent={1} kind="receita" values={vals(r => r.alimentosExtras)} editableLineKey="alimentos_extras" />

                        <Row label="Receita de Bebidas" asHeader kind="receita" values={vals(r => r.receitaBebidas)} />
                        <Row label="Inclusas" indent={1} kind="receita" values={vals(r => r.bebidasInclusas)} editableLineKey="bebidas_inclusas" />
                        <Row label="Extras" indent={1} kind="receita" values={vals(r => r.bebidasExtras)} editableLineKey="bebidas_extras" />

                        <Row label="Hóspedes" asHeader format="integer" values={vals(r => r.hospedes)} />
                        <Row label="Adultos" indent={1} format="integer" values={vals(r => r.adultos)} />
                        <Row label="CHD" indent={1} format="integer" values={vals(r => r.chd)} />
                    </TableShell>

                    <div className="flex items-start gap-4 flex-wrap">
                        <TableShell reserveTitleSpace>
                            <Row label="Custo de Alimentos" asHeader kind="despesa" values={vals(r => r.custoAlimentos)} />
                            {custoAlimentosRows.map((row, i) => (
                                <Row key={row.id} label={row.label} indent={1} kind="despesa" values={vals(r => r.custoAlimentosItems[i] || 0)} />
                            ))}
                        </TableShell>
                        <TableShell title="Por PAX" hideLabelColumn>
                            <Row label="" hideLabel asHeader format="currency2" kind="despesa" values={vals(r => r.custoPaxAlimentos)} />
                            {custoAlimentosRows.map((row, i) => (
                                <Row key={row.id} label="" hideLabel indent={1} format="currency2" kind="despesa" values={itemPax('custoAlimentosItems', i)} />
                            ))}
                        </TableShell>
                    </div>

                    <div className="flex items-start gap-4 flex-wrap">
                        <TableShell reserveTitleSpace>
                            <Row label="Custos de Bebidas" asHeader kind="despesa" values={vals(r => r.custoBebidas)} />
                            {custoBebidasRows.map((row, i) => (
                                <Row key={row.id} label={row.label} indent={1} kind="despesa" values={vals(r => r.custoBebidasItems[i] || 0)} />
                            ))}
                        </TableShell>
                        <TableShell title="Por PAX" hideLabelColumn>
                            <Row label="" hideLabel asHeader format="currency2" kind="despesa" values={vals(r => r.custoPaxBebidas)} />
                            {custoBebidasRows.map((row, i) => (
                                <Row key={row.id} label="" hideLabel indent={1} format="currency2" kind="despesa" values={itemPax('custoBebidasItems', i)} />
                            ))}
                        </TableShell>
                    </div>

                    <TableShell>
                        <SectionHeader label="Alimentos (com o crédito)" />
                        <Row label="Custo por PAX" format="currency2" kind="despesa" values={vals(r => r.custoPaxAlimentos)} />
                        <Row label="CMV %" format="percent" kind="despesa" values={vals(r => r.cmvAlimentos)} />

                        <SectionHeader label="Bebidas" />
                        <Row label="Custo por PAX" format="currency2" kind="despesa" values={vals(r => r.custoPaxBebidas)} />
                        <Row label="CMV %" format="percent" kind="despesa" values={vals(r => r.cmvBebidas)} />

                        <SectionHeader label="Alimentos e Bebidas (com o crédito)" />
                        <Row label="Custo por PAX" format="currency2" kind="despesa" values={vals(r => r.custoPaxAB)} />
                        <Row label="CMV %" format="percent" kind="despesa" values={vals(r => r.cmvAB)} />
                    </TableShell>
                </div>
            </div>

            <div className="inline-block bg-white rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-gray-100 p-6">
                <h3 className="text-base font-black text-gray-900 mb-4">Resumo mensal — Custo por PAX</h3>
                <div className="flex items-start gap-4 flex-wrap">
                    <MonthlyStripTable title="Custo de Alimentos" format="currency" kind="despesa" getMonth={idx => monthlySummary[idx]?.custoAlimentos || { real: 0, meta: 0 }} />
                    <MonthlyStripTable title="PAX" format="integer" kind="receita" getMonth={idx => monthlySummary[idx]?.pax || { real: 0, meta: 0 }} />
                    <MonthlyStripTable
                        title="Custo por PAX" format="currency2" kind="despesa"
                        getMonth={idx => monthlySummary[idx]?.custoPorPax || { real: 0, meta: 0 }}
                        aggregateOverride={monthIdxs => {
                            const custo = monthIdxs.reduce((acc, i) => {
                                const c = monthlySummary[i]?.custoAlimentos || { real: 0, meta: 0 };
                                return { real: acc.real + c.real, meta: acc.meta + c.meta };
                            }, { real: 0, meta: 0 });
                            const pax = monthIdxs.reduce((acc, i) => {
                                const p = monthlySummary[i]?.pax || { real: 0, meta: 0 };
                                return { real: acc.real + p.real, meta: acc.meta + p.meta };
                            }, { real: 0, meta: 0 });
                            return {
                                real: pax.real ? custo.real / pax.real : 0,
                                meta: pax.meta ? custo.meta / pax.meta : 0,
                            };
                        }}
                    />
                </div>
            </div>

            <div className="inline-block bg-white rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-gray-100 p-6 text-sm text-gray-600">
                <p className="font-black text-gray-900 mb-1">Observações:</p>
                <p>Receitas: Para construção das prévias, insira as receitas manualmente.</p>
                <p>Número de PAX e despesas: retornam os valores da respectiva prévia.</p>
            </div>
        </div>
    );
};

export default AnaliseABView;
