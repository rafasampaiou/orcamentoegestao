import React, { useMemo, useState } from 'react';
import { ArrowLeft, Calculator, ClipboardEdit, ArrowLeftRight, ChevronDown, ChevronRight, Save } from 'lucide-react';
import { Account, BudgetVersion, CostPackage, DreSection, Hotel, ImportedRow, KpiCalculation, PermissionMatrix, User, hasPermission } from '../types';
import { buildForecastRows } from './ForecastTable';
import { getKpiInfoForRow, isEditableKpiForRow, resolveKpiTerm, parseSelfRatioDenominator, blueRowIds } from '../utils/kpiEngine';

interface BudgetReviewDREProps {
    version: BudgetVersion;
    // De qual versão puxar os KPIs de despesa "importados anteriormente" (resolvido em App.tsx,
    // resolveBudgetReviewMainVersion) — usado pra já preencher a tela por padrão, independente de
    // "usar original" ou "criar réplica" ter sido escolhido no assistente.
    mainSourceVersionId: string;
    budgetVersions: BudgetVersion[];
    reviewMonths: number[]; // 1-indexed
    accounts: Account[];
    packages: CostPackage[];
    packageKpiConfigs: Record<string, KpiCalculation>;
    hotels: Hotel[];
    dreConfigs: Record<string, DreSection[]>;
    financialData: ImportedRow[];
    budgetOccupancyDataMap: Record<string, Record<string, number[]>>;
    setBudgetOccupancyDataMap: React.Dispatch<React.SetStateAction<Record<string, Record<string, number[]>>>>;
    currentUser?: User;
    permissionsMatrix: PermissionMatrix;
    onBack: () => void;
    onGoToOccupancy: () => void;
    onGoToComparatives: () => void;
    onCalcularForecast: () => Promise<void>;
    onSaveEdits: (edits: { rowId: string; month: number; value: number }[]) => Promise<void>;
}

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
// Receita Extra Lazer/Eventos não tem Meta própria em financial_data — escreve direto em
// budgetOccupancyDataMap, mesmo caso especial de ForecastTable.tsx (handleKpiValueChange).
const REVENUE_EXTRA_BUDGET_SOURCE: Record<string, string> = { 'REV-EXTRA-LAZER': 'lazer_extra_rev', 'REV-EXTRA-EVENTOS': 'event_extra_rev' };
// Agregados sempre recalculados por soma dos filhos (sem trava de override) — editar aqui não
// teria efeito nenhum, a soma sobrescreveria na mesma hora.
const NON_EDITABLE_AGGREGATE_IDS = new Set(['REV-APT', 'REV-EXTRA', 'REV-TOTAL', 'REV-NET', 'CST-HEAD']);

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v || 0);
const fmtKpi = (v: number, format: string) => format === 'percent' ? `${(v || 0).toFixed(2)}%` : new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);

// Etapa 4/5 da Revisão de Metas — DRE idêntica à DRE Forecast (mesma hierarquia de
// contas/pacotes/indicadores, mesmo motor de KPI), só que com um mês em cada coluna (cada um com
// seu par Valor/KPI) em vez de Prévia/Real/Meta. Reaproveita buildForecastRows (ForecastTable.tsx)
// chamado uma vez por mês selecionado, e o motor de KPI extraído em utils/kpiEngine.ts.
const BudgetReviewDRE: React.FC<BudgetReviewDREProps> = ({
    version, mainSourceVersionId, budgetVersions, reviewMonths, accounts, packages, packageKpiConfigs, hotels, dreConfigs, financialData,
    budgetOccupancyDataMap, setBudgetOccupancyDataMap, currentUser, permissionsMatrix,
    onBack, onGoToOccupancy, onGoToComparatives, onCalcularForecast, onSaveEdits
}) => {
    const [calculating, setCalculating] = useState(false);
    const [saving, setSaving] = useState(false);
    const [collapsedPackages, setCollapsedPackages] = useState<Set<string>>(new Set());
    // rowId -> mês -> novo valor (ainda não salvo) — some com financialData/budgetOccupancyDataMap
    // pra recalcular ao vivo, e só vira persistência de verdade ao clicar "Salvar".
    const [pendingEdits, setPendingEdits] = useState<Record<string, Record<number, number>>>({});

    const canEdit = hasPermission(permissionsMatrix, currentUser, 'Revisão de Metas', 'Criar Réplica / Editar Meta em Revisão') && !version.isLocked;
    const hotelName = hotels.find(h => h.code === version.hotelId || h.id === version.hotelId)?.name || version.hotel || '';
    const months = useMemo(() => [...reviewMonths].sort((a, b) => a - b), [reviewMonths]);
    const scopedFinancialData = useMemo(() => financialData.filter(r => r.versionId === version.id), [financialData, version.id]);

    const effectiveFinancialData = useMemo(() => {
        const pendingRows: ImportedRow[] = [];
        Object.entries(pendingEdits).forEach(([rowId, byMonth]) => {
            Object.entries(byMonth).forEach(([month, value]) => {
                pendingRows.push({
                    ano: String(version.year), cenario: 'Meta', tipo: 'Despesa', hotel: hotelName, conta: `override_${rowId}`,
                    cr: '', mes: month, valor: value.toFixed(2), status: 'valid', versionId: version.id,
                });
            });
        });
        if (pendingRows.length === 0) return scopedFinancialData;
        const overriddenKeys = new Set(pendingRows.map(r => `${r.conta}|${r.mes}`));
        return [...scopedFinancialData.filter(r => !overriddenKeys.has(`${r.conta}|${r.mes}`)), ...pendingRows];
    }, [scopedFinancialData, pendingEdits, version.year, version.id, hotelName]);

    const effectiveOccupancyData = budgetOccupancyDataMap[version.id] || {};

    // Passo 1: linhas com os dados reais/editados desta versão (sem preenchimento automático
    // ainda) — usadas só pra ler os denominadores (Receita/UH Disponível etc.) de cada mês, que
    // não dependem de despesa nenhuma.
    const rawCurrentRowSets = useMemo(() => months.map(month =>
        buildForecastRows(dreConfigs, month, version.year, effectiveFinancialData, hotelName, hotels, {}, undefined, version.id, accounts, packages, effectiveOccupancyData, undefined, [])
    ), [months, dreConfigs, version.year, effectiveFinancialData, hotelName, hotels, version.id, accounts, packages, effectiveOccupancyData]);

    const mainSourceVersion = budgetVersions.find(v => v.id === mainSourceVersionId) || null;
    const sourceHotelName = mainSourceVersion ? (hotels.find(h => h.code === mainSourceVersion.hotelId || h.id === mainSourceVersion.hotelId)?.name || mainSourceVersion.hotel || hotelName) : hotelName;
    const sourceScopedFinancialData = useMemo(() => mainSourceVersion ? financialData.filter(r => r.versionId === mainSourceVersion.id) : [], [financialData, mainSourceVersion]);
    const sourceOccupancyData = mainSourceVersion ? (budgetOccupancyDataMap[mainSourceVersion.id] || {}) : {};

    // Linhas da versão-fonte (a "última meta importada") — é dela que sai a taxa (valor ÷
    // denominador) de cada conta de despesa, pro mesmo mês.
    const baselineRowSets = useMemo(() => {
        if (!mainSourceVersion) return months.map(() => [] as ReturnType<typeof buildForecastRows>);
        return months.map(month =>
            buildForecastRows(dreConfigs, month, mainSourceVersion.year, sourceScopedFinancialData, sourceHotelName, hotels, {}, undefined, mainSourceVersion.id, accounts, packages, sourceOccupancyData, undefined, [])
        );
    }, [months, mainSourceVersion, sourceScopedFinancialData, sourceHotelName, hotels, dreConfigs, accounts, packages, sourceOccupancyData]);

    // Passo 2: pra cada conta de despesa (Costs/Account) com KPI de razão simples que ainda não foi
    // editada nesta sessão, calcula o valor projetado (taxa da versão-fonte × denominador do mês já
    // revisado) e injeta como override_<linha> — reaproveita o próprio buildForecastRows (e o
    // recalculateTotals de dentro dele) pra já vir com pacotes/totais/GOP corretamente
    // re-somados, em vez de eu reimplementar a agregação na mão.
    const displayFinancialData = useMemo(() => {
        if (!mainSourceVersion) return effectiveFinancialData;
        const autoRows: ImportedRow[] = [];
        months.forEach((month, monthIdx) => {
            const currentRows = rawCurrentRowSets[monthIdx];
            const baselineRows = baselineRowSets[monthIdx];
            currentRows.forEach(row => {
                if (row.category !== 'Costs' && row.category !== 'Account') return;
                if (pendingEdits[row.id]?.[month] !== undefined) return; // editado nesta sessão, não mexe
                const baseRow = baselineRows.find(r => r.id === row.id);
                if (!baseRow?.rowConfig?.kpiCalculation) return;
                const calc = baseRow.rowConfig.kpiCalculation;
                const selfDenom = parseSelfRatioDenominator(calc.formula, baseRow.label);
                if (!selfDenom) return;
                const baseDenom = resolveKpiTerm(selfDenom, baselineRows, 'budget');
                if (!baseDenom) return;
                const rate = baseRow.budget / baseDenom;
                const currentDenom = resolveKpiTerm(selfDenom, currentRows, 'budget');
                const projected = rate * currentDenom;
                autoRows.push({
                    ano: String(version.year), cenario: 'Meta', tipo: 'Despesa', hotel: hotelName, conta: `override_${row.id}`,
                    cr: '', mes: String(month), valor: projected.toFixed(2), status: 'valid', versionId: version.id,
                });
            });
        });
        if (autoRows.length === 0) return effectiveFinancialData;
        const autoKeys = new Set(autoRows.map(r => `${r.conta}|${r.mes}`));
        return [...effectiveFinancialData.filter(r => !autoKeys.has(`${r.conta}|${r.mes}`)), ...autoRows];
    }, [mainSourceVersion, months, rawCurrentRowSets, baselineRowSets, pendingEdits, effectiveFinancialData, version.year, version.id, hotelName]);

    const monthRowSets = useMemo(() => months.map((month, monthIdx) =>
        mainSourceVersion
            ? buildForecastRows(dreConfigs, month, version.year, displayFinancialData, hotelName, hotels, {}, undefined, version.id, accounts, packages, effectiveOccupancyData, undefined, [])
            : rawCurrentRowSets[monthIdx]
    ), [months, mainSourceVersion, dreConfigs, version.year, displayFinancialData, hotelName, hotels, version.id, accounts, packages, effectiveOccupancyData, rawCurrentRowSets]);

    const structureRows = monthRowSets[0] || [];

    const togglePackage = (id: string) => setCollapsedPackages(prev => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
    });

    const isRowVisible = (row: any, idx: number) => {
        if (row.category !== 'Costs' && row.category !== 'Account') return true;
        if (row.indentLevel !== 2) return true;
        // Conta dentro de um pacote colapsado — acha o pacote-pai olhando pra trás até o header mais próximo.
        for (let i = idx - 1; i >= 0; i--) {
            if (structureRows[i].isHeader && structureRows[i].indentLevel === 1) {
                return !collapsedPackages.has(structureRows[i].id);
            }
        }
        return true;
    };

    const isEditableRow = (row: any) => {
        if (row.isTotal) return false;
        if (row.isHeader && row.indentLevel === 0) return false;
        if (NON_EDITABLE_AGGREGATE_IDS.has(row.id)) return false;
        if (row.category === 'Indicators' || row.category === 'Spacer') return false;
        return true;
    };

    const setEdit = (rowId: string, month: number, value: number) => {
        setPendingEdits(prev => ({ ...prev, [rowId]: { ...(prev[rowId] || {}), [month]: value } }));
    };

    const handleValueChange = (row: any, month: number, newValue: number) => {
        const sourceId = REVENUE_EXTRA_BUDGET_SOURCE[row.id];
        if (sourceId) {
            setBudgetOccupancyDataMap(prev => {
                const current = { ...(prev[version.id] || {}) };
                const arr = [...(current[sourceId] || Array(12).fill(0))];
                arr[month - 1] = newValue;
                return { ...prev, [version.id]: { ...current, [sourceId]: arr } };
            });
            return;
        }
        setEdit(row.id, month, newValue);
    };

    const handleKpiChange = (row: any, monthIdx: number, month: number, typedKpiValue: number) => {
        const monthRows = monthRowSets[monthIdx];
        const calc = row.category === 'Package' ? packageKpiConfigs[row.label.trim()] : row.rowConfig?.kpiCalculation;
        const precomputedKpi = row.rowConfig?.precomputedKpi;

        if (calc) {
            const selfDenom = parseSelfRatioDenominator(calc.formula, row.label);
            if (!selfDenom) return;
            const denom = resolveKpiTerm(selfDenom, monthRows, 'budget');
            if (!denom) return;
            const rawKpi = calc.format === 'percent' ? typedKpiValue / 100 : typedKpiValue;
            handleValueChange(row, month, rawKpi * denom);
        } else if (precomputedKpi?.denominator) {
            const denom = precomputedKpi.denominator.budget;
            if (!denom) return;
            handleValueChange(row, month, typedKpiValue * denom);
        }
    };

    const handleCalcular = async () => {
        setCalculating(true);
        setPendingEdits({});
        await onCalcularForecast();
        setCalculating(false);
    };

    const handleSave = async () => {
        const edits: { rowId: string; month: number; value: number }[] = [];
        Object.entries(pendingEdits).forEach(([rowId, byMonth]) => {
            Object.entries(byMonth).forEach(([month, value]) => edits.push({ rowId, month: parseInt(month), value }));
        });
        if (edits.length === 0) return;
        setSaving(true);
        await onSaveEdits(edits);
        setPendingEdits({});
        setSaving(false);
    };

    const hasPendingEdits = Object.keys(pendingEdits).length > 0;

    return (
        <div className="p-6 max-w-full mx-auto">
            <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"><ArrowLeft size={18} /></button>
                    <div className="w-9 h-9 rounded-xl bg-[#F8981C]/10 flex items-center justify-center shrink-0">
                        <ClipboardEdit className="text-[#F8981C]" size={16} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">Revisão de Metas — {version.name}</h2>
                        <p className="text-gray-500 text-xs mt-0.5">DRE completa de {version.year}, um mês por coluna.</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={onGoToOccupancy} className="px-3 py-2 rounded-lg text-xs font-bold border border-gray-200 text-gray-600 hover:bg-gray-50">← Editar Ocupação</button>
                    <button onClick={onGoToComparatives} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border border-gray-200 text-gray-600 hover:bg-gray-50">
                        <ArrowLeftRight size={13} /> Comparativos
                    </button>
                    {canEdit && hasPendingEdits && (
                        <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-gray-300">
                            <Save size={14} /> {saving ? 'Salvando...' : 'Salvar alterações'}
                        </button>
                    )}
                    {canEdit && (
                        <button onClick={handleCalcular} disabled={calculating} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-gray-300">
                            <Calculator size={14} /> {calculating ? 'Calculando...' : 'Calcular Forecast'}
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
                {/* Sem min-w-full de propósito: com poucos meses selecionados, a tabela deve ficar
                    do tamanho do conteúdo (encostada à esquerda), não esticada pra preencher o
                    container inteiro — só cresce/ganha scroll horizontal quando o conteúdo pede. */}
                <table className="w-auto text-[11px] border-collapse">
                    <thead>
                        <tr className="border-b border-gray-200">
                            <th rowSpan={2} className="w-[300px] px-2 py-px text-left font-bold text-gray-500 uppercase sticky left-0 bg-white z-10 align-bottom whitespace-nowrap">Indicador</th>
                            {months.map(m => (
                                <th key={m} colSpan={2} className="px-1 py-px text-center font-bold text-gray-500 uppercase border-l border-gray-100 truncate">{MONTH_NAMES[m - 1]}</th>
                            ))}
                        </tr>
                        <tr className="border-b border-gray-200">
                            {months.map(m => (
                                <React.Fragment key={m}>
                                    <th className="w-20 px-1 py-px text-right font-semibold text-gray-400 border-l border-gray-100 truncate">Valor</th>
                                    <th className="w-14 px-1 py-px text-center font-semibold text-amber-600 truncate">KPI</th>
                                </React.Fragment>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {structureRows.map((row, idx) => {
                            if (!isRowVisible(row, idx)) return null;
                            if (row.category === 'Spacer') return <tr key={row.id}><td colSpan={1 + months.length * 2} className="py-1">&nbsp;</td></tr>;

                            // Mesma classificação/paleta de cores da DRE Forecast (ForecastTable.tsx:
                            // isSectionHeader → azul sky-100 se "blueRowIds" (REV-TOTAL, REV-NET,
                            // CST-HEAD, LABOR-TOTAL etc.) ou cinza slate-100 senão; pacote → cinza
                            // gray-50 com chevron; isTotal → indigo-50; REV-IMP → azul sky sempre.
                            const isSectionHeader = row.isHeader && row.indentLevel === 0;
                            const isBlueHighlight = blueRowIds.includes(row.id);
                            const isPackageHeader = row.category === 'Package' && row.isHeader && row.indentLevel === 1;
                            const isRevImp = row.id === 'REV-IMP';
                            const editable = canEdit && isEditableRow(row);
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
                                    {months.map((month, monthIdx) => {
                                        const monthRow = monthRowSets[monthIdx].find(r => r.id === row.id);
                                        if (!monthRow) return <td key={month} colSpan={2} className="border-l border-gray-100">-</td>;
                                        const kpiInfo = getKpiInfoForRow(monthRow, monthRowSets[monthIdx], packageKpiConfigs);
                                        const kpiEditable = editable && isEditableKpiForRow(monthRow, kpiInfo, packageKpiConfigs);
                                        return (
                                            <React.Fragment key={month}>
                                                <td className="px-1 py-px text-right tabular-nums border-l border-gray-100 truncate">
                                                    {editable ? (
                                                        <input
                                                            key={`v-${monthRow.budget}`}
                                                            type="text"
                                                            defaultValue={fmt(monthRow.budget)}
                                                            onBlur={e => {
                                                                const parsed = parseFloat(e.target.value.replace(/\./g, '').replace(',', '.'));
                                                                if (!isNaN(parsed) && parsed !== monthRow.budget) handleValueChange(row, month, parsed);
                                                            }}
                                                            className="w-full text-right bg-transparent border border-transparent hover:bg-gray-50 focus:bg-white focus:border-indigo-300 rounded px-0.5 outline-none"
                                                        />
                                                    ) : fmt(monthRow.budget)}
                                                </td>
                                                <td className="px-1 py-px text-center text-amber-700 truncate">
                                                    {!kpiInfo.hasKpi ? '' : kpiEditable ? (
                                                        <input
                                                            key={`k-${kpiInfo.kpiValue('budget')}`}
                                                            type="text"
                                                            defaultValue={fmtKpi(kpiInfo.kpiValue('budget'), kpiInfo.kpiFormatType)}
                                                            onBlur={e => {
                                                                const parsed = parseFloat(e.target.value.replace(/\./g, '').replace(',', '.'));
                                                                if (!isNaN(parsed)) handleKpiChange(row, monthIdx, month, parsed);
                                                            }}
                                                            className="w-full text-center bg-amber-50/40 border border-transparent hover:bg-white focus:bg-white focus:border-indigo-300 rounded px-0.5 outline-none"
                                                        />
                                                    ) : fmtKpi(kpiInfo.kpiValue('budget'), kpiInfo.kpiFormatType)}
                                                </td>
                                            </React.Fragment>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <p className="text-xs text-gray-400 mt-3">
                "Calcular Forecast" recalcula todas as linhas com KPI usando a taxa da mesma versão de antes da revisão começar (a "meta antiga" desta sessão),
                aplicada sobre o driver de cada mês já revisado — mesmo mecanismo de KPI da DRE Forecast normal.
            </p>
        </div>
    );
};

export default BudgetReviewDRE;
