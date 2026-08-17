import React, { useState } from 'react';
import { MeetingKind } from '../types';

interface CreateMeetingModalProps {
    onClose: () => void;
    onCreate: (meetingDate: string, kind: MeetingKind) => void;
}

const FIXED_KIND_OPTIONS: { value: MeetingKind; label: string }[] = [
    { value: 'Reunião de Ritmo', label: 'Reunião de Ritmo' },
    { value: 'FCA N2', label: 'FCA N2' },
    { value: 'FCA N1', label: 'FCA N1' },
    { value: 'Fechamento', label: 'Fechamento' },
];

// Formata 'YYYY-MM-DD' (valor de <input type="date">) como "05/03/2026" sem passar por Date()
// direto — new Date('2026-03-05') é interpretado em UTC e pode "voltar" um dia conforme o fuso.
const formatDateBR = (isoDate: string): string => {
    const [y, m, d] = isoDate.split('-');
    return `${d}/${m}/${y}`;
};

// Data de hoje em 'YYYY-MM-DD', em horário LOCAL (não UTC) — usada só pra pré-preencher o campo
// de data já com o ano atual, poupando o usuário de digitar os 4 dígitos toda vez; ele ajusta só
// o dia/mês se a reunião não for hoje.
const todayIso = (): string => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

const CreateMeetingModal: React.FC<CreateMeetingModalProps> = ({ onClose, onCreate }) => {
    const [meetingDate, setMeetingDate] = useState(todayIso());
    const [kind, setKind] = useState<MeetingKind | ''>('');

    const previaLabel = meetingDate ? `Prévia de ${formatDateBR(meetingDate)}` : 'Prévia (escolha uma data primeiro)';

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!meetingDate || !kind) {
            alert('Escolha a data e o nome da reunião.');
            return;
        }
        onCreate(meetingDate, kind);
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                    <h3 className="text-lg font-medium text-gray-900">Nova Reunião</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Qual será a data da reunião?
                        </label>
                        <input
                            type="date"
                            value={meetingDate}
                            onChange={(e) => setMeetingDate(e.target.value)}
                            className="w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-[#38b2ac] focus:border-[#38b2ac]"
                            required
                            autoFocus
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                            Qual o nome da reunião?
                        </label>
                        <div className="space-y-2">
                            {[...FIXED_KIND_OPTIONS, { value: 'Prévia' as MeetingKind, label: previaLabel }].map(opt => (
                                <label
                                    key={opt.value}
                                    className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${kind === opt.value ? 'border-teal-500 bg-teal-50' : 'border-gray-200'}`}
                                >
                                    <input
                                        type="radio"
                                        name="meetingKind"
                                        value={opt.value}
                                        checked={kind === opt.value}
                                        onChange={() => setKind(opt.value)}
                                        className="text-[#38b2ac] focus:ring-[#38b2ac]"
                                    />
                                    <span className="font-medium text-gray-900">{opt.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 text-sm font-medium text-white bg-[#38b2ac] rounded-md hover:bg-[#319795]"
                        >
                            Criar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateMeetingModal;
