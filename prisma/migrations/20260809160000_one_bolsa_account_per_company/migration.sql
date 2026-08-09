CREATE UNIQUE INDEX "bank_accounts_one_bolsa_per_company"
ON "bank_accounts" ("company_id")
WHERE "is_bolsa_account" = true AND "deleted_at" IS NULL;
