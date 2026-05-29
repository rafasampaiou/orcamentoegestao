import React, { useMemo, useState, useEffect } from 'react';
import { Save, CheckCircle } from 'lucide-react';
import { User, UserRole } from '../types';
import { BudgetRow, BudgetOccupancyTable, geralRows, lazerRows, eventRows } from './OccupancyView';

interface OccupancyMonthlyRealViewProps {
    selectedYear: number;
    selectedHotel: string;
    realOccupancyData: Record<string, Record<string, number>>;
    setRealOccupancyData: React.Dispatch<React.SetStateAction<Record<string, Record<string, number>>>>;
    budgetData: Record<string, number[]>;
    currentUser?: User;
    onSaveOccupancy?: () => void;
}

const OccupancyMonthlyRealView: React.FC<OccupancyMonthlyRealViewProps> = ({
    selectedYear,
    selectedHotel,
    realOccupancyData,
    setRealOccupancyData,
    budgetData,
    currentUser,
    onSaveOccupancy
}) => {
    const canEditOccupancy = currentUser?.role === UserRole.ADMIN ||
                            currentUser?.role === UserRole.ENTITY_MANAGER ||
                            currentUser?.role === UserRole.COST_ANALYST;

    const [decimalOverrides, setDecimalOverrides] = useState<Record<string, number>>({});
    const [savedIndicator, setSavedIndicator] = useState(false);

    const toggleDecimals = (rowId: string) => {
        setDecimalOverrides(prev => {
            const current = prev[rowId] ?? -1;
            const allRows = [...geralRows, ...lazerRows, ...eventRows];
            const found = allRows.find(r => r.id === rowId);
            const standard = found?.format === 'integer' ? 0 : 2;

            let next;
            if (current === -1) {
                next = (standard + 1) % 5;
            } else {
                next = (current + 1) % 5;
            }
            return { ...prev, [rowId]: next };
        });
    };

    const handleManualSave = () => {
        if (onSaveOccupancy) {
            onSaveOccupancy();
        }
        setSavedIndicator(true);
        setTimeout(() => setSavedIndicator(false), 2500);
    };

    // Replicate the pure calculation logic
    const recalculateRealForMonth = (currentData: Record<string, number>, monthIdx: number) => {
        const newData = { ...currentData };
        const get = (key: string) => newData[key] || 0;
        const set = (key: string, val: number) => { newData[key] = val; };

        // For Monthly View, we update both forecast and previa if they edit it manually
        const suffixes = ['forecast', 'previa'];

        suffixes.forEach(s => {
            set(`days_month_${s}`, budgetData['days_month']?.[monthIdx] || 0);
            set(`geral_capacity_${s}`, budgetData['geral_capacity']?.[monthIdx] || 0);
            set(`geral_avail_${s}`, budgetData['geral_avail']?.[monthIdx] || 0);

            set(`lazer_capacity_${s}`, budgetData['lazer_capacity']?.[monthIdx] || 0);
            set(`lazer_avail_${s}`, budgetData['lazer_avail']?.[monthIdx] || 0);

            set(`event_capacity_${s}`, budgetData['event_capacity']?.[monthIdx] || 0);
            set(`event_avail_${s}`, budgetData['event_avail']?.[monthIdx] || 0);

            const lzSold = get(`lazer_sold_${s}`);
            const lzAvail = get(`lazer_avail_${s}`);
            const lzAd = get(`lazer_adults_${s}`);
            const lzChd = get(`lazer_chd_${s}`);
            const lzDmFap = get(`lazer_dm_fap_${s}`);

            const lzPax = lzAd + lzChd;
            const lzRevFap = lzDmFap * lzSold;

            set(`lazer_pax_${s}`, lzPax);
            set(`lazer_occ_pct_${s}`, lzAvail > 0 ? (lzSold / lzAvail) * 100 : 0);
            set(`lazer_coef_total_${s}`, lzSold > 0 ? lzPax / lzSold : 0);
            set(`lazer_coef_ad_${s}`, lzSold > 0 ? lzAd / lzSold : 0);
            set(`lazer_coef_chd_${s}`, lzSold > 0 ? lzChd / lzSold : 0);
            set(`lazer_rev_fap_${s}`, lzRevFap);
            set(`lazer_revpar_${s}`, lzAvail > 0 ? lzRevFap / lzAvail : 0);

            const evSold = get(`event_sold_${s}`);
            const evAvail = get(`event_avail_${s}`);
            const evAd = get(`event_adults_${s}`);
            const evChd = get(`event_chd_${s}`);
            const evDmFap = get(`event_dm_fap_${s}`);

            const evPax = evAd + evChd;
            const evRevFap = evDmFap * evSold;
            const evExtra = get(`event_extra_rev_${s}`);

            set(`event_pax_${s}`, evPax);
            set(`event_occ_pct_${s}`, evAvail > 0 ? (evSold / evAvail) * 100 : 0);
            set(`event_coef_total_${s}`, evSold > 0 ? evPax / evSold : 0);
            set(`event_coef_ad_${s}`, evSold > 0 ? evAd / evSold : 0);
            set(`event_coef_chd_${s}`, evSold > 0 ? evChd / evSold : 0);
            set(`event_rev_fap_${s}`, evRevFap);
            set(`event_revpar_${s}`, evAvail > 0 ? evRevFap / evAvail : 0);

            const lzExtra = get(`lazer_extra_rev_${s}`);
            const gExtra = lzExtra + evExtra;

            const gSold = lzSold + evSold;
            const gAd = lzAd + evAd;
            const gChd = lzChd + evChd;
            const gPax = gAd + gChd;
            const gRevFap = lzRevFap + evRevFap;
            const gAvail = get(`geral_avail_${s}`);

            set(`geral_sold_${s}`, gSold);
            set(`geral_occ_pct_${s}`, gAvail > 0 ? (gSold / gAvail) * 100 : 0);
            set(`geral_pax_${s}`, gPax);
            set(`geral_coef_total_${s}`, gSold > 0 ? gPax / gSold : 0);
            set(`geral_adults_${s}`, gAd);
            set(`geral_coef_ad_${s}`, gSold > 0 ? gAd / gSold : 0);
            set(`geral_chd_${s}`, gChd);
            set(`geral_coef_chd_${s}`, gSold > 0 ? gChd / gSold : 0);
            set(`geral_rev_fap_${s}`, gRevFap);
            set(`geral_dm_fap_${s}`, gSold > 0 ? gRevFap / gSold : 0);
            set(`geral_revpar_${s}`, gAvail > 0 ? gRevFap / gAvail : 0);
            set(`geral_extra_rev_${s}`, gExtra);
        });

        return newData;
    };

    // Transform realOccupancyData into a 12-month array format for BudgetOccupancyTable
    const tableData: Record<string, number[]> = useMemo(() => {
        const result: Record<string, number[]> = {};
        const allRowIds = [...geralRows, ...lazerRows, ...eventRows].map(r => r.id);
        
        allRowIds.forEach(id => {
            result[id] = Array(12).fill(0);
        });
        
        for (let i = 0; i < 12; i++) {
            const contextKey = `${selectedHotel}_${selectedYear}_${i + 1}`;
            const monthData = realOccupancyData?.[contextKey] || {};
            
            allRowIds.forEach(id => {
                // By default, we show 'forecast'
                const val = monthData[`${id}_forecast`];
                if (val !== undefined) {
                    result[id][i] = val;
                } else if (budgetData && budgetData[id] && budgetData[id][i] !== undefined) {
                    // Fallback to budget data for base values like capacity, if available
                    result[id][i] = budgetData[id][i];
                }
            });
        }
        return result;
    }, [realOccupancyData, selectedHotel, selectedYear, budgetData]);

    const handleUpdate = (rowId: string, monthIndex: number, value: number) => {
        if (!setRealOccupancyData) return;

        const month = monthIndex + 1;
        const contextKey = `${selectedHotel}_${selectedYear}_${month}`;

        setRealOccupancyData(prev => {
            const contextData = prev[contextKey] || {};
            // Update both forecast and previa since this is a manual entry
            const newData = { 
                ...contextData, 
                [`${rowId}_forecast`]: value,
                [`${rowId}_previa`]: value 
            };
            const recalculated = recalculateRealForMonth(newData, monthIndex);
            
            return {
                ...prev,
                [contextKey]: recalculated
            };
        });
    };

    return (
        <div className="p-8 max-w-[1600px] mx-auto">
            <div className="mb-6 flex items-start justify-between">
                <div>
                    <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-bold text-gray-900">Ocupação Mensal</h2>
                        <span className="bg-indigo-50 border border-indigo-200 text-indigo-700 text-sm rounded-lg py-1 px-3 font-bold">
                            Fechamento oficial
                        </span>
                    </div>
                    <p className="text-gray-500 mt-1">Visão anual de ocupação do realizado e forecast. As alterações aqui refletem na aba Comparativo e no DRE.</p>
                </div>
                {canEditOccupancy && (
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleManualSave}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all shadow-sm border ${savedIndicator
                                ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                                : 'bg-indigo-600 text-white border-indigo-700 hover:bg-indigo-700'
                                }`}
                        >
                            {savedIndicator ? <CheckCircle size={16} /> : <Save size={16} />}
                            {savedIndicator ? 'Salvo!' : 'Salvar Ocupação'}
                        </button>
                    </div>
                )}
            </div>

            <BudgetOccupancyTable 
                title="Geral" 
                rows={geralRows} 
                data={tableData} 
                onUpdate={handleUpdate} 
                decimalOverrides={decimalOverrides} 
                onToggleDecimals={toggleDecimals} 
                canEdit={canEditOccupancy} 
            />
            <BudgetOccupancyTable 
                title="Lazer" 
                rows={lazerRows} 
                data={tableData} 
                onUpdate={handleUpdate} 
                decimalOverrides={decimalOverrides} 
                onToggleDecimals={toggleDecimals} 
                canEdit={canEditOccupancy} 
            />
            <BudgetOccupancyTable 
                title="Eventos" 
                rows={eventRows} 
                data={tableData} 
                onUpdate={handleUpdate} 
                decimalOverrides={decimalOverrides} 
                onToggleDecimals={toggleDecimals} 
                canEdit={canEditOccupancy} 
            />
        </div>
    );
};

export default OccupancyMonthlyRealView;
