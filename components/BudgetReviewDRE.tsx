import React, { useMemo, useState } from 'react';
import { ArrowLeft, Calculator, ClipboardEdit, ArrowLeftRight } from 'lucide-react';
import { Account, BudgetVersion, CostPackage, ImportedRow, PermissionMatrix, User, hasPermission } from '../types';
import { computeMonthlyRevenueSummary, sumPackageValueForMonth } from '../utils/budgetReviewDre';

interface BudgetReviewDREProps {
    version: BudgetVersion;
    reviewMonths: number[]; // 1-indexed
    accounts: Account[];
    packages: CostPackage[];
    financialData: ImportedRow[];
    budgetOccupancyDataMap: Record<string, Record<string, number[]>>;
    currentUser?: User;
    permissionsMatrix: PermissionMatrix;
    onBack: () => void;
    onGoToOccupancy: () => void;
    onGoToComparatives: () => void;
    onCalcularForecast: () => Promise<void>;
}

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v || 0);
const fmtPct = (v: number) => `${(v || 0).toFixed(1)}%`;

// Etapa 4/5 da Revisão de Metas: DRE macro (Receita/Impostos direto da Ocupação, Despesas por
// pacote a partir do Plano de Contas) com um mês por coluna + Total, e o botão "Calcular
// Forecast" que projeta as despesas dos meses selecionados (ver utils/budgetReviewDre.ts).
const BudgetReviewDRE: React.FC<BudgetReviewDREProps> = ({
    version, reviewMonths, accounts, packages, financialData, budgetOccupancyDataMap,
    currentUser, permissionsMatrix, onBack, onGoToOccupancy, onGoToComparatives, onCalcularForecast
}) => {
    const [calculating, setCalculating] = useState(false);
    const canEdit = hasPermission(permissionsMatrix, currentUser, 'Revisão de Metas', 'Criar Réplica / Editar Meta em Revisão') && !version.isLocked;
    const hotel = version.hotel || version.hotelId || '';
    const months = [...reviewMonths].sort((a, b) => a - b);
    const occupancyData = budgetOccupancyDataMap[version.id] || {};

    const packageNames = useMemo(() => Array.from(new Set(accounts.filter(a => a.package && !a.outOfScope).map(a => a.package as string))), [accounts]);

    const perMonth = useMemo(() => months.map(month => {
        const rev = computeMonthlyRevenueSummary(occupancyData, month - 1);
        const despesasPorPacote = packageNames.map(pkg => ({
            pkg,
            valor: sumPackageValueForMonth(financialData, accounts, pkg, hotel, version.year, month, version.id)
        }));
        const totalDespesas = despesasPorPacote.reduce((s, d) => s + d.valor, 0);
        const gopRs = rev.receitaLiquida - totalDespesas;
        const gopPct = rev.receitaLiquida !== 0 ? (gopRs / rev.receitaLiquida) * 100 : 0;
        return { month, rev, despesasPorPacote, totalDespesas, gopRs, gopPct };
    }), [months, occupancyData, packageNames, financialData, accounts, hotel, version.year, version.id]);

    const totalRev = perMonth.reduce((acc, m) => ({
        receitaApt: acc.receitaApt + m.rev.receitaApt,
        receitaExtra: acc.receitaExtra + m.rev.receitaExtra,
        timeShare: acc.timeShare + m.rev.timeShare,
        receitaIss: acc.receitaIss + m.rev.receitaIss,
        receitaBrutaTotal: acc.receitaBrutaTotal + m.rev.receitaBrutaTotal,
        impostos: acc.impostos + m.rev.impostos,
        receitaLiquida: acc.receitaLiquida + m.rev.receitaLiquida,
    }), { receitaApt: 0, receitaExtra: 0, timeShare: 0, receitaIss: 0, receitaBrutaTotal: 0, impostos: 0, receitaLiquida: 0 });
    const totalDespesasPorPacote = packageNames.map(pkg => ({ pkg, valor: perMonth.reduce((s, m) => s + (m.despesasPorPacote.find(d => d.pkg === pkg)?.valor || 0), 0) }));
    const totalDespesas = totalDespesasPorPacote.reduce((s, d) => s + d.valor, 0);
    const totalGopRs = totalRev.receitaLiquida - totalDespesas;
    const totalGopPct = totalRev.receitaLiquida !== 0 ? (totalGopRs / totalRev.receitaLiquida) * 100 : 0;

    const handleCalcular = async () => {
        setCalculating(true);
        await onCalcularForecast();
        setCalculating(false);
    };

    const Row: React.FC<{ label: string; values: number[]; total: number; bold?: boolean; isPct?: boolean; indent?: boolean }> = ({ label, values, total, bold, isPct, indent }) => (
        <tr className={bold ? 'bg-gray-50 font-bold' : ''}>
            <td className={`px-3 py-1.5 text-sm sticky left-0 bg-inherit ${indent ? 'pl-6 text-gray-600' : 'text-gray-800'} ${bold ? '' : ''}`} style={{ backgroundColor: bold ? '#f9fafb' : 'white' }}>{label}</td>
            {values.map((v, i) => (
                <td key={i} className="px-3 py-1.5 text-sm text-right tabular-nums text-gray-700">{isPct ? fmtPct(v) : fmt(v)}</td>
            ))}
            <td className="px-3 py-1.5 text-sm text-right tabular-nums font-bold border-l border-gray-200">{isPct ? fmtPct(total) : fmt(total)}</td>
        </tr>
    );

    return (
        <div className="p-8 max-w-[1600px] mx-auto">
            <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"><ArrowLeft size={18} /></button>
                    <div className="w-9 h-9 rounded-xl bg-[#F8981C]/10 flex items-center justify-center shrink-0">
                        <ClipboardEdit className="text-[#F8981C]" size={16} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Revisão de Metas — {version.name}</h2>
                        <p className="text-gray-500 text-sm mt-0.5">DRE macro de {version.year} — Ocupação, receitas, impostos e despesas por pacote.</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={onGoToOccupancy} className="px-3 py-2 rounded-lg text-xs font-bold border border-gray-200 text-gray-600 hover:bg-gray-50">
                        ← Editar Ocupação
                    </button>
                    <button onClick={onGoToComparatives} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border border-gray-200 text-gray-600 hover:bg-gray-50">
                        <ArrowLeftRight size={13} /> Comparativos
                    </button>
                    {canEdit && (
                        <button
                            onClick={handleCalcular}
                            disabled={calculating}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-gray-300 transition-colors"
                        >
                            <Calculator size={15} /> {calculating ? 'Calculando...' : 'Calcular Forecast'}
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
                <table className="min-w-full">
                    <thead>
                        <tr className="border-b border-gray-200">
                            <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase sticky left-0 bg-white">Indicador</th>
                            {months.map(m => <th key={m} className="px-3 py-2 text-right text-xs font-bold text-gray-500 uppercase">{MONTH_NAMES[m - 1]}</th>)}
                            <th className="px-3 py-2 text-right text-xs font-bold text-gray-700 uppercase border-l border-gray-200">Total</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        <Row label="Receita de Apartamentos" values={perMonth.map(m => m.rev.receitaApt)} total={totalRev.receitaApt} />
                        <Row label="Receita Extra" values={perMonth.map(m => m.rev.receitaExtra)} total={totalRev.receitaExtra} />
                        <Row label="Cancelamento de Time Share" values={perMonth.map(m => m.rev.timeShare)} total={totalRev.timeShare} />
                        <Row label="Receita de ISS" values={perMonth.map(m => m.rev.receitaIss)} total={totalRev.receitaIss} />
                        <Row label="Receita Bruta Total" values={perMonth.map(m => m.rev.receitaBrutaTotal)} total={totalRev.receitaBrutaTotal} bold />
                        <Row label="Impostos" values={perMonth.map(m => m.rev.impostos)} total={totalRev.impostos} />
                        <Row label="Receita Líquida" values={perMonth.map(m => m.rev.receitaLiquida)} total={totalRev.receitaLiquida} bold />
                        {packageNames.map(pkg => (
                            <Row key={pkg} label={pkg} indent
                                values={perMonth.map(m => m.despesasPorPacote.find(d => d.pkg === pkg)?.valor || 0)}
                                total={totalDespesasPorPacote.find(d => d.pkg === pkg)?.valor || 0} />
                        ))}
                        <Row label="Total de Despesas" values={perMonth.map(m => m.totalDespesas)} total={totalDespesas} bold />
                        <Row label="GOP R$" values={perMonth.map(m => m.gopRs)} total={totalGopRs} bold />
                        <Row label="GOP %" values={perMonth.map(m => m.gopPct)} total={totalGopPct} bold isPct />
                    </tbody>
                </table>
            </div>

            <p className="text-xs text-gray-400 mt-3">
                Receita, Impostos e Ocupação vêm do que foi preenchido em "Editar Ocupação". Despesas são a soma por pacote,
                a partir do Plano de Contas — "Calcular Forecast" projeta cada conta usando o mesmo tipo/driver configurado lá,
                aplicado sobre a ocupação revisada de cada mês (contas com driver de mão de obra/GMD são mantidas fixas aqui).
            </p>
        </div>
    );
};

export default BudgetReviewDRE;
