/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useBPOState } from '../hooks/useBPOState';
import { ACCESS_PASSWORD } from '../services/mockData';
import idexLogo from '../../assets/idex-finance-logo-transparent.png';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  Loader2,
  AlertCircle,
  ShieldCheck,
  UserRound,
  Calculator,
} from 'lucide-react';

const PROFILE_PRESENTATION = {
  BPO_ADMIN: { label: 'Administrador BPO', icon: ShieldCheck },
  CLIENT: { label: 'Cliente', icon: UserRound },
  ACCOUNTANT: { label: 'Contador', icon: Calculator },
  BPO_TEAM: { label: 'Equipe BPO', icon: UserRound },
};

export default function LoginView() {
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
    <div className="min-h-screen flex font-sans bg-zinc-50">
      {/* Left Brand Panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#061425] relative overflow-hidden items-center justify-center p-12">
        <div className="absolute inset-0 opacity-15 bg-[radial-gradient(circle_at_50%_38%,#0B2C52,transparent_55%)]" />

        <div className="relative w-full max-w-lg flex flex-col items-center text-center">
          <img
            src={idexLogo}
            alt="Idex Finance — Gestão que move resultados"
            className="w-64 max-w-full object-contain"
          />
          <div className="w-12 h-0.5 bg-[#C8102E] mt-5 mb-6 rounded-full" />
          <h2 className="text-3xl font-black text-white leading-tight max-w-md">
            O BPO Financeiro completo para sua operação multiempresas.
          </h2>
          <p className="text-sm text-[#F2D3A0]/80 leading-relaxed max-w-md mt-4">
            Contas a pagar e receber, conciliação bancária, aprovações e conformidade em um único workspace, com controle de acesso por perfil.
          </p>
        </div>

        <div className="absolute bottom-8 left-0 right-0 text-center text-[10px] text-[#F2D3A0]/50 font-semibold space-y-1">
          <p>© {new Date().getFullYear()} Idex Finance.</p>
          <p>Desenvolvido por <span className="text-[#F2D3A0]/80 font-bold">NFlow Analytics</span></p>
        </div>
      </div>

      {/* Right Form Panel */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm space-y-6">

          {/* Mobile brand header */}
          <div className="lg:hidden flex justify-center">
            <img src={idexLogo} alt="Idex Finance" className="h-20 w-40 object-contain" />
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
                  className="w-full bg-white border border-zinc-200 text-zinc-900 text-sm pl-9 pr-3 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B2C52]/20 focus:border-[#0B2C52] transition-colors"
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
                  className="w-full bg-white border border-zinc-200 text-zinc-900 text-sm pl-9 pr-9 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B2C52]/20 focus:border-[#0B2C52] transition-colors"
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
              className="w-full flex items-center justify-center gap-2 bg-[#0B2C52] hover:bg-[#0B2C52]/90 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-bold py-2.5 rounded-lg transition-colors cursor-pointer shadow-sm"
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

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-px bg-zinc-200 grow" />
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Selecionar perfil de acesso</span>
              <div className="h-px bg-zinc-200 grow" />
            </div>

            <div className="grid grid-cols-3 gap-2">
              {users
                .filter(user => ['BPO_ADMIN', 'CLIENT', 'ACCOUNTANT'].includes(user.role))
                .slice(0, 3)
                .map(user => {
                  const presentation = PROFILE_PRESENTATION[user.role];
                  const Icon = presentation.icon;
                  return (
                    <button
                      key={user.id}
                      type="button"
                      disabled={isSubmitting || user.status !== 'ACTIVE'}
                      onClick={() => handleProfileLogin(user.email)}
                      className="flex flex-col items-center gap-1.5 border border-zinc-200 hover:border-[#0B2C52]/40 hover:bg-[#0B2C52]/5 disabled:opacity-60 rounded-lg px-2 py-3 text-center transition-colors cursor-pointer"
                      title={`Entrar como ${user.name}`}
                    >
                      <Icon className="h-4.5 w-4.5 text-[#0B2C52]" />
                      <span className="text-[10px] font-bold text-zinc-800 leading-tight">{presentation.label}</span>
                    </button>
                  );
                })}
            </div>
          </div>

          <p className="lg:hidden text-center text-[9px] text-zinc-400">
            Desenvolvido por <span className="font-bold text-[#0B2C52]">NFlow Analytics</span>
          </p>

        </div>
      </div>
    </div>
  );
}
