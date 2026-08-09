/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useBPOState } from '../hooks/useBPOState';
import { ACCESS_PASSWORD } from '../services/mockData';
import idexLogo from '../../assets/idex-finance-logo-transparent.png';
import { Button, IconButton, TextField } from '../components/ui';
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
    <div className="min-h-screen flex font-sans bg-canvas dark:bg-canvas-dark text-ink dark:text-ink-dark">
      {/* Left Brand Panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-brand-navy-950 relative overflow-hidden items-center justify-center p-12">
        <div className="absolute inset-0 opacity-15 bg-[radial-gradient(circle_at_50%_38%,#0B2C52,transparent_55%)]" />

        <div className="relative w-full max-w-lg flex flex-col items-center text-center">
          <img
            src={idexLogo}
            alt="Idex Finance — Gestão que move resultados"
            className="w-64 max-w-full object-contain"
          />
          <div className="w-12 h-0.5 bg-brand-red-600 mt-5 mb-6 rounded-full" />
          <h2 className="text-3xl font-black text-white leading-tight max-w-md">
            O BPO Financeiro completo para sua operação multiempresas.
          </h2>
          <p className="text-sm text-brand-gold-300/80 leading-relaxed max-w-md mt-4">
            Contas a pagar e receber, conciliação bancária, aprovações e conformidade em um único workspace, com controle de acesso por perfil.
          </p>
        </div>

        <div className="absolute bottom-8 left-0 right-0 text-center text-[10px] text-brand-gold-300/50 font-semibold space-y-1">
          <p>© {new Date().getFullYear()} Idex Finance.</p>
          <p>Desenvolvido por <span className="text-brand-gold-300/80 font-bold">NFlow Analytics</span></p>
        </div>
      </div>

      {/* Right Form Panel */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 relative">
        <IconButton
          icon={theme.isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          label={theme.isDarkMode ? 'Usar tema claro' : 'Usar tema escuro'}
          variant="ghost"
          onClick={theme.toggleTheme}
          className="absolute top-4 right-4 sm:top-6 sm:right-6"
        />

        <div className="w-full max-w-sm space-y-6">

          {/* Mobile brand header */}
          <div className="lg:hidden flex justify-center">
            <img src={idexLogo} alt="Idex Finance" className="h-20 w-40 object-contain" />
          </div>

          <div className="space-y-1.5 text-center lg:text-left">
            <h2 className="text-2xl font-black text-ink dark:text-ink-dark">Entrar na sua conta</h2>
            <p className="text-xs text-ink-soft dark:text-ink-soft-dark">Acesse o workspace com seu e-mail e senha.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <TextField
              label="E-mail"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@empresa.com.br"
              icon={<Mail className="h-4 w-4" />}
            />

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wide block">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-soft dark:text-ink-soft-dark" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-10 bg-surface dark:bg-surface-dark border border-line dark:border-line-dark text-ink dark:text-ink-dark text-sm pl-9 pr-9 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-navy-700/25 focus:border-brand-navy-700 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft dark:text-ink-soft-dark hover:text-ink dark:hover:text-ink-dark cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-brand-red-50 dark:bg-brand-red-600/10 border border-brand-red-600/30 text-brand-red-600 dark:text-red-300 text-xs font-semibold rounded-lg px-3 py-2.5">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
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
            >
              {isSubmitting ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-px bg-line dark:bg-line-dark grow" />
              <span className="text-[10px] font-bold text-ink-soft dark:text-ink-soft-dark uppercase tracking-wider">Selecionar perfil de acesso</span>
              <div className="h-px bg-line dark:bg-line-dark grow" />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
                    className="flex flex-col items-center gap-1.5 border border-line dark:border-line-dark hover:border-brand-navy-700/50 hover:bg-brand-blue-50 dark:hover:bg-white/5 disabled:opacity-60 rounded-lg px-2 py-3 text-center transition-colors cursor-pointer"
                    title={`Entrar como ${user.name}`}
                  >
                    <Icon className="h-4.5 w-4.5 text-brand-navy-900 dark:text-brand-gold-300" />
                    <span className="text-[10px] font-bold text-ink dark:text-ink-dark leading-tight">{profile.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <p className="lg:hidden text-center text-[9px] text-ink-soft dark:text-ink-soft-dark">
            Desenvolvido por <span className="font-bold text-brand-navy-900 dark:text-brand-gold-300">NFlow Analytics</span>
          </p>

        </div>
      </div>
    </div>
  );
}
