ALTER TABLE "accounts_payable"
ADD COLUMN "bank_account_id" UUID;

ALTER TABLE "accounts_receivable"
ADD COLUMN "bank_account_id" UUID;

ALTER TABLE "accounts_payable"
ADD CONSTRAINT "accounts_payable_bank_account_id_fkey"
FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "accounts_receivable"
ADD CONSTRAINT "accounts_receivable_bank_account_id_fkey"
FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "accounts_payable_bank_account_id_idx"
ON "accounts_payable"("bank_account_id");

CREATE INDEX "accounts_receivable_bank_account_id_idx"
ON "accounts_receivable"("bank_account_id");
