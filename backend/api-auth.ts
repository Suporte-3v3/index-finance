import { getAuth } from "./auth.js";
import { getAuthenticatedProfile } from "./auth-profile.js";
import { getDatabaseClient } from "./database.js";

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

export async function requireApiCompanyPermission(
  profile: Awaited<ReturnType<typeof requireApiProfile>>,
  companyId: unknown,
  permission: string,
) {
  if (typeof companyId !== "string" || !/^[0-9a-f-]{36}$/i.test(companyId)) {
    throw new ApiAuthenticationError("Empresa inválida.", 400);
  }
  const company = await getDatabaseClient().company.findFirst({
    where: { id: companyId, deletedAt: null },
    select: { id: true, tenantId: true },
  });
  if (!company) throw new ApiAuthenticationError("Empresa não encontrada.", 404);
  const allowed = profile.isPlatformAdmin ||
    profile.tenantMemberships.some(({ tenantId, role }) =>
      tenantId === company.tenantId && role === "BPO_ADMIN",
    ) ||
    profile.companyMemberships.some(({ companyId: membershipCompanyId, role, permissions }) =>
      membershipCompanyId === company.id &&
      (role === "BPO_ADMIN" || permissions.includes(permission)),
    );
  if (!allowed) throw new ApiAuthenticationError("Sem permissão para esta empresa.", 403);
  return company;
}
