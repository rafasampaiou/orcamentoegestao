import React, { useState } from 'react';
import { ArrowLeft, ClipboardEdit } from 'lucide-react';
import { BudgetVersion, User, PermissionMatrix, hasPermission } from '../types';
import { BudgetOccupancyTable, geralRows, lazerRows, eventRows } from './OccupancyView';
import { recalculateBudgetOccupancy } from '../utils/occupancyProjection';

interface BudgetReviewOccupancyProps {
    version: BudgetVersion;
    reviewMonths: number[]; // 1-indexed (1 = Janeiro)
    budgetOccupancyDataMap: Record<string, Record<string, number[]>>;
    setBudgetOccupancyDataMap: React.Dispatch<React.SetStateAction<Record<string, Record<string, number[]>>>>;
    currentUser?: User;
    permissionsMatrix: PermissionMatrix;
    onBack: () => void;
}

// Etapa 3 da Revisão de Metas: tela igual à Ocupação (Geral/Lazer/Eventos), só que gravando na
// BudgetVersion escolhida no wizard (BudgetReviewHome) em vez da versão "principal" ativa do
// hotel — reaproveita a mesma grade (BudgetOccupancyTable) e o mesmo motor de cálculo
// (recalculateBudgetOccupancy) da tela de Ocupação, só aponta pra outro versionId.
const BudgetReviewOccupancy: React.FC<BudgetReviewOccupancyProps> = ({
    version, reviewMonths, budgetOccupancyDataMap, setBudgetOccupancyDataMap, currentUser, permissionsMatrix, onBack
}) => {
    const [decimalOverrides, setDecimalOverrides] = useState<Record<string, number>>({});

    const canEdit = hasPermission(permissionsMatrix, currentUser, 'Revisão de Metas', 'Criar Réplica / Editar Meta em Revisão') && !version.isLocked;
    const data = budgetOccupancyDataMap[version.id] || {};
    const visibleMonths = reviewMonths.map(m => m - 1);

    const handleUpdate = (rowId: string, monthIndex: number, value: number) => {
        setBudgetOccupancyDataMap(prev => {
            const current = prev[version.id] || {};
            const newRowData = [...(current[rowId] || Array(12).fill(0))];
            newRowData[monthIndex] = value;
            const newData = recalculateBudgetOccupancy({ ...current, [rowId]: newRowData }, version.year);
            return { ...prev, [version.id]: newData };
        });
    };

    const toggleDecimals = (rowId: string) => {
        setDecimalOverrides(prev => {
            const current = prev[rowId] ?? -1;
            const allRows = [...geralRows, ...lazerRows, ...eventRows];
            const found = allRows.find(r => r.id === rowId);
            const standard = found?.format === 'integer' ? 0 : 2;
            const next = current === -1 ? (standard + 1) % 5 : (current + 1) % 5;
            return { ...prev, [rowId]: next };
        });
    };

    return (
        <div className="p-8 max-w-[1600px] mx-auto">
            <div className="mb-6 flex items-center gap-3">
                <button onClick={onBack} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
                    <ArrowLeft size={18} />
                </button>
                <div className="w-9 h-9 rounded-xl bg-[#F8981C]/10 flex items-center justify-center shrink-0">
                    <ClipboardEdit className="text-[#F8981C]" size={16} />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Revisão de Metas — {version.name}</h2>
                    <p className="text-gray-500 text-sm mt-0.5">
                        {version.year} · Ocupação e receitas (Lazer e Eventos) — só os meses selecionados no início da revisão ficam visíveis abaixo.
                        {version.isLocked && ' Esta versão está bloqueada (somente leitura).'}
                    </p>
                </div>
            </div>

            <div className="space-y-6">
                <BudgetOccupancyTable title="Geral" rows={geralRows} data={data} onUpdate={handleUpdate} decimalOverrides={decimalOverrides} onToggleDecimals={toggleDecimals} canEdit={canEdit} visibleMonths={visibleMonths} />
                <BudgetOccupancyTable title="Lazer" rows={lazerRows} data={data} onUpdate={handleUpdate} decimalOverrides={decimalOverrides} onToggleDecimals={toggleDecimals} canEdit={canEdit} visibleMonths={visibleMonths} />
                <BudgetOccupancyTable title="Eventos" rows={eventRows} data={data} onUpdate={handleUpdate} decimalOverrides={decimalOverrides} onToggleDecimals={toggleDecimals} canEdit={canEdit} visibleMonths={visibleMonths} />
            </div>
        </div>
    );
};

export default BudgetReviewOccupancy;
