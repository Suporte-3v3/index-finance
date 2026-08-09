-- CreateEnum
CREATE TYPE "BakeryShiftStatus" AS ENUM ('OPEN', 'AWAITING_CLOSE', 'CLOSED', 'REOPENED', 'CANCELED');

-- CreateEnum
CREATE TYPE "BakeryExpenseSource" AS ENUM ('CAIXA', 'BOLSA');

-- CreateEnum
CREATE TYPE "BakeryPixReconciliationStatus" AS ENUM ('AWAITING', 'RECONCILED', 'DIVERGENT');

-- CreateEnum
CREATE TYPE "ReportFormat" AS ENUM ('PDF', 'EXCEL');

-- CreateEnum
CREATE TYPE "ReportModelType" AS ENUM ('PAYABLES', 'RECEIVABLES', 'CASH_FLOW', 'DRE');

-- CreateEnum
CREATE TYPE "SupportTicketCategory" AS ENUM ('FINANCIAL', 'DOCUMENTS', 'PAYMENTS', 'RECEIVABLES', 'ACCOUNTING', 'ACCESS', 'OTHER');

-- CreateEnum
CREATE TYPE "SupportTicketPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'AWAITING_REQUESTER', 'RESOLVED', 'CLOSED');

-- CreateTable
CREATE TABLE "bakery_shifts" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "register_id" UUID NOT NULL,
    "register_name" VARCHAR(160) NOT NULL,
    "shift_label" VARCHAR(80) NOT NULL,
    "operator_id" UUID NOT NULL,
    "operator_name" VARCHAR(160) NOT NULL,
    "status" "BakeryShiftStatus" NOT NULL DEFAULT 'OPEN',
    "opened_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "initial_balance" DECIMAL(18,2) NOT NULL,
    "open_note" TEXT,
    "initial_balance_justification" TEXT,
    "previous_shift_final_balance" DECIMAL(18,2),
    "closed_at" TIMESTAMPTZ(3),
    "final_balance_counted" DECIMAL(18,2),
    "close_note" TEXT,
    "estimated_cash_revenue" DECIMAL(18,2),
    "pix_revenue_total" DECIMAL(18,2),
    "card_machine_total" DECIMAL(18,2),
    "total_revenue" DECIMAL(18,2),
    "reopened_at" TIMESTAMPTZ(3),
    "reopened_by_id" UUID,
    "reopened_by_name" VARCHAR(160),
    "reopen_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "bakery_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bakery_shift_close_snapshots" (
    "id" UUID NOT NULL,
    "shift_id" UUID NOT NULL,
    "closed_at" TIMESTAMPTZ(3) NOT NULL,
    "final_balance_counted" DECIMAL(18,2) NOT NULL,
    "estimated_cash_revenue" DECIMAL(18,2) NOT NULL,
    "pix_revenue_total" DECIMAL(18,2) NOT NULL,
    "card_machine_total" DECIMAL(18,2) NOT NULL,
    "total_revenue" DECIMAL(18,2) NOT NULL,
    "changed_by_id" UUID NOT NULL,
    "changed_by_name" VARCHAR(160) NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bakery_shift_close_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bakery_card_machine_entries" (
    "id" UUID NOT NULL,
    "shift_id" UUID NOT NULL,
    "close_snapshot_id" UUID,
    "bank_account_id" UUID NOT NULL,
    "bank_account_name" VARCHAR(160) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bakery_card_machine_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bakery_expenses" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "shift_id" UUID NOT NULL,
    "description" VARCHAR(300) NOT NULL,
    "supplier" VARCHAR(200),
    "amount" DECIMAL(18,2) NOT NULL,
    "source" "BakeryExpenseSource" NOT NULL,
    "category" VARCHAR(160),
    "note" TEXT,
    "receipt_object_key" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" UUID NOT NULL,
    "created_by_name" VARCHAR(160) NOT NULL,
    "canceled" BOOLEAN NOT NULL DEFAULT false,
    "canceled_at" TIMESTAMPTZ(3),
    "canceled_by_id" UUID,

    CONSTRAINT "bakery_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bakery_withdrawals" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "shift_id" UUID NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "note" TEXT,
    "receipt_object_key" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" UUID NOT NULL,
    "created_by_name" VARCHAR(160) NOT NULL,
    "canceled" BOOLEAN NOT NULL DEFAULT false,
    "canceled_at" TIMESTAMPTZ(3),
    "canceled_by_id" UUID,

    CONSTRAINT "bakery_withdrawals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bakery_pix_sales" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "shift_id" UUID NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "bank_account_id" UUID NOT NULL,
    "bank_account_name" VARCHAR(160) NOT NULL,
    "customer_name" VARCHAR(200),
    "description" TEXT,
    "note" TEXT,
    "receipt_object_key" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" UUID NOT NULL,
    "created_by_name" VARCHAR(160) NOT NULL,
    "reconciliation_status" "BakeryPixReconciliationStatus" NOT NULL DEFAULT 'AWAITING',
    "reconciled_at" TIMESTAMPTZ(3),
    "reconciled_by_id" UUID,
    "canceled" BOOLEAN NOT NULL DEFAULT false,
    "canceled_at" TIMESTAMPTZ(3),
    "canceled_by_id" UUID,

    CONSTRAINT "bakery_pix_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "type" VARCHAR(100) NOT NULL,
    "filters" JSONB NOT NULL,
    "generated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generated_by_id" UUID NOT NULL,
    "generated_by_name" VARCHAR(160) NOT NULL,
    "format" "ReportFormat",
    "file_name" VARCHAR(255),
    "mime_type" VARCHAR(150),
    "object_key" VARCHAR(500),
    "file_size_bytes" BIGINT,
    "template_id" UUID,
    "template_name" VARCHAR(200),
    "recipient_id" UUID,
    "recipient_name" VARCHAR(160),
    "recipient_role" "UserRole",

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_templates" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "model_type" "ReportModelType" NOT NULL,
    "blocks" JSONB NOT NULL,
    "filters" JSONB NOT NULL,
    "dre_options" JSONB,
    "notes" TEXT,
    "orientation" VARCHAR(20),
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_by_name" VARCHAR(160) NOT NULL,

    CONSTRAINT "report_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" UUID NOT NULL,
    "protocol" VARCHAR(40) NOT NULL,
    "company_id" UUID NOT NULL,
    "requester_id" UUID NOT NULL,
    "requester_name" VARCHAR(160) NOT NULL,
    "requester_role" "UserRole" NOT NULL,
    "category" "SupportTicketCategory" NOT NULL,
    "subject" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "priority" "SupportTicketPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
    "assigned_to_id" UUID,
    "assigned_to_name" VARCHAR(160),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_messages" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "author_name" VARCHAR(160) NOT NULL,
    "author_role" "UserRole" NOT NULL,
    "content" TEXT NOT NULL,
    "attachments" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bakery_shifts_company_id_status_idx" ON "bakery_shifts"("company_id", "status");

-- CreateIndex
CREATE INDEX "bakery_shifts_operator_id_status_idx" ON "bakery_shifts"("operator_id", "status");

-- CreateIndex
CREATE INDEX "bakery_shifts_register_id_status_idx" ON "bakery_shifts"("register_id", "status");

-- CreateIndex
CREATE INDEX "bakery_shift_close_snapshots_shift_id_created_at_idx" ON "bakery_shift_close_snapshots"("shift_id", "created_at");

-- CreateIndex
CREATE INDEX "bakery_card_machine_entries_shift_id_close_snapshot_id_idx" ON "bakery_card_machine_entries"("shift_id", "close_snapshot_id");

-- CreateIndex
CREATE INDEX "bakery_expenses_company_id_shift_id_idx" ON "bakery_expenses"("company_id", "shift_id");

-- CreateIndex
CREATE INDEX "bakery_expenses_shift_id_canceled_idx" ON "bakery_expenses"("shift_id", "canceled");

-- CreateIndex
CREATE INDEX "bakery_withdrawals_company_id_shift_id_idx" ON "bakery_withdrawals"("company_id", "shift_id");

-- CreateIndex
CREATE INDEX "bakery_withdrawals_shift_id_canceled_idx" ON "bakery_withdrawals"("shift_id", "canceled");

-- CreateIndex
CREATE INDEX "bakery_pix_sales_company_id_shift_id_idx" ON "bakery_pix_sales"("company_id", "shift_id");

-- CreateIndex
CREATE INDEX "bakery_pix_sales_shift_id_canceled_idx" ON "bakery_pix_sales"("shift_id", "canceled");

-- CreateIndex
CREATE INDEX "reports_company_id_generated_at_idx" ON "reports"("company_id", "generated_at");

-- CreateIndex
CREATE INDEX "report_templates_company_id_archived_idx" ON "report_templates"("company_id", "archived");

-- CreateIndex
CREATE UNIQUE INDEX "support_tickets_protocol_key" ON "support_tickets"("protocol");

-- CreateIndex
CREATE INDEX "support_tickets_company_id_status_idx" ON "support_tickets"("company_id", "status");

-- CreateIndex
CREATE INDEX "support_tickets_requester_id_status_idx" ON "support_tickets"("requester_id", "status");

-- CreateIndex
CREATE INDEX "support_tickets_assigned_to_id_status_idx" ON "support_tickets"("assigned_to_id", "status");

-- CreateIndex
CREATE INDEX "support_messages_ticket_id_created_at_idx" ON "support_messages"("ticket_id", "created_at");

-- AddForeignKey
ALTER TABLE "bakery_shifts" ADD CONSTRAINT "bakery_shifts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bakery_shifts" ADD CONSTRAINT "bakery_shifts_register_id_fkey" FOREIGN KEY ("register_id") REFERENCES "master_data_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bakery_shifts" ADD CONSTRAINT "bakery_shifts_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bakery_shifts" ADD CONSTRAINT "bakery_shifts_reopened_by_id_fkey" FOREIGN KEY ("reopened_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bakery_shift_close_snapshots" ADD CONSTRAINT "bakery_shift_close_snapshots_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "bakery_shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bakery_shift_close_snapshots" ADD CONSTRAINT "bakery_shift_close_snapshots_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bakery_card_machine_entries" ADD CONSTRAINT "bakery_card_machine_entries_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "bakery_shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bakery_card_machine_entries" ADD CONSTRAINT "bakery_card_machine_entries_close_snapshot_id_fkey" FOREIGN KEY ("close_snapshot_id") REFERENCES "bakery_shift_close_snapshots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bakery_card_machine_entries" ADD CONSTRAINT "bakery_card_machine_entries_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bakery_expenses" ADD CONSTRAINT "bakery_expenses_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bakery_expenses" ADD CONSTRAINT "bakery_expenses_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "bakery_shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bakery_expenses" ADD CONSTRAINT "bakery_expenses_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bakery_expenses" ADD CONSTRAINT "bakery_expenses_canceled_by_id_fkey" FOREIGN KEY ("canceled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bakery_withdrawals" ADD CONSTRAINT "bakery_withdrawals_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bakery_withdrawals" ADD CONSTRAINT "bakery_withdrawals_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "bakery_shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bakery_withdrawals" ADD CONSTRAINT "bakery_withdrawals_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bakery_withdrawals" ADD CONSTRAINT "bakery_withdrawals_canceled_by_id_fkey" FOREIGN KEY ("canceled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bakery_pix_sales" ADD CONSTRAINT "bakery_pix_sales_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bakery_pix_sales" ADD CONSTRAINT "bakery_pix_sales_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "bakery_shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bakery_pix_sales" ADD CONSTRAINT "bakery_pix_sales_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bakery_pix_sales" ADD CONSTRAINT "bakery_pix_sales_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bakery_pix_sales" ADD CONSTRAINT "bakery_pix_sales_reconciled_by_id_fkey" FOREIGN KEY ("reconciled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bakery_pix_sales" ADD CONSTRAINT "bakery_pix_sales_canceled_by_id_fkey" FOREIGN KEY ("canceled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_generated_by_id_fkey" FOREIGN KEY ("generated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "report_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_templates" ADD CONSTRAINT "report_templates_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_templates" ADD CONSTRAINT "report_templates_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
