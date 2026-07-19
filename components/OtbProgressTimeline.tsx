import React from 'react';
import { Check } from 'lucide-react';
import { OTB_STEP_LABELS } from '../utils/otbProgress';

interface OtbProgressTimelineProps {
    completed: boolean[];
    onStepClick?: (index: number) => void;
}

// Checklist compacto dos 8 passos de montagem de uma projeção (Reunião de Ritmo/FCA N1/FCA N2)
// — mesmo padrão visual de badge numerado do "Cronograma de Elaboração" em
// UnifiedAdministrationView.tsx, só que horizontal/compacto pra caber no topo da tela.
const OtbProgressTimeline: React.FC<OtbProgressTimelineProps> = ({ completed, onStepClick }) => {
    return (
        <div className="flex items-start gap-1 overflow-x-auto py-2">
            {OTB_STEP_LABELS.map((label, idx) => {
                const done = !!completed[idx];
                const isLast = idx === OTB_STEP_LABELS.length - 1;
                return (
                    <React.Fragment key={idx}>
                        <button
                            type="button"
                            onClick={() => onStepClick?.(idx)}
                            className="flex flex-col items-center gap-1 w-20 shrink-0 group"
                            title={label}
                        >
                            <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                                    done
                                        ? 'bg-emerald-500 border-emerald-500 text-white'
                                        : 'bg-white border-gray-300 text-gray-500 group-hover:border-indigo-300'
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
    );
};

export default OtbProgressTimeline;
