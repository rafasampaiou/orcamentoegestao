import React from 'react';
import { Check } from 'lucide-react';

interface RealizadoProgressTimelineProps {
    occupancyDone: boolean;
    expensesDone: boolean;
    onClickOccupancy: () => void;
    onClickExpenses: () => void;
    // Hotéis Administradora não têm ocupação própria — oculta o item "Inserir ocupação".
    hideOccupancy?: boolean;
    title?: string;
}

// "Status de fechamento" da versão Realizado — mesmo estilo visual de badge numerado/linha
// conectora do <OtbProgressTimeline>, mas com só 2 itens e sem os modais de Revisar/Resetar (aqui
// o clique sempre só navega; não há nada pra "desfazer" — o passo se torna concluído sozinho
// quando o dado correspondente existe, não é uma flag manual).
const RealizadoProgressTimeline: React.FC<RealizadoProgressTimelineProps> = ({
    occupancyDone,
    expensesDone,
    onClickOccupancy,
    onClickExpenses,
    hideOccupancy,
    title,
}) => {
    const steps = [
        ...(hideOccupancy ? [] : [{ label: 'Inserir ocupação', done: occupancyDone, onClick: onClickOccupancy }]),
        { label: 'Inserir despesas', done: expensesDone, onClick: onClickExpenses },
    ];
    const doneCount = steps.filter(s => s.done).length;

    return (
        <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-1 overflow-x-auto py-2 flex-1">
                {steps.map((step, idx) => {
                    const isLast = idx === steps.length - 1;
                    return (
                        <React.Fragment key={step.label}>
                            <button
                                type="button"
                                onClick={step.onClick}
                                className="flex flex-col items-center gap-1 w-24 shrink-0 group"
                                title={`${step.label} (clique para ir até lá)`}
                            >
                                <div
                                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors group-hover:border-indigo-400 ${
                                        step.done
                                            ? 'bg-emerald-500 border-emerald-500 text-white'
                                            : 'bg-white border-gray-300 text-gray-500'
                                    }`}
                                >
                                    {step.done ? <Check size={16} /> : idx + 1}
                                </div>
                                <span className={`text-[10px] text-center leading-tight ${step.done ? 'text-emerald-700 font-bold' : 'text-gray-500'}`}>
                                    {step.label}
                                </span>
                            </button>
                            {!isLast && (
                                <div className={`h-0.5 flex-1 mt-4 min-w-[8px] ${step.done ? 'bg-emerald-400' : 'bg-gray-200'}`} />
                            )}
                        </React.Fragment>
                    );
                })}
            </div>
            {title && (
                <div className="shrink-0 text-right pl-3 border-l border-gray-200">
                    <div className="text-sm font-bold text-gray-700">{title}</div>
                    <div className="text-xs text-gray-400">{doneCount}/{steps.length} concluído</div>
                </div>
            )}
        </div>
    );
};

export default RealizadoProgressTimeline;
