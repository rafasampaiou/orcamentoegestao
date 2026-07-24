import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ArrowLeft, ArrowRight, Calendar } from 'lucide-react';
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
    formattedDate?: string;
    onMonthChange?: (direction: 'prev' | 'next') => void;
}

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
// Forecast (row.previa), não da coluna Forecast (row.real) — pedido explícito, já que é a Prévia
// quem reflete o valor sendo trabalhado/fechado. Hóspedes (Adultos/CHD) continuam vindo de
// row.real, que é o campo que a própria DRE usa pra essas linhas de indicador.
const dreFieldForScenario = (row: ForecastRow | undefined, scenario: Scenario, realizadoField: 'real' | 'previa' = 'real'): number => {
    if (!row) return 0;
    if (scenario === 'META') return row.budget || 0;
    if (scenario === 'ANO_ANTERIOR') return row.lastYear || 0;
    return (realizadoField === 'previa' ? row.previa : row.real) || 0;
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
    budgetOccupancyData, activeProjectionType, setActiveProjectionType, formattedDate, onMonthChange,
}) => {
    const [revenueRows, setRevenueRows] = useState<any[]>([]);
    const [overrides, setOverrides] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [pendingEdits, setPendingEdits] = useState<Record<string, number>>({});
    const pendingEditsRef = useRef(pendingEdits);
    pendingEditsRef.current = pendingEdits;

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
    }, [selectedHotel, selectedYear, selectedMonth]);

    // Troca de contexto (hotel/ano/mês/versão) descarta edições ainda não salvas dessa tela.
    useEffect(() => { setPendingEdits({}); }, [selectedHotel, selectedYear, selectedMonth, activeRealVersionId]);

    // Linhas "replicadas" da DRE Forecast — mesmo cálculo, sem duplicar lógica.
    const dreRows = useMemo(() => buildForecastRows(
        undefined, selectedMonth, selectedYear, financialData, selectedHotel, hotels,
        realOccupancyData || {}, activeRealVersionId, activeBudgetVersionId, accounts, packages,
        budgetOccupancyData || {}, activeProjectionType
    ), [selectedMonth, selectedYear, financialData, selectedHotel, hotels, realOccupancyData, activeRealVersionId, activeBudgetVersionId, accounts, packages, budgetOccupancyData, activeProjectionType]);

    const findAccountRow = (targetName: string) => dreRows.find(r => r.category === 'Account' && normalizeAccountName(r.label) === normalizeAccountName(targetName));

    const adultosRow = dreRows.find(r => r.id === 'IND-ADULTOS');
    const chdRow = dreRows.find(r => r.id === 'IND-CHD');
    const custoAlimentosRows = CUSTO_ALIMENTOS_ACCOUNTS.map(findAccountRow).filter((r): r is ForecastRow => !!r);
    const custoBebidasRows = CUSTO_BEBIDAS_ACCOUNTS.map(findAccountRow).filter((r): r is ForecastRow => !!r);

    // Linhas de receita importadas (Administração > Importação > Receitas), filtradas pro
    // contexto atual (hotel + mês). O ano é conferido por linha: Realizado/Meta esperam o ano
    // selecionado; Ano anterior espera o ano selecionado - 1 — os dois sinais da planilha
    // (coluna Ano + coluna Real/Meta) são usados juntos pra evitar ambiguidade.
    const contextRevenueRows = useMemo(() => revenueRows.filter(r =>
        normalizeAccountName(r.hotel || '') === normalizeAccountName(selectedHotel || '') &&
        Number(r.month) === selectedMonth
    ), [revenueRows, selectedHotel, selectedMonth]);

    const sumImportedForAccounts = (targetNames: string[], scenario: Scenario) => {
        const targets = targetNames.map(normalizeAccountName);
        const expectedYear = scenario === 'ANO_ANTERIOR' ? (selectedYear || 0) - 1 : selectedYear;
        return contextRevenueRows
            .filter(r => targets.includes(normalizeAccountName(r.conta_matched || r.conta || ''))
                && scenarioBucket(r.cenario) === scenario
                && Number(r.year) === expectedYear)
            .reduce((sum, r) => sum + (Number(r.value) || 0), 0);
    };

    const overrideMap = useMemo(() => {
        const map = new Map<string, number>();
        overrides.forEach(o => {
            if (normalizeAccountName(o.hotel || '') !== normalizeAccountName(selectedHotel || '')) return;
            if (Number(o.month) !== selectedMonth) return;
            if (Number(o.year) !== selectedYear) return;
            if ((o.version_id || '') !== (activeRealVersionId || '')) return;
            map.set(`${o.line_key}__${o.scenario}`, Number(o.value) || 0);
        });
        return map;
    }, [overrides, selectedHotel, selectedMonth, selectedYear, activeRealVersionId]);

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
                    hotel: selectedHotel || '', year: selectedYear || 0, month: selectedMonth || 0,
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

        const adultos = dreFieldForScenario(adultosRow, scenario);
        const chd = dreFieldForScenario(chdRow, scenario);
        const hospedes = adultos + chd;

        const custoAlimentosItems = custoAlimentosRows.map(r => dreFieldForScenario(r, scenario, 'previa'));
        const custoAlimentos = custoAlimentosItems.reduce((a, b) => a + b, 0);
        const custoBebidasItems = custoBebidasRows.map(r => dreFieldForScenario(r, scenario, 'previa'));
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
        values: RowValues; editableLineKey?: string; editableScenarios?: Scenario[];
    }> = ({ label, indent = 0, bold, asHeader, format = 'currency', kind = 'neutral', values, editableLineKey, editableScenarios }) => {
        const diff1 = values.realizado - values.meta;
        const diff2 = values.realizado - values.anoAnterior;
        const isBold = bold || asHeader;
        const textClass = asHeader ? 'text-indigo-900' : (isBold ? 'text-gray-900' : 'text-gray-700');
        const cellClass = `px-2 py-1 text-right tabular-nums whitespace-nowrap ${isBold ? `font-black ${textClass}` : textClass}`;
        const renderCell = (scenario: Scenario, value: number) => {
            if (editableLineKey && (!editableScenarios || editableScenarios.includes(scenario))) {
                return <EditableCell value={value} onCommit={v => handleCommitCell(editableLineKey, scenario, v)} />;
            }
            return <>{formatByType(value, format)}</>;
        };
        return (
            <tr className={asHeader ? 'bg-indigo-50/60' : 'border-b border-gray-100 hover:bg-gray-50/50'}>
                <td className={`px-3 py-1 truncate ${asHeader ? 'font-black text-indigo-900 text-xs uppercase tracking-wide' : (isBold ? 'font-black text-gray-900' : 'text-gray-600')}`} style={{ paddingLeft: `${12 + indent * 20}px` }}>
                    {label}
                </td>
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
            <td colSpan={6} className="px-3 py-1 font-black text-indigo-900 text-xs uppercase tracking-wide">{label}</td>
        </tr>
    );

    const TableShell: React.FC<{ title?: string; children: React.ReactNode }> = ({ title, children }) => (
        <div>
            {title && <div className="text-xs font-black text-gray-500 uppercase tracking-wide mb-1 px-1">{title}</div>}
            <div className="overflow-x-auto border border-gray-200 rounded-xl">
                <table className="text-sm" style={{ fontFamily: 'Calibri, sans-serif' }}>
                    <colgroup>
                        <col style={{ width: '260px' }} />
                        <col style={{ width: '110px' }} />
                        <col style={{ width: '110px' }} />
                        <col style={{ width: '95px' }} />
                        <col style={{ width: '110px' }} />
                        <col style={{ width: '95px' }} />
                    </colgroup>
                    <thead className="bg-gray-50 text-gray-500 uppercase font-bold text-xs sticky top-0">
                        <tr>
                            <th className="px-3 py-1 text-left">Linha</th>
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

    return (
        <div className="px-4 py-6 min-h-[calc(100vh-5rem)]">
            <div className="inline-block bg-white rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-gray-100 p-6">
                <VersionInfoBanner versionName={activeRealVersionName} />
                <h2 className="text-xl font-black text-gray-900 mb-1">Análise de A&B</h2>
                <p className="text-sm text-gray-500 mb-4 max-w-md">CMV e Custo por PAX de Alimentos e Bebidas — Receitas editáveis vêm da importação de Receitas; Hóspedes e Custos são os mesmos valores da DRE Forecast.</p>

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

                    {onMonthChange && (
                        <div className="flex items-center gap-3 bg-white px-3 py-2 rounded-lg border border-gray-200 shadow-sm">
                            <button onClick={() => onMonthChange('prev')} className="p-1.5 hover:bg-gray-100 rounded text-gray-500">
                                <ArrowLeft size={18} />
                            </button>
                            <div className="flex items-center gap-2 text-sm text-gray-700 w-36 justify-center font-bold capitalize">
                                <Calendar size={16} className="text-indigo-500" />
                                <span>{formattedDate}</span>
                            </div>
                            <button onClick={() => onMonthChange('next')} className="p-1.5 hover:bg-gray-100 rounded text-gray-500">
                                <ArrowRight size={18} />
                            </button>
                        </div>
                    )}
                </div>

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
                        <TableShell title="Custo de Alimentos">
                            <Row label="Custo de Alimentos" asHeader kind="despesa" values={vals(r => r.custoAlimentos)} />
                            {custoAlimentosRows.map((row, i) => (
                                <Row key={row.id} label={row.label} indent={1} kind="despesa" values={vals(r => r.custoAlimentosItems[i] || 0)} />
                            ))}
                        </TableShell>
                        <TableShell title="Custo de Alimentos — Custo por PAX">
                            <Row label="Custo de Alimentos" asHeader format="currency2" kind="despesa" values={vals(r => r.custoPaxAlimentos)} />
                            {custoAlimentosRows.map((row, i) => (
                                <Row key={row.id} label={row.label} indent={1} format="currency2" kind="despesa" values={itemPax('custoAlimentosItems', i)} />
                            ))}
                        </TableShell>
                    </div>

                    <div className="flex items-start gap-4 flex-wrap">
                        <TableShell title="Custos de Bebidas">
                            <Row label="Custos de Bebidas" asHeader kind="despesa" values={vals(r => r.custoBebidas)} />
                            {custoBebidasRows.map((row, i) => (
                                <Row key={row.id} label={row.label} indent={1} kind="despesa" values={vals(r => r.custoBebidasItems[i] || 0)} />
                            ))}
                        </TableShell>
                        <TableShell title="Custos de Bebidas — Custo por PAX">
                            <Row label="Custos de Bebidas" asHeader format="currency2" kind="despesa" values={vals(r => r.custoPaxBebidas)} />
                            {custoBebidasRows.map((row, i) => (
                                <Row key={row.id} label={row.label} indent={1} format="currency2" kind="despesa" values={itemPax('custoBebidasItems', i)} />
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
        </div>
    );
};

export default AnaliseABView;
