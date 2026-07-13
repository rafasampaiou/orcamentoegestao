import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { supabaseService } from '../services/supabaseService';
import { Lock, Loader2, KeyRound, CheckCircle2 } from 'lucide-react';

interface DefinePasswordViewProps {
  onDone: () => void;
}

const DefinePasswordView: React.FC<DefinePasswordViewProps> = ({ onDone }) => {
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabaseService.markProfileValidated(user.id);
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Erro ao definir a senha. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden font-['Outfit',sans-serif]"
      style={{ backgroundColor: '#ffffff' }}
    >
      <div
        className="absolute top-[-15%] left-[-10%] w-[50%] h-[50%] rounded-full animate-pulse"
        style={{ background: 'radial-gradient(circle, rgba(21,86,69,0.08) 0%, transparent 70%)', filter: 'blur(80px)' }}
      />
      <div
        className="absolute bottom-[-15%] right-[-10%] w-[45%] h-[45%] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(21,86,69,0.05) 0%, transparent 70%)', filter: 'blur(100px)', animation: 'pulse 4s ease-in-out infinite 1.5s' }}
      />

      <div
        className="relative z-10 w-full max-w-md mx-4 p-9 rounded-[2rem] shadow-2xl border"
        style={{
          background: 'linear-gradient(135deg, #155645 0%, #0c3d30 50%, #000000 100%)',
          borderColor: 'rgba(21, 86, 69, 0.4)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 40px rgba(21, 86, 69, 0.15)'
        }}
      >
        <div className="text-center mb-10">
          <div
            className="inline-flex p-4 rounded-2xl mb-6 border"
            style={{
              background: 'rgba(248, 152, 28, 0.15)',
              borderColor: 'rgba(248,152,28,0.35)',
              boxShadow: '0 0 24px rgba(248,152,28,0.25)'
            }}
          >
            <KeyRound className="w-10 h-10" style={{ color: '#F8981C' }} />
          </div>

          <h1 className="text-3xl font-extrabold text-white tracking-tight leading-tight mb-2">
            Defina sua senha
          </h1>

          <p className="text-sm font-medium mt-1" style={{ color: '#ffffff' }}>
            {success ? 'Senha definida com sucesso!' : 'Crie a senha que você vai usar para acessar o sistema.'}
          </p>
        </div>

        {success ? (
          <div className="space-y-5">
            <div className="p-4 rounded-2xl border flex items-center gap-3" style={{ background: 'rgba(74,222,128,0.08)', borderColor: 'rgba(74,222,128,0.25)' }}>
              <CheckCircle2 className="w-6 h-6 shrink-0" style={{ color: '#4ade80' }} />
              <p className="text-sm text-emerald-200 font-medium">Sua senha foi definida. Você já pode continuar.</p>
            </div>
            <button
              type="button"
              onClick={onDone}
              className="w-full relative overflow-hidden py-4 rounded-2xl text-white font-bold text-lg transition-all active:scale-95"
              style={{ background: 'linear-gradient(135deg, #155645 0%, #1a7a5e 100%)', boxShadow: '0 8px 32px rgba(21,86,69,0.5), 0 0 0 1px rgba(74,222,128,0.2)' }}
            >
              Entrar no sistema
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-widest ml-1" style={{ color: '#ffffff' }}>
                Nova senha
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="w-5 h-5" style={{ color: '#ffffff' }} />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-12 pr-4 py-4 rounded-2xl text-white transition-all outline-none"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(21,86,69,0.5)' }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(74,222,128,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(74,222,128,0.1)'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'rgba(21,86,69,0.5)'; e.currentTarget.style.boxShadow = 'none'; }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-widest ml-1" style={{ color: '#ffffff' }}>
                Confirmar senha
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="w-5 h-5" style={{ color: '#ffffff' }} />
                </div>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-12 pr-4 py-4 rounded-2xl text-white transition-all outline-none"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(21,86,69,0.5)' }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(74,222,128,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(74,222,128,0.1)'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'rgba(21,86,69,0.5)'; e.currentTarget.style.boxShadow = 'none'; }}
                />
              </div>
            </div>

            {error && (
              <div className="p-4 rounded-2xl border" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)' }}>
                <p className="text-sm text-red-400 text-center font-medium">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full relative overflow-hidden py-4 rounded-2xl text-white font-bold text-lg transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 mt-2"
              style={{
                background: loading ? '#155645' : 'linear-gradient(135deg, #155645 0%, #1a7a5e 100%)',
                boxShadow: '0 8px 32px rgba(21,86,69,0.5), 0 0 0 1px rgba(74,222,128,0.2)'
              }}
            >
              <div className="flex items-center justify-center gap-2">
                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <span>Salvar senha</span>}
              </div>
            </button>
          </form>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap');
        input::placeholder { color: rgba(255,255,255,0.7); }
      ` }} />
    </div>
  );
};

export default DefinePasswordView;
