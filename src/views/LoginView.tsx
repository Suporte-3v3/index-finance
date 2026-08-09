/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useBPOState } from '../hooks/useBPOState';
import { ACCESS_PASSWORD } from '../services/mockData';
import idexLogo from '../../assets/idex-finance-logo-transparent.png';
import { Button, IconButton } from '../components/ui';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  AlertCircle,
  ShieldCheck,
  UserRound,
  Calculator,
  Store,
  Sun,
  Moon,
} from 'lucide-react';

// Contas de demonstração exibidas como atalhos na tela de login — uma por
// perfil relevante (o CLIENT tem duas: acesso completo e Operador do
// cliente, já que se comportam de forma bem diferente no app).
const QUICK_LOGIN_PROFILES: Array<{
  email: string;
  label: string;
  icon: typeof ShieldCheck;
}> = [
  { email: 'admin@idexfinance.com.br', label: 'Administrador BPO', icon: ShieldCheck },
  { email: 'nayltonnobre@gmail.com', label: 'Cliente (Acesso completo)', icon: UserRound },
  { email: 'bruna.alfa@exemplo.com.br', label: 'Cliente (Operador)', icon: Store },
  { email: 'contador@idexfinance.com.br', label: 'Contador', icon: Calculator },
];

interface LoginViewProps {
  theme: { isDarkMode: boolean; toggleTheme: () => void };
}

export default function LoginView({ theme }: LoginViewProps) {
  const { login, users } = useBPOState();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const performLogin = (targetEmail: string, targetPassword: string) => {
    setError(null);
    setIsSubmitting(true);

    setTimeout(() => {
      const result = login(targetEmail, targetPassword);
      if (!result.success) {
        setError(result.error || 'Não foi possível entrar. Tente novamente.');
        setIsSubmitting(false);
      }
    }, 400);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Informe e-mail e senha para continuar.');
      return;
    }
    performLogin(email, password);
  };

  const handleProfileLogin = (targetEmail: string) => {
    setEmail(targetEmail);
    setPassword(ACCESS_PASSWORD);
    performLogin(targetEmail, ACCESS_PASSWORD);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-brand-navy-950 font-sans text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_12%,#174E83_0%,#0B2C52_28%,#061425_68%)]" />
      <div className="pointer-events-none absolute -left-36 top-1/3 h-80 w-80 rounded-full border border-white/5" />
      <div className="pointer-events-none absolute -right-40 bottom-8 h-96 w-96 rounded-full border border-brand-gold-300/10" />

      <IconButton
        icon={theme.isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        label={theme.isDarkMode ? 'Usar tema claro' : 'Usar tema escuro'}
        variant="ghost"
        onClick={theme.toggleTheme}
        className="absolute right-4 top-4 z-20 text-white/70 hover:bg-white/10 hover:text-white sm:right-6 sm:top-6"
      />

      <main className="relative z-10 flex min-h-screen w-full flex-col items-center justify-center px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex w-full max-w-md flex-col items-center gap-4 sm:gap-5">
          <img
            src={idexLogo}
            alt="Idex Finance — Gestão que move resultados"
            className="w-36 object-contain drop-shadow-[0_10px_24px_rgba(0,0,0,0.28)] sm:w-44"
          />

          <section className="w-full rounded-3xl border border-white/70 bg-white p-5 text-ink shadow-[0_24px_70px_rgba(0,0,0,0.35)] sm:p-7">
            <div className="mb-5 space-y-1.5 text-center">
              <h1 className="text-2xl font-black tracking-tight text-brand-navy-950">
                Entrar na sua conta
              </h1>
              <p className="text-xs text-ink-soft">
                Acesse o workspace com seu e-mail e senha.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="login-email" className="block text-[11px] font-bold uppercase tracking-wide text-ink-soft">
                  E-mail
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
                  <input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="voce@empresa.com.br"
                    className="h-11 w-full rounded-xl border border-line bg-canvas pl-9 pr-3 text-sm text-ink outline-none transition placeholder:text-ink-soft/60 focus:border-brand-navy-700 focus:bg-white focus:ring-4 focus:ring-brand-navy-700/10"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="login-password" className="block text-[11px] font-bold uppercase tracking-wide text-ink-soft">
                  Senha
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-11 w-full rounded-xl border border-line bg-canvas pl-9 pr-10 text-sm text-ink outline-none transition placeholder:text-ink-soft/60 focus:border-brand-navy-700 focus:bg-white focus:ring-4 focus:ring-brand-navy-700/10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-ink-soft transition-colors hover:text-ink"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-brand-red-600/30 bg-brand-red-50 px-3 py-2.5 text-xs font-semibold text-brand-red-600">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                variant="secondary"
                size="lg"
                fullWidth
                loading={isSubmitting}
                icon={<LogIn className="h-4 w-4" />}
                className="rounded-xl"
              >
                {isSubmitting ? 'Entrando...' : 'Entrar'}
              </Button>
            </form>

            <div className="mt-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-px grow bg-line" />
                <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-ink-soft">
                  Perfis de demonstração
                </span>
                <div className="h-px grow bg-line" />
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {QUICK_LOGIN_PROFILES.map(profile => {
                  const user = users.find(u => u.email === profile.email);
                  if (!user) return null;
                  const Icon = profile.icon;
                  return (
                    <button
                      key={user.id}
                      type="button"
                      disabled={isSubmitting || user.status !== 'ACTIVE'}
                      onClick={() => handleProfileLogin(user.email)}
                      className="flex min-h-16 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-line bg-canvas px-2 py-2.5 text-center transition hover:border-brand-navy-700/40 hover:bg-brand-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
                      title={`Entrar como ${user.name}`}
                    >
                      <Icon className="h-4 w-4 text-brand-navy-900" />
                      <span className="text-[9px] font-bold leading-tight text-ink">{profile.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <div className="max-w-sm text-center">
            <div className="mx-auto mb-2 h-0.5 w-10 rounded-full bg-brand-red-600" />
            <p className="text-sm font-bold leading-snug text-white sm:text-base">
              O BPO Financeiro completo para sua operação multiempresas.
            </p>
          </div>

          <footer className="text-center text-[9px] font-semibold leading-relaxed text-brand-gold-300/55">
            <p>© {new Date().getFullYear()} Idex Finance · Desenvolvido por <span className="text-brand-gold-300/80">NFlow Analytics</span></p>
          </footer>
        </div>
      </main>
    </div>
  );
}
