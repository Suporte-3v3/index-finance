import assert from "node:assert/strict";
import test from "node:test";
import type { Company } from "../types";
import { AuthProfile, toApplicationUser } from "./auth";

const companies = [
  { id: "company-a", tenantId: "tenant-a" },
  { id: "company-b", tenantId: "tenant-b" },
] as Company[];

const baseProfile: AuthProfile = {
  id: "user-1",
  name: "Usuário Seguro",
  email: "usuario@exemplo.com",
  title: null,
  image: null,
  isPlatformAdmin: false,
  mustChangePassword: false,
  tenantMemberships: [],
  companyMemberships: [],
};

test("administrador da plataforma recebe acesso a todas as empresas", () => {
  const user = toApplicationUser(
    { ...baseProfile, isPlatformAdmin: true },
    companies,
    "company-b",
  );

  assert.equal(user.role, "BPO_ADMIN");
  assert.deepEqual(user.companies, ["company-a", "company-b"]);
});

test("papel e permissões são resolvidos para a empresa ativa", () => {
  const profile: AuthProfile = {
    ...baseProfile,
    companyMemberships: [
      {
        companyId: "company-a",
        role: "BPO_TEAM",
        permissions: ["documents.upload"],
        clientOperator: false,
      },
      {
        companyId: "company-b",
        role: "CLIENT",
        permissions: ["reports.view"],
        clientOperator: true,
      },
    ],
  };

  const companyAUser = toApplicationUser(profile, companies, "company-a");
  const companyBUser = toApplicationUser(profile, companies, "company-b");

  assert.equal(companyAUser.role, "BPO_TEAM");
  assert.deepEqual(companyAUser.permissions, ["documents.upload"]);
  assert.equal(companyBUser.role, "CLIENT");
  assert.deepEqual(companyBUser.permissions, ["reports.view"]);
  assert.equal(companyBUser.clientOperator, true);
});

test("vínculo de tenant BPO não libera empresas de outro tenant", () => {
  const user = toApplicationUser(
    {
      ...baseProfile,
      tenantMemberships: [{ tenantId: "tenant-a", role: "BPO_ADMIN" }],
    },
    companies,
  );

  assert.deepEqual(user.companies, ["company-a"]);
});
