<div align="center">
  <img src="assets/idex-finance-logo-transparent.png" alt="Logo Idex Finance" width="260" />

  <h1>Idex Finance</h1>

  <p>
    Plataforma multiempresa para operação de BPO financeiro, do recebimento
    de documentos ao lançamento, aprovação, conciliação e relatório.
  </p>

  <p>
    <img alt="Status" src="https://img.shields.io/badge/status-produ%C3%A7%C3%A3o-15996F" />
    <img alt="React" src="https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white" />
    <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white" />
    <img alt="Node.js" src="https://img.shields.io/badge/Node.js-22-5FA04E?logo=nodedotjs&logoColor=white" />
    <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=white" />
    <img alt="AWS" src="https://img.shields.io/badge/produ%C3%A7%C3%A3o-AWS-FF9900?logo=amazonwebservices&logoColor=white" />
  </p>
</div>

## Visão geral

O **Idex Finance** é o sistema de operação financeira da **NFlow Analytics**. Ele atende equipes de BPO, empresas clientes e contadores em um workspace com isolamento por tenant e empresa, permissões granulares e histórico auditável.

O sistema está em produção na AWS. A aplicação é uma SPA React servida pelo mesmo processo Express que expõe as APIs privadas. O PostgreSQL é a fonte de verdade dos dados operacionais; anexos enviados ficam no disco privado da instância em `.data/uploads` e são entregues somente para sessões autenticadas.

## O que o sistema possui

### Operação financeira

- Painel geral com saldos, entradas, saídas, vencimentos, inadimplência e aprovações;
- centro de operação multiempresa para acompanhamento consolidado da carteira BPO;
- fluxo de caixa por período, conta bancária e natureza da movimentação;
- contas a pagar com parcelamento, edição, agendamento, aprovação, pagamento parcial ou integral e cancelamento;
- contas a receber com parcelamento, recebimento parcial ou integral, inadimplência e cancelamento;
- atualização transacional dos saldos bancários durante pagamentos, recebimentos e transferências;
- importação em lote de contas a pagar e receber por planilha Excel;
- planilha modelo gerada com os cadastros atuais da empresa e validação linha a linha antes da importação.

### Documentos, lançamentos e aprovações

- Central de Documentos para enviar, receber, visualizar, baixar e cancelar arquivos;
- Assistente de Documentos com análise visual pelo Gemini para PDF e imagens;
- extração de fornecedor, valor, vencimento, competência, número do documento, categoria, resumo, confiança e alertas;
- revisão manual dos campos identificados antes do envio;
- fluxo cliente → fila de análise BPO → lançamento ou solicitação de aprovação;
- histórico separado entre “Meus envios”, “Recebidos” e “Cancelados”;
- atualização da fila do BPO ao abrir o módulo, ao retomar a janela e periodicamente;
- lançamento manual ou originado de documento como conta a pagar, conta a receber ou transferência;
- processamento individual ou em lote dos documentos aguardando análise;
- aprovação documental com decisões de aprovar, rejeitar ou solicitar ajuste;
- compartilhamento BPO → cliente/contador apenas para visualização, sem gerar lançamento financeiro;
- notificações persistidas durante as transições do documento.

### Conciliação bancária

- Importação de extratos em **OFX/QFX** ou pela planilha modelo **Excel**;
- prevenção de duplicidade na importação;
- conciliação manual com contas a pagar ou a receber;
- sugestão e conciliação automática de movimentos compatíveis;
- estados de pendente, conciliado, parcialmente conciliado, divergente e ignorado;
- trilha persistida das conciliações realizadas.

### Relatórios e DRE

- Construtor de relatórios por blocos;
- modelos de Contas a Pagar, Contas a Receber, Fluxo de Caixa e DRE Gerencial;
- filtros por datas, competência, situação, conta bancária, categoria, centro de custo, fornecedor/cliente e forma de pagamento;
- indicadores, gráficos, agrupamentos e listas detalhadas;
- exportação em **PDF** ou **Excel**;
- modelos reutilizáveis, favoritos, duplicação e arquivamento;
- histórico dos relatórios gerados no PostgreSQL;
- envio de relatório para a Central de Documentos e compartilhamento com cliente.

### Cadastros e administração

- Cadastro multiempresa com CNPJ, regime tributário, segmento, contatos, responsável BPO, logotipo e módulos liberados ao cliente;
- contas bancárias e conta interna “Bolsa” por empresa;
- fornecedores, clientes, categorias, subcategorias, centros de custo, formas de pagamento e tipos de documento;
- gestão de colaboradores, perfis, empresas permitidas e permissões granulares;
- senha temporária automática no cadastro ou reset e troca obrigatória no primeiro acesso;
- senha definitiva com mínimo de 8 e máximo de 128 caracteres;
- desativação lógica de empresas e usuários;
- logs de conformidade/auditoria e notificações persistentes.

### Atendimento e módulos especializados

- Requerimentos entre cliente/contador e BPO com protocolo, categoria, prioridade, status, mensagens e anexos;
- Central de Requerimentos para triagem e atendimento pela equipe BPO;
- indicação de presença recente da equipe;
- módulo **Caixa Padaria** com visão de operador e administração BPO;
- abertura, envio para fechamento, fechamento, reabertura e cancelamento de turnos;
- despesas, retiradas, vendas Pix, conferência e conciliação de Pix;
- controle da conta Bolsa ligada à operação da empresa.

## Perfis de acesso

| Perfil | Escopo principal |
| --- | --- |
| `BPO_ADMIN` | Administração do tenant, empresas, equipe, operação global, auditoria e backups |
| `BPO_TEAM` | Operação das empresas autorizadas conforme permissões concedidas |
| `CLIENT` | Módulos liberados para a empresa, documentos, aprovações e requerimentos |
| `ACCOUNTANT` | Consulta e colaboração nas empresas autorizadas |

O administrador pode liberar módulos por empresa. O perfil de operador do cliente possui uma visão mais restrita e não acessa Painel Geral, Central de Aprovações nem Fluxo de Caixa.

As permissões controlam operações como visualizar o centro de operação, gerenciar empresas/equipe, criar ou editar títulos, solicitar/decidir aprovações, enviar documentos, gerar relatórios e executar conciliações.

## Arquitetura e persistência

| Camada | Implementação |
| --- | --- |
| Frontend | React 19, TypeScript, Vite 6 e Tailwind CSS 4 |
| Interface | Lucide React, Motion e Recharts |
| Arquivos e relatórios | SheetJS, jsPDF e jsPDF AutoTable |
| Backend | Node.js 22 e Express 4 |
| Autenticação | Better Auth, cookies `HttpOnly` e Argon2id |
| Banco de dados | PostgreSQL 17 e Prisma ORM |
| Inteligência artificial | Google GenAI / Gemini |
| Produção | AWS/Ubuntu, Nginx, systemd e Docker |

O PostgreSQL armazena tenants, empresas, usuários, sessões, papéis, permissões, contas bancárias, cadastros, contas a pagar e receber, pagamentos, recebimentos, aprovações, documentos, extratos, conciliações, auditoria, notificações, caixa da padaria, relatórios, modelos e requerimentos.

O navegador mantém apenas um espelho de estado e preferências de interface para compatibilidade. Após autenticação ou atualização, os dados canônicos são carregados novamente pelas APIs protegidas.

Os arquivos físicos não ficam dentro do PostgreSQL. Na instalação atual, documentos e anexos são gravados em `.data/uploads`. Esse diretório deve fazer parte da rotina de backup da instância.

## Segurança

- Cadastro público desativado;
- senhas protegidas com Argon2id e salt exclusivo;
- cookies de sessão `HttpOnly`, `SameSite=Lax` e `Secure` em produção;
- sessões com duração de 12 horas;
- limite de tentativas no login;
- troca obrigatória da senha temporária no primeiro acesso;
- reset de senha encerra todas as sessões ativas do usuário;
- autorização por tenant, empresa, papel e permissão;
- rotas financeiras, documentos, uploads e APIs administrativas protegidas no backend;
- isolamento dos registros pela empresa acessível à sessão;
- operações críticas registradas na auditoria;
- segredos e conexão do banco mantidos somente no servidor.

## Formatos aceitos

### Assistente de Documentos

A Central de Documentos aceita arquivos PDF, JPG, JPEG, PNG, HEIC, OFX, XML, XLSX e CSV com até **20 MB**. A análise visual pelo Gemini é aplicada a PDF e formatos de imagem compatíveis. Quando a IA não está configurada ou não consegue analisar o arquivo, a interface oferece uma classificação local e exige revisão manual.

### Importação de lançamentos

A tela de Lançamentos disponibiliza o botão para baixar a planilha modelo e importa arquivos `.xlsx` ou `.xls`. O mesmo arquivo pode conter contas a pagar e contas a receber.

### Conciliação

A conciliação importa extratos `.ofx`, `.qfx`, `.xlsx` ou `.xls`.

### Relatórios

Os relatórios são gerados em PDF ou Excel.

## Ambiente de produção na AWS

A topologia prevista pelos arquivos deste repositório e utilizada na instalação atual é:

```text
Internet
   │
   ▼
Nginx :80/:443
   │ reverse proxy
   ▼
Express/Node :3000  ─────►  .data/uploads
   │
   ▼
PostgreSQL 17 em Docker (127.0.0.1:5432)
```

- O serviço `idex-finance.service` executa `npm start` como usuário `ubuntu`;
- o diretório esperado é `/home/ubuntu/index-finance`;
- o Nginx encaminha as requisições para `127.0.0.1:3000` e aceita corpos de até 30 MB;
- o PostgreSQL publica a porta somente no loopback da máquina;
- logs da aplicação são enviados para o journal do systemd;
- o processo reinicia automaticamente em caso de falha.

### Atualizar a produção

Depois que as alterações estiverem disponíveis no GitHub, execute na instância:

```bash
cd /home/ubuntu/index-finance
bash deploy/deploy.sh
```

O script executa, nesta ordem:

1. `git pull --ff-only`;
2. `npm ci`;
3. `npm run build`;
4. `npm run db:deploy`;
5. reinício e verificação do serviço `idex-finance`.

Comandos úteis para diagnóstico:

```bash
sudo systemctl status idex-finance --no-pager -l
sudo journalctl -u idex-finance -n 200 --no-pager
sudo journalctl -u idex-finance -f
sudo nginx -t
docker ps
docker logs idex-finance-postgres --tail 100
```

Nunca execute `prisma db push` no banco de produção. Alterações estruturais devem chegar por migrações versionadas e ser aplicadas com `npm run db:deploy`.

## Backup em produção

O backup principal do banco é feito com `pg_dump` compactado:

```bash
cd /home/ubuntu/index-finance
bash deploy/backup-db.sh
```

O script grava os arquivos em `~/backups/postgres` e mantém sete dias de histórico. Ele pode ser agendado no `cron` do usuário `ubuntu`.

Além do PostgreSQL, preserve separadamente:

- `/home/ubuntu/index-finance/.env.local` em um cofre de segredos, não em backup público;
- `/home/ubuntu/index-finance/.data/uploads`, que contém os anexos físicos;
- as configurações ativas do Nginx e do serviço systemd.

A tela administrativa “Backup de Dados” gera um pacote JSON com um retrato dos dados carregados e cópias verificáveis dos anexos. Ela é útil para exportação e compatibilidade, mas não substitui o `pg_dump` como estratégia de recuperação do PostgreSQL.

## Desenvolvimento local

### Pré-requisitos

- Node.js 22 ou superior;
- npm 10 ou superior;
- Docker com Docker Compose;
- chave Gemini apenas para testar a análise inteligente.

### Instalação

```bash
git clone <URL_DO_REPOSITORIO>
cd index-finance
npm install
cp .env.example .env.local
npm run db:up
npm run db:deploy
npm run dev
```

No PowerShell, copie o ambiente com:

```powershell
Copy-Item .env.example .env.local
```

A aplicação fica disponível em [http://localhost:3000](http://localhost:3000).

## Variáveis de ambiente

| Variável | Obrigatória | Padrão local | Finalidade |
| --- | :---: | --- | --- |
| `DATABASE_URL` | Sim | — | Conexão privada usada pelo Prisma e pelo servidor |
| `BETTER_AUTH_URL` | Sim em produção | `http://localhost:3000` | URL pública/base da autenticação |
| `BETTER_AUTH_SECRET` | Sim em produção | — | Segredo exclusivo das sessões, com pelo menos 32 bytes aleatórios |
| `BETTER_AUTH_TRUSTED_ORIGINS` | Conforme ambiente | URL base | Origens adicionais permitidas, separadas por vírgula |
| `GEMINI_API_KEY` | Para análise por IA | — | Chave privada da API Gemini; nunca use prefixo `VITE_` |
| `GEMINI_MODEL` | Não | `gemini-2.5-flash` | Modelo utilizado na análise visual |
| `PORT` | Não | `3000` | Porta do servidor Express |
| `APP_URL` | Não | — | URL pública usada por integrações e links internos |
| `DISABLE_HMR` | Não | `false` | Desativa o acompanhamento de arquivos no Vite |
| `POSTGRES_DB` | Desenvolvimento/produção Docker | `idex_finance` | Nome do banco criado pelo Compose |
| `POSTGRES_USER` | Desenvolvimento/produção Docker | `idex_app` | Usuário do PostgreSQL |
| `POSTGRES_PASSWORD` | Sim | — | Senha exclusiva do PostgreSQL |
| `POSTGRES_PORT` | Não | `5432` | Porta publicada somente em `127.0.0.1` |

Nunca versione `.env.local`, chaves, senhas, dumps ou dados reais de clientes.

## Administrador inicial

O primeiro administrador e tenant são criados diretamente no servidor. A senha deve ter entre 8 e 128 caracteres e não pode conter o identificador do e-mail.

```powershell
$env:ADMIN_EMAIL="administrador@seudominio.com"
$env:ADMIN_NAME="Administrador"
$env:ADMIN_PASSWORD="uma-senha-forte-e-exclusiva"
$env:ADMIN_TENANT_NAME="Sua empresa"
$env:ADMIN_TENANT_SLUG="sua-empresa"
npm run auth:bootstrap-admin
Remove-Item Env:ADMIN_EMAIL, Env:ADMIN_NAME, Env:ADMIN_PASSWORD, Env:ADMIN_TENANT_NAME, Env:ADMIN_TENANT_SLUG
```

No Linux, defina as mesmas variáveis com `export`, execute o comando e remova-as da sessão com `unset`.

O bootstrap não sobrescreve uma conta existente.

## Scripts disponíveis

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Inicia Express e Vite em modo de desenvolvimento |
| `npm run build` | Gera o cliente Prisma e o bundle de produção |
| `npm start` | Serve APIs, uploads e SPA compilada em modo de produção |
| `npm run preview` | Abre diretamente a prévia do bundle Vite |
| `npm run clean` | Remove o bundle e artefatos locais de build |
| `npm run lint` | Executa a verificação TypeScript sem emitir arquivos |
| `npm test` | Executa os testes automatizados do frontend e backend |
| `npm run db:up` | Inicia o PostgreSQL local em Docker |
| `npm run db:down` | Encerra o contêiner sem remover o volume |
| `npm run db:logs` | Acompanha os logs do PostgreSQL local |
| `npm run db:generate` | Gera novamente o cliente Prisma |
| `npm run db:validate` | Valida o schema Prisma |
| `npm run db:check` | Verifica conexão, tabelas e migrações essenciais |
| `npm run db:migrate -- --name nome` | Cria e aplica uma migração em desenvolvimento |
| `npm run db:deploy` | Aplica migrações versionadas pendentes |
| `npm run db:status` | Exibe o estado das migrações |
| `npm run db:studio` | Abre o Prisma Studio |
| `npm run auth:bootstrap-admin` | Cria o primeiro administrador e tenant |
| `npm run auth:check` | Valida login, sessão e logout |
| `npm run company:check` | Valida empresas, isolamento, edição e desativação |
| `npm run financial-setup:check` | Valida contas, cadastros, Bolsa e saldos |
| `npm run financial-entries:check` | Valida títulos, parcelas, aprovações, baixas e saldos |
| `npm run documents:check` | Valida envio, fila BPO, revisão, aprovação e visibilidade de documentos |
| `npm run reconciliation:check` | Valida importação e conciliação bancária |
| `npm run users:check` | Valida credenciais, RBAC, senha temporária e primeiro acesso |

Antes de publicar uma alteração:

```bash
npm run lint
npm test
npm run build
```

Execute também o verificador integrado do módulo alterado quando ele existir.

## APIs internas

Todas as rotas operacionais exigem sessão válida e troca da senha temporária concluída.

| Domínio | Rotas principais |
| --- | --- |
| Sessão | `/api/auth/*`, `/api/me`, `/api/account/change-password` |
| Empresas e usuários | `/api/companies`, `/api/users` |
| Cadastros financeiros | `/api/financial-setup`, `/api/bank-accounts`, `/api/master-data` |
| Contas e importação | `/api/financial-entries`, `/api/financial-entries/import`, `/api/payables`, `/api/receivables` |
| Aprovações | `/api/payment-approvals`, `/api/document-approvals` |
| Documentos | `/api/document-records`, `/api/documents/*`, `/uploads/*` |
| Conciliação | `/api/reconciliation/*` |
| Auditoria e notificações | `/api/audit-logs`, `/api/notifications` |
| Caixa Padaria | `/api/bakery-cash/*` |
| Relatórios | `/api/reports`, `/api/report-templates` |
| Atendimento | `/api/support-tickets/*` |

O endpoint `GET /api/database/status` verifica a disponibilidade do PostgreSQL sem revelar credenciais. O endpoint `GET /api/documents/status` informa se a análise por IA está disponível e qual é o limite do arquivo.

## Estrutura do projeto

```text
index-finance/
├── api/                    # Adaptadores de funções para ambientes compatíveis
├── assets/                 # Identidade visual
├── backend/                # Regras de negócio, autorização e PostgreSQL
├── deploy/                 # Deploy, serviço systemd, Nginx e backup do banco
├── prisma/                 # Schema e migrações versionadas
├── scripts/                # Bootstrap e verificações integradas
├── src/
│   ├── components/         # Componentes reutilizáveis
│   ├── config/             # Módulos, relatórios e configurações da interface
│   ├── hooks/              # Estado global e integração dos módulos
│   ├── services/           # Clientes HTTP, importadores e geradores de arquivo
│   ├── types/              # Tipos e contratos TypeScript
│   ├── views/              # Telas do produto
│   ├── App.tsx             # Shell, navegação e controle de acesso
│   └── main.tsx            # Entrada do React
├── local-server.ts         # Express, APIs, uploads e entrega da SPA
├── compose.yaml            # PostgreSQL 17
├── prisma.config.ts        # Configuração do Prisma
├── vite.config.ts          # Vite e Tailwind CSS
├── .env.example            # Modelo de configuração
└── package.json            # Dependências e comandos
```

## Considerações operacionais

- O PostgreSQL é a fonte de verdade dos módulos operacionais;
- uploads continuam no disco da instância e precisam de backup próprio;
- o armazenamento atual de arquivos é adequado para uma única instância, mas deve migrar para object storage antes de escalar horizontalmente;
- o Gemini depende de chave, cota e disponibilidade do provedor;
- o backup JSON da interface não substitui o backup do banco;
- migrações devem ser revisadas antes do deploy;
- logs de aplicação podem ser consultados pelo `journalctl` e logs do proxy pelo Nginx.

## Contribuição

1. Crie uma branch a partir da branch principal;
2. implemente uma alteração pequena e delimitada;
3. preserve o isolamento por tenant e `companyId`;
4. adicione ou atualize testes do fluxo alterado;
5. execute lint, testes, build e o verificador integrado aplicável;
6. descreva no pull request o problema, a solução e a validação realizada.

Nunca inclua credenciais, dumps, anexos ou dados financeiros reais nos commits.

## Status e autoria

O Idex Finance está em produção e é desenvolvido pela **NFlow Analytics**.

O repositório não declara uma licença pública de distribuição. Consulte os responsáveis antes de copiar, modificar ou redistribuir o código.
