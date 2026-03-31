import React from 'react';
import { Table2, Users, Settings, LogOut, Building2, BarChart2, BedDouble, Users2, DollarSign } from 'lucide-react';
import { ViewState, ModuleType, User, UserRole } from '../types';

interface SidebarProps {
  currentView: ViewState;
  currentModule: ModuleType;
  onChangeView: (view: ViewState) => void;
  onModuleChange: (module: ModuleType) => void;
  user: User;
  collapsed?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, currentModule, onChangeView, onModuleChange, user, collapsed }) => {
  const isAdmin = user.role === UserRole.ADMIN;
  
  const realMenuItems = [
    { id: 'occupancy_real', label: 'Ocupação', icon: BedDouble },
    { id: 'dashboard', label: 'Forecast', icon: Table2 },
    { id: 'comparatives', label: 'Comparativos', icon: BarChart2 },
    { id: 'gmd', label: 'GMD', icon: Users },
  ];

  const budgetMenuItems = [
    { id: 'occupancy_budget', label: 'Ocupação', icon: BedDouble },
    { id: 'labor_budget', label: 'Mão de Obra', icon: Users2 },
    { id: 'extra_revenue_budget', label: 'Receitas Extras', icon: DollarSign },
    { id: 'dre_budget', label: 'USALI', icon: BarChart2 },
  ];

  const isHomeView = currentView === 'real_home' || currentView === 'budget_home';

  const menuItems = currentModule === 'REAL' 
    ? (isHomeView ? [] : realMenuItems)
    : (isHomeView ? [] : budgetMenuItems);

  return (
    <div className={`${collapsed ? 'w-20' : 'w-64'} bg-slate-900 text-white h-screen flex flex-col fixed left-0 top-0 shadow-xl z-50 transition-all duration-300 overflow-hidden`}>
      <div className="p-6 border-b border-slate-800 flex flex-col gap-4">
        <div className="flex items-center gap-2">
            <Building2 className="text-emerald-400 shrink-0" />
            {!collapsed && (
              <div className="overflow-hidden whitespace-nowrap">
                <h1 className="font-bold text-lg leading-tight">Orçamento e Gestão</h1>
                <p className="text-xs text-slate-400">Resort Management</p>
              </div>
            )}
        </div>

        {/* Module Selector */}
        <div className={`flex bg-slate-800 p-1 rounded-lg w-full ${collapsed ? 'flex-col' : ''}`}>
            <button 
                onClick={() => onModuleChange('REAL')}
                className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${currentModule === 'REAL' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'} ${collapsed ? 'text-[10px] px-1' : ''}`}
            >
                {collapsed ? 'Real' : 'Tauá Real'}
            </button>
            <button 
                onClick={() => onModuleChange('BUDGET')}
                className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${currentModule === 'BUDGET' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'} ${collapsed ? 'text-[10px] px-1' : ''}`}
            >
                {collapsed ? 'Budg' : 'Tauá Budget'}
            </button>
        </div>
      </div>

      <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto overflow-x-hidden">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChangeView(item.id as ViewState)}
              className={`w-full flex items-center gap-3 px-4 py-3.5 text-base font-bold rounded-lg transition-colors duration-200 ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-lg'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              } ${collapsed ? 'justify-center px-0' : ''}`}
              title={collapsed ? item.label : ''}
            >
              <Icon size={20} className="shrink-0" />
              {!collapsed && <span className="overflow-hidden whitespace-nowrap">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800 space-y-1">
        {isAdmin && (
          <button
            onClick={() => onChangeView('admin')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
              currentView === 'admin'
                ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-600/20'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            } ${collapsed ? 'justify-center px-0' : ''}`}
            title={collapsed ? "Administração" : ""}
          >
            <Settings size={20} className={`${currentView === 'admin' ? 'text-indigo-400' : 'text-slate-500'} shrink-0`} />
            {!collapsed && <span className="overflow-hidden whitespace-nowrap">Administração</span>}
          </button>
        )}
        
        <button 
          onClick={() => alert('Saindo do sistema...')}
          className={`flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-400 hover:bg-red-400/10 w-full transition-colors rounded-xl ${collapsed ? 'justify-center px-0' : ''}`}
          title={collapsed ? "Sair" : ""}
        >
          <LogOut size={20} className="shrink-0" />
          {!collapsed && <span className="overflow-hidden whitespace-nowrap">Sair do Sistema</span>}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;