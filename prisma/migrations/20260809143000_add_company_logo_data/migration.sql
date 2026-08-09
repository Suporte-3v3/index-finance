-- Transitional persistence for normalized company logos. This keeps branding
-- consistent across devices until object storage is introduced.
ALTER TABLE "companies" ADD COLUMN "logo_data_url" TEXT;
