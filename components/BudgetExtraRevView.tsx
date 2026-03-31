import React, { useState } from 'react';

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

interface BudgetExtraRevViewProps {
    budgetOccupancyData: Record<string, number[]>;
}

interface PDVRow {
    id: string;
    name: string;
    values: number[]; // 12 months (Indicator per PAX)
}

const BudgetExtraRevView: React.FC<BudgetExtraRevViewProps> = ({ budgetOccupancyData }) => {
    const [pdvs, setPdvs] = useState<PDVRow[]>([
        { id: '1', name: 'A&B (Alimentos e Bebidas)', values: Array(12).fill(0) },
        { id: '2', name: 'Spa', values: Array(12).fill(0) },
        { id: '3', name: 'Lojinha', values: Array(12).fill(0) },
        { id: '4', name: 'Estacionamento', values: Array(12).fill(0) },
    ]);

    const paxData = budgetOccupancyData['geral_pax'] || Array(12).fill(0);

    const handleUpdate = (id: string, monthIndex: number, value: number) => {
        setPdvs(prev => prev.map(p => {
            if (p.id === id) {
                const newValues = [...p.values];
                newValues[monthIndex] = value;
                return { ...p, values: newValues };
            }
            return p;
        }));
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    };



    return (
        <div className="p-8 max-w-[1600px] mx-auto space-y-8">
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Orçamento de Receitas Extras</h2>
                <p className="text-gray-500 mt-1">Definição de indicadores por PAX e cálculo de receita total.</p>
            </div>

            {/* TABLE 1: INDICATOR PER PAX */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-bold text-gray-800">Indicador de Receita Extra por PAX</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
                            <tr>
                                <th className="px-4 py-3 w-64 sticky left-0 bg-gray-50 z-10 border-r border-gray-200">PDV / Centro de Custo</th>
                                {MONTHS.map(m => (
                                    <th key={m} className="px-2 py-3 text-center min-w-[100px] border-r border-gray-100">{m}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {pdvs.map((pdv) => (
                                <tr key={pdv.id} className="hover:bg-gray-50 transition-colors group">
                                    <td className="px-4 py-2 sticky left-0 bg-white group-hover:bg-gray-50 z-10 border-r border-gray-200 font-medium text-gray-700">
                                        {pdv.name}
                                    </td>
                                    {pdv.values.map((val, idx) => (
                                        <td key={idx} className="px-1 py-1 border-r border-gray-100 text-center">
                                            <input
                                                type="number"
                                                className="w-full text-center bg-transparent focus:bg-indigo-50 focus:outline-none focus:ring-1 focus:ring-indigo-300 rounded px-1 text-xs"
                                                value={val || ''}
                                                onChange={(e) => handleUpdate(pdv.id, idx, parseFloat(e.target.value) || 0)}
                                                placeholder="0.00"
                                                step="0.01"
                                            />
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* TABLE 2: TOTAL REVENUE (CALCULATED) */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-gray-800">Receita Total Extra (Calculada)</h3>
                    <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded">Baseado em PAX do Orçamento de Ocupação</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
                            <tr>
                                <th className="px-4 py-3 w-64 sticky left-0 bg-gray-50 z-10 border-r border-gray-200">PDV / Centro de Custo</th>
                                {MONTHS.map(m => (
                                    <th key={m} className="px-2 py-3 text-center min-w-[100px] border-r border-gray-100">{m}</th>
                                ))}
                                <th className="px-4 py-3 text-center min-w-[120px] bg-gray-100 font-bold text-gray-800">Total Anual</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {pdvs.map((pdv) => {
                                const totalRow = pdv.values.reduce((acc, val, idx) => acc + (val * (paxData[idx] || 0)), 0);
                                return (
                                    <tr key={pdv.id} className="hover:bg-gray-50 transition-colors group bg-gray-50/30">
                                        <td className="px-4 py-2 sticky left-0 bg-gray-50 group-hover:bg-gray-100 z-10 border-r border-gray-200 font-medium text-gray-700">
                                            {pdv.name}
                                        </td>
                                        {pdv.values.map((val, idx) => {
                                            const totalRev = val * (paxData[idx] || 0);
                                            return (
                                                <td key={idx} className="px-1 py-2 border-r border-gray-100 text-center text-gray-600">
                                                    {formatCurrency(totalRev)}
                                                </td>
                                            );
                                        })}
                                        <td className="px-4 py-2 text-center bg-gray-100 font-bold text-gray-800 border-l border-gray-200">
                                            {formatCurrency(totalRow)}
                                        </td>
                                    </tr>
                                );
                            })}
                             {/* GRAND TOTAL ROW */}
                             <tr className="bg-indigo-50 font-bold border-t-2 border-indigo-100">
                                <td className="px-4 py-3 sticky left-0 bg-indigo-50 z-10 border-r border-indigo-200 text-indigo-900">
                                    TOTAL GERAL
                                </td>
                                {MONTHS.map((_, idx) => {
                                    const monthlyTotal = pdvs.reduce((acc, pdv) => acc + (pdv.values[idx] * (paxData[idx] || 0)), 0);
                                    return (
                                        <td key={idx} className="px-1 py-3 text-center text-indigo-900 border-r border-indigo-200">
                                            {formatCurrency(monthlyTotal)}
                                        </td>
                                    );
                                })}
                                <td className="px-4 py-3 text-center bg-indigo-100 text-indigo-900 border-l border-indigo-200">
                                    {formatCurrency(pdvs.reduce((acc, pdv) => acc + pdv.values.reduce((sum, val, idx) => sum + (val * (paxData[idx] || 0)), 0), 0))}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default BudgetExtraRevView;
