import React, { useState } from 'react';
import {
  Table2, Users, Settings, LogOut, Building2, BarChart2,
  BedDouble, Users2, DollarSign, CheckCircle2, ChevronDown, ChevronRight,
  TrendingUp, HardDrive, Database, PieChart, Layers, GanttChartSquare
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

// ─── Sub-item button ────────────────────────────────────────────────────────
const NavItem: React.FC<{
  id: string;
  label: string;
  icon: React.FC<{ size?: number; className?: string }>;
  active: boolean;
  onClick: () => void;
  indent?: number; // 0 = first level, 1 = deeper
}> = ({ label, icon: Icon, active, onClick, indent = 0 }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150 ${
      indent === 1 ? 'pl-5' : ''
    } ${
      active
        ? 'bg-indigo-600/20 text-indigo-300 border-l-2 border-indigo-400 rounded-l-none'
        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
    }`}
  >
    <Icon size={14} className="shrink-0" />
    <span className="truncate">{label}</span>
  </button>
);

// ─── Collapsible group header ────────────────────────────────────────────────
const GroupHeader: React.FC<{
  label: string;
  icon: React.FC<{ size?: number; className?: string }>;
  active: boolean;
  expanded: boolean;
  onToggle: () => void;
  indent?: boolean;
}> = ({ label, icon: Icon, active, expanded, onToggle, indent }) => (
  <button
    onClick={onToggle}
    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all ${
      indent ? 'pl-5' : ''
    } ${active ? 'text-white' : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'}`}
  >
    <div className="flex items-center gap-2">
      <Icon size={14} className={active ? 'text-indigo-400' : ''} />
      <span className="text-[11px] font-black uppercase tracking-wider">{label}</span>
    </div>
    {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
  </button>
);

// ─── Sidebar ─────────────────────────────────────────────────────────────────
const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  currentModule,
  onChangeView,
  onModuleChange,
  user,
  collapsed,
}) => {
  const isAdmin = user.role === UserRole.ADMIN;
  const isAdminView = currentView.startsWith('admin');

  const [exp, setExp] = useState<Record<string, boolean>>({
    real: currentModule === 'REAL' && !isAdminView,
    budget: currentModule === 'BUDGET' && !isAdminView,
    admin: isAdminView,
    adminBudget: ['admin_budget'].includes(currentView),
    adminReal: ['admin_real'].includes(currentView),
    adminGeral: ['admin_geral', 'admin_users', 'admin_hotels', 'admin_gmd'].includes(currentView),
  });

  const toggle = (key: string) =>
    setExp(prev => ({ ...prev, [key]: !prev[key] }));

  const go = (view: ViewState, module?: ModuleType) => {
    if (module) onModuleChange(module);
    onChangeView(view);
  };

  const initials = user.name
    ? user.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
    : 'U';

  if (collapsed) {
    return (
      <div className="w-20 bg-[#0f172a] text-slate-300 h-screen flex flex-col fixed left-0 top-0 shadow-2xl z-50 border-r border-slate-800/50">
        <div className="p-4 flex justify-center mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-indigo-600 flex items-center justify-center shadow-lg shrink-0">
            <Building2 className="text-white" size={22} />
          </div>
        </div>
        <nav className="flex-1 flex flex-col items-center gap-3 py-3">
          <button onClick={() => { onModuleChange('REAL'); go('dashboard'); }} title="Tauá Real">
            <TrendingUp size={22} className={currentModule === 'REAL' && !isAdminView ? 'text-emerald-400' : 'text-slate-500'} />
          </button>
          <div className="w-6 h-px bg-slate-800" />
          <button onClick={() => { onModuleChange('BUDGET'); go('dre_budget'); }} title="Tauá Budget">
            <HardDrive size={22} className={currentModule === 'BUDGET' && !isAdminView ? 'text-emerald-400' : 'text-slate-500'} />
          </button>
          {isAdmin && (
            <>
              <div className="w-6 h-px bg-slate-800" />
              <button onClick={() => go('admin_geral')} title="Administração">
                <Settings size={22} className={isAdminView ? 'text-indigo-400' : 'text-slate-500'} />
              </button>
            </>
          )}
        </nav>
        <div className="p-3 border-t border-slate-800/50 flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-[10px] font-black">{initials}</div>
          <button onClick={() => alert('Saindo do sistema...')}>
            <LogOut size={18} className="text-red-400/70 hover:text-red-400" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-[280px] bg-[#0f172a] text-slate-300 h-screen flex flex-col fixed left-0 top-0 shadow-2xl z-50 transition-all duration-300 border-r border-slate-800/50">
      {/* Brand */}
      <div className="px-5 py-5 mb-1 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-indigo-600 flex items-center justify-center shadow-lg shrink-0">
            <Building2 className="text-white" size={20} />
          </div>
          <div>
            <h1 className="font-black text-white text-base leading-tight tracking-tight">Tauá Finance</h1>
            <p className="text-[9px] text-slate-500 uppercase font-bold tracking-widest">Intelligent DRE Engine</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2.5 space-y-0.5 overflow-y-auto custom-scrollbar overflow-x-hidden pb-4">

        {/* ── TAUÁ REAL ── */}
        <div className="space-y-0.5">
          <GroupHeader
            label="Tauá Real"
            icon={TrendingUp}
            active={currentModule === 'REAL' && !isAdminView}
            expanded={!!exp.real}
            onToggle={() => toggle('real')}
          />
          {exp.real && (
            <div className="pl-2 ml-1 border-l border-slate-800/50 space-y-0.5 py-0.5">
              <NavItem id="real_home"        label="Versões Real"    icon={Database}       active={currentView === 'real_home'}        onClick={() => go('real_home', 'REAL')} />
              <NavItem id="occupancy_real"   label="Ocupação"        icon={BedDouble}      active={currentView === 'occupancy_real'}    onClick={() => go('occupancy_real', 'REAL')} />
              <NavItem id="dashboard"        label="DRE Forecast"   icon={BarChart2}      active={currentView === 'dashboard'}        onClick={() => go('dashboard', 'REAL')} />
              <NavItem id="comparatives"     label="Comparativos"   icon={PieChart}       active={currentView === 'comparatives'}     onClick={() => go('comparatives', 'REAL')} />
              <NavItem id="gmd"              label="Metas GMD"      icon={Users}          active={currentView === 'gmd'}              onClick={() => go('gmd', 'REAL')} />
              {isAdmin && <NavItem id="validations" label="Validações" icon={CheckCircle2} active={currentView === 'validations'} onClick={() => go('validations', 'REAL')} />}
            </div>
          )}
        </div>

        {/* ── TAUÁ BUDGET ── */}
        <div className="space-y-0.5">
          <GroupHeader
            label="Tauá Budget"
            icon={HardDrive}
            active={currentModule === 'BUDGET' && !isAdminView}
            expanded={!!exp.budget}
            onToggle={() => toggle('budget')}
          />
          {exp.budget && (
            <div className="pl-2 ml-1 border-l border-slate-800/50 space-y-0.5 py-0.5">
              <NavItem id="budget_home"          label="Versões Budget"  icon={Database}   active={currentView === 'budget_home'}          onClick={() => go('budget_home', 'BUDGET')} />
              <NavItem id="occupancy_budget"     label="Ocupação UH"     icon={BedDouble}  active={currentView === 'occupancy_budget'}     onClick={() => go('occupancy_budget', 'BUDGET')} />
              <NavItem id="labor_budget"         label="Mão de Obra"     icon={Users2}     active={currentView === 'labor_budget'}         onClick={() => go('labor_budget', 'BUDGET')} />
              <NavItem id="extra_revenue_budget" label="Receitas Extras" icon={DollarSign} active={currentView === 'extra_revenue_budget'} onClick={() => go('extra_revenue_budget', 'BUDGET')} />
              <NavItem id="dre_budget"           label="USALI Final"     icon={Table2}     active={currentView === 'dre_budget'}           onClick={() => go('dre_budget', 'BUDGET')} />
            </div>
          )}
        </div>

        {/* ── ADMINISTRAÇÃO ── */}
        {isAdmin && (
          <div className="pt-3 mt-2 border-t border-slate-800/50 space-y-0.5">
            <GroupHeader
              label="Administração"
              icon={Settings}
              active={isAdminView}
              expanded={!!exp.admin}
              onToggle={() => toggle('admin')}
            />

            {exp.admin && (
              <div className="pl-2 ml-1 border-l border-slate-800/50 space-y-0.5 py-0.5">

                {/* ── Sub: Tauá Budget ── */}
                <GroupHeader
                  label="Tauá Budget"
                  icon={HardDrive}
                  active={currentView === 'admin_budget'}
                  expanded={!!exp.adminBudget}
                  onToggle={() => toggle('adminBudget')}
                  indent
                />
                {exp.adminBudget && (
                  <div className="pl-3 ml-1 border-l border-slate-800/40 space-y-0.5 py-0.5">
                    <NavItem indent={1} id="admin_budget" label="USALI / Config" icon={Layers}           active={currentView === 'admin_budget'} onClick={() => go('admin_budget')} />
                  </div>
                )}

                {/* ── Sub: Tauá Real ── */}
                <GroupHeader
                  label="Tauá Real"
                  icon={TrendingUp}
                  active={currentView === 'admin_real'}
                  expanded={!!exp.adminReal}
                  onToggle={() => toggle('adminReal')}
                  indent
                />
                {exp.adminReal && (
                  <div className="pl-3 ml-1 border-l border-slate-800/40 space-y-0.5 py-0.5">
                    <NavItem indent={1} id="admin_real" label="DRE Estrutura" icon={GanttChartSquare} active={currentView === 'admin_real'} onClick={() => go('admin_real')} />
                  </div>
                )}

                {/* ── Sub: Tauá Geral ── */}
                <GroupHeader
                  label="Tauá Geral"
                  icon={Database}
                  active={['admin_geral', 'admin_users', 'admin_hotels', 'admin_gmd'].includes(currentView)}
                  expanded={!!exp.adminGeral}
                  onToggle={() => toggle('adminGeral')}
                  indent
                />
                {exp.adminGeral && (
                  <div className="pl-3 ml-1 border-l border-slate-800/40 space-y-0.5 py-0.5">
                    <NavItem indent={1} id="admin_geral"  label="Plano de Contas"  icon={Database}         active={currentView === 'admin_geral'}  onClick={() => go('admin_geral')} />
                    <NavItem indent={1} id="admin_hotels" label="Hotéis e Setores" icon={Building2}        active={currentView === 'admin_hotels'} onClick={() => go('admin_hotels')} />
                    <NavItem indent={1} id="admin_users"  label="Usuários e Logs"  icon={Users}            active={currentView === 'admin_users'}  onClick={() => go('admin_users')} />
                    <NavItem indent={1} id="admin_gmd"    label="Config GMD"       icon={CheckCircle2}     active={currentView === 'admin_gmd'}    onClick={() => go('admin_gmd')} />
                  </div>
                )}

              </div>
            )}
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-slate-800/50 shrink-0">
        <div className="flex items-center gap-3 px-3 py-2.5 bg-slate-800/30 rounded-xl mb-1.5">
          <div className="w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center text-[10px] font-black shrink-0">{initials}</div>
          <div className="overflow-hidden">
            <p className="text-xs font-black text-white truncate">{user.name}</p>
            <p className="text-[9px] text-slate-500 truncate lowercase">{user.role}</p>
          </div>
        </div>
        <button
          onClick={() => alert('Saindo do sistema...')}
          className="flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-red-400/70 hover:text-red-400 hover:bg-red-400/5 w-full transition-all rounded-lg"
        >
          <LogOut size={15} className="shrink-0" />
          <span>Sair do Sistema</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;