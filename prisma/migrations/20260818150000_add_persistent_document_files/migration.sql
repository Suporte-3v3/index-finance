CREATE TABLE "document_files" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "uploaded_by_id" UUID NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(150) NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "total_chunks" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_files_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "document_file_chunks" (
    "id" UUID NOT NULL,
    "file_id" UUID NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_file_chunks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "document_files_company_id_created_at_idx" ON "document_files"("company_id", "created_at");
CREATE INDEX "document_files_uploaded_by_id_idx" ON "document_files"("uploaded_by_id");
CREATE UNIQUE INDEX "document_file_chunks_file_id_chunk_index_key" ON "document_file_chunks"("file_id", "chunk_index");
CREATE INDEX "document_file_chunks_file_id_idx" ON "document_file_chunks"("file_id");

ALTER TABLE "document_files"
ADD CONSTRAINT "document_files_company_id_fkey"
FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "document_files"
ADD CONSTRAINT "document_files_uploaded_by_id_fkey"
FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "document_file_chunks"
ADD CONSTRAINT "document_file_chunks_file_id_fkey"
FOREIGN KEY ("file_id") REFERENCES "document_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
