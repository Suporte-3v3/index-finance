import type { Company, User, UserRole } from "../types";

export interface AuthProfile {
  id: string;
  name: string;
  email: string;
  title: string | null;
  image: string | null;
  isPlatformAdmin: boolean;
  mustChangePassword: boolean;
  tenantMemberships: Array<{
    tenantId: string;
    role: UserRole;
  }>;
  companyMemberships: Array<{
    companyId: string;
    role: UserRole;
    permissions: string[];
    clientOperator: boolean;
  }>;
}

export class AuthenticationError extends Error {}

async function parseError(response: Response): Promise<string | undefined> {
  try {
    const body = (await response.json()) as { error?: string; message?: string };
    return body.message || body.error;
  } catch {
    return undefined;
  }
}

export async function getCurrentAuthProfile(): Promise<AuthProfile | null> {
  const response = await fetch("/api/me", {
    method: "GET",
    credentials: "include",
    headers: { accept: "application/json" },
  });
  if (response.status === 401) return null;
  if (!response.ok) {
    throw new AuthenticationError(
      (await parseError(response)) || "Não foi possível validar sua sessão.",
    );
  }
  return (await response.json()) as AuthProfile;
}

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<AuthProfile> {
  const response = await fetch("/api/auth/sign-in/email", {
    method: "POST",
    credentials: "include",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
  });

  if (!response.ok) {
    // A mesma mensagem para e-mail e senha evita confirmar quais contas existem.
    throw new AuthenticationError(
      response.status === 429
        ? "Muitas tentativas. Aguarde um minuto e tente novamente."
        : "E-mail ou senha inválidos.",
    );
  }

  const profile = await getCurrentAuthProfile();
  if (!profile) {
    throw new AuthenticationError("A sessão não pôde ser iniciada.");
  }
  return profile;
}

export async function signOutCurrentSession(): Promise<void> {
  const response = await fetch("/api/auth/sign-out", {
    method: "POST",
    credentials: "include",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: "{}",
  });
  if (!response.ok && response.status !== 401) {
    throw new AuthenticationError(
      (await parseError(response)) || "Não foi possível encerrar a sessão.",
    );
  }
}

export async function changeCurrentPassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const response = await fetch("/api/account/change-password", {
    method: "POST",
    credentials: "include",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  if (!response.ok) {
    throw new AuthenticationError(
      (await parseError(response)) || "Não foi possível alterar a senha.",
    );
  }
}

const ROLE_PRIORITY: Record<UserRole, number> = {
  CLIENT: 1,
  ACCOUNTANT: 2,
  BPO_TEAM: 3,
  BPO_ADMIN: 4,
};

function highestRole(roles: UserRole[]): UserRole {
  return roles.reduce<UserRole>(
    (highest, role) =>
      ROLE_PRIORITY[role] > ROLE_PRIORITY[highest] ? role : highest,
    "CLIENT",
  );
}

export function toApplicationUser(
  profile: AuthProfile,
  companies: Company[],
  activeCompanyId?: string,
): User {
  const tenantIdsWithBpoAccess = new Set(
    profile.tenantMemberships
      .filter(({ role }) => role === "BPO_ADMIN" || role === "BPO_TEAM")
      .map(({ tenantId }) => tenantId),
  );
  const allowedCompanyIds = profile.isPlatformAdmin
    ? companies.map(({ id }) => id)
    : [
        ...new Set([
          ...profile.companyMemberships.map(({ companyId }) => companyId),
          ...companies
            .filter(({ tenantId }) => tenantIdsWithBpoAccess.has(tenantId))
            .map(({ id }) => id),
        ]),
      ];

  const activeCompany = companies.find(({ id }) => id === activeCompanyId);
  const activeCompanyMembership = profile.companyMemberships.find(
    ({ companyId }) => companyId === activeCompanyId,
  );
  const activeTenantMembership = profile.tenantMemberships.find(
    ({ tenantId }) => tenantId === activeCompany?.tenantId,
  );
  const fallbackRoles = [
    ...profile.tenantMemberships.map(({ role }) => role),
    ...profile.companyMemberships.map(({ role }) => role),
  ];
  const role = profile.isPlatformAdmin
    ? "BPO_ADMIN"
    : activeCompanyMembership?.role ||
      activeTenantMembership?.role ||
      highestRole(fallbackRoles);

  const membershipsForPermissions = activeCompanyId
    ? profile.companyMemberships.filter(
        ({ companyId }) => companyId === activeCompanyId,
      )
    : profile.companyMemberships;

  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    title: profile.title || undefined,
    role,
    status: "ACTIVE",
    companies: allowedCompanyIds,
    permissions: [
      ...new Set(
        membershipsForPermissions.flatMap(({ permissions }) => permissions),
      ),
    ],
    clientOperator: activeCompanyMembership?.clientOperator || false,
  };
}
