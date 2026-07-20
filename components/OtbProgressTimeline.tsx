import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { OTB_STEP_LABELS } from '../utils/otbProgress';

interface OtbProgressTimelineProps {
    completed: boolean[];
    onStepClick?: (index: number) => void;
    onStepReset?: (index: number) => void;
    // Índices em que um clique numa etapa já concluída oferece a escolha Revisar/Resetar. Sem essa
    // prop, todas as 8 oferecem a escolha. Usado pela tela de Ocupação, que só sabe resetar as 3
    // etapas que vivem nela (as outras continuam navegando direto pra DRE Forecast).
    resettableSteps?: number[];
    title?: string;
}

// Checklist compacto dos 8 passos de montagem de uma projeção (Reunião de Ritmo/FCA N1/FCA N2)
// — mesmo padrão visual de badge numerado do "Cronograma de Elaboração" em
// UnifiedAdministrationView.tsx, só que horizontal/compacto pra caber no topo da tela. Todo passo
// é clicável a qualquer momento (não é sequencial) — se ainda não foi feito, o clique navega direto;
// se já foi feito, pergunta se o usuário quer revisar (mesma navegação) ou resetar (desfazer).
const OtbProgressTimeline: React.FC<OtbProgressTimelineProps> = ({ completed, onStepClick, onStepReset, resettableSteps, title }) => {
    const [confirmIndex, setConfirmIndex] = useState<number | null>(null);
    const doneCount = completed.filter(Boolean).length;

    const handleBadgeClick = (idx: number) => {
        const done = !!completed[idx];
        const offersChoice = done && (!resettableSteps || resettableSteps.includes(idx));
        if (offersChoice) {
            setConfirmIndex(idx);
        } else {
            onStepClick?.(idx);
        }
    };

    return (
        <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-1 overflow-x-auto py-2 flex-1">
                {OTB_STEP_LABELS.map((label, idx) => {
                    const done = !!completed[idx];
                    const isLast = idx === OTB_STEP_LABELS.length - 1;
                    return (
                        <React.Fragment key={idx}>
                            <button
                                type="button"
                                onClick={() => handleBadgeClick(idx)}
                                className="flex flex-col items-center gap-1 w-20 shrink-0 group"
                                title={`${label} (clique para editar/refazer)`}
                            >
                                <div
                                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors group-hover:border-indigo-400 ${
                                        done
                                            ? 'bg-emerald-500 border-emerald-500 text-white'
                                            : 'bg-white border-gray-300 text-gray-500'
                                    }`}
                                >
                                    {done ? <Check size={16} /> : idx + 1}
                                </div>
                                <span className={`text-[10px] text-center leading-tight ${done ? 'text-emerald-700 font-bold' : 'text-gray-500'}`}>
                                    {label}
                                </span>
                            </button>
                            {!isLast && (
                                <div className={`h-0.5 flex-1 mt-4 min-w-[8px] ${done ? 'bg-emerald-400' : 'bg-gray-200'}`} />
                            )}
                        </React.Fragment>
                    );
                })}
            </div>
            {title && (
                <div className="shrink-0 text-right pl-3 border-l border-gray-200">
                    <div className="text-sm font-bold text-gray-700">{title}</div>
                    <div className="text-xs text-gray-400">{doneCount}/{OTB_STEP_LABELS.length} concluído</div>
                </div>
            )}

            {confirmIndex !== null && (
                <div
                    className="fixed inset-0 bg-black/40 z-[200] flex items-center justify-center"
                    onClick={() => setConfirmIndex(null)}
                >
                    <div
                        className="bg-white rounded-xl shadow-2xl p-5 w-80"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <p className="text-xs font-bold text-emerald-600 uppercase tracking-wide mb-1">Etapa {confirmIndex + 1}</p>
                        <p className="font-bold text-gray-800 mb-3">{OTB_STEP_LABELS[confirmIndex]}</p>
                        <p className="text-sm text-gray-500 mb-4">Qual ação deseja realizar?</p>
                        <div className="flex flex-col gap-2">
                            <button
                                type="button"
                                onClick={() => { onStepClick?.(confirmIndex); setConfirmIndex(null); }}
                                className="w-full px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-colors"
                            >
                                Revisar etapa
                            </button>
                            <button
                                type="button"
                                onClick={() => { onStepReset?.(confirmIndex); setConfirmIndex(null); }}
                                className="w-full px-4 py-2 rounded-lg bg-red-50 text-red-600 border border-red-200 text-sm font-bold hover:bg-red-100 transition-colors"
                            >
                                Resetar etapa
                            </button>
                            <button
                                type="button"
                                onClick={() => setConfirmIndex(null)}
                                className="w-full px-4 py-1 text-xs text-gray-400 hover:text-gray-600"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OtbProgressTimeline;
