<div align="center">
  <img src="assets/idex-finance-logo-transparent.png" alt="Logo Idex Finance" width="260" />

  <h1>Idex Finance</h1>

  <p>
    Plataforma multiempresa para centralizar a operação de BPO financeiro,
    do recebimento de documentos à conciliação e à geração de relatórios.
  </p>

  <p>
    <img alt="React" src="https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white" />
    <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white" />
    <img alt="Vite" src="https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white" />
    <img alt="Node.js" src="https://img.shields.io/badge/Node.js-22-5FA04E?logo=nodedotjs&logoColor=white" />
    <img alt="Status" src="https://img.shields.io/badge/status-em%20desenvolvimento-F59E0B" />
  </p>
</div>

## Sobre o projeto

O **Idex Finance** é uma aplicação web responsiva para empresas e equipes de BPO que precisam acompanhar múltiplos clientes em um único workspace. A plataforma reúne rotinas financeiras, documentos, aprovações, conciliação bancária, indicadores e atendimento ao cliente com separação de acesso por perfil.

O projeto combina uma SPA em React com um servidor Express. O servidor entrega a aplicação, recebe uploads e protege a chave usada na análise de documentos com Gemini. Autenticação, usuários, RBAC, empresas, contas bancárias, cadastros mestres, contas a pagar e contas a receber já usam PostgreSQL; os demais módulos permanecem temporariamente no `localStorage`. Os arquivos enviados ficam no diretório local `.data/uploads`.

## Funcionalidades

- Dashboard financeiro com indicadores e visão consolidada;
- centro de operações multiempresa para a equipe de BPO;
- contas a pagar e contas a receber;
- fluxo de caixa e acompanhamento de vencimentos;
- central de aprovações com histórico de decisões;
- conciliação bancária manual e automática;
- recebimento, visualização e classificação de documentos;
- extração de dados de imagens e PDFs financeiros com Gemini;
- lançamentos financeiros manuais ou originados de documentos;
- DRE, relatórios e exportações;
- cadastros de fornecedores, clientes, categorias e centros de custo;
- gestão de empresas, colaboradores e permissões por perfil (RBAC);
- logs de auditoria, notificações e backup dos dados locais;
- abertura e acompanhamento de requerimentos entre clientes e BPO;
- interface responsiva para desktop e dispositivos móveis.

## Perfis de acesso

| Perfil | Escopo principal |
| --- | --- |
| `BPO_ADMIN` | Visão global, gestão de empresas e equipe, auditoria, backup e service desk |
| `BPO_TEAM` | Execução das rotinas financeiras conforme as permissões concedidas |
| `CLIENT` | Acompanhamento da empresa, aprovações, documentos e solicitações ao BPO |
| `ACCOUNTANT` | Consulta e colaboração nas informações financeiras da empresa autorizada |

> O login usa autenticação definitiva no backend, com sessões no PostgreSQL e
> acesso derivado dos vínculos ativos do usuário com tenants e empresas.

## Tecnologias

| Camada | Tecnologias |
| --- | --- |
| Frontend | React 19, TypeScript, Vite e Tailwind CSS 4 |
| Interface | Lucide React e Motion |
| Gráficos | Recharts |
| Planilhas | SheetJS (`xlsx`) |
| Backend | Node.js e Express |
| Inteligência artificial | Google GenAI / Gemini |
| Persistência atual | PostgreSQL, `localStorage` durante a migração e sistema de arquivos local |

## Pré-requisitos

- [Node.js](https://nodejs.org/) 22 ou superior;
- npm 10 ou superior;
- uma chave da API Gemini, necessária apenas para análise inteligente de documentos.

## Instalação e execução

1. Clone o repositório e acesse a pasta do projeto:

   ```bash
   git clone <URL_DO_REPOSITORIO>
   cd index-finance
   ```

2. Instale as dependências:

   ```bash
   npm install
   ```

3. Crie o arquivo de ambiente local a partir do exemplo:

   ```bash
   cp .env.example .env.local
   ```

   No PowerShell, use:

   ```powershell
   Copy-Item .env.example .env.local
   ```

4. Ajuste as variáveis em `.env.local` e inicie o ambiente de desenvolvimento:

   ```bash
   npm run dev
   ```

5. Acesse [http://localhost:3000](http://localhost:3000).

Na tela inicial, entre com uma conta criada pelo bootstrap administrativo. A
sessão é restaurada com segurança ao recarregar a página.

## Variáveis de ambiente

| Variável | Obrigatória | Padrão | Descrição |
| --- | :---: | --- | --- |
| `GEMINI_API_KEY` | Para IA | — | Chave privada usada exclusivamente pelo servidor para chamar a API Gemini |
| `GEMINI_MODEL` | Não | `gemini-2.5-flash` | Modelo utilizado na análise visual de documentos |
| `PORT` | Não | `3000` | Porta HTTP do servidor Express |
| `APP_URL` | Não | — | URL pública da aplicação, reservada para integrações e callbacks |
| `DISABLE_HMR` | Não | `false` | Desativa HMR e o acompanhamento de arquivos no Vite quando definido como `true` |
| `DATABASE_URL` | Para PostgreSQL | — | Conexão privada usada exclusivamente pelo servidor e pelo Prisma |
| `BETTER_AUTH_URL` | Para autenticação | `http://localhost:3000` | URL base da aplicação; em produção deve usar o domínio HTTPS definitivo |
| `BETTER_AUTH_SECRET` | Produção | — | Segredo aleatório exclusivo usado para proteger as sessões; nunca deve ir para o frontend |
| `BETTER_AUTH_TRUSTED_ORIGINS` | Não | URL base | Origens adicionais permitidas, separadas por vírgula |
| `POSTGRES_DB` | Desenvolvimento | `idex_finance` | Banco criado pelo Docker Compose local |
| `POSTGRES_USER` | Desenvolvimento | `idex_app` | Usuário do PostgreSQL local |
| `POSTGRES_PASSWORD` | Desenvolvimento | — | Senha local; use um segredo forte e exclusivo em produção |
| `POSTGRES_PORT` | Não | `5432` | Porta local publicada apenas em `127.0.0.1` |

Nunca versione `.env.local` nem chaves reais. Arquivos `.env*` estão ignorados pelo Git, com exceção de `.env.example`.

## PostgreSQL local

O banco definitivo usa PostgreSQL 17 e Prisma. O Docker publica o banco somente
em `127.0.0.1`, e o volume `idex-finance-postgres-data` preserva os dados entre
reinicializações dos contêineres.

```powershell
Copy-Item .env.example .env.local
npm run db:up
npm run db:deploy
npm run db:status
```

Durante o desenvolvimento de uma nova alteração estrutural, crie uma migração
versionada com `npm run db:migrate -- --name nome_da_alteracao`. Em produção,
aplique apenas migrações já revisadas usando `npm run db:deploy`; nunca use
`prisma db push` contra o banco de produção.

O endpoint `GET /api/database/status` verifica a conexão sem revelar endereço,
usuário ou credenciais. Empresas, usuários, contas bancárias, cadastros mestres e
títulos a pagar/receber são carregados do banco após o login; outros módulos ainda usam `localStorage`
durante a migração gradual.

## Autenticação e administrador inicial

O backend usa login por e-mail e senha, Argon2id para armazenamento das senhas,
cookies de sessão `HttpOnly`, expiração em 12 horas e limite de cinco tentativas
de login por minuto. O cadastro público está desativado: o primeiro administrador
é criado por um comando executado diretamente no servidor. A interface restaura
a sessão ao recarregar a página e resolve o papel e as permissões separadamente
para cada empresa ativa.

As rotas de documentos e os arquivos em `/uploads` exigem sessão ativa. A área
de equipe cria usuários, credenciais Argon2id, vínculos com empresas, papéis e
permissões diretamente no PostgreSQL. O servidor gera uma senha temporária que
é exibida uma única vez; antes de acessar o workspace, o novo usuário precisa
substituí-la por uma senha exclusiva. Redefinições encerram as sessões ativas.

O cadastro de empresas já usa o PostgreSQL como fonte de verdade. A criação grava
empresa, conta bancária inicial e cadastros básicos em uma única transação. As
listagens respeitam os vínculos do usuário, e a exclusão administrativa é uma
desativação lógica para evitar perda acidental. A logo normalizada também é
persistida no banco nesta fase e poderá ser movida para object storage depois.

Contas bancárias e cadastros mestres também usam o PostgreSQL como fonte de
verdade. Inclusões, edições e desativações são autorizadas por tenant e empresa,
registradas em auditoria e reaparecem em qualquer dispositivo. A conta interna
Bolsa é única por empresa, e ajustes de saldo e transferências são transacionais.

Contas a pagar e a receber são persistidas com parcelamento calculado no servidor,
aprovação de pagamentos, baixas parciais, cancelamentos e vínculo com a conta
bancária. Pagamentos e recebimentos alteram título e saldo na mesma transação.

Defina temporariamente as variáveis abaixo em um terminal administrativo e rode
o bootstrap uma única vez. A senha deve ter entre 8 e 128 caracteres e não deve
conter o identificador do e-mail.

```powershell
$env:ADMIN_EMAIL="administrador@seudominio.com"
$env:ADMIN_NAME="Administrador"
$env:ADMIN_PASSWORD="uma-senha-forte-e-exclusiva"
$env:ADMIN_TENANT_NAME="Sua empresa"
$env:ADMIN_TENANT_SLUG="sua-empresa"
npm run auth:bootstrap-admin
Remove-Item Env:ADMIN_EMAIL, Env:ADMIN_NAME, Env:ADMIN_PASSWORD, Env:ADMIN_TENANT_NAME, Env:ADMIN_TENANT_SLUG
```

O comando se recusa a sobrescrever uma conta existente. Para verificar login,
cookie de sessão e logout usando um usuário efêmero, execute
`npm run auth:check`.

## Scripts disponíveis

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Inicia o Express com o Vite em modo middleware e desenvolvimento |
| `npm run build` | Gera o bundle de produção em `dist/` |
| `npm start` | Serve a API, os uploads e o bundle compilado em modo de produção |
| `npm run preview` | Visualiza diretamente o bundle do Vite |
| `npm run lint` | Executa a verificação estática do TypeScript sem emitir arquivos |
| `npm run clean` | Remove os artefatos locais de build |
| `npm run db:up` | Inicia o PostgreSQL local em Docker |
| `npm run db:down` | Encerra os contêineres sem apagar o volume de dados |
| `npm run db:check` | Confirma a conexão, as tabelas essenciais e as migrações aplicadas |
| `npm run db:migrate -- --name nome` | Cria e aplica uma migração de desenvolvimento |
| `npm run db:deploy` | Aplica migrações pendentes em homologação ou produção |
| `npm run db:status` | Exibe o estado das migrações |
| `npm run db:studio` | Abre a interface administrativa local do Prisma |
| `npm run auth:bootstrap-admin` | Cria o primeiro administrador e seu tenant sem habilitar cadastro público |
| `npm run auth:check` | Valida login, sessão e logout contra o PostgreSQL |
| `npm run company:check` | Valida criação transacional, isolamento, edição e desativação de empresas |
| `npm run financial-setup:check` | Valida contas bancárias, dados mestres, isolamento, conta Bolsa e saldos |
| `npm run financial-entries:check` | Valida parcelas, aprovações, baixas, recebimentos, cancelamentos e saldos atômicos |
| `npm run users:check` | Valida credencial, RBAC, senha temporária, primeiro acesso e desativação de usuários |

Para validar e executar a versão de produção:

```bash
npm run lint
npm run build
npm start
```

## Deploy na Vercel

A Vercel publica o frontend Vite e transforma os arquivos em `api/` em funções
Node.js. Para ativar o Assistente de Documentos:

1. abra o projeto na Vercel e acesse **Settings > Environment Variables**;
2. crie `GEMINI_API_KEY` com a chave real, sem o prefixo `VITE_`;
3. opcionalmente, crie `GEMINI_MODEL` (o padrão é `gemini-2.5-flash`);
4. marque os ambientes em que a chave deve existir, especialmente `Production`;
5. faça um novo deploy, pois alterações de variáveis só chegam a deployments novos.

Depois do deploy, abra `/api/documents/status` no domínio da aplicação. O JSON
deve retornar `"available": true`. A chave nunca é enviada ao frontend: a API
cria uma sessão temporária e o navegador envia o documento diretamente ao
Gemini. O arquivo temporário é excluído após a análise.

Na hospedagem local, os arquivos incluídos são mantidos em `.data/uploads`. Na
Vercel, que não oferece disco persistente para esse fluxo, somente os metadados
extraídos são mantidos no `localStorage`; o arquivo original não é preservado.
Para persistência real e acesso entre dispositivos, conecte um armazenamento de
objetos privado e um banco de dados antes de usar o sistema em produção.

## Análise e upload de documentos

A central aceita arquivos PDF, JPG, PNG, HEIC, OFX, XML, XLSX e CSV com até **20 MB**. Localmente, os uploads confirmados são enviados em Base64 ao backend e armazenados em `.data/uploads` com um nome aleatório.

A análise inteligente está disponível para JPEG, PNG, WebP, HEIC, HEIF e PDF. Quando `GEMINI_API_KEY` está configurada, o servidor autoriza um upload temporário direto ao Gemini e retorna campos estruturados, como fornecedor, vencimento, valor, competência, tipo do documento, resumo, confiança e alertas de legibilidade.

### Endpoints internos

| Método | Rota | Finalidade |
| --- | --- | --- |
| `POST` | `/api/documents/upload` | Armazena um arquivo enviado pela interface |
| `POST` | `/api/documents/upload-url` | Cria uma sessão temporária de upload direto ao Gemini |
| `GET` | `/api/documents/status` | Informa se a análise por IA está configurada e qual modelo está ativo |
| `POST` | `/api/documents/analyze` | Analisa visualmente um documento compatível |
| `GET` | `/api/database/status` | Verifica se o PostgreSQL está configurado e acessível sem revelar credenciais |
| `POST` | `/api/auth/sign-in/email` | Inicia sessão com e-mail e senha |
| `GET` | `/api/auth/get-session` | Consulta a sessão atual |
| `POST` | `/api/auth/sign-out` | Encerra a sessão atual |
| `GET` | `/api/me` | Retorna o usuário autenticado e seus acessos ativos por empresa |
| `GET` | `/api/companies` | Lista somente empresas e tenants acessíveis pela sessão |
| `POST` | `/api/companies` | Cadastra empresa, conta inicial e dados mestres em transação |
| `PATCH` | `/api/companies/:id` | Atualiza dados, módulos e status de uma empresa autorizada |
| `DELETE` | `/api/companies/:id` | Desativa logicamente uma empresa autorizada |
| `GET` | `/api/financial-setup` | Carrega contas bancárias e cadastros mestres das empresas acessíveis |
| `POST/PATCH/DELETE` | `/api/bank-accounts` | Gerencia contas bancárias com autorização por empresa |
| `POST` | `/api/bank-accounts/batch-adjust` | Aplica movimentações de saldo de forma atômica |
| `POST/PATCH/DELETE` | `/api/master-data` | Gerencia cadastros mestres e suas hierarquias |
| `GET` | `/api/financial-entries` | Carrega contas a pagar, contas a receber e aprovações de pagamento acessíveis |
| `POST/PATCH` | `/api/payables` | Cria, edita, agenda, cancela e registra pagamentos de títulos |
| `POST/PATCH` | `/api/receivables` | Cria, edita, cancela e registra recebimentos de títulos |
| `GET` | `/api/users` | Lista os usuários administráveis no tenant da sessão |
| `POST` | `/api/users` | Cria usuário, credencial temporária e vínculos de acesso |
| `PATCH` | `/api/users/:id` | Atualiza perfil, status, empresas e permissões |
| `POST` | `/api/users/:id/reset-password` | Gera uma nova senha temporária e encerra sessões |
| `DELETE` | `/api/users/:id` | Desativa usuário, revoga vínculos e encerra sessões |
| `POST` | `/api/account/change-password` | Troca a senha da própria conta e libera o primeiro acesso |
| `GET` | `/uploads/:arquivo` | Entrega um arquivo armazenado localmente |

## Estrutura do projeto

```text
index-finance/
├── assets/                 # Identidade visual e imagens
├── backend/                # Integrações privadas e cliente PostgreSQL
├── prisma/                 # Esquema e migrações versionadas do banco
├── scripts/                # Verificações operacionais e geração de prévias
├── src/
│   ├── components/         # Componentes reutilizáveis
│   ├── hooks/              # Estado global e regras da aplicação
│   ├── services/           # Dados demonstrativos, upload e análise
│   ├── types/              # Tipos e contratos TypeScript
│   ├── views/              # Telas e módulos do produto
│   ├── App.tsx             # Shell, navegação e controle de acesso
│   ├── index.css           # Estilos globais
│   └── main.tsx            # Ponto de entrada do React
├── local-server.ts         # Express local, uploads e entrega da SPA
├── compose.yaml            # PostgreSQL 17 para desenvolvimento local
├── prisma.config.ts        # Configuração do Prisma ORM
├── vite.config.ts          # Configuração do Vite e Tailwind CSS
├── .env.example            # Modelo de configuração local
└── package.json            # Dependências e scripts
```

## Persistência, backup e limitações atuais

- Empresas, contas bancárias, saldos, cadastros mestres e títulos a pagar/receber são persistidos no PostgreSQL.
- Documentos, conciliação, notificações e os demais módulos operacionais ainda ficam no `localStorage` durante a migração gradual.
- O módulo de backup exporta e restaura os dados locais em JSON.
- Os uploads ficam no disco da instância do servidor e não são replicados para armazenamento externo.
- A autenticação, a tela de login e as sessões definitivas já usam o backend e o PostgreSQL.
- Usuários, credenciais, papéis, permissões e vínculos por empresa já são persistidos no PostgreSQL.
- Reiniciar o armazenamento do navegador ou usar outro dispositivo cria uma experiência de dados independente.

Antes de uso real, ainda é necessário conectar os módulos operacionais restantes ao PostgreSQL, adicionar armazenamento de objetos, proteger os arquivos com antivírus, configurar observabilidade e gerir segredos na infraestrutura.

## Como contribuir

1. Crie uma branch a partir da branch principal;
2. implemente uma alteração pequena e bem delimitada;
3. execute `npm run lint` e `npm run build`;
4. descreva no pull request o problema, a solução e como validar a mudança.

Adote componentes e tipos já existentes, preserve a separação de dados por `companyId` e nunca inclua credenciais ou dados financeiros reais nos commits.

## Status e autoria

O Idex Finance está em desenvolvimento e atualmente funciona como uma demonstração funcional da experiência de BPO financeiro. Desenvolvido por **NFlow Analytics**.

O repositório ainda não declara uma licença de distribuição. Consulte os responsáveis pelo projeto antes de copiar, modificar ou redistribuir o código.
