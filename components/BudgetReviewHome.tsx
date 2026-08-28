import React, { useState } from 'react';
import { ClipboardEdit, Copy, FileEdit, Lock, ChevronRight, Check } from 'lucide-react';
import { BudgetVersion, Hotel } from '../types';

interface BudgetReviewHomeProps {
    hotels: Hotel[];
    selectedHotel: string;
    setSelectedHotel: (name: string) => void;
    budgetVersions: BudgetVersion[];
    onCreateReplica: (sourceVersionId: string) => Promise<string | null>;
    onStartReview: (versionId: string, months: number[]) => void;
}

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

type Step = 'version' | 'mode' | 'period';

// Fluxo de "Revisão de Metas" (Budget): escolher qual versão de Meta revisar → revisar a versão
// original ou criar uma réplica pra revisar em paralelo → escolher o período (meses) → segue pra
// BudgetReviewOccupancy (aba tipo Ocupação, só que gravando na versão escolhida aqui).
const BudgetReviewHome: React.FC<BudgetReviewHomeProps> = ({ hotels, selectedHotel, setSelectedHotel, budgetVersions, onCreateReplica, onStartReview }) => {
    const [step, setStep] = useState<Step>('version');
    const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
    const [selectedMonths, setSelectedMonths] = useState<number[]>([]);
    const [creating, setCreating] = useState(false);

    // Mesma lógica da tela "Versões" (TimelineView/Planejamentos): a lista mostra TODAS as versões
    // de Budget já criadas, de qualquer hotel — não só do hotel selecionado no momento. Escolher
    // uma versão troca o hotel ativo pra o dela (ver hotelNameForVersion/onClick abaixo), do mesmo
    // jeito que a tela Versões já faz.
    const allVersions = [...budgetVersions].sort((a, b) => (b.year - a.year) || (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    const hotelNameForVersion = (v: BudgetVersion) => hotels.find(h => h.code === v.hotelId || h.id === v.hotelId)?.name || v.hotel || v.hotelId || '—';

    const selectedVersion = allVersions.find(v => v.id === selectedVersionId) || null;

    const resetAll = () => {
        setStep('version');
        setSelectedVersionId(null);
        setSelectedMonths([]);
    };

    const toggleMonth = (idx: number) => {
        setSelectedMonths(prev => prev.includes(idx) ? prev.filter(m => m !== idx) : [...prev, idx].sort((a, b) => a - b));
    };

    const handleChooseMode = async (mode: 'original' | 'replica') => {
        if (!selectedVersionId) return;
        if (mode === 'original') {
            setStep('period');
            return;
        }
        setCreating(true);
        const newId = await onCreateReplica(selectedVersionId);
        setCreating(false);
        if (newId) {
            setSelectedVersionId(newId);
            setStep('period');
        }
    };

    const handleConfirmPeriod = () => {
        if (!selectedVersionId || selectedMonths.length === 0) return;
        onStartReview(selectedVersionId, selectedMonths);
    };

    return (
        <div className="max-w-4xl mx-auto py-6">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-[#F8981C]/10 flex items-center justify-center">
                    <ClipboardEdit className="text-[#F8981C]" size={20} />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-gray-800">Revisão de Metas</h1>
                    <p className="text-sm text-gray-500">{selectedHotel}</p>
                </div>
            </div>

            {/* Passo 1: escolher versão + formato */}
            {step === 'version' && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <h2 className="font-bold text-gray-700 mb-1">Qual versão de Meta você quer revisar?</h2>
                    <p className="text-xs text-gray-400 mb-4">Escolha a versão de origem — no próximo passo você decide se revisa ela direto ou cria uma réplica.</p>

                    {allVersions.length === 0 ? (
                        <p className="text-sm text-gray-400 italic py-6 text-center">Nenhuma versão de Meta encontrada em Versões.</p>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6 max-h-[420px] overflow-y-auto pr-1">
                            {allVersions.map(v => {
                                const hotelName = hotelNameForVersion(v);
                                return (
                                    <button
                                        key={v.id}
                                        onClick={() => {
                                            setSelectedVersionId(v.id);
                                            if (hotelName && hotelName !== selectedHotel) setSelectedHotel(hotelName);
                                        }}
                                        className={`text-left p-3 rounded-xl border transition-colors ${selectedVersionId === v.id ? 'border-[#F8981C] bg-[#F8981C]/5' : 'border-gray-200 hover:border-gray-300'}`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="font-bold text-sm text-gray-800 truncate">{v.name}</span>
                                            {v.isLocked && <Lock size={12} className="text-gray-400 shrink-0" />}
                                        </div>
                                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                                            <span className="text-xs font-semibold text-gray-600">{hotelName}</span>
                                            <span className="text-xs text-gray-400">·</span>
                                            <span className="text-xs text-gray-500">{v.year}{v.month ? ` — ${MONTH_NAMES[v.month - 1]}` : ''}</span>
                                            {v.isMain && <span className="text-[9px] font-bold uppercase text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">Principal</span>}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    <div className="border-t border-gray-100 pt-4">
                        <p className="text-xs font-bold text-gray-500 uppercase mb-2">Formato da revisão</p>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="flex-1 p-3 rounded-xl border-2 border-[#F8981C] bg-[#F8981C]/5">
                                <p className="font-bold text-sm text-gray-800">Revisar metas apenas para a DRE e GMD</p>
                                <p className="text-xs text-gray-500 mt-1">Ocupação, receitas de hospedagem, por PAX, impostos e despesas de forma macro.</p>
                            </div>
                            <div className="flex-1 p-3 rounded-xl border border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed">
                                <p className="font-bold text-sm text-gray-500">Revisar metas no formato USALI</p>
                                <p className="text-xs text-gray-400 mt-1">Em desenvolvimento.</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end mt-6">
                        <button
                            disabled={!selectedVersionId}
                            onClick={() => setStep('mode')}
                            className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg font-bold text-sm bg-[#F8981C] text-white disabled:bg-gray-200 disabled:text-gray-400 hover:bg-[#e08a15] transition-colors"
                        >
                            Continuar <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            )}

            {/* Passo 2: original ou réplica */}
            {step === 'mode' && selectedVersion && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <h2 className="font-bold text-gray-700 mb-1">Como você quer revisar "{selectedVersion.name}"?</h2>
                    <p className="text-xs text-gray-400 mb-5">
                        Mesmo criando uma réplica, a Prévia e o Realizado continuam sendo os mesmos de sempre —
                        só a Meta fica em uma versão separada, pra você comparar depois.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <button
                            onClick={() => handleChooseMode('original')}
                            disabled={creating || selectedVersion.isLocked}
                            className="text-left p-4 rounded-xl border border-gray-200 hover:border-[#F8981C] hover:bg-[#F8981C]/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <FileEdit className="text-gray-500 mb-2" size={20} />
                            <p className="font-bold text-sm text-gray-800">Usar a versão original</p>
                            <p className="text-xs text-gray-500 mt-1">Edita "{selectedVersion.name}" diretamente. {selectedVersion.isLocked && '(bloqueada — desbloqueie em Versões antes)'}</p>
                        </button>
                        <button
                            onClick={() => handleChooseMode('replica')}
                            disabled={creating}
                            className="text-left p-4 rounded-xl border border-gray-200 hover:border-[#F8981C] hover:bg-[#F8981C]/5 transition-colors disabled:opacity-40"
                        >
                            <Copy className="text-gray-500 mb-2" size={20} />
                            <p className="font-bold text-sm text-gray-800">{creating ? 'Criando réplica...' : 'Criar uma réplica'}</p>
                            <p className="text-xs text-gray-500 mt-1">Cria "{selectedVersion.name} (Revisão)" com os mesmos dados, pra revisar sem alterar a original.</p>
                        </button>
                    </div>

                    <button onClick={() => setStep('version')} className="text-xs text-gray-400 hover:text-gray-600 mt-5">← Voltar</button>
                </div>
            )}

            {/* Passo 3: período */}
            {step === 'period' && selectedVersion && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <h2 className="font-bold text-gray-700 mb-1">Qual período você quer revisar?</h2>
                    <p className="text-xs text-gray-400 mb-4">Selecione os meses de "{selectedVersion.name}" que vão ficar disponíveis pra edição na próxima tela.</p>

                    <div className="flex items-center justify-between mb-2">
                        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 flex-1">
                            {MONTH_NAMES.map((label, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => toggleMonth(idx + 1)}
                                    className={`py-2 rounded-lg text-xs font-bold border transition-colors ${selectedMonths.includes(idx + 1) ? 'bg-[#F8981C] text-white border-[#F8981C]' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <button
                        onClick={() => setSelectedMonths(selectedMonths.length === 12 ? [] : Array.from({ length: 12 }, (_, i) => i + 1))}
                        className="text-xs font-semibold text-[#F8981C] hover:underline mt-2"
                    >
                        {selectedMonths.length === 12 ? 'Desmarcar todos' : 'Selecionar o ano inteiro'}
                    </button>

                    <div className="flex justify-between mt-6">
                        <button onClick={() => setStep('mode')} className="text-xs text-gray-400 hover:text-gray-600">← Voltar</button>
                        <button
                            disabled={selectedMonths.length === 0}
                            onClick={handleConfirmPeriod}
                            className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg font-bold text-sm bg-[#F8981C] text-white disabled:bg-gray-200 disabled:text-gray-400 hover:bg-[#e08a15] transition-colors"
                        >
                            <Check size={16} /> Começar revisão
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BudgetReviewHome;
