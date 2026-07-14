import React, { useState } from 'react';
import { supabase, SITE_URL } from '../services/supabaseClient';
import { LogIn, Mail, Lock, Loader2, TrendingUp } from 'lucide-react';

const Auth: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message || 'Erro ao autenticar. Verifique suas credenciais.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: SITE_URL,
          // Restricts Google's account picker to the company Workspace domain — a UX hint,
          // not a security boundary; access is still gated by the profiles-lookup in App.tsx.
          queryParams: { hd: 'taua.com.br', prompt: 'select_account' }
        }
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message || 'Erro ao autenticar com o Google.');
      setGoogleLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden font-['Outfit',sans-serif]"
      style={{ backgroundColor: '#ffffff' }}
    >
      {/* Animated glow orbs */}
      <div
        className="absolute top-[-15%] left-[-10%] w-[50%] h-[50%] rounded-full animate-pulse"
        style={{ background: 'radial-gradient(circle, rgba(21,86,69,0.08) 0%, transparent 70%)', filter: 'blur(80px)' }}
      />
      <div
        className="absolute bottom-[-15%] right-[-10%] w-[45%] h-[45%] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(21,86,69,0.05) 0%, transparent 70%)', filter: 'blur(100px)', animation: 'pulse 4s ease-in-out infinite 1.5s' }}
      />
      <div
        className="absolute top-[40%] right-[20%] w-[25%] h-[25%] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(248,152,28,0.05) 0%, transparent 70%)', filter: 'blur(60px)', animation: 'pulse 6s ease-in-out infinite 3s' }}
      />

      {/* Grid overlay removed */}

      {/* Card */}
      <div
        className="relative z-10 w-full max-w-md mx-4 p-9 rounded-[2rem] shadow-2xl border"
        style={{
          background: 'linear-gradient(135deg, #155645 0%, #0c3d30 50%, #000000 100%)',
          borderColor: 'rgba(21, 86, 69, 0.4)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 40px rgba(21, 86, 69, 0.15)'
        }}
      >
        {/* Logo & Title */}
        <div className="text-center mb-10">
          <div
            className="inline-flex p-4 rounded-2xl mb-6 border"
            style={{
              background: 'rgba(248, 152, 28, 0.15)',
              borderColor: 'rgba(248,152,28,0.35)',
              boxShadow: '0 0 24px rgba(248,152,28,0.25)'
            }}
          >
            <TrendingUp className="w-10 h-10" style={{ color: '#F8981C' }} />
          </div>

          <h1 className="text-4xl font-extrabold text-white tracking-tight leading-tight mb-2">
            Forecast{' '}
            <span style={{ color: '#F8981C' }}>&amp;</span>{' '}
            <span style={{ color: '#F8981C' }}>
              Budget
            </span>
          </h1>

          <p className="text-sm font-medium mt-1" style={{ color: '#ffffff' }}>
            Acesso Restrito · Controle Orçamentário
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleAuth} className="space-y-5">
          {/* Email */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-widest ml-1" style={{ color: '#ffffff' }}>
              E-mail Corporativo
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Mail className="w-5 h-5 transition-colors" style={{ color: '#ffffff' }} />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@empresa.com.br"
                className="block w-full pl-12 pr-4 py-4 rounded-2xl text-white transition-all outline-none"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(21,86,69,0.5)'
                }}
                onFocus={e => { e.currentTarget.style.borderColor = 'rgba(74,222,128,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(74,222,128,0.1)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = 'rgba(21,86,69,0.5)'; e.currentTarget.style.boxShadow = 'none'; }}
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-widest ml-1" style={{ color: '#ffffff' }}>
              Senha
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock className="w-5 h-5 transition-colors" style={{ color: '#ffffff' }} />
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="block w-full pl-12 pr-4 py-4 rounded-2xl text-white transition-all outline-none"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(21,86,69,0.5)',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = 'rgba(74,222,128,0.5)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(74,222,128,0.1)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = 'rgba(21,86,69,0.5)'; e.currentTarget.style.boxShadow = 'none'; }}
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="p-4 rounded-2xl border" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)' }}>
              <p className="text-sm text-red-400 text-center font-medium">{error}</p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full relative overflow-hidden py-4 rounded-2xl text-white font-bold text-lg transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 mt-2"
            style={{
              background: loading ? '#155645' : 'linear-gradient(135deg, #155645 0%, #1a7a5e 100%)',
              boxShadow: '0 8px 32px rgba(21,86,69,0.5), 0 0 0 1px rgba(74,222,128,0.2)'
            }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.background = 'linear-gradient(135deg, #1a7a5e 0%, #22c55e 100%)'; }}
            onMouseLeave={e => { if (!loading) e.currentTarget.style.background = 'linear-gradient(135deg, #155645 0%, #1a7a5e 100%)'; }}
          >
            <div className="flex items-center justify-center gap-2">
              {loading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  <LogIn className="w-6 h-6" />
                  <span>Entrar</span>
                </>
              )}
            </div>
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.15)' }} />
          <span className="text-xs font-semibold uppercase" style={{ color: 'rgba(255,255,255,0.5)' }}>ou</span>
          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.15)' }} />
        </div>

        {/* Google Sign-in */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={googleLoading}
          className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-bold text-base transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100"
          style={{ background: '#ffffff', color: '#1f2937' }}
        >
          {googleLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47c-.28 1.5-1.13 2.78-2.4 3.63v3.02h3.89c2.27-2.09 3.58-5.17 3.58-8.84z" />
                <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.9l-3.89-3.02c-1.08.72-2.46 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.94H1.27v3.11C3.25 21.3 7.31 24 12 24z" />
                <path fill="#FBBC05" d="M5.29 14.29c-.24-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.6H1.27C.46 8.24 0 10.06 0 12s.46 3.76 1.27 5.4l4.02-3.11z" />
                <path fill="#EA4335" d="M12 4.77c1.76 0 3.35.61 4.6 1.8l3.45-3.45C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.7 1.27 6.6l4.02 3.11C6.23 6.88 8.88 4.77 12 4.77z" />
              </svg>
              <span>Entrar com Google</span>
            </>
          )}
        </button>

        {/* Footer */}
        <div className="mt-8 text-center pt-7" style={{ borderTop: '1px solid rgba(21,86,69,0.4)' }}>
          <p className="text-xs italic" style={{ color: '#ffffff' }}>
            Contate o administrador para solicitar acesso.
          </p>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap');
        input::placeholder { color: rgba(255,255,255,0.7); }
      ` }} />
    </div>
  );
};

export default Auth;
