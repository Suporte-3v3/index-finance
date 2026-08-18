import { getAuth } from "./auth.js";
import { getAuthenticatedProfile } from "./auth-profile.js";

export class ApiAuthenticationError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function requireApiProfile(request: Request) {
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session) throw new ApiAuthenticationError("Não autenticado.", 401);
  const profile = await getAuthenticatedProfile(session.user.id);
  if (!profile) throw new ApiAuthenticationError("Sessão sem acesso ativo.", 401);
  if (profile.mustChangePassword) {
    throw new ApiAuthenticationError("Troque a senha temporária para continuar.", 403);
  }
  return profile;
}
