import React from 'react';
import { TrendingUp } from 'lucide-react';

interface LoadingPanelProps {
    label?: string;
    className?: string;
    minHeight?: number | string;
}

// Versão pequena/inline da LoadingScreen (tela de boot) — um card com cantos arredondados e a
// mesma seta "enchendo", pra usar DENTRO de uma aba específica enquanto ela busca seus próprios
// dados (ex.: Análise de A&B), em vez da tela cheia usada só no carregamento inicial do app.
const LoadingPanel: React.FC<LoadingPanelProps> = ({ label = 'Carregando dados...', className = '', minHeight = 240 }) => {
    return (
        <div
            className={`flex flex-col items-center justify-center gap-3 rounded-2xl bg-white border border-gray-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] ${className}`}
            style={{ minHeight }}
        >
            <div style={{ position: 'relative', width: 48, height: 48 }}>
                <TrendingUp size={48} strokeWidth={2} style={{ position: 'absolute', inset: 0, color: 'rgba(21,86,69,0.15)' }} />
                <div
                    className="loading-panel-fill"
                    style={{ position: 'absolute', left: 0, right: 0, bottom: 0, overflow: 'hidden', height: '0%' }}
                >
                    <TrendingUp size={48} strokeWidth={2.5} style={{ position: 'absolute', bottom: 0, left: 0, color: '#15803d' }} />
                </div>
            </div>
            <p className="text-gray-400 text-xs font-bold uppercase tracking-wide">{label}</p>
            <style>{`
                @keyframes loadingPanelFill {
                    0% { height: 0%; }
                    55% { height: 100%; }
                    100% { height: 0%; }
                }
                .loading-panel-fill {
                    animation: loadingPanelFill 2.2s ease-in-out infinite;
                }
            `}</style>
        </div>
    );
};

export default LoadingPanel;
