import { getDatabaseClient } from "./database.js";

export async function getAuthenticatedProfile(userId: string) {
  const user = await getDatabaseClient().user.findFirst({
    where: {
      id: userId,
      status: "ACTIVE",
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      email: true,
      title: true,
      image: true,
      isPlatformAdmin: true,
      passwordChangedAt: true,
      tenantMemberships: {
        where: { status: "ACTIVE" },
        select: {
          tenantId: true,
          role: true,
        },
      },
      companyMemberships: {
        where: { status: "ACTIVE" },
        select: {
          companyId: true,
          role: true,
          permissions: true,
          clientOperator: true,
        },
      },
    },
  });
  if (!user) return null;
  const { passwordChangedAt, ...profile } = user;
  return {
    ...profile,
    mustChangePassword: passwordChangedAt === null,
  };
}
