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

O projeto combina uma SPA em React com um servidor Express. O servidor entrega a aplicação, recebe uploads e protege a chave usada na análise de documentos com Gemini. No estágio atual, os dados operacionais são demonstrativos e persistidos no `localStorage` do navegador; os arquivos enviados ficam no diretório local `.data/uploads`.

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

> A implementação atual de login é demonstrativa e usa uma senha compartilhada configurada no frontend. Ela não substitui autenticação de produção.

## Tecnologias

| Camada | Tecnologias |
| --- | --- |
| Frontend | React 19, TypeScript, Vite e Tailwind CSS 4 |
| Interface | Lucide React e Motion |
| Gráficos | Recharts |
| Planilhas | SheetJS (`xlsx`) |
| Backend | Node.js e Express |
| Inteligência artificial | Google GenAI / Gemini |
| Persistência atual | `localStorage` e sistema de arquivos local |

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

Na tela inicial, você pode selecionar um dos perfis demonstrativos. Todos usam o valor definido em `VITE_ACCESS_PASSWORD` (o fallback de desenvolvimento é `123456`).

## Variáveis de ambiente

| Variável | Obrigatória | Padrão | Descrição |
| --- | :---: | --- | --- |
| `GEMINI_API_KEY` | Para IA | — | Chave privada usada exclusivamente pelo servidor para chamar a API Gemini |
| `GEMINI_MODEL` | Não | `gemini-2.5-flash` | Modelo utilizado na análise visual de documentos |
| `VITE_ACCESS_PASSWORD` | Recomendada | `123456` | Senha compartilhada dos perfis demonstrativos; é incorporada ao bundle do frontend |
| `PORT` | Não | `3000` | Porta HTTP do servidor Express |
| `APP_URL` | Não | — | URL pública da aplicação, reservada para integrações e callbacks |
| `DISABLE_HMR` | Não | `false` | Desativa HMR e o acompanhamento de arquivos no Vite quando definido como `true` |

Nunca versione `.env.local` nem chaves reais. Arquivos `.env*` estão ignorados pelo Git, com exceção de `.env.example`.

## Scripts disponíveis

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Inicia o Express com o Vite em modo middleware e desenvolvimento |
| `npm run build` | Gera o bundle de produção em `dist/` |
| `npm start` | Serve a API, os uploads e o bundle compilado em modo de produção |
| `npm run preview` | Visualiza diretamente o bundle do Vite |
| `npm run lint` | Executa a verificação estática do TypeScript sem emitir arquivos |
| `npm run clean` | Remove os artefatos locais de build |

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
| `GET` | `/uploads/:arquivo` | Entrega um arquivo armazenado localmente |

## Estrutura do projeto

```text
index-finance/
├── assets/                 # Identidade visual e imagens
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
├── vite.config.ts          # Configuração do Vite e Tailwind CSS
├── .env.example            # Modelo de configuração local
└── package.json            # Dependências e scripts
```

## Persistência, backup e limitações atuais

- As entidades financeiras e configurações ficam no `localStorage` do navegador que abriu a aplicação.
- O módulo de backup exporta e restaura os dados locais em JSON.
- Os uploads ficam no disco da instância do servidor e não são replicados para armazenamento externo.
- Não há banco de dados, sincronização multiusuário, sessões no backend ou provedor de identidade.
- A senha demonstrativa usa o prefixo `VITE_` e, portanto, é pública no bundle gerado.
- Reiniciar o armazenamento do navegador ou usar outro dispositivo cria uma experiência de dados independente.

Antes de uso real, recomenda-se implementar autenticação no backend, banco de dados transacional, armazenamento de objetos, isolamento de tenant no servidor, validação de autorização em cada endpoint, rate limiting, antivírus para uploads, observabilidade e gestão segura de segredos.

## Como contribuir

1. Crie uma branch a partir da branch principal;
2. implemente uma alteração pequena e bem delimitada;
3. execute `npm run lint` e `npm run build`;
4. descreva no pull request o problema, a solução e como validar a mudança.

Adote componentes e tipos já existentes, preserve a separação de dados por `companyId` e nunca inclua credenciais ou dados financeiros reais nos commits.

## Status e autoria

O Idex Finance está em desenvolvimento e atualmente funciona como uma demonstração funcional da experiência de BPO financeiro. Desenvolvido por **NFlow Analytics**.

O repositório ainda não declara uma licença de distribuição. Consulte os responsáveis pelo projeto antes de copiar, modificar ou redistribuir o código.
