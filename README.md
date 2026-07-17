<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/89d6bb4d-1cd9-4f99-9093-a77f57deee49

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Análise visual de documentos

O comando `npm run dev` inicia o servidor Express e o Vite na porta 3000. A rota
`POST /api/documents/analyze` mantém a `GEMINI_API_KEY` no servidor e usa um
modelo multimodal para extrair dados de fotos e PDFs financeiros.

- Configure `GEMINI_API_KEY` em `.env.local`.
- Opcionalmente altere `GEMINI_MODEL` (padrão: `gemini-2.5-flash`).
- Use `npm run build` e `npm start` para servir a aplicação compilada.
