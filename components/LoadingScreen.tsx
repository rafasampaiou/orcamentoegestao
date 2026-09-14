import React from 'react';
import { TrendingUp } from 'lucide-react';

interface LoadingScreenProps {
    // 0-100 — quantas das buscas iniciais no Supabase já terminaram (ver App.tsx, fetchRealData).
    progress?: number;
}

// Tela de carregamento inicial (dados do Supabase ainda não chegaram) — antes disso a tela
// aparecia com tudo zerado por alguns segundos até os dados chegarem. Reaproveita o mesmo ícone
// TrendingUp usado na marca do Sidebar, "enchendo" de baixo pra cima (2 cópias sobrepostas: uma
// esmaecida fixa, outra verde revelada por uma altura em cima da mesma posição) — a altura
// preenchida é o `progress` de verdade (App.tsx, fetchRealData), não mais um loop decorativo sem
// relação nenhuma com o carregamento de fato.
const LoadingScreen: React.FC<LoadingScreenProps> = ({ progress = 0 }) => {
    const clampedProgress = Math.max(0, Math.min(100, Math.round(progress)));
    return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-6" style={{ background: '#155645' }}>
            <div style={{ position: 'relative', width: 96, height: 96 }}>
                <TrendingUp
                    size={96}
                    strokeWidth={1.75}
                    style={{ position: 'absolute', inset: 0, color: 'rgba(255,255,255,0.18)' }}
                />
                <div
                    style={{
                        position: 'absolute', left: 0, right: 0, bottom: 0, overflow: 'hidden',
                        height: `${clampedProgress}%`, transition: 'height 0.3s ease-out'
                    }}
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
                <p className="text-[#4ADE80] font-black text-2xl tabular-nums">{clampedProgress}%</p>
                <p className="text-white/40 text-xs">Isso pode levar alguns segundos</p>
            </div>
        </div>
    );
};

export default LoadingScreen;
