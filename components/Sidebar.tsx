import React, { useState } from 'react';
import { 
  Table2, Users, Settings, LogOut, Building2, BarChart2, 
  BedDouble, Users2, DollarSign, CheckCircle2, ChevronDown, ChevronRight,
  TrendingUp, PieChart, Database, HardDrive, Layers
} from 'lucide-react';
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
  
  // Local state for accordion expansion
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    'real': currentModule === 'REAL' && currentView !== 'admin',
    'budget': currentModule === 'BUDGET' && currentView !== 'admin',
    'admin': currentView === 'admin'
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const menuSections = [
    {
      id: 'real',
      label: 'Tauá Real (Forecast)',
      icon: TrendingUp,
      module: 'REAL' as ModuleType,
      items: [
        { id: 'real_home', label: 'Versões Real', icon: Database },
        { id: 'occupancy_real', label: 'Ocupação', icon: BedDouble },
        { id: 'dashboard', label: 'DRE Forecast', icon: BarChart2 },
        { id: 'comparatives', label: 'Comparativos', icon: PieChart },
        { id: 'gmd', label: 'Metas GMD', icon: Users },
        ...(isAdmin ? [{ id: 'validations', label: 'Validações', icon: CheckCircle2 }] : []),
      ]
    },
    {
      id: 'budget',
      label: 'Tauá Budget (Orçamento)',
      icon: HardDrive,
      module: 'BUDGET' as ModuleType,
      items: [
        { id: 'budget_home', label: 'Versões Budget', icon: Database },
        { id: 'occupancy_budget', label: 'Ocupação UH', icon: BedDouble },
        { id: 'labor_budget', label: 'Mão de Obra', icon: Users2 },
        { id: 'extra_revenue_budget', label: 'Receitas Extras', icon: DollarSign },
        { id: 'dre_budget', label: 'USALI Final', icon: Table2 },
      ]
    }
  ];

  return (
    <div className={`${collapsed ? 'w-20' : 'w-[280px]'} bg-[#0f172a] text-slate-300 h-screen flex flex-col fixed left-0 top-0 shadow-2xl z-50 transition-all duration-300 border-r border-slate-800/50`}>
      {/* Brand Section */}
      <div className="p-6 mb-2">
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-indigo-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
               <Building2 className="text-white" size={24} />
            </div>
            {!collapsed && (
              <div className="overflow-hidden whitespace-nowrap">
                <h1 className="font-black text-white text-lg leading-tight tracking-tight">Tauá Finance</h1>
                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mt-0.5">Intelligent DRE Engine</p>
              </div>
            )}
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-2 overflow-y-auto custom-scrollbar overflow-x-hidden">
        {menuSections.map((section) => {
          const SectionIcon = section.icon;
          const isExpanded = !collapsed && expandedSections[section.id];
          const isCurrentModule = currentModule === section.module && currentView !== 'admin';

          return (
            <div key={section.id} className="space-y-1">
              {!collapsed && (
                <button 
                  onClick={() => toggleSection(section.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all ${isCurrentModule ? 'text-white' : 'hover:bg-slate-800/50 text-slate-400'}`}
                >
                  <div className="flex items-center gap-2">
                    <SectionIcon size={16} className={isCurrentModule ? 'text-emerald-400' : ''} />
                    <span className="text-[11px] font-black uppercase tracking-wider">{section.label}</span>
                  </div>
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
              )}

              {isExpanded && !collapsed && (
                <div className="space-y-0.5 ml-2 border-l border-slate-800/50 pl-2 py-1">
                  {section.items.map((item) => {
                    const ItemIcon = item.icon;
                    const isActive = currentView === item.id && currentModule === section.module;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                           onModuleChange(section.module);
                           onChangeView(item.id as ViewState);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-bold rounded-lg transition-all duration-200 ${
                          isActive
                            ? 'bg-gradient-to-r from-emerald-600/20 to-transparent text-emerald-400 border-l-2 border-emerald-500 rounded-l-none'
                            : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        <ItemIcon size={16} className="shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {collapsed && (
                 <div className="flex flex-col gap-2 items-center py-2">
                    <SectionIcon size={20} className={isCurrentModule ? 'text-emerald-400' : 'text-slate-500'} />
                    <div className="w-8 h-[1px] bg-slate-800" />
                 </div>
              )}
            </div>
          );
        })}

        {/* Admin Section (Standalone or Grouped) */}
        {isAdmin && (
           <div className="pt-4 mt-4 border-t border-slate-800/50">
              {!collapsed && (
                <button 
                  onClick={() => toggleSection('admin')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all ${currentView.startsWith('admin') ? 'text-white' : 'hover:bg-slate-800/50 text-slate-400'}`}
                >
                  <div className="flex items-center gap-2">
                    <Settings size={16} className={currentView.startsWith('admin') ? 'text-indigo-400' : ''} />
                    <span className="text-[11px] font-black uppercase tracking-wider">Administração</span>
                  </div>
                  {expandedSections['admin'] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
              )}

              {collapsed && (
                <div className="flex flex-col items-center py-2">
                  <button onClick={() => onChangeView('admin')}>
                    <Settings size={20} className={currentView.startsWith('admin') ? 'text-indigo-400' : 'text-slate-500'} />
                  </button>
                </div>
              )}

              {expandedSections['admin'] && !collapsed && (
                <div className="space-y-0.5 ml-2 border-l border-slate-800/50 pl-2 py-1">
                  <button
                    onClick={() => onChangeView('admin_geral')}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-bold rounded-lg transition-all duration-200 ${
                      currentView === 'admin_geral'
                        ? 'bg-gradient-to-r from-indigo-600/20 to-transparent text-indigo-400 border-l-2 border-indigo-500 rounded-l-none'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <Database size={16} className="shrink-0" />
                    <span className="truncate">Plano de Contas</span>
                  </button>
                  <button
                    onClick={() => onChangeView('admin_real')}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-bold rounded-lg transition-all duration-200 ${
                      currentView === 'admin_real'
                        ? 'bg-gradient-to-r from-indigo-600/20 to-transparent text-indigo-400 border-l-2 border-indigo-500 rounded-l-none'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <BarChart2 size={16} className="shrink-0" />
                    <span className="truncate">DRE Forecast</span>
                  </button>
                  <button
                    onClick={() => onChangeView('admin_budget')}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-bold rounded-lg transition-all duration-200 ${
                      currentView === 'admin_budget'
                        ? 'bg-gradient-to-r from-indigo-600/20 to-transparent text-indigo-400 border-l-2 border-indigo-500 rounded-l-none'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <Table2 size={16} className="shrink-0" />
                    <span className="truncate">USALI Budget</span>
                  </button>
                  <button
                    onClick={() => onChangeView('admin_hotels')}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-bold rounded-lg transition-all duration-200 ${
                      currentView === 'admin_hotels'
                        ? 'bg-gradient-to-r from-indigo-600/20 to-transparent text-indigo-400 border-l-2 border-indigo-500 rounded-l-none'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <Building2 size={16} className="shrink-0" />
                    <span className="truncate">Hotéis e Setores</span>
                  </button>
                  <button
                    onClick={() => onChangeView('admin_users')}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-bold rounded-lg transition-all duration-200 ${
                      currentView === 'admin_users'
                        ? 'bg-gradient-to-r from-indigo-600/20 to-transparent text-indigo-400 border-l-2 border-indigo-500 rounded-l-none'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <Users size={16} className="shrink-0" />
                    <span className="truncate">Usuários e Logs</span>
                  </button>
                  <button
                    onClick={() => onChangeView('admin_gmd')}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-bold rounded-lg transition-all duration-200 ${
                      currentView === 'admin_gmd'
                        ? 'bg-gradient-to-r from-indigo-600/20 to-transparent text-indigo-400 border-l-2 border-indigo-500 rounded-l-none'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <CheckCircle2 size={16} className="shrink-0" />
                    <span className="truncate">Config GMD</span>
                  </button>
                </div>
              )}
           </div>
        )}
      </nav>

      <div className="p-4 border-t border-slate-800/50">
        <div className={`flex items-center gap-3 px-4 py-3 bg-slate-800/30 rounded-2xl mb-2 ${collapsed ? 'justify-center px-0' : ''}`}>
           <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-[10px] font-black shrink-0">RS</div>
           {!collapsed && (
              <div className="overflow-hidden">
                 <p className="text-xs font-black text-white truncate">{user.name}</p>
                 <p className="text-[10px] text-slate-500 truncate lowercase">{user.role}</p>
              </div>
           )}
        </div>
        
        <button 
          onClick={() => alert('Saindo do sistema...')}
          className={`flex items-center gap-3 px-4 py-3 text-xs font-bold text-red-400/70 hover:text-red-400 hover:bg-red-400/5 w-full transition-all rounded-xl ${collapsed ? 'justify-center px-0' : ''}`}
        >
          <LogOut size={18} className="shrink-0" />
          {!collapsed && <span>Sair do Sistema</span>}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;