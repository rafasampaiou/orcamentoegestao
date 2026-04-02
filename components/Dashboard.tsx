
import React, { useMemo } from 'react';
import { TrendingUp, DollarSign, Users, Activity, Hotel, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { ImportedRow, CostPackage, Account, Hotel as HotelType, ForecastRow } from '../types';
import { getForecastData } from '../services/mockData';

// --- Types & Helpers ---

interface FinancialRow {
  label: string;
  real: number;
  budget: number;
  lastYear: number;
  isPercentage?: boolean;
  isTotal?: boolean; // Highlight style
  isSectionHeader?: boolean;
}

interface EntityData {
  id: string;
  name: string;
  rows: FinancialRow[];
}

interface DashboardProps {
    isMonthClosed?: boolean;
    selectedMonth?: number;
    selectedYear?: number;
    financialData?: ImportedRow[];
    packages: CostPackage[];
    accounts: Account[];
    hotels: HotelType[];
}

const formatCurrency = (val: number) => 
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);

const formatPercent = (val: number) => 
  `${val > 0 ? '+' : ''}${val.toFixed(1)}%`;

const calculateDiff = (current: number, target: number) => {
  if (target === 0) return 0;
  return ((current - target) / target) * 100;
};

// --- Helper: Recalculate Totals (Duplicated logic from ForecastTable to ensure Dashboard aggregation is accurate) ---
const calculateDreSummary = (rows: ForecastRow[], packages: CostPackage[], accounts: Account[]) => {
      // Create Map
      const rowMap = new Map(rows.map(r => [r.id, r]));
      const updatedRows = Array.from(rowMap.values()); // Working copy

      // 1. Update Package Totals
      packages.forEach(pkg => {
          const pkgRow = rowMap.get(pkg.id);
          if (pkgRow) {
             const pkgAccountIds = accounts.filter(a => a.packageId === pkg.id).map(a => a.id);
             const children = updatedRows.filter(r => pkgAccountIds.includes(r.id));
             
             pkgRow.real = children.reduce((s, c) => s + c.real, 0);
             pkgRow.budget = children.reduce((s, c) => s + c.budget, 0);
             pkgRow.lastYear = children.reduce((s, c) => s + c.lastYear, 0);
          }
      });

      // 2. Revenue Totals
      const sumRev = (field: 'real'|'budget'|'lastYear') => {
          const revApt = rowMap.get('REV-APT')?.[field] || 0;
          const revExtra = rowMap.get('REV-EXTRA')?.[field] || 0;
          const revTotal = rowMap.get('REV-TOTAL');
          if (revTotal) revTotal[field] = revApt + revExtra;
          
          const totalVal = revTotal?.[field] || 0;
          const revTime = rowMap.get('REV-TIME')?.[field] || 0;
          const revIss = rowMap.get('REV-ISS')?.[field] || 0;
          const revImp = rowMap.get('REV-IMP')?.[field] || 0;
          
          if(rowMap.get('REV-NET')) rowMap.get('REV-NET')![field] = totalVal - revTime - revIss - revImp;
      };
      
      sumRev('real');
      sumRev('budget');
      sumRev('lastYear');


      // 3. Update Costs Head
      const costHead = rowMap.get('CST-HEAD');
      if (costHead) {
          const pkgRows = packages.map(p => rowMap.get(p.id)).filter(Boolean) as ForecastRow[];
          costHead.real = pkgRows.reduce((sum, p) => sum + p.real, 0);
          costHead.budget = pkgRows.reduce((sum, p) => sum + p.budget, 0);
          costHead.lastYear = pkgRows.reduce((sum, p) => sum + p.lastYear, 0);
      }
      
      // 4. Update GOP
      const revNet = rowMap.get('REV-NET');
      const gopRow = rowMap.get('RES-OP');
      const gopPctRow = rowMap.get('RES-PCT');
      
      if (revNet && costHead && gopRow) {
          gopRow.real = revNet.real - costHead.real;
          gopRow.budget = (revNet.budget || 0) - (costHead.budget || 0);
          gopRow.lastYear = (revNet.lastYear || 0) - (costHead.lastYear || 0);
          
          if (gopPctRow) {
             gopPctRow.real = revNet.real > 0 ? (gopRow.real / revNet.real) * 100 : 0;
             gopPctRow.budget = (revNet.budget || 0) > 0 ? (gopRow.budget / revNet.budget) * 100 : 0;
             gopPctRow.lastYear = (revNet.lastYear || 0) > 0 ? (gopRow.lastYear / revNet.lastYear) * 100 : 0;
          }
      }

      return {
          revenue: rowMap.get('REV-TOTAL'),
          tax: {
              real: (rowMap.get('REV-ISS')?.real || 0) + (rowMap.get('REV-IMP')?.real || 0) + (rowMap.get('REV-TIME')?.real || 0),
              budget: (rowMap.get('REV-ISS')?.budget || 0) + (rowMap.get('REV-IMP')?.budget || 0) + (rowMap.get('REV-TIME')?.budget || 0),
              lastYear: (rowMap.get('REV-ISS')?.lastYear || 0) + (rowMap.get('REV-IMP')?.lastYear || 0) + (rowMap.get('REV-TIME')?.lastYear || 0),
          },
          expenses: rowMap.get('CST-HEAD'),
          gop: rowMap.get('RES-OP'),
          gopPct: rowMap.get('RES-PCT'),
          revpar: rowMap.get('IND-6'),
          // Calculated: GOP without Tax (GOP + Deduções)
          gopNoTax: {
              real: (rowMap.get('RES-OP')?.real || 0) + ((rowMap.get('REV-ISS')?.real || 0) + (rowMap.get('REV-IMP')?.real || 0) + (rowMap.get('REV-TIME')?.real || 0)),
              budget: (rowMap.get('RES-OP')?.budget || 0) + ((rowMap.get('REV-ISS')?.budget || 0) + (rowMap.get('REV-IMP')?.budget || 0) + (rowMap.get('REV-TIME')?.budget || 0)),
              lastYear: (rowMap.get('RES-OP')?.lastYear || 0) + ((rowMap.get('REV-ISS')?.lastYear || 0) + (rowMap.get('REV-IMP')?.lastYear || 0) + (rowMap.get('REV-TIME')?.lastYear || 0)),
          }
      };
};


// --- Components ---

const KPI_Card: React.FC<{ 
  label: string; 
  mainValue: string; 
  subValue?: string;
  trendLabel: string; 
  trendValue?: number; // percentage
  icon: React.ElementType; 
  colorTheme: 'emerald' | 'blue' | 'indigo' | 'orange';
}> = ({ label, mainValue, subValue, trendLabel, trendValue, icon: Icon, colorTheme }) => {
  
  const colors = {
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', iconBg: 'bg-emerald-100', border: 'border-emerald-100' },
    blue: { bg: 'bg-blue-50', text: 'text-blue-700', iconBg: 'bg-blue-100', border: 'border-blue-100' },
    indigo: { bg: 'bg-indigo-50', text: 'text-indigo-700', iconBg: 'bg-indigo-100', border: 'border-indigo-100' },
    orange: { bg: 'bg-orange-50', text: 'text-orange-700', iconBg: 'bg-orange-100', border: 'border-orange-100' },
  };

  const theme = colors[colorTheme];
  const isPositive = trendValue !== undefined ? trendValue >= 0 : true;

  return (
    <div className={`p-6 rounded-xl border shadow-sm bg-white hover:shadow-md transition-all`}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{label}</p>
          <h3 className={`text-2xl font-bold mt-1 text-gray-900`}>{mainValue}</h3>
          {subValue && <p className="text-sm text-gray-400 font-medium mt-0.5">{subValue}</p>}
        </div>
        <div className={`p-3 rounded-lg ${theme.iconBg} ${theme.text}`}>
          <Icon size={24} />
        </div>
      </div>
      
      <div className="flex items-center gap-2 pt-4 border-t border-gray-50">
        {trendValue !== undefined && (
           <span className={`flex items-center text-sm font-bold ${isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
             {isPositive ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
             {Math.abs(trendValue).toFixed(1).replace('.', ',')}%
           </span>
        )}
        <span className="text-xs text-gray-400 font-medium">{trendLabel}</span>
      </div>
    </div>
  );
};

const ComparativeTable: React.FC<{ entities: EntityData[], isMonthClosed?: boolean }> = ({ entities, isMonthClosed }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-5 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
        <h3 className="font-bold text-gray-800 flex items-center gap-2">
          <Activity size={18} className="text-indigo-600" />
          Demonstrativo Gerencial por Unidade
        </h3>
        <span className={`text-xs font-bold px-2 py-1 rounded border ${isMonthClosed ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-white text-gray-500 border-gray-300'}`}>
          Status: {isMonthClosed ? 'Fechado' : 'Aberto'}
        </span>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="bg-gray-100 text-gray-600 font-semibold uppercase tracking-wider">
            <tr>
              <th className="px-6 py-3 border-b border-gray-200 w-32">Unidade</th>
              <th className="px-4 py-3 border-b border-gray-200 w-auto">Indicadores</th>
              <th className="px-4 py-3 border-b border-gray-200 text-right bg-blue-50/50 text-blue-900">
                  {isMonthClosed ? 'Real' : 'Forecast'}
              </th>
              <th className="px-4 py-3 border-b border-gray-200 text-right">Meta (Budget)</th>
              <th className="px-4 py-3 border-b border-gray-200 text-right text-gray-500">Dif %</th>
              <th className="px-4 py-3 border-b border-gray-200 text-right bg-orange-50/30 text-orange-900">Ano Ant. (LY)</th>
              <th className="px-4 py-3 border-b border-gray-200 text-right text-gray-500">Dif % LY</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {entities.map((entity) => (
              <React.Fragment key={entity.id}>
                {entity.rows.map((row, rowIdx) => {
                  const diffBudget = calculateDiff(row.real, row.budget);
                  const diffLY = calculateDiff(row.real, row.lastYear);
                  
                  // Style logic
                  const isTotal = row.isTotal;
                  const rowClass = isTotal ? 'bg-indigo-50/50 font-bold text-gray-800' : 'hover:bg-gray-50 text-gray-600';
                  
                  // Formatter
                  const fmt = (val: number) => row.isPercentage ? `${val.toFixed(1).replace('.', ',')}%` : formatCurrency(val);
                  
                  const getDiffColor = (val: number) => {
                      if (Math.abs(val) < 0.1) return 'text-gray-400';
                      return val > 0 ? 'text-emerald-600' : 'text-red-500';
                  };

                  return (
                    <tr key={`${entity.id}-${rowIdx}`} className={`transition-colors ${rowClass} ${rowIdx === entity.rows.length -1 ? 'border-b-2 border-gray-200' : ''}`}>
                      {/* Entity Column with RowSpan */}
                      {rowIdx === 0 && (
                          <td 
                            rowSpan={entity.rows.length} 
                            className="px-6 py-3 font-bold text-sm text-indigo-900 border-r border-gray-200 bg-white align-middle"
                          >
                             <div className="flex flex-col items-center gap-1">
                                {entity.name === 'Consolidado (Grupo)' ? <Users size={20} className="text-indigo-400"/> : <Hotel size={20} className="text-gray-400" />}
                                <span className="text-center leading-tight">{entity.name.replace('Consolidado (Grupo)', 'Grupo')}</span>
                             </div>
                          </td>
                      )}

                      <td className="px-4 py-2 border-r border-gray-100 whitespace-nowrap font-medium w-min">
                        {row.label}
                      </td>
                      <td className="px-4 py-2 text-right border-r border-gray-100 font-medium bg-blue-50/10 text-blue-900">
                        {fmt(row.real)}
                      </td>
                      <td className="px-4 py-2 text-right border-r border-gray-100 text-gray-500">
                        {fmt(row.budget)}
                      </td>
                      <td className={`px-4 py-2 text-right border-r border-gray-100 font-bold ${getDiffColor(diffBudget)}`}>
                        {formatPercent(diffBudget)}
                      </td>
                      <td className="px-4 py-2 text-right border-r border-gray-100 bg-orange-50/10 text-gray-600">
                        {fmt(row.lastYear)}
                      </td>
                      <td className={`px-4 py-2 text-right font-bold ${getDiffColor(diffLY)}`}>
                        {formatPercent(diffLY)}
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const Dashboard: React.FC<DashboardProps> = ({ 
    isMonthClosed, 
    selectedMonth, 
    selectedYear, 
    financialData,
    packages,
    accounts,
    hotels
}) => {

  const dashboardData = useMemo(() => {
      // 1. Define Entities (Group + Individual Hotels)
      const entitiesList = [
          { id: 'group', name: 'Consolidado (Grupo)', isGroup: true },
          ...hotels.map(h => ({ id: h.id, name: h.name, isGroup: false }))
      ];

      return entitiesList.map(entity => {
          let rows: FinancialRow[] = [];
          
          const processSummary = (hName?: string) => {
               const dreRows = getForecastData(selectedMonth, selectedYear, financialData, hName, packages, accounts, hotels);
               return calculateDreSummary(dreRows, packages, accounts);
          };

          let summary;
          if (!entity.isGroup) {
               summary = processSummary(entity.name);
          } else {
               // Group Calculation
               const allSummaries = hotels.map(h => processSummary(h.name));
               const sumField = (field: 'revenue' | 'tax' | 'expenses' | 'gop' | 'gopNoTax', subField: 'real' | 'budget' | 'lastYear') => {
                   return allSummaries.reduce((sum, s) => {
                       if (field === 'gopNoTax') return sum + (s.gopNoTax[subField] || 0);
                       return sum + (s[field]?.[subField] || 0);
                   }, 0);
               };

               summary = {
                   revenue: { real: sumField('revenue', 'real'), budget: sumField('revenue', 'budget'), lastYear: sumField('revenue', 'lastYear') },
                   tax: { real: sumField('tax', 'real'), budget: sumField('tax', 'budget'), lastYear: sumField('tax', 'lastYear') },
                   expenses: { real: sumField('expenses', 'real'), budget: sumField('expenses', 'budget'), lastYear: sumField('expenses', 'lastYear') },
                   gop: { real: sumField('gop', 'real'), budget: sumField('gop', 'budget'), lastYear: sumField('gop', 'lastYear') },
                   gopNoTax: { real: sumField('gopNoTax', 'real'), budget: sumField('gopNoTax', 'budget'), lastYear: sumField('gopNoTax', 'lastYear') }
               };
          }

          // Build Rows based on EXACT requested list
          // 1. Receita
          // 2. Impostos
          // 3. Despesas
          // 4. GOP R$
          // 5. GOP %
          // 6. GOP R$ sem imposto
          
          rows = [
              { label: 'Receita', real: summary.revenue?.real || 0, budget: summary.revenue?.budget || 0, lastYear: summary.revenue?.lastYear || 0 },
              { label: 'Impostos', real: summary.tax?.real || 0, budget: summary.tax?.budget || 0, lastYear: summary.tax?.lastYear || 0 },
              { label: 'Despesas', real: summary.expenses?.real || 0, budget: summary.expenses?.budget || 0, lastYear: summary.expenses?.lastYear || 0 },
              { label: 'GOP R$', real: summary.gop?.real || 0, budget: summary.gop?.budget || 0, lastYear: summary.gop?.lastYear || 0, isTotal: true },
              { label: 'GOP %', 
                real: summary.revenue?.real ? (summary.gop?.real || 0) / summary.revenue.real * 100 : 0,
                budget: summary.revenue?.budget ? (summary.gop?.budget || 0) / summary.revenue.budget * 100 : 0,
                lastYear: summary.revenue?.lastYear ? (summary.gop?.lastYear || 0) / summary.revenue.lastYear * 100 : 0,
                isPercentage: true 
              },
              { label: 'GOP R$ sem imposto', real: summary.gopNoTax.real, budget: summary.gopNoTax.budget, lastYear: summary.gopNoTax.lastYear },
          ];

          return {
              id: entity.id,
              name: entity.name,
              rows: rows
          };
      });
  }, [selectedMonth, selectedYear, financialData, packages, accounts, hotels]);

  // Extract Group Data for Cards
  const groupData = dashboardData.find(d => d.id === 'group');
  const gopRow = groupData?.rows.find(r => r.label === 'GOP R$');
  const revRow = groupData?.rows.find(r => r.label === 'Receita');
  
  return (
    <div className="space-y-8 max-w-[1600px] mx-auto">
      
      {/* Top Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1: GOP R$ */}
        <KPI_Card 
          label="GOP (Consolidado)" 
          mainValue={formatCurrency(gopRow?.real || 0)} 
          trendValue={calculateDiff(gopRow?.real || 0, gopRow?.lastYear || 0)}
          trendLabel="vs last year"
          icon={DollarSign}
          colorTheme="emerald"
        />

        {/* Card 2: Receita */}
        <KPI_Card 
          label="Receita Total" 
          mainValue={formatCurrency(revRow?.real || 0)} 
          subValue={isMonthClosed ? 'Realizado' : 'Forecast'}
          trendValue={calculateDiff(revRow?.real || 0, revRow?.budget || 0)}
          trendLabel="vs Budget"
          icon={Activity}
          colorTheme="blue"
        />

        {/* Card 3: Transformação / Reatividade */}
        <KPI_Card 
          label="Margem GOP" 
          mainValue={formatPercent(gopRow && revRow && revRow.real > 0 ? (gopRow.real / revRow.real) * 100 : 0)} 
          subValue="Eficiência Operacional"
          trendValue={calculateDiff((gopRow?.real || 0), (gopRow?.budget || 0))}
          trendLabel="Melhoria vs Budget"
          icon={TrendingUp}
          colorTheme="indigo"
        />

        {/* Card 4: Status */}
        <KPI_Card 
          label="Status do Mês" 
          mainValue={isMonthClosed ? "Fechado" : "Aberto"} 
          subValue={isMonthClosed ? "Dados Consolidados" : "Em Planejamento"}
          trendValue={0} 
          trendLabel="-"
          icon={Users}
          colorTheme="orange"
        />
      </div>

      {/* Main Comparative Table */}
      <div>
        <ComparativeTable entities={dashboardData} isMonthClosed={isMonthClosed} />
      </div>
      
    </div>
  );
};

export default Dashboard;
