import React, { useState } from 'react';
import {
  Users, Settings, LogOut, Building2, BarChart2,
  BedDouble, CheckCircle2, ChevronDown, ChevronRight,
  TrendingUp, Database, PieChart, FileText, Upload,
  Calendar, Lock, GanttChartSquare, Layers, ShieldCheck, Package
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

// ── Helpers ────────────────────────────────────────────────────────────────────
const isAdminView = (v: ViewState) => v.startsWith('admin');

// ── Leaf item ──────────────────────────────────────────────────────────────────
const NavItem: React.FC<{
  label: string;
  icon: React.FC<{ size?: number; className?: string }>;
  active: boolean;
  onClick: () => void;
  depth?: number;
}> = ({ label, icon: Icon, active, onClick, depth = 0 }) => {
  const pl = depth === 0 ? 'pl-3' : depth === 1 ? 'pl-5' : 'pl-6';
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 ${pl} pr-3 py-1.5 text-[11px] font-semibold rounded-lg transition-all duration-150 ${
        active
          ? 'bg-[#F8981C]/20 text-[#F8981C] border-l-2 border-[#F8981C] rounded-l-none'
          : 'text-slate-300 hover:bg-white/5 hover:text-white'
      }`}
    >
      <Icon size={13} className="shrink-0" />
      <span className="truncate text-left">{label}</span>
    </button>
  );
};

// ── Group header (collapsible) ─────────────────────────────────────────────────
const GroupHeader: React.FC<{
  label: string;
  icon: React.FC<{ size?: number; className?: string }>;
  active: boolean;
  expanded: boolean;
  onToggle: () => void;
  depth?: number;
}> = ({ label, icon: Icon, active, expanded, onToggle, depth = 0 }) => {
  const pl = depth === 0 ? 'pl-3' : 'pl-5';
  return (
    <button
      onClick={onToggle}
      className={`w-full flex items-center justify-between ${pl} pr-3 py-2 rounded-lg transition-all ${
        active ? 'text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'
      }`}
    >
      <div className="flex items-center gap-2">
        <Icon size={depth === 0 ? 15 : 13} className={active ? 'text-[#F8981C]' : ''} />
        <span className={`font-black uppercase tracking-wider ${depth === 0 ? 'text-[11px]' : 'text-[10px]'}`}>
          {label}
        </span>
      </div>
      {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
    </button>
  );
};

// ── Sidebar ────────────────────────────────────────────────────────────────────
const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  currentModule,
  onChangeView,
  onModuleChange,
  user,
  collapsed,
}) => {
  const isAdmin = user.role === UserRole.ADMIN;

  const [exp, setExp] = useState<Record<string, boolean>>({
    real:  currentModule === 'REAL' && !isAdminView(currentView),
    admin: isAdminView(currentView),
  });

  const toggle = (key: string) => setExp(prev => ({ ...prev, [key]: !prev[key] }));

  const go = (view: ViewState, module?: ModuleType) => {
    if (module) onModuleChange(module);
    onChangeView(view);
  };

  const initials = user.name
    ? user.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
    : 'U';

  // ── Collapsed mode ────────────────────────────────────────────────────────
  if (collapsed) {
    return (
      <div className="w-20 bg-[#155645] text-slate-300 h-screen flex flex-col fixed left-0 top-0 shadow-2xl z-50">
        <div className="p-4 flex justify-center">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg" style={{ background: 'rgba(248,152,28,0.15)', border: '1px solid rgba(248,152,28,0.3)', boxShadow: '0 0 15px rgba(248,152,28,0.2)' }}>
            <TrendingUp className="text-[#F8981C]" size={20} />
          </div>
        </div>
        <nav className="flex-1 flex flex-col items-center gap-4 py-4">
          <button onClick={() => go('dashboard', 'REAL')} title="Forecast & GMD">
            <TrendingUp size={22} className={currentModule === 'REAL' && !isAdminView(currentView) ? 'text-[#F8981C]' : 'text-slate-400'} />
          </button>
          {isAdmin && (
            <button onClick={() => go('admin_real_versions')} title="Administração">
              <Settings size={22} className={isAdminView(currentView) ? 'text-[#F8981C]' : 'text-slate-400'} />
            </button>
          )}
        </nav>
        <div className="p-3 border-t border-white/10 flex flex-col items-center gap-3">
          <div className="w-7 h-7 rounded-full bg-[#F8981C] flex items-center justify-center text-[10px] font-black text-white">{initials}</div>
          <button onClick={() => alert('Saindo...')}><LogOut size={17} className="text-red-400/80 hover:text-red-400" /></button>
        </div>
      </div>
    );
  }

  // ── Full mode ─────────────────────────────────────────────────────────────
  return (
    <div className="w-[280px] bg-[#155645] text-slate-300 h-screen flex flex-col fixed left-0 top-0 shadow-2xl z-50">

      {/* Brand */}
      <div className="px-4 py-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shadow-lg shrink-0" style={{ background: 'rgba(248,152,28,0.15)', border: '1px solid rgba(248,152,28,0.3)' }}>
            <TrendingUp className="text-[#F8981C]" size={17} />
          </div>
          <div>
            <h1 className="font-black text-white text-sm leading-tight">Forecast &amp; GMD</h1>
            <p className="text-[9px] text-white/40 uppercase font-bold tracking-widest">Grupo Tauá</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto custom-scrollbar overflow-x-hidden pb-4">

        {/* ══ FORECAST & GMD ══ */}
        <GroupHeader
          label="Forecast & GMD"
          icon={TrendingUp}
          active={currentModule === 'REAL' && !isAdminView(currentView)}
          expanded={!!exp.real}
          onToggle={() => toggle('real')}
        />
        {exp.real && (
          <div className="space-y-0.5 pb-1">
            <NavItem depth={1} label="Versões"        icon={Database}      active={currentView === 'real_home'}       onClick={() => go('real_home', 'REAL')} />
            <NavItem depth={1} label="Ocupação"           icon={Calendar}      active={currentView === 'occupancy_monthly'} onClick={() => go('occupancy_monthly', 'REAL')} />
            <NavItem depth={1} label="Comparativo de ocupação" icon={BedDouble}     active={currentView === 'occupancy_real'}  onClick={() => go('occupancy_real', 'REAL')} />
            <NavItem depth={1} label="DRE Forecast"   icon={BarChart2}     active={currentView === 'dashboard'}       onClick={() => go('dashboard', 'REAL')} />
            <NavItem depth={1} label="Comparativos"   icon={PieChart}      active={currentView === 'comparatives'}    onClick={() => go('comparatives', 'REAL')} />
            <NavItem depth={1} label="Metas GMD"      icon={Users}         active={currentView === 'gmd'}             onClick={() => go('gmd', 'REAL')} />
            {isAdmin && <NavItem depth={1} label="Validações" icon={CheckCircle2} active={currentView === 'validations'} onClick={() => go('validations', 'REAL')} />}
          </div>
        )}

        {/* ══ ADMINISTRAÇÃO ══ */}
        {isAdmin && (
          <div className="pt-3 mt-1">
            <GroupHeader
              label="Administração"
              icon={Settings}
              active={isAdminView(currentView)}
              expanded={!!exp.admin}
              onToggle={() => toggle('admin')}
            />
            {exp.admin && (
              <div className="space-y-0.5 pb-1 mt-0.5">
                {/* Versões / Fechamento */}
                <NavItem depth={1} label="Versões"          icon={Database}        active={currentView === 'admin_real_versions'} onClick={() => go('admin_real_versions')} />
                <NavItem depth={1} label="Fechamento"       icon={Lock}            active={currentView === 'admin_real_closure'}  onClick={() => go('admin_real_closure')} />

                {/* Divisor visual suave */}
                <div className="my-1.5 mx-3 h-px bg-white/5" />

                {/* Cadastros gerais */}
                <NavItem depth={1} label="Plano de Contas"  icon={FileText}        active={currentView === 'admin_geral_accounts'}    onClick={() => go('admin_geral_accounts')} />
                <NavItem depth={1} label="Pacotes"          icon={Package}         active={currentView === 'admin_geral_packages'}    onClick={() => go('admin_geral_packages')} />
                <NavItem depth={1} label="Hotéis"           icon={Building2}       active={currentView === 'admin_geral_hotels'}      onClick={() => go('admin_geral_hotels')} />
                <NavItem depth={1} label="Setores (CR)"     icon={Layers}          active={currentView === 'admin_geral_costcenters'} onClick={() => go('admin_geral_costcenters')} />
                <NavItem depth={1} label="Usuários"         icon={Users}           active={currentView === 'admin_geral_users'}       onClick={() => go('admin_geral_users')} />
                <NavItem depth={1} label="Logs"             icon={FileText}        active={currentView === 'admin_geral_logs'}        onClick={() => go('admin_geral_logs')} />
                <NavItem depth={1} label="Permissões"       icon={ShieldCheck}     active={currentView === 'admin_geral_permissions'} onClick={() => go('admin_geral_permissions')} />
                <NavItem depth={1} label="Importação"       icon={Upload}          active={currentView === 'admin_geral_import'}      onClick={() => go('admin_geral_import')} />

              </div>
            )}
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="px-2 py-3 border-t border-white/10 shrink-0">
        <div className="flex items-center gap-2.5 px-3 py-2 bg-black/20 rounded-xl mb-1">
          <div className="w-7 h-7 rounded-full bg-[#F8981C] text-white flex items-center justify-center text-[10px] font-black shrink-0">{initials}</div>
          <div className="overflow-hidden">
            <p className="text-[11px] font-black text-white truncate">{user.name}</p>
            <p className="text-[9px] text-slate-500 truncate lowercase">{user.role}</p>
          </div>
        </div>
        <button
          onClick={() => alert('Saindo do sistema...')}
          className="flex items-center gap-2 px-3 py-1.5 text-[11px] font-bold text-red-400/70 hover:text-red-400 hover:bg-red-400/5 w-full transition-all rounded-lg"
        >
          <LogOut size={14} className="shrink-0" />
          <span>Sair do Sistema</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;