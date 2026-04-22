import React, { useState } from 'react';
import { BudgetVersion } from '../types';
import { Star, Lock, LockOpen, Trash2, Copy, Plus, AlertTriangle, Settings } from 'lucide-react';

interface TimelineViewProps {
  title: string;
  versions: BudgetVersion[];
  activeVersionId: string;
  onSelectVersion: (id: string) => void;
  onToggleLock: (id: string) => void;
  onCreateVersion: (year: number, month: number, name: string, hotelId: string) => void;
  onReplicateVersion?: (year: number, month: number) => void;
  onSetMain?: (id: string) => void;
  onDelete?: (id: string) => void;
  showCreateOption?: boolean;
  showSettingsIcon?: boolean;
  hotels?: { id: string, name: string, code: string }[];
}

const TimelineView: React.FC<TimelineViewProps> = ({
  title,
  versions,
  activeVersionId,
  onSelectVersion,
  onToggleLock,
  onCreateVersion,
  onReplicateVersion,
  onSetMain,
  onDelete,
  showCreateOption = true,
  showSettingsIcon = false,
  hotels = []
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deleteVersionId, setDeleteVersionId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<{year: number, month: number} | null>(null);
  const [newVersionName, setNewVersionName] = useState('');
  const [newVersionYear, setNewVersionYear] = useState(new Date().getFullYear());
  const [selectedHotelId, setSelectedHotelId] = useState('');

  const handleMonthClick = (year: number, month: number) => {
    setSelectedDate({ year, month });
    if (!showCreateOption && onReplicateVersion) {
      onReplicateVersion(year, month);
      return;
    }
    
    if (onReplicateVersion) {
      setModalOpen(true);
    } else {
      setNewVersionYear(year);
      setNewVersionName('');
      setCreateModalOpen(true);
    }
  };

  const handleNewPlanClick = () => {
    const currentYear = new Date().getFullYear();
    setSelectedDate({ year: currentYear, month: 1 });
    if (!showCreateOption && onReplicateVersion) {
      onReplicateVersion(currentYear, 1);
      return;
    }

    if (onReplicateVersion) {
      setModalOpen(true);
    } else {
      setNewVersionYear(currentYear);
      setNewVersionName('');
      setCreateModalOpen(true);
    }
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newVersionName.trim() && selectedDate && selectedHotelId) {
      onCreateVersion(newVersionYear, selectedDate.month, newVersionName.trim(), selectedHotelId);
      setCreateModalOpen(false);
      setSelectedHotelId('');
    } else if (!selectedHotelId) {
      alert('Por favor, selecione uma empresa/hotel.');
    }
  };
  // Determine the range of years to display
  const currentYear = new Date().getFullYear();
  const minYear = Math.min(...versions.map(v => v.year), currentYear - 1);
  const maxYear = Math.max(...versions.map(v => v.year), currentYear + 3);
  
  const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i);
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  // Group versions by year
  const versionsByYear = versions.reduce((acc, v) => {
    if (!acc[v.year]) acc[v.year] = [];
    acc[v.year].push(v);
    return acc;
  }, {} as Record<number, BudgetVersion[]>);

  // Colors for versions
  const colors = [
    'bg-[#3b82f6]', // blue
    'bg-[#2dd4bf]', // teal
    'bg-[#1e293b]', // slate dark
    'bg-[#f59e0b]', // orange
    'bg-[#10b981]', // emerald
    'bg-[#6366f1]'  // indigo
  ];

  // Find max rows needed
  const maxRows = Math.max(1, ...(Object.values(versionsByYear) as BudgetVersion[][]).map(arr => arr.length));

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-light text-gray-800 flex items-center gap-2">
          <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
          </svg>
          {title}
        </h3>
        <button onClick={handleNewPlanClick} className="bg-[#38b2ac] hover:bg-[#319795] text-white px-4 py-2 rounded text-xs font-bold flex items-center gap-2 transition-colors uppercase tracking-wider shadow-sm">
          Novo Planejamento
        </button>
      </div>

      <div className="border border-gray-200 bg-white shadow-sm overflow-x-auto">
        <div className="min-w-max">
          {/* Header row for Years */}
          <div className="flex bg-gray-50 border-b border-gray-200">
            {years.map(year => (
              <div key={year} className="flex-none w-[360px] border-r border-gray-200 last:border-r-0">
                <div className="text-center py-3 text-2xl font-light text-gray-500">
                  {year}
                </div>
                <div className="flex border-t border-gray-200">
                  {months.map((month, idx) => (
                    <div key={idx} className="flex-1 text-center py-1.5 text-[10px] text-gray-400 border-r border-gray-100 last:border-r-0 uppercase">
                      {month}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Body for Versions */}
          <div className="relative bg-white" style={{ width: `${years.length * 360}px`, minHeight: `${maxRows * 70 + 40}px` }}>
            {/* Grid lines and interaction areas */}
            <div className="absolute inset-0 flex">
              {years.map(year => (
                <div key={`grid-${year}`} className="flex-none w-[360px] flex border-r border-gray-200 last:border-r-0">
                  {months.map((_, idx) => (
                    <div 
                      key={`grid-m-${idx}`} 
                      className="flex-1 border-r border-gray-100 last:border-r-0 hover:bg-gray-50 cursor-pointer group relative"
                      onClick={() => handleMonthClick(year, idx + 1)}
                      title={`Nova ação em ${months[idx]} de ${year}`}
                    >
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-4 h-4 rounded-full bg-[#38b2ac] text-white flex items-center justify-center text-xs font-bold">+</div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Render versions */}
            <div className="relative z-10 pt-4 pb-4">
              {Array.from({ length: maxRows }).map((_, rowIdx) => (
                <div key={`row-${rowIdx}`} className="relative h-16 w-full mb-2">
                  {years.map((year, yearIdx) => {
                    const version = versionsByYear[year]?.[rowIdx];
                    if (!version) return null;
                    
                    const colorClass = colors[(yearIdx + rowIdx) % colors.length];
                    const isActive = activeVersionId === version.id;

                    const startMonth = version.month ? version.month - 1 : 0;
                    const leftOffset = yearIdx * 360 + (startMonth * 30) + 4;
                    const width = (12 - startMonth) * 30 - 8;

                    return (
                      <div 
                        key={version.id}
                        onClick={!showSettingsIcon ? (e) => { 
                          e.preventDefault(); 
                          e.stopPropagation();
                          onSelectVersion(version.id); 
                        } : undefined}
                        className={`absolute top-0 h-14 rounded shadow-sm p-2 transition-all flex flex-col justify-start ${colorClass} text-white ${isActive ? 'ring-2 ring-offset-2 ring-[#38b2ac]' : ''} ${!showSettingsIcon ? 'cursor-pointer hover:scale-[1.02] hover:shadow-md' : 'hover:opacity-95'}`}
                        style={{ 
                          left: `${leftOffset}px`, 
                          width: `${width}px` 
                        }}
                      >
                        {showSettingsIcon && (
                          <div className="absolute bottom-1 right-1 z-20">
                            <button 
                              type="button"
                              onClick={(e) => { 
                                e.preventDefault(); 
                                e.stopPropagation(); 
                                onSelectVersion(isActive ? '' : version.id); 
                              }}
                              className={`flex items-center justify-center bg-white rounded-md p-1 shadow-md transition-all hover:scale-110 active:scale-95 ${isActive ? 'opacity-100 animate-spin-slow text-emerald-500 ring-2 ring-emerald-500' : 'opacity-80 hover:opacity-100 text-gray-700 hover:text-gray-900 border border-gray-100'}`}
                              title={isActive ? 'Desmarcar configuração' : 'Selecionar para configuração'}
                            >
                              <Settings size={14} strokeWidth={2.5} />
                            </button>
                          </div>
                        )}
                        <div className="flex justify-between items-start">
                          <div className={!showSettingsIcon ? 'pointer-events-none' : ''}>
                            <div className="font-bold text-sm leading-tight max-w-[150px] truncate">{version.year}</div>
                            <div className="text-[10px] opacity-90 max-w-[150px] truncate leading-tight mt-0.5">{version.name}</div>
                          </div>
                          <div className="flex items-center gap-1.5 opacity-80">
                            {onSetMain && (
                              <button 
                                onClick={(e) => { e.stopPropagation(); onSetMain(version.id); }}
                                className={`opacity-70 hover:opacity-100 transition-opacity ${version.isMain ? 'opacity-100' : ''}`}
                                title={version.isMain ? "Versão Principal" : "Tornar Principal"}
                              >
                                <Star size={14} className={version.isMain ? "fill-white" : ""} />
                              </button>
                            )}
                            {!onSetMain && version.isMain && <Star size={14} className="fill-white" />}
                            <button 
                              onClick={(e) => { e.stopPropagation(); onToggleLock(version.id); }}
                              className="opacity-70 hover:opacity-100 transition-opacity"
                              title={version.isLocked ? "Desbloquear" : "Bloquear"}
                            >
                              {version.isLocked ? <Lock size={14} /> : <LockOpen size={14} />}
                            </button>
                            {onDelete && (
                              <button 
                                onClick={(e) => { e.stopPropagation(); setDeleteVersionId(version.id); }}
                                className="opacity-70 hover:opacity-100 hover:text-red-200 transition-colors"
                                title="Deletar"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Configuration version status banner */}
      {showSettingsIcon && (() => {
        const activeVersion = versions.find(v => v.id === activeVersionId);
        return activeVersion ? (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-600 rounded-lg flex items-center justify-center shrink-0">
              <Settings size={18} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-black text-emerald-900">Versão selecionada para configuração: <span className="text-emerald-700 border-b border-emerald-300 pb-0.5">{activeVersion.name} ({activeVersion.year})</span></p>
              <p className="text-xs text-emerald-600 mt-0.5">As abas de configuração e importação agora irão operar sobre esta versão.</p>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl flex items-center gap-3">
            <div className="w-9 h-9 bg-gray-200 rounded-lg flex items-center justify-center shrink-0">
              <Settings size={18} className="text-gray-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-800">Nenhuma versão selecionada para configuração</p>
              <p className="text-xs text-gray-500 mt-0.5">Selecione a versão que deseja configurar clicando na engrenagem</p>
            </div>
          </div>
        );
      })()}

      {/* Action Modal */}
      {modalOpen && selectedDate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-medium text-gray-900">
                Nova Ação - {months[selectedDate.month - 1]} {selectedDate.year}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-500">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <button
                onClick={() => {
                  setModalOpen(false);
                  setNewVersionYear(selectedDate.year);
                  setNewVersionName('');
                  setCreateModalOpen(true);
                }}
                className="w-full flex items-center gap-4 p-4 rounded-lg border border-gray-200 hover:border-[#38b2ac] hover:bg-teal-50 transition-colors text-left group"
              >
                <div className="bg-teal-100 text-[#38b2ac] p-3 rounded-full group-hover:bg-[#38b2ac] group-hover:text-white transition-colors">
                  <Plus size={24} />
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Criar Orçamento em Branco</h4>
                  <p className="text-sm text-gray-500">Iniciar um planejamento do zero para este período.</p>
                </div>
              </button>

              <button
                onClick={() => {
                  setModalOpen(false);
                  if (onReplicateVersion) onReplicateVersion(selectedDate.year, selectedDate.month);
                }}
                className="w-full flex items-center gap-4 p-4 rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-colors text-left group"
              >
                <div className="bg-blue-100 text-blue-600 p-3 rounded-full group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <Copy size={24} />
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">Criar a partir de Versão Existente</h4>
                  <p className="text-sm text-gray-500">Fazer uma cópia exata ou iniciar uma nova com projeções.</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Version Modal */}
      {createModalOpen && selectedDate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-medium text-gray-900">Nova Versão</h3>
              <button onClick={() => setCreateModalOpen(false)} className="text-gray-400 hover:text-gray-500">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Versão</label>
                <input 
                  type="text" 
                  value={newVersionName} 
                  onChange={e => setNewVersionName(e.target.value)} 
                  className="w-full border border-gray-300 rounded-md p-2 focus:ring-[#38b2ac] focus:border-[#38b2ac]" 
                  placeholder="Ex: 2026 Oficial" 
                  required 
                  autoFocus 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ano</label>
                <input 
                  type="number" 
                  value={newVersionYear} 
                  onChange={e => setNewVersionYear(parseInt(e.target.value) || new Date().getFullYear())} 
                  className="w-full border border-gray-300 rounded-md p-2 focus:ring-[#38b2ac] focus:border-[#38b2ac]" 
                  required 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Empresa (Hotel)</label>
                <select 
                  value={selectedHotelId} 
                  onChange={e => setSelectedHotelId(e.target.value)} 
                  className="w-full border border-gray-300 rounded-md p-2 focus:ring-[#38b2ac] focus:border-[#38b2ac]" 
                  required
                >
                  <option value="">Selecione um hotel...</option>
                  {hotels.map(h => (
                    <option key={h.id} value={h.code}>{h.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setCreateModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-[#38b2ac] rounded-md hover:bg-[#319795]">
                  Criar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteVersionId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden">
            <div className="p-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-lg font-medium text-gray-900">Excluir Versão</h3>
              <p className="text-sm text-gray-500">Tem certeza que deseja excluir esta versão? Esta ação não pode ser desfeita.</p>
              <div className="flex justify-center gap-3 pt-4">
                <button onClick={() => setDeleteVersionId(null)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
                  Cancelar
                </button>
                <button 
                  onClick={() => { 
                    if(onDelete) onDelete(deleteVersionId); 
                    setDeleteVersionId(null); 
                  }} 
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimelineView;
