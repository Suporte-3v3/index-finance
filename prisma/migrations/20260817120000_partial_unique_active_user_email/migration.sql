-- Torna a restrição de e-mail único válida apenas para usuários ativos
-- (deleted_at IS NULL), permitindo reutilizar o e-mail de um usuário
-- que já foi desativado/excluído (soft delete).
DROP INDEX "users_email_key";
CREATE UNIQUE INDEX "users_email_key" ON "users"("email") WHERE "deleted_at" IS NULL;
