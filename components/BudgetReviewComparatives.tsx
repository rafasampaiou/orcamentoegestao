import React, { useMemo, useState } from 'react';
import { ArrowLeft, ArrowLeftRight } from 'lucide-react';
import { Account, BudgetVersion, Hotel, ImportedRow } from '../types';
import { computeMonthlyRevenueSummary } from '../utils/budgetReviewDre';

interface BudgetReviewComparativesProps {
    hotels: Hotel[];
    budgetVersions: BudgetVersion[];
    accounts: Account[];
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

interface Totals { receita: number; imposto: number; despesa: number; gopRs: number; gopPct: number; }

const packageValueForMonth = (financialData: ImportedRow[], accounts: Account[], hotel: string, year: number, month: number, versionId: string, cenario: string): number => {
    const accountNames = new Set(accounts.filter(a => !a.outOfScope).flatMap(a => [a.name, a.code]));
    return financialData
        .filter(r => (r.cenario || '').trim().toLowerCase() === cenario.toLowerCase() && r.hotel === hotel && r.versionId === versionId && parseInt(r.ano) === year && parseInt(r.mes) === month && accountNames.has(r.conta))
        .reduce((s, r) => s + (parseFloat(r.valor) || 0), 0);
};

// Etapa 5 (bis) da Revisão de Metas — "Comparativos": Meta antiga × Meta atual (qualquer par de
// versões de Budget do hotel, não precisa ser a que replicou desta sessão), e opcionalmente
// combinado com o Realizado (mês já realizado usa Realizado; mês futuro cai pra Meta
// antiga/atual respectivamente) pra ver como o período fecharia com cada uma.
const BudgetReviewComparatives: React.FC<BudgetReviewComparativesProps> = ({
    hotels, budgetVersions, accounts, financialData, budgetOccupancyDataMap, realOccupancyData,
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
    const [months, setMonths] = useState<number[]>(initialMonths);
    const [showRealCombo, setShowRealCombo] = useState(false);

    const oldVersion = versionsForHotel.find(v => v.id === oldVersionId);
    const newVersion = versionsForHotel.find(v => v.id === newVersionId);

    const computeMetaTotals = (versionId: string): Totals => {
        const occupancy = budgetOccupancyDataMap[versionId] || {};
        let receita = 0, imposto = 0, despesa = 0;
        months.forEach(m => {
            const rev = computeMonthlyRevenueSummary(occupancy, m - 1);
            receita += rev.receitaLiquida;
            imposto += rev.impostos;
            despesa += packageValueForMonth(financialData, accounts, hotelName, oldVersion?.year || newVersion?.year || 0, m, versionId, 'Meta');
        });
        const gopRs = receita - despesa;
        return { receita, imposto, despesa, gopRs, gopPct: receita !== 0 ? (gopRs / receita) * 100 : 0 };
    };

    const computeRealTotalsForMonth = (year: number, month: number) => {
        const contextKey = `${hotelName}_${year}_${month}_${activeRealVersionId || ''}`;
        const occ = realOccupancyData[contextKey] || {};
        // Mesmas fórmulas de computeMonthlyRevenueSummary, só que sobre o bucket _forecast do Realizado.
        const val = (id: string) => occ[`${id}_forecast`] || 0;
        const receitaApt = val('lazer_rev_fap') + val('event_rev_fap') + val('geral_or_hosp');
        const receitaExtra = val('lazer_extra_rev') + val('event_extra_rev') + val('geral_or_extras');
        const receita = receitaApt + receitaExtra + val('geral_cancel_ts') + val('geral_iss_rev') - val('geral_impostos');
        const imposto = val('geral_impostos');
        const despesa = packageValueForMonth(financialData, accounts, hotelName, year, month, activeRealVersionId || '', 'Real');
        return { receita, imposto, despesa, hasData: receita !== 0 || despesa !== 0 };
    };

    const computeComboTotals = (metaVersionId: string): Totals => {
        const occupancy = budgetOccupancyDataMap[metaVersionId] || {};
        const version = versionsForHotel.find(v => v.id === metaVersionId);
        let receita = 0, imposto = 0, despesa = 0;
        months.forEach(m => {
            const real = computeRealTotalsForMonth(version?.year || 0, m);
            if (real.hasData) {
                receita += real.receita; imposto += real.imposto; despesa += real.despesa;
            } else {
                const rev = computeMonthlyRevenueSummary(occupancy, m - 1);
                receita += rev.receitaLiquida; imposto += rev.impostos;
                despesa += packageValueForMonth(financialData, accounts, hotelName, version?.year || 0, m, metaVersionId, 'Meta');
            }
        });
        const gopRs = receita - despesa;
        return { receita, imposto, despesa, gopRs, gopPct: receita !== 0 ? (gopRs / receita) * 100 : 0 };
    };

    const oldTotals = useMemo(() => oldVersionId ? computeMetaTotals(oldVersionId) : null, [oldVersionId, months, financialData, budgetOccupancyDataMap]);
    const newTotals = useMemo(() => newVersionId ? computeMetaTotals(newVersionId) : null, [newVersionId, months, financialData, budgetOccupancyDataMap]);
    const comboOld = useMemo(() => showRealCombo && oldVersionId ? computeComboTotals(oldVersionId) : null, [showRealCombo, oldVersionId, months, financialData, budgetOccupancyDataMap, realOccupancyData]);
    const comboNew = useMemo(() => showRealCombo && newVersionId ? computeComboTotals(newVersionId) : null, [showRealCombo, newVersionId, months, financialData, budgetOccupancyDataMap, realOccupancyData]);

    const toggleMonth = (m: number) => setMonths(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m].sort((a, b) => a - b));

    const rows: { label: string; key: keyof Totals; isPct?: boolean }[] = [
        { label: 'Receita', key: 'receita' },
        { label: 'Imposto', key: 'imposto' },
        { label: 'Despesa', key: 'despesa' },
        { label: 'GOP R$', key: 'gopRs' },
        { label: 'GOP %', key: 'gopPct', isPct: true },
    ];

    return (
        <div className="p-8 max-w-[1400px] mx-auto">
            <div className="mb-6 flex items-center gap-3">
                <button onClick={onBack} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"><ArrowLeft size={18} /></button>
                <div className="w-9 h-9 rounded-xl bg-[#F8981C]/10 flex items-center justify-center shrink-0">
                    <ArrowLeftRight className="text-[#F8981C]" size={16} />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Comparativos — {hotelName}</h2>
                    <p className="text-gray-500 text-sm mt-0.5">Meta antiga × Meta atual, com a opção de combinar com o Realizado.</p>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">Meta antiga</label>
                        <select value={oldVersionId} onChange={e => setOldVersionId(e.target.value)} className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm">
                            <option value="">Selecione...</option>
                            {versionsForHotel.map(v => <option key={v.id} value={v.id}>{v.name} ({v.year})</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase">Meta atual</label>
                        <select value={newVersionId} onChange={e => setNewVersionId(e.target.value)} className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm">
                            <option value="">Selecione...</option>
                            {versionsForHotel.map(v => <option key={v.id} value={v.id}>{v.name} ({v.year})</option>)}
                        </select>
                    </div>
                </div>

                <label className="text-xs font-bold text-gray-500 uppercase">Meses</label>
                <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5 mt-1 mb-3">
                    {MONTH_NAMES.map((label, idx) => (
                        <button key={idx} onClick={() => toggleMonth(idx + 1)}
                            className={`py-1.5 rounded-md text-[11px] font-bold border ${months.includes(idx + 1) ? 'bg-[#F8981C] text-white border-[#F8981C]' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                            {label}
                        </button>
                    ))}
                </div>

                <label className="flex items-center gap-2 text-sm text-gray-600">
                    <input type="checkbox" checked={showRealCombo} onChange={e => setShowRealCombo(e.target.checked)} />
                    Ver também "Realizado + Meta antiga" × "Realizado + Meta atual" (como o período fecharia)
                </label>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
                <table className="min-w-full">
                    <thead>
                        <tr className="border-b border-gray-200">
                            <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase">Indicador</th>
                            <th className="px-3 py-2 text-right text-xs font-bold text-gray-500 uppercase">Meta antiga</th>
                            <th className="px-3 py-2 text-right text-xs font-bold text-gray-500 uppercase">Meta atual</th>
                            <th className="px-3 py-2 text-right text-xs font-bold text-gray-500 uppercase">Δ</th>
                            {showRealCombo && <th className="px-3 py-2 text-right text-xs font-bold text-indigo-500 uppercase border-l border-gray-200">Realizado + Meta antiga</th>}
                            {showRealCombo && <th className="px-3 py-2 text-right text-xs font-bold text-indigo-500 uppercase">Realizado + Meta atual</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {rows.map(r => {
                            const oldV = oldTotals?.[r.key] || 0;
                            const newV = newTotals?.[r.key] || 0;
                            const delta = newV - oldV;
                            const format = r.isPct ? fmtPct : fmt;
                            return (
                                <tr key={r.key} className={r.key === 'gopRs' || r.key === 'gopPct' ? 'bg-gray-50 font-bold' : ''}>
                                    <td className="px-3 py-2 text-sm text-gray-800">{r.label}</td>
                                    <td className="px-3 py-2 text-sm text-right tabular-nums">{format(oldV)}</td>
                                    <td className="px-3 py-2 text-sm text-right tabular-nums">{format(newV)}</td>
                                    <td className={`px-3 py-2 text-sm text-right tabular-nums ${delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-red-500' : ''}`}>{delta >= 0 ? '+' : ''}{format(delta)}</td>
                                    {showRealCombo && <td className="px-3 py-2 text-sm text-right tabular-nums border-l border-gray-200">{format(comboOld?.[r.key] || 0)}</td>}
                                    {showRealCombo && <td className="px-3 py-2 text-sm text-right tabular-nums">{format(comboNew?.[r.key] || 0)}</td>}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default BudgetReviewComparatives;
