import React, { useMemo, useState } from 'react';
import { ArrowLeft, ArrowLeftRight, ChevronDown, ChevronRight, ListFilter, LayoutList } from 'lucide-react';
import { Account, BudgetVersion, CostPackage, DreSection, Hotel, ImportedRow } from '../types';
import { buildForecastRows } from './ForecastTable';
import { blueRowIds } from '../utils/kpiEngine';
import { normalizeHotelName, pairedVersionId, resolveVersionWithImportedData } from '../services/mockData';

interface BudgetReviewComparativesProps {
    hotels: Hotel[];
    budgetVersions: BudgetVersion[];
    accounts: Account[];
    packages: CostPackage[];
    dreConfigs: Record<string, DreSection[]>;
    financialData: ImportedRow[];
    budgetOccupancyDataMap: Record<string, Record<string, number[]>>;
    realOccupancyData: Record<string, Record<string, number>>;
    activeRealVersionId?: string;
    initialNewVersionId: string;
    initialMonths: number[]; // 1-indexed
    onBack: () => void;
}

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v || 0);
const fmtPct = (v: number) => `${(v || 0).toFixed(1)}%`;

type SourceType = 'Meta' | 'Real';
interface ColumnDef { key: string; group: 'old' | 'new'; versionId: string; year: number; month: number; source: SourceType; }

// Mesmas linhas escondidas da DRE de Revisão de Metas (BudgetReviewDRE.tsx) — só interessa o GOP
// com dedução de impostos, e Transformação/Reatividade não faz sentido aqui (compara Real x Meta
// x Ano Anterior, que já não é o que este comparativo mostra).
const HIDDEN_ROW_IDS = new Set(['RES-OP-SEM-IMP', 'RES-OP-SEM-IMP-PCT', 'KPI-TRANS-BUDGET', 'KPI-TRANS-LY', 'KPI-TRANS-M-LY', 'KPI-TRANS-BUDGET-SEM', 'KPI-TRANS-LY-SEM', 'KPI-TRANS-M-LY-SEM']);
const fmtDecimal2 = (v: number) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);
const fmtValue = (v: number, row: { rowConfig?: { format?: string } }) => {
    if (row.rowConfig?.format === 'percent') return `${(v || 0).toFixed(2)}%`;
    if (row.rowConfig?.format === 'decimal') return fmtDecimal2(v); // ex.: Coef. Adultos/CHD
    return fmt(v);
};

// Etapa 5 (bis) da Revisão de Metas — "Comparativos": pra cada versão (Meta antiga / Meta atual),
// escolhe independentemente quais meses entram e, mês a mês, se a coluna usa a Meta daquela
// versão ou o Realizado — assim dá pra montar o ano fechado inteiro (ex.: Jan-Ago com Meta antiga
// + Set-Dez com a Meta revisada) e ver como o resultado anual fica, na mesma DRE completa
// (hierarquia de contas/pacotes) que a Revisão de Metas usa — só que com uma coluna por
// combinação (versão, mês, fonte) escolhida, em vez de Valor/KPI por mês.
const BudgetReviewComparatives: React.FC<BudgetReviewComparativesProps> = ({
    hotels, budgetVersions, accounts, packages, dreConfigs, financialData, budgetOccupancyDataMap, realOccupancyData,
    activeRealVersionId, initialNewVersionId, initialMonths, onBack
}) => {
    const newVersionDefault = budgetVersions.find(v => v.id === initialNewVersionId);
    const hotelName = hotels.find(h => h.code === newVersionDefault?.hotelId || h.id === newVersionDefault?.hotelId)?.name || newVersionDefault?.hotel || '';
    const versionsForHotel = budgetVersions.filter(v => v.hotelId === newVersionDefault?.hotelId || v.hotel === hotelName);

    const [oldVersionId, setOldVersionId] = useState<string>(
        versionsForHotel.find(v => v.id !== initialNewVersionId && v.isMain)?.id
        || versionsForHotel.find(v => v.id !== initialNewVersionId)?.id
        || ''
    );
    const [newVersionId, setNewVersionId] = useState(initialNewVersionId);
    const [oldMonthSources, setOldMonthSources] = useState<Record<number, SourceType>>({});
    const [newMonthSources, setNewMonthSources] = useState<Record<number, SourceType>>(() => {
        const init: Record<number, SourceType> = {};
        initialMonths.forEach(m => { init[m] = 'Meta'; });
        return init;
    });
    const [collapsedPackages, setCollapsedPackages] = useState<Set<string>>(new Set());
    // "Mostrar/Ocultar Contas" — igual ao botão da DRE Forecast/Revisão de Metas: expande/colapsa
    // todos os pacotes de uma vez e mostra/esconde o detalhamento de Indicadores e Lazer/Eventos.
    const [showDetails, setShowDetails] = useState(true);

    const oldVersion = versionsForHotel.find(v => v.id === oldVersionId);
    const newVersion = versionsForHotel.find(v => v.id === newVersionId);

    // Pode existir mais de uma BudgetVersion com o MESMO nome/ano pro mesmo hotel (ex.: uma criada
    // vazia antes da importação de verdade acontecer) — o <select> mostra as duas com texto
    // idêntico, sem dar pra diferenciar. Resolve pra quem realmente TEM despesa/ocupação
    // importada — mesma ideia usada pra achar o KPI "da última meta importada" na Revisão de
    // Metas — em vez de confiar cegamente em qual delas o <select> ativou por padrão.
    const oldResolved = useMemo(() => oldVersion ? resolveVersionWithImportedData(oldVersion, versionsForHotel, hotels, financialData, budgetOccupancyDataMap) : null, [oldVersion, versionsForHotel, hotels, financialData, budgetOccupancyDataMap]);
    const newResolved = useMemo(() => newVersion ? resolveVersionWithImportedData(newVersion, versionsForHotel, hotels, financialData, budgetOccupancyDataMap) : null, [newVersion, versionsForHotel, hotels, financialData, budgetOccupancyDataMap]);

    const toggleMonth = (which: 'old' | 'new', m: number) => {
        const setter = which === 'old' ? setOldMonthSources : setNewMonthSources;
        setter(prev => {
            const next = { ...prev };
            if (next[m]) delete next[m]; else next[m] = 'Meta';
            return next;
        });
    };
    const toggleSource = (which: 'old' | 'new', m: number, e: React.MouseEvent) => {
        e.stopPropagation();
        const setter = which === 'old' ? setOldMonthSources : setNewMonthSources;
        setter(prev => ({ ...prev, [m]: prev[m] === 'Real' ? 'Meta' : 'Real' }));
    };

    const columns: ColumnDef[] = useMemo(() => {
        const cols: ColumnDef[] = [];
        if (oldResolved) {
            Object.entries(oldMonthSources).sort((a, b) => +a[0] - +b[0]).forEach(([m, source]) => {
                cols.push({ key: `old-${m}`, group: 'old', versionId: oldResolved.id, year: oldResolved.year, month: +m, source });
            });
        }
        if (newResolved) {
            Object.entries(newMonthSources).sort((a, b) => +a[0] - +b[0]).forEach(([m, source]) => {
                cols.push({ key: `new-${m}`, group: 'new', versionId: newResolved.id, year: newResolved.year, month: +m, source });
            });
        }
        return cols;
    }, [oldResolved, newResolved, oldMonthSources, newMonthSources]);

    const colRowSets = useMemo(() => columns.map(col => {
        if (col.source === 'Meta') {
            const paired = pairedVersionId(col.versionId) || undefined;
            // Mesmo problema do par Real/Budget pode acontecer com a ocupação (import gravando sob
            // o id errado do par) — cai pro id par se a versão em si não tiver nada.
            const occData = budgetOccupancyDataMap[col.versionId] && Object.keys(budgetOccupancyDataMap[col.versionId]).length > 0
                ? budgetOccupancyDataMap[col.versionId]
                : (paired ? budgetOccupancyDataMap[paired] : undefined) || {};
            return buildForecastRows(dreConfigs, col.month, col.year, financialData, hotelName, hotels, {}, paired, col.versionId, accounts, packages, occData, undefined, []);
        }
        return buildForecastRows(dreConfigs, col.month, col.year, financialData, hotelName, hotels, realOccupancyData, activeRealVersionId, undefined, accounts, packages, {}, undefined, []);
    }), [columns, dreConfigs, financialData, hotelName, hotels, accounts, packages, budgetOccupancyDataMap, realOccupancyData, activeRealVersionId]);

    const structureRows = colRowSets[0] || [];
    const oldCount = columns.filter(c => c.group === 'old').length;
    const newCount = columns.filter(c => c.group === 'new').length;
    const allPackageIds = useMemo(() => structureRows.filter(r => r.category === 'Package' && r.isHeader && r.indentLevel === 1).map(r => r.id), [structureRows]);

    const toggleShowDetails = () => {
        if (showDetails) {
            setShowDetails(false);
            setCollapsedPackages(new Set(allPackageIds));
        } else {
            setShowDetails(true);
            setCollapsedPackages(new Set());
        }
    };

    // Diagnóstico visível embaixo de cada mês: quantas linhas de DESPESA (tipo='Despesa', não
    // qualquer linha de Meta — receita/imposto/ocupação-detalhada também gravam com cenario=Meta
    // e inflavam essa contagem antes) essa coluna achou pra esse mês específico, e se a OCUPAÇÃO
    // tem valor não-zero exatamente nesse mês (não só "o objeto existe" — a Ocupação é um array de
    // 12 posições por versão, então um array preenchido só de Set a Dez ainda "existe" mas fica
    // zerado em Jan-Ago). Se vier 0/sem ocup. aqui é porque não existe dado gravado pra esse
    // mês/versão/hotel — não é a tabela "escondendo" nada.
    const normCompareHotel = normalizeHotelName(hotelName);
    const colDiagnostics = useMemo(() => columns.map(col => {
        if (col.source === 'Meta') {
            const paired = pairedVersionId(col.versionId);
            const count = financialData.filter(r =>
                (r.versionId === col.versionId || (paired && r.versionId === paired)) &&
                (r.cenario || '').trim().toLowerCase() === 'meta' && (r.tipo || '').trim().toLowerCase() === 'despesa' &&
                parseInt(r.ano) === col.year && parseInt(r.mes) === col.month && normalizeHotelName(r.hotel) === normCompareHotel
            ).length;
            const occForVersion = budgetOccupancyDataMap[col.versionId] || {};
            const occForPaired = paired ? (budgetOccupancyDataMap[paired] || {}) : {};
            const hasOcc = (occForVersion['geral_avail']?.[col.month - 1] || 0) > 0 || (occForPaired['geral_avail']?.[col.month - 1] || 0) > 0;
            return { count, hasOcc };
        }
        const count = financialData.filter(r =>
            r.versionId === activeRealVersionId && (r.cenario || '').trim().toLowerCase() === 'real' && (r.tipo || '').trim().toLowerCase() === 'despesa' &&
            parseInt(r.ano) === col.year && parseInt(r.mes) === col.month && normalizeHotelName(r.hotel) === normCompareHotel
        ).length;
        return { count, hasOcc: true };
    }), [columns, financialData, budgetOccupancyDataMap, normCompareHotel, activeRealVersionId]);

    const valueOf = (rows: ReturnType<typeof buildForecastRows>, rowId: string, source: SourceType) => {
        const r = rows.find(x => x.id === rowId);
        if (!r) return 0;
        return source === 'Meta' ? r.budget : r.real;
    };

    // Coluna "Total" (soma de todas as colunas selecionadas) — pra linhas em % não faz sentido
    // somar ponto percentual, precisa recalcular a razão a partir dos totais em R$/unidade.
    const sumRaw = (rowId: string) => columns.reduce((s, col, idx) => s + valueOf(colRowSets[idx], rowId, col.source), 0);
    const computeTotalForRow = (row: any): number => {
        if (row.id === 'RES-OP-COM-IMP-PCT') {
            const totalReceita = sumRaw('REV-NET');
            return totalReceita !== 0 ? (sumRaw('RES-OP-COM-IMP') / totalReceita) * 100 : 0;
        }
        if (row.id === 'IND-3') { // % de Ocupação
            const totalDisponivel = sumRaw('IND-1');
            return totalDisponivel !== 0 ? (sumRaw('IND-2') / totalDisponivel) * 100 : 0;
        }
        return sumRaw(row.id);
    };

    // Resposta direta a "quanto meu resultado vai ficar no ano": soma Receita Líquida/Despesa/GOP
    // de TODAS as colunas selecionadas no momento — escolhendo meses complementares e sem
    // sobreposição entre Meta antiga e Meta atual (ex.: Jan-Ago antiga + Set-Dez atual), essa soma
    // já é o ano fechado inteiro.
    const annualSummary = useMemo(() => {
        let receita = 0, despesa = 0, gop = 0;
        columns.forEach((col, idx) => {
            const rows = colRowSets[idx];
            receita += valueOf(rows, 'REV-NET', col.source);
            despesa += valueOf(rows, 'CST-HEAD', col.source);
            gop += valueOf(rows, 'RES-OP-COM-IMP', col.source);
        });
        return { receita, despesa, gop, gopPct: receita !== 0 ? (gop / receita) * 100 : 0 };
    }, [columns, colRowSets]);

    // Transformação/Reatividade — mesma fórmula da DRE Forecast (ForecastTable.tsx,
    // computeTransReat): Transformação = ΔGOP / ΔReceita quando a Receita Líquida do período
    // "atual" (Meta atual, respeitando a fonte Meta/Real escolhida em cada mês) é MAIOR que a do
    // MESMO período (mesmos meses) na Meta antiga — sempre a Meta antiga, não o Realizado, porque
    // é "em relação à meta anterior" — indicando crescimento por transformação real do negócio.
    // Reatividade = ΔCusto / ΔReceita quando encolheu, indicando reação via corte/aumento de
    // custo. Ignora qual mês está manualmente marcado no seletor de "Meta antiga" — usa sempre os
    // MESMOS meses selecionados em "Meta atual", buscados na versão antiga resolvida.
    const transReatCard = useMemo(() => {
        if (!oldResolved || !newResolved) return null;
        const newMonthList = Object.keys(newMonthSources).map(Number);
        if (newMonthList.length === 0) return null;

        let curReceita = 0, curGop = 0, curCusto = 0;
        newMonthList.forEach(m => {
            const colIdx = columns.findIndex(c => c.group === 'new' && c.month === m);
            if (colIdx === -1) return;
            const rows = colRowSets[colIdx];
            const source = columns[colIdx].source;
            curReceita += valueOf(rows, 'REV-NET', source);
            curGop += valueOf(rows, 'RES-OP-COM-IMP', source);
            curCusto += valueOf(rows, 'CST-HEAD', source);
        });

        const pairedOld = pairedVersionId(oldResolved.id) || undefined;
        const oldOccData = budgetOccupancyDataMap[oldResolved.id] && Object.keys(budgetOccupancyDataMap[oldResolved.id]).length > 0
            ? budgetOccupancyDataMap[oldResolved.id]
            : (pairedOld ? budgetOccupancyDataMap[pairedOld] : undefined) || {};
        let baseReceita = 0, baseGop = 0, baseCusto = 0;
        newMonthList.forEach(m => {
            const rows = buildForecastRows(dreConfigs, m, oldResolved.year, financialData, hotelName, hotels, {}, pairedOld, oldResolved.id, accounts, packages, oldOccData, undefined, []);
            const val = (id: string) => rows.find(r => r.id === id)?.budget || 0;
            baseReceita += val('REV-NET'); baseGop += val('RES-OP-COM-IMP'); baseCusto += val('CST-HEAD');
        });

        const deltaRev = curReceita - baseReceita;
        let value = 0;
        if (deltaRev > 0) value = ((curGop - baseGop) / deltaRev) * 100;
        else if (deltaRev < 0) value = ((curCusto - baseCusto) / deltaRev) * 100;
        return { kind: deltaRev >= 0 ? 'Transformação' : 'Reatividade', value, deltaRev };
    }, [oldResolved, newResolved, newMonthSources, columns, colRowSets, dreConfigs, financialData, hotelName, hotels, accounts, packages, budgetOccupancyDataMap]);

    const togglePackage = (id: string) => setCollapsedPackages(prev => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
    });

    const ALLOWED_INDICATORS_HIDDEN = ['IND-1', 'IND-2', 'IND-3', 'IND-4', 'IND-5', 'IND-6', 'IND-TREVPOR'];

    const isRowVisible = (row: any, idx: number) => {
        if (HIDDEN_ROW_IDS.has(row.id)) return false;
        if (row.category === 'Indicators') {
            return showDetails || ALLOWED_INDICATORS_HIDDEN.includes(row.id);
        }
        if (row.category === 'Revenue' && !row.isHeader) {
            return showDetails;
        }
        if (row.category !== 'Costs' && row.category !== 'Account') return true;
        if (row.indentLevel !== 2) return true;
        for (let i = idx - 1; i >= 0; i--) {
            if (structureRows[i].isHeader && structureRows[i].indentLevel === 1) {
                return !collapsedPackages.has(structureRows[i].id);
            }
        }
        return true;
    };

    const renderMonthPicker = (which: 'old' | 'new', sources: Record<number, SourceType>) => (
        <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5">
            {MONTH_NAMES.map((label, idx) => {
                const m = idx + 1;
                const selected = sources[m];
                return (
                    <button
                        key={idx}
                        onClick={() => toggleMonth(which, m)}
                        className={`relative py-1.5 rounded-md text-[11px] font-bold border flex flex-col items-center gap-0.5 ${selected ? 'bg-[#F8981C] text-white border-[#F8981C]' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                    >
                        {label}
                        {selected && (
                            <span
                                onClick={(e) => toggleSource(which, m, e)}
                                className={`text-[8px] px-1 rounded-full font-black uppercase ${selected === 'Real' ? 'bg-white text-[#F8981C]' : 'bg-black/20 text-white'}`}
                                title="Clique pra trocar entre Meta e Realizado"
                            >
                                {selected === 'Real' ? 'Real' : 'Meta'}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );

    return (
        <div className="p-6 max-w-full mx-auto">
            <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"><ArrowLeft size={18} /></button>
                    <div className="w-9 h-9 rounded-xl bg-[#F8981C]/10 flex items-center justify-center shrink-0">
                        <ArrowLeftRight className="text-[#F8981C]" size={16} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">Comparativos — {hotelName}</h2>
                        <p className="text-gray-500 text-xs mt-0.5">Escolha os meses e a fonte (Meta ou Realizado) de cada versão — mesma DRE completa da Revisão de Metas, uma coluna por combinação.</p>
                    </div>
                </div>
                <button
                    onClick={toggleShowDetails}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border transition-colors ${!showDetails ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                    title={showDetails ? 'Ocultar contas contábeis' : 'Mostrar contas contábeis'}
                >
                    {showDetails ? <ListFilter size={13} /> : <LayoutList size={13} />}
                    {showDetails ? 'Ocultar Contas' : 'Mostrar Contas'}
                </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">Meta antiga</label>
                        <select value={oldVersionId} onChange={e => setOldVersionId(e.target.value)} className="w-full mt-1 mb-2 border border-gray-200 rounded-lg px-3 py-2 text-sm">
                            <option value="">Selecione...</option>
                            {versionsForHotel.map(v => <option key={v.id} value={v.id}>{v.name} ({v.year})</option>)}
                        </select>
                        {oldVersion && oldResolved && oldResolved.id !== oldVersion.id && (
                            <p className="text-[10px] text-amber-600 font-semibold mb-1.5">
                                Essa versão não tem despesa/ocupação importada — usando os dados de "{oldResolved.name}" ({oldResolved.year}) em vez disso.
                            </p>
                        )}
                        {oldVersion && renderMonthPicker('old', oldMonthSources)}
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">Meta atual</label>
                        <select value={newVersionId} onChange={e => setNewVersionId(e.target.value)} className="w-full mt-1 mb-2 border border-gray-200 rounded-lg px-3 py-2 text-sm">
                            <option value="">Selecione...</option>
                            {versionsForHotel.map(v => <option key={v.id} value={v.id}>{v.name} ({v.year})</option>)}
                        </select>
                        {newVersion && newResolved && newResolved.id !== newVersion.id && (
                            <p className="text-[10px] text-amber-600 font-semibold mb-1.5">
                                Essa versão não tem despesa/ocupação importada — usando os dados de "{newResolved.name}" ({newResolved.year}) em vez disso.
                            </p>
                        )}
                        {newVersion && renderMonthPicker('new', newMonthSources)}
                    </div>
                </div>
                <p className="text-[11px] text-gray-400 mt-3">Clique num mês pra incluir/tirar da tabela. Com o mês incluído, clique na etiqueta "Meta"/"Real" pra trocar a fonte daquela coluna.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 mb-4">
                {[
                    { label: 'Receita Líquida (colunas selecionadas)', value: fmt(annualSummary.receita) },
                    { label: 'Despesa (colunas selecionadas)', value: fmt(annualSummary.despesa) },
                    { label: 'GOP R$ (colunas selecionadas)', value: fmt(annualSummary.gop) },
                    { label: 'GOP % (colunas selecionadas)', value: fmtPct(annualSummary.gopPct) },
                ].map(card => (
                    <div key={card.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{card.label}</p>
                        <p className="text-xl font-bold text-gray-900 mt-1">{card.value}</p>
                    </div>
                ))}
                {transReatCard && (
                    <div className={`rounded-xl border shadow-sm p-4 ${transReatCard.kind === 'Transformação' ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}`}>
                        <p className={`text-[10px] font-bold uppercase tracking-wide ${transReatCard.kind === 'Transformação' ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {transReatCard.kind} vs. mesmo período da Meta antiga
                        </p>
                        <p className={`text-xl font-bold mt-1 ${transReatCard.kind === 'Transformação' ? 'text-emerald-800' : 'text-amber-800'}`}>{fmtPct(transReatCard.value)}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                            Receita {transReatCard.deltaRev >= 0 ? 'maior' : 'menor'} que a da Meta antiga nos mesmos meses
                        </p>
                    </div>
                )}
            </div>

            {columns.length === 0 ? (
                <p className="text-sm text-gray-400 italic text-center py-10">Selecione ao menos um mês de "Meta antiga" ou "Meta atual" pra montar a tabela.</p>
            ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
                    <table className="w-auto text-base font-sans border-collapse">
                        <thead className="text-sm">
                            <tr className="border-b border-gray-200">
                                <th rowSpan={2} className="w-[300px] px-2 py-px text-left font-bold text-gray-500 uppercase sticky left-0 bg-white z-10 align-bottom whitespace-nowrap">Indicador</th>
                                {oldCount > 0 && <th colSpan={oldCount} className="px-1 py-px text-center text-xs font-bold text-gray-500 uppercase border-l border-gray-100 truncate">Meta antiga — {oldVersion?.name}</th>}
                                {newCount > 0 && <th colSpan={newCount} className="px-1 py-px text-center text-xs font-bold text-gray-500 uppercase border-l border-gray-100 truncate">Meta atual — {newVersion?.name}</th>}
                                <th rowSpan={2} className="w-20 px-1 py-px text-center text-xs font-bold text-indigo-700 uppercase border-l-2 border-indigo-200 bg-indigo-50 align-bottom">Total</th>
                            </tr>
                            <tr className="border-b border-gray-200">
                                {columns.map((col, colIdx) => {
                                    const diag = colDiagnostics[colIdx];
                                    return (
                                        <th key={col.key} className={`w-20 px-1 py-px text-center text-xs font-semibold border-l border-gray-100 truncate ${col.source === 'Real' ? 'text-emerald-600' : 'text-gray-400'}`}>
                                            {MONTH_NAMES[col.month - 1]} <span className="block text-[9px] font-black uppercase">{col.source === 'Real' ? 'Real' : 'Meta'}</span>
                                            <span className={`block text-[8px] font-normal normal-case ${diag.count === 0 ? 'text-red-400' : 'text-gray-300'}`} title="Linhas de financial_data encontradas pra esse mês/versão — 0 quer dizer que não existe dado gravado aqui, não é a tabela escondendo nada">
                                                {diag.count} linha(s){!diag.hasOcc && col.source === 'Meta' ? ' · sem ocup.' : ''}
                                            </span>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {structureRows.map((row, idx) => {
                                if (!isRowVisible(row, idx)) return null;
                                if (row.category === 'Spacer') return <tr key={row.id}><td colSpan={2 + columns.length} className="py-1">&nbsp;</td></tr>;

                                const isSectionHeader = row.isHeader && row.indentLevel === 0;
                                const isBlueHighlight = blueRowIds.includes(row.id);
                                const isPackageHeader = row.category === 'Package' && row.isHeader && row.indentLevel === 1;
                                const isRevImp = row.id === 'REV-IMP';
                                const indent = (row.indentLevel || 0) * 16;

                                let rowBg = 'white';
                                let trClass = 'border-b border-gray-100 text-slate-700 hover:bg-indigo-50/30';
                                let labelClass = 'text-xs';
                                if (isSectionHeader) {
                                    rowBg = isBlueHighlight ? '#e0f2fe' : '#f1f5f9';
                                    trClass = isBlueHighlight ? 'border-y border-sky-200' : 'border-y border-slate-200';
                                    labelClass = `text-xs font-bold uppercase tracking-wide ${isBlueHighlight ? 'text-sky-900' : 'text-slate-800'}`;
                                } else if (isPackageHeader) {
                                    rowBg = '#f9fafb';
                                    trClass = 'border-b border-gray-200';
                                    labelClass = 'text-xs font-bold text-gray-800 uppercase';
                                } else if (row.isTotal || isRevImp) {
                                    rowBg = isRevImp ? '#e0f2fe' : '#eef2ff';
                                    trClass = isRevImp ? 'border-y-2 border-sky-300 font-bold text-sky-950' : 'border-y-2 border-gray-300 font-bold text-indigo-900';
                                    labelClass = 'text-xs uppercase tracking-wide';
                                }

                                return (
                                    <tr key={row.id} className={trClass} style={{ backgroundColor: rowBg }}>
                                        <td className={`w-[300px] px-2 py-px sticky left-0 truncate ${labelClass}`} style={{ paddingLeft: 8 + indent, backgroundColor: rowBg }}>
                                            {isPackageHeader && (
                                                <button onClick={() => togglePackage(row.id)} className="inline-flex mr-1 align-middle text-gray-400 hover:text-indigo-600">
                                                    {collapsedPackages.has(row.id) ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
                                                </button>
                                            )}
                                            {row.label}
                                        </td>
                                        {columns.map((col, colIdx) => {
                                            const cellRow = colRowSets[colIdx].find(r => r.id === row.id);
                                            const val = cellRow ? (col.source === 'Meta' ? cellRow.budget : cellRow.real) : 0;
                                            return (
                                                <td key={col.key} className="px-1 py-px text-right tabular-nums border-l border-gray-100 truncate">
                                                    {cellRow ? fmtValue(val, cellRow) : '-'}
                                                </td>
                                            );
                                        })}
                                        <td className="px-1 py-px text-right tabular-nums border-l-2 border-indigo-200 bg-indigo-50/60 font-bold text-indigo-900 truncate">
                                            {fmtValue(computeTotalForRow(row), row)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default BudgetReviewComparatives;
