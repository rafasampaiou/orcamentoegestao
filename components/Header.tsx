import React from 'react';
import { Layers, Building2 as Building2Icon, ArrowLeft, ArrowRight, Calendar, LogOut } from 'lucide-react';
import { User, Hotel, ModuleType, UserRole } from '../types';

interface HeaderProps {
    sidebarCollapsed: boolean;
    setSidebarCollapsed: (collapsed: boolean) => void;
    hotels: Hotel[];
    selectedHotel: string;
    setSelectedHotel: (hotel: string) => void;
    currentModule: ModuleType;
    handleMonthChange: (direction: 'prev' | 'next') => void;
    formattedDate: string;
    currentUser: User;
    onLogout: () => void;
}

const Header: React.FC<HeaderProps> = ({
    sidebarCollapsed,
    setSidebarCollapsed,
    hotels,
    selectedHotel,
    setSelectedHotel,
    currentModule,
    handleMonthChange,
    formattedDate,
    currentUser,
    onLogout
}) => {
    return (
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0 z-10 font-['Inter',sans-serif]">
            <div className="flex items-center gap-4">
                <button 
                    onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                    className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
                    title={sidebarCollapsed ? "Mostrar Menu" : "Ocultar Menu"}
                >
                    <Layers size={20} className={sidebarCollapsed ? "text-indigo-600" : ""} />
                </button>

                {/* Hotel Context Selector */}
                <div className="flex items-center bg-indigo-50 px-4 py-2.5 rounded-lg border border-indigo-100">
                    <Building2Icon className="text-indigo-600 mr-2" size={20} />
                    <select 
                        value={selectedHotel} 
                        onChange={(e) => setSelectedHotel(e.target.value)}
                        className="bg-transparent text-base font-bold text-indigo-900 focus:outline-none cursor-pointer"
                    >
                        {hotels.map(h => (
                            <option key={h.id} value={h.name}>{h.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="flex items-center gap-4">
                {/* MONTH SELECTOR - HIDDEN IN BUDGET MODULE */}
                {currentModule !== 'BUDGET' && (
                    <div className="flex items-center gap-3 bg-white px-3 py-2 rounded-lg border border-gray-200 shadow-sm">
                        <button onClick={() => handleMonthChange('prev')} className="p-1.5 hover:bg-gray-100 rounded text-gray-500">
                            <ArrowLeft size={18} />
                        </button>
                        <div className="flex items-center gap-2 text-base text-gray-700 w-40 justify-center font-bold capitalize">
                            <Calendar size={18} className="text-indigo-500" />
                            <span>{formattedDate}</span>
                        </div>
                        <button onClick={() => handleMonthChange('next')} className="p-1.5 hover:bg-gray-100 rounded text-gray-500">
                            <ArrowRight size={18} />
                        </button>
                    </div>
                )}

                {currentModule !== 'BUDGET' && <div className="h-8 w-px bg-gray-200 mx-1"></div>}
                
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3 p-1.5 rounded-lg">
                        <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm">
                            {currentUser.name.split(' ').map((n: string) => n[0]).join('')}
                        </div>
                        <div className="text-sm hidden sm:block">
                            <p className="font-semibold text-gray-700 leading-none">{currentUser.name}</p>
                            <p className="text-xs text-gray-500 leading-none mt-1">{currentUser.role === UserRole.ADMIN ? 'Administrador' : 'Gestor'}</p>
                        </div>
                    </div>

                    <button 
                        onClick={onLogout}
                        className="p-2.5 hover:bg-red-50 hover:text-red-600 rounded-xl text-gray-400 Transition-all active:scale-95 group"
                        title="Sair"
                    >
                        <LogOut size={20} className="group-hover:translate-x-0.5 transition-transform" />
                    </button>
                </div>
            </div>
        </header>
    );
};

export default Header;
