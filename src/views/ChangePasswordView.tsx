import { useState } from "react";
import { AlertCircle, KeyRound, LogOut, ShieldCheck } from "lucide-react";
import idexLogo from "../../assets/idex-finance-logo-transparent.png";
import { Button } from "../components/ui";
import { useBPOState } from "../hooks/useBPOState";

export default function ChangePasswordView() {
  const { changePassword, logout, currentUser } = useBPOState();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (newPassword.length < 12 || newPassword.length > 128) {
      setError("A nova senha deve ter entre 12 e 128 caracteres.");
      return;
    }
    if (newPassword !== confirmation) {
      setError("A confirmação não corresponde à nova senha.");
      return;
    }
    if (newPassword === currentPassword) {
      setError("Escolha uma senha diferente da senha temporária.");
      return;
    }
    setIsSubmitting(true);
    const result = await changePassword(currentPassword, newPassword);
    setIsSubmitting(false);
    if (!result.success) {
      setError(result.error || "Não foi possível alterar a senha.");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-navy-950 p-4">
      <main className="w-full max-w-md space-y-5">
        <img src={idexLogo} alt="Idex Finance" className="mx-auto w-40 object-contain" />
        <section className="rounded-3xl border border-white/70 bg-white p-6 text-ink shadow-2xl">
          <div className="mb-5 text-center">
            <ShieldCheck className="mx-auto mb-3 h-9 w-9 text-brand-navy-900" />
            <h1 className="text-xl font-black text-brand-navy-950">Proteja sua conta</h1>
            <p className="mt-1 text-xs text-ink-soft">
              Olá, {currentUser.name}. Troque a senha temporária para continuar.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block space-y-1">
              <span className="text-[11px] font-bold uppercase text-ink-soft">Senha temporária</span>
              <input
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                className="h-11 w-full rounded-xl border border-line bg-canvas px-3 text-sm outline-none focus:border-brand-navy-700 focus:ring-4 focus:ring-brand-navy-700/10"
                required
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[11px] font-bold uppercase text-ink-soft">Nova senha</span>
              <input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                minLength={12}
                maxLength={128}
                className="h-11 w-full rounded-xl border border-line bg-canvas px-3 text-sm outline-none focus:border-brand-navy-700 focus:ring-4 focus:ring-brand-navy-700/10"
                required
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[11px] font-bold uppercase text-ink-soft">Confirmar nova senha</span>
              <input
                type="password"
                autoComplete="new-password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                minLength={12}
                maxLength={128}
                className="h-11 w-full rounded-xl border border-line bg-canvas px-3 text-sm outline-none focus:border-brand-navy-700 focus:ring-4 focus:ring-brand-navy-700/10"
                required
              />
            </label>

            <p className="text-[10px] leading-relaxed text-ink-soft">
              Use uma senha exclusiva com pelo menos 12 caracteres e que não contenha seu e-mail.
            </p>
            {error && (
              <div className="flex gap-2 rounded-xl border border-brand-red-600/30 bg-brand-red-50 p-3 text-xs font-semibold text-brand-red-600">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
            <Button
              type="submit"
              fullWidth
              size="lg"
              loading={isSubmitting}
              icon={<KeyRound className="h-4 w-4" />}
            >
              Definir nova senha
            </Button>
          </form>

          <button
            type="button"
            onClick={() => void logout()}
            className="mx-auto mt-4 flex items-center gap-1.5 text-xs font-semibold text-ink-soft hover:text-ink"
          >
            <LogOut className="h-3.5 w-3.5" /> Sair
          </button>
        </section>
      </main>
    </div>
  );
}
