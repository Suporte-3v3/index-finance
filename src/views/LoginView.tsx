/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useBPOState } from '../hooks/useBPOState';
import { DEMO_PASSWORD } from '../services/mockData';
import {
  LayoutDashboard,
  Mail,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  Loader2,
  AlertCircle,
  Building2,
  UserRound,
  Calculator,
  ShieldCheck
} from 'lucide-react';

interface DemoProfile {
  id: string;
  label: string;
  description: string;
  email: string;
  icon: React.ComponentType<{ className?: string }>;
}

const DEMO_PROFILES: DemoProfile[] = [
  {
    id: 'bpo',
    label: 'Equipe BPO',
    description: 'Operação, aprovações e controle geral',
    email: 'anapaula.bpo@exemplo.com.br',
    icon: ShieldCheck,
  },
  {
    id: 'client',
    label: 'Cliente',
    description: 'Visão financeira da empresa contratante',
    email: 'nayltonnobre@gmail.com',
    icon: UserRound,
  },
  {
    id: 'accountant',
    label: 'Contador',
    description: 'Acesso a documentos e relatórios fiscais',
    email: 'silva.contabil@exemplo.com.br',
    icon: Calculator,
  },
];

export default function LoginView() {
  const { login } = useBPOState();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const performLogin = (targetEmail: string, targetPassword: string) => {
    setError(null);
    setIsSubmitting(true);

    // Simulate a brief network round-trip for realism.
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

  const handleDemoProfile = (profile: DemoProfile) => {
    setEmail(profile.email);
    setPassword(DEMO_PASSWORD);
    performLogin(profile.email, DEMO_PASSWORD);
  };

  return (
    <div className="min-h-screen flex font-sans bg-zinc-50">
      {/* Left Brand Panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#00304c] relative overflow-hidden flex-col justify-between p-12">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_20%_20%,white,transparent_35%)]" />
        <div className="relative flex items-center gap-3">
          <div className="p-2.5 bg-[#d20010] text-white rounded-xl shadow-lg">
            <LayoutDashboard className="h-6 w-6 text-[#ffefd1]" />
          </div>
          <div>
            <h1 className="font-black text-white text-lg tracking-tight leading-none">Index Finance</h1>
            <span className="text-[10px] text-[#ffefd1] font-bold uppercase tracking-wider block mt-1">Elegância & Precisão</span>
          </div>
        </div>

        <div className="relative space-y-4 max-w-md">
          <h2 className="text-3xl font-black text-white leading-tight">
            O BPO Financeiro completo para sua operação multiempresas.
          </h2>
          <p className="text-sm text-[#ffefd1]/80 leading-relaxed">
            Contas a pagar e receber, conciliação bancária, aprovações e conformidade em um único workspace, com controle de acesso por perfil.
          </p>
        </div>

        <div className="relative text-[10px] text-[#ffefd1]/50 font-semibold">
          © {new Date().getFullYear()} Index Finance. Ambiente de testes / sandbox.
        </div>
      </div>

      {/* Right Form Panel */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm space-y-8">

          {/* Mobile brand header */}
          <div className="lg:hidden flex items-center gap-3 justify-center">
            <div className="p-2 bg-[#d20010] text-white rounded-lg">
              <LayoutDashboard className="h-5 w-5 text-[#ffefd1]" />
            </div>
            <span className="font-black text-[#00304c] text-base tracking-tight">Index Finance</span>
          </div>

          <div className="space-y-1.5 text-center lg:text-left">
            <h2 className="text-xl font-black text-zinc-900">Entrar na sua conta</h2>
            <p className="text-xs text-zinc-500">Acesse o workspace com seu e-mail e senha.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-zinc-700 uppercase tracking-wide">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@empresa.com.br"
                  className="w-full bg-white border border-zinc-200 text-zinc-900 text-sm pl-9 pr-3 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00304c]/20 focus:border-[#00304c] transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-zinc-700 uppercase tracking-wide">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white border border-zinc-200 text-zinc-900 text-sm pl-9 pr-9 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00304c]/20 focus:border-[#00304c] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-lg px-3 py-2.5">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 bg-[#00304c] hover:bg-[#00304c]/90 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-bold py-2.5 rounded-lg transition-colors cursor-pointer shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Entrando...
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4" /> Entrar
                </>
              )}
            </button>
          </form>

          <div className="flex items-center gap-3">
            <div className="h-px bg-zinc-200 flex-grow" />
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Acesso rápido de teste</span>
            <div className="h-px bg-zinc-200 flex-grow" />
          </div>

          <div className="grid grid-cols-3 gap-2">
            {DEMO_PROFILES.map(profile => {
              const Icon = profile.icon;
              return (
                <button
                  key={profile.id}
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleDemoProfile(profile)}
                  className="flex flex-col items-center gap-1.5 border border-zinc-200 hover:border-[#00304c]/40 hover:bg-[#00304c]/5 disabled:opacity-60 rounded-lg px-2 py-3 text-center transition-colors cursor-pointer"
                >
                  <Icon className="h-4.5 w-4.5 text-[#00304c]" />
                  <span className="text-[10px] font-bold text-zinc-800 leading-tight">{profile.label}</span>
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-zinc-400 text-center leading-relaxed">
            Ambiente de testes: qualquer conta demo usa a senha <span className="font-mono font-bold text-zinc-500">{DEMO_PASSWORD}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
