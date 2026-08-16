import React from 'react';
import { TrendingUp } from 'lucide-react';

// Tela de carregamento inicial (dados do Supabase ainda não chegaram) — antes disso a tela
// aparecia com tudo zerado por alguns segundos até os dados chegarem. Reaproveita o mesmo ícone
// TrendingUp usado na marca do Sidebar, "enchendo" de baixo pra cima (2 cópias sobrepostas: uma
// esmaecida fixa, outra verde revelada por uma altura animada em cima da mesma posição).
const LoadingScreen: React.FC = () => {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-6" style={{ background: '#155645' }}>
            <div style={{ position: 'relative', width: 96, height: 96 }}>
                <TrendingUp
                    size={96}
                    strokeWidth={1.75}
                    style={{ position: 'absolute', inset: 0, color: 'rgba(255,255,255,0.18)' }}
                />
                <div
                    className="loading-arrow-fill"
                    style={{ position: 'absolute', left: 0, right: 0, bottom: 0, overflow: 'hidden', height: '0%' }}
                >
                    <TrendingUp
                        size={96}
                        strokeWidth={2.25}
                        style={{ position: 'absolute', bottom: 0, left: 0, color: '#4ADE80', filter: 'drop-shadow(0 0 6px rgba(74,222,128,0.55))' }}
                    />
                </div>
            </div>
            <div className="flex flex-col items-center gap-1.5">
                <p className="text-white font-black text-sm uppercase tracking-widest">Carregando dados</p>
                <p className="text-white/40 text-xs">Isso pode levar alguns segundos</p>
            </div>
            <style>{`
                @keyframes loadingArrowFill {
                    0% { height: 0%; }
                    55% { height: 100%; }
                    100% { height: 0%; }
                }
                .loading-arrow-fill {
                    animation: loadingArrowFill 2.2s ease-in-out infinite;
                }
            `}</style>
        </div>
    );
};

export default LoadingScreen;
