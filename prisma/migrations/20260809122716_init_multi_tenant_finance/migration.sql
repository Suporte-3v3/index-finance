-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "CompanyStatus" AS ENUM ('IMPLEMENTATION', 'ACTIVE', 'ATTENTION', 'OVERDUE', 'NO_ACTIVITY', 'INACTIVE');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'REVOKED');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('BPO_ADMIN', 'BPO_TEAM', 'CLIENT', 'ACCOUNTANT');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'LOCKED');

-- CreateEnum
CREATE TYPE "BankAccountType" AS ENUM ('CHECKING', 'SAVINGS', 'INVESTMENT', 'CASH');

-- CreateEnum
CREATE TYPE "MasterDataType" AS ENUM ('CATEGORY', 'SUBCATEGORY', 'PAYMENT_METHOD', 'COST_CENTER', 'DOCUMENT_TYPE', 'SUPPLIER', 'CUSTOMER', 'BAKERY_REGISTER');

-- CreateEnum
CREATE TYPE "RecurrenceType" AS ENUM ('NONE', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL', 'INSTALLMENTS');

-- CreateEnum
CREATE TYPE "PayableStatus" AS ENUM ('DRAFT', 'PENDING', 'AWAITING_APPROVAL', 'UPCOMING', 'APPROVED', 'SCHEDULED', 'PAID', 'PARTIALLY_PAID', 'OVERDUE', 'REJECTED', 'CANCELED');

-- CreateEnum
CREATE TYPE "ReceivableStatus" AS ENUM ('DRAFT', 'PENDING', 'OPEN', 'PARTIALLY_RECEIVED', 'RECEIVED', 'OVERDUE', 'COLLECTION', 'NEGOTIATED', 'CANCELED');

-- CreateEnum
CREATE TYPE "ApprovalType" AS ENUM ('PAYMENT', 'DOCUMENT', 'SENSITIVE_ACTION');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED', 'CANCELED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('APPROVED', 'REJECTED', 'CHANGES_REQUESTED', 'CANCELED');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('AWAITING_ANALYSIS', 'AWAITING_APPROVAL', 'SHARED', 'POSTED', 'CANCELED');

-- CreateEnum
CREATE TYPE "DocumentPurpose" AS ENUM ('PROCESSING', 'VIEW_ONLY');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('INFO', 'WARNING', 'SUCCESS', 'ALERT');

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "plan" VARCHAR(50) NOT NULL DEFAULT 'PROFESSIONAL',
    "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
    "timezone" VARCHAR(60) NOT NULL DEFAULT 'America/Sao_Paulo',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "cnpj" VARCHAR(14) NOT NULL,
    "corporate_name" VARCHAR(200) NOT NULL,
    "trade_name" VARCHAR(160) NOT NULL,
    "segment" VARCHAR(100),
    "tax_regime" VARCHAR(80),
    "accountant_name" VARCHAR(160),
    "accountant_email" VARCHAR(254),
    "primary_contact_name" VARCHAR(160),
    "primary_contact_email" VARCHAR(254),
    "bpo_responsible_id" UUID,
    "status" "CompanyStatus" NOT NULL DEFAULT 'IMPLEMENTATION',
    "approval_limit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "logo_object_key" VARCHAR(500),
    "client_modules" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "password_hash" VARCHAR(255),
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "title" VARCHAR(120),
    "is_platform_admin" BOOLEAN NOT NULL DEFAULT false,
    "email_verified_at" TIMESTAMPTZ(3),
    "password_changed_at" TIMESTAMPTZ(3),
    "last_login_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_memberships" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "UserRole" NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tenant_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_memberships" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "UserRole" NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "client_operator" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "company_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_invitations" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "role" "UserRole" NOT NULL,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "token_hash" VARCHAR(128) NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'INVITED',
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "accepted_at" TIMESTAMPTZ(3),
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(128) NOT NULL,
    "ip_address" INET,
    "user_agent" VARCHAR(500),
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "last_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_accounts" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "bank_name" VARCHAR(160) NOT NULL,
    "agency" VARCHAR(20),
    "account_number" VARCHAR(40) NOT NULL,
    "type" "BankAccountType" NOT NULL,
    "balance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "is_bolsa_account" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_data_options" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "type" "MasterDataType" NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "parent_id" UUID,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "master_data_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts_payable" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "supplier_name" VARCHAR(200) NOT NULL,
    "category_name" VARCHAR(160) NOT NULL,
    "cost_center_name" VARCHAR(160) NOT NULL,
    "competence_month" CHAR(7) NOT NULL,
    "issue_date" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "interest" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "penalty" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "final_amount" DECIMAL(18,2) NOT NULL,
    "payment_method" VARCHAR(100) NOT NULL,
    "recurrence" "RecurrenceType" NOT NULL DEFAULT 'NONE',
    "installment_group_id" UUID,
    "installment_number" INTEGER,
    "installment_count" INTEGER,
    "document_number" VARCHAR(100),
    "notes" TEXT,
    "attachment_object_key" VARCHAR(500),
    "attachment_name" VARCHAR(255),
    "status" "PayableStatus" NOT NULL DEFAULT 'DRAFT',
    "responsible_id" UUID,
    "needs_approval" BOOLEAN NOT NULL DEFAULT false,
    "payment_date" DATE,
    "paid_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "canceled_at" TIMESTAMPTZ(3),
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "accounts_payable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_payable_payments" (
    "id" UUID NOT NULL,
    "payable_id" UUID NOT NULL,
    "bank_account_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "interest" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "penalty" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "receipt_object_key" VARCHAR(500),
    "registered_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_payable_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts_receivable" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "customer_name" VARCHAR(200) NOT NULL,
    "category_name" VARCHAR(160) NOT NULL,
    "cost_center_name" VARCHAR(160) NOT NULL,
    "competence_month" CHAR(7) NOT NULL,
    "issue_date" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "interest" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "penalty" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "received_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "payment_method" VARCHAR(100) NOT NULL,
    "recurrence" "RecurrenceType" NOT NULL DEFAULT 'NONE',
    "installment_group_id" UUID,
    "installment_number" INTEGER,
    "installment_count" INTEGER,
    "document_number" VARCHAR(100),
    "notes" TEXT,
    "attachment_object_key" VARCHAR(500),
    "attachment_name" VARCHAR(255),
    "status" "ReceivableStatus" NOT NULL DEFAULT 'DRAFT',
    "responsible_id" UUID,
    "receipt_date" DATE,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "canceled_at" TIMESTAMPTZ(3),
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "accounts_receivable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_receivable_receipts" (
    "id" UUID NOT NULL,
    "receivable_id" UUID NOT NULL,
    "bank_account_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "interest" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "penalty" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "receipt_object_key" VARCHAR(500),
    "registered_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_receivable_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approvals" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "type" "ApprovalType" NOT NULL,
    "related_entity_type" VARCHAR(80) NOT NULL,
    "related_entity_id" UUID NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "amount" DECIMAL(18,2),
    "due_date" DATE,
    "requester_id" UUID NOT NULL,
    "recipient_id" UUID,
    "approval_deadline" TIMESTAMPTZ(3),
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "justification" TEXT,
    "attachment_object_key" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_steps" (
    "id" UUID NOT NULL,
    "approval_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "UserRole" NOT NULL,
    "decision" "ApprovalDecision" NOT NULL,
    "comment" TEXT,
    "ip_address" INET,
    "user_agent" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "category" VARCHAR(80) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "competence_month" CHAR(7),
    "uploaded_by_id" UUID NOT NULL,
    "recipient_id" UUID,
    "object_key" VARCHAR(500) NOT NULL,
    "file_size_bytes" BIGINT NOT NULL,
    "mime_type" VARCHAR(150) NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "related_entity_type" VARCHAR(80),
    "related_entity_id" UUID,
    "status" "DocumentStatus" NOT NULL DEFAULT 'AWAITING_ANALYSIS',
    "purpose" "DocumentPurpose" NOT NULL DEFAULT 'PROCESSING',
    "ai_summary" TEXT,
    "extracted_data" JSONB,
    "processing_confidence" DECIMAL(5,4),
    "analysis_warnings" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "canceled_at" TIMESTAMPTZ(3),
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_statement_entries" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "bank_account_id" UUID NOT NULL,
    "external_id" VARCHAR(160),
    "date" DATE NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "document_number" VARCHAR(100),
    "reconciliation_status" VARCHAR(40) NOT NULL DEFAULT 'PENDING',
    "imported_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_statement_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reconciliations" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "bank_account_id" UUID NOT NULL,
    "statement_entry_id" UUID NOT NULL,
    "financial_entity_type" VARCHAR(60) NOT NULL,
    "financial_entity_id" UUID NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "notes" TEXT,
    "reconciled_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversed_at" TIMESTAMPTZ(3),

    CONSTRAINT "reconciliations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID,
    "user_id" UUID,
    "action" VARCHAR(120) NOT NULL,
    "entity_type" VARCHAR(100) NOT NULL,
    "entity_id" UUID,
    "previous_data" JSONB,
    "next_data" JSONB,
    "ip_address" INET,
    "user_agent" VARCHAR(500),
    "origin" VARCHAR(80) NOT NULL DEFAULT 'WEB_APP',
    "request_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "company_id" UUID,
    "user_id" UUID,
    "title" VARCHAR(200) NOT NULL,
    "message" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL DEFAULT 'INFO',
    "related_link" VARCHAR(500),
    "read_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE INDEX "companies_tenant_id_status_idx" ON "companies"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "companies_bpo_responsible_id_idx" ON "companies"("bpo_responsible_id");

-- CreateIndex
CREATE UNIQUE INDEX "companies_tenant_id_cnpj_key" ON "companies"("tenant_id", "cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "tenant_memberships_user_id_status_idx" ON "tenant_memberships"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_memberships_tenant_id_user_id_key" ON "tenant_memberships"("tenant_id", "user_id");

-- CreateIndex
CREATE INDEX "company_memberships_user_id_status_idx" ON "company_memberships"("user_id", "status");

-- CreateIndex
CREATE INDEX "company_memberships_company_id_role_status_idx" ON "company_memberships"("company_id", "role", "status");

-- CreateIndex
CREATE UNIQUE INDEX "company_memberships_company_id_user_id_key" ON "company_memberships"("company_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "company_invitations_token_hash_key" ON "company_invitations"("token_hash");

-- CreateIndex
CREATE INDEX "company_invitations_company_id_email_status_idx" ON "company_invitations"("company_id", "email", "status");

-- CreateIndex
CREATE INDEX "company_invitations_expires_at_idx" ON "company_invitations"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_token_hash_key" ON "user_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "user_sessions_user_id_expires_at_idx" ON "user_sessions"("user_id", "expires_at");

-- CreateIndex
CREATE INDEX "user_sessions_expires_at_revoked_at_idx" ON "user_sessions"("expires_at", "revoked_at");

-- CreateIndex
CREATE INDEX "bank_accounts_company_id_active_idx" ON "bank_accounts"("company_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "bank_accounts_company_id_agency_account_number_key" ON "bank_accounts"("company_id", "agency", "account_number");

-- CreateIndex
CREATE INDEX "master_data_options_company_id_type_active_idx" ON "master_data_options"("company_id", "type", "active");

-- CreateIndex
CREATE INDEX "master_data_options_parent_id_idx" ON "master_data_options"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "master_data_options_company_id_type_name_key" ON "master_data_options"("company_id", "type", "name");

-- CreateIndex
CREATE INDEX "accounts_payable_company_id_due_date_status_idx" ON "accounts_payable"("company_id", "due_date", "status");

-- CreateIndex
CREATE INDEX "accounts_payable_company_id_competence_month_idx" ON "accounts_payable"("company_id", "competence_month");

-- CreateIndex
CREATE INDEX "accounts_payable_company_id_supplier_name_idx" ON "accounts_payable"("company_id", "supplier_name");

-- CreateIndex
CREATE INDEX "accounts_payable_created_by_id_idx" ON "accounts_payable"("created_by_id");

-- CreateIndex
CREATE INDEX "account_payable_payments_payable_id_date_idx" ON "account_payable_payments"("payable_id", "date");

-- CreateIndex
CREATE INDEX "account_payable_payments_bank_account_id_date_idx" ON "account_payable_payments"("bank_account_id", "date");

-- CreateIndex
CREATE INDEX "accounts_receivable_company_id_due_date_status_idx" ON "accounts_receivable"("company_id", "due_date", "status");

-- CreateIndex
CREATE INDEX "accounts_receivable_company_id_competence_month_idx" ON "accounts_receivable"("company_id", "competence_month");

-- CreateIndex
CREATE INDEX "accounts_receivable_company_id_customer_name_idx" ON "accounts_receivable"("company_id", "customer_name");

-- CreateIndex
CREATE INDEX "accounts_receivable_created_by_id_idx" ON "accounts_receivable"("created_by_id");

-- CreateIndex
CREATE INDEX "account_receivable_receipts_receivable_id_date_idx" ON "account_receivable_receipts"("receivable_id", "date");

-- CreateIndex
CREATE INDEX "account_receivable_receipts_bank_account_id_date_idx" ON "account_receivable_receipts"("bank_account_id", "date");

-- CreateIndex
CREATE INDEX "approvals_company_id_status_created_at_idx" ON "approvals"("company_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "approvals_recipient_id_status_idx" ON "approvals"("recipient_id", "status");

-- CreateIndex
CREATE INDEX "approvals_related_entity_type_related_entity_id_idx" ON "approvals"("related_entity_type", "related_entity_id");

-- CreateIndex
CREATE INDEX "approval_steps_approval_id_created_at_idx" ON "approval_steps"("approval_id", "created_at");

-- CreateIndex
CREATE INDEX "documents_company_id_status_created_at_idx" ON "documents"("company_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "documents_recipient_id_status_idx" ON "documents"("recipient_id", "status");

-- CreateIndex
CREATE INDEX "documents_related_entity_type_related_entity_id_idx" ON "documents"("related_entity_type", "related_entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "documents_company_id_sha256_key" ON "documents"("company_id", "sha256");

-- CreateIndex
CREATE INDEX "bank_statement_entries_company_id_date_idx" ON "bank_statement_entries"("company_id", "date");

-- CreateIndex
CREATE INDEX "bank_statement_entries_bank_account_id_reconciliation_statu_idx" ON "bank_statement_entries"("bank_account_id", "reconciliation_status", "date");

-- CreateIndex
CREATE UNIQUE INDEX "bank_statement_entries_bank_account_id_external_id_key" ON "bank_statement_entries"("bank_account_id", "external_id");

-- CreateIndex
CREATE INDEX "reconciliations_company_id_created_at_idx" ON "reconciliations"("company_id", "created_at");

-- CreateIndex
CREATE INDEX "reconciliations_statement_entry_id_idx" ON "reconciliations"("statement_entry_id");

-- CreateIndex
CREATE INDEX "reconciliations_financial_entity_type_financial_entity_id_idx" ON "reconciliations"("financial_entity_type", "financial_entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_created_at_idx" ON "audit_logs"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_company_id_created_at_idx" ON "audit_logs"("company_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_created_at_idx" ON "audit_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_created_at_idx" ON "notifications"("user_id", "read_at", "created_at");

-- CreateIndex
CREATE INDEX "notifications_company_id_created_at_idx" ON "notifications"("company_id", "created_at");

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_bpo_responsible_id_fkey" FOREIGN KEY ("bpo_responsible_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_memberships" ADD CONSTRAINT "company_memberships_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_memberships" ADD CONSTRAINT "company_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_invitations" ADD CONSTRAINT "company_invitations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_invitations" ADD CONSTRAINT "company_invitations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_data_options" ADD CONSTRAINT "master_data_options_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_data_options" ADD CONSTRAINT "master_data_options_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "master_data_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts_payable" ADD CONSTRAINT "accounts_payable_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts_payable" ADD CONSTRAINT "accounts_payable_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_payable_payments" ADD CONSTRAINT "account_payable_payments_payable_id_fkey" FOREIGN KEY ("payable_id") REFERENCES "accounts_payable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_payable_payments" ADD CONSTRAINT "account_payable_payments_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_payable_payments" ADD CONSTRAINT "account_payable_payments_registered_by_id_fkey" FOREIGN KEY ("registered_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts_receivable" ADD CONSTRAINT "accounts_receivable_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts_receivable" ADD CONSTRAINT "accounts_receivable_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_receivable_receipts" ADD CONSTRAINT "account_receivable_receipts_receivable_id_fkey" FOREIGN KEY ("receivable_id") REFERENCES "accounts_receivable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_receivable_receipts" ADD CONSTRAINT "account_receivable_receipts_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_receivable_receipts" ADD CONSTRAINT "account_receivable_receipts_registered_by_id_fkey" FOREIGN KEY ("registered_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_approval_id_fkey" FOREIGN KEY ("approval_id") REFERENCES "approvals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_statement_entries" ADD CONSTRAINT "bank_statement_entries_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_statement_entries" ADD CONSTRAINT "bank_statement_entries_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliations" ADD CONSTRAINT "reconciliations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliations" ADD CONSTRAINT "reconciliations_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliations" ADD CONSTRAINT "reconciliations_statement_entry_id_fkey" FOREIGN KEY ("statement_entry_id") REFERENCES "bank_statement_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliations" ADD CONSTRAINT "reconciliations_reconciled_by_id_fkey" FOREIGN KEY ("reconciled_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
