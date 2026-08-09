import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createServer } from "vite";

const root = process.cwd();
const outputDir = path.join(root, "output", "pdf");
await mkdir(outputDir, { recursive: true });

const logoBytes = await readFile(
  path.join(root, "assets", "idex-finance-logo-transparent.png"),
);
const logoData = `data:image/png;base64,${logoBytes.toString("base64")}`;
const vite = await createServer({
  root,
  appType: "custom",
  logLevel: "silent",
  server: { middlewareMode: true },
});

try {
  const { createIdexReportPdf } = await vite.ssrLoadModule(
    "/src/services/idexReportTemplate.ts",
  );
  const currency = (value: number) =>
    value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const payableRows = Array.from({ length: 74 }, (_, index) => {
    const day = String((index % 28) + 1).padStart(2, "0");
    const status = ["Paga", "Pendente", "Vencida", "Parcialmente paga", "Cancelada"][index % 5];
    const value = index === 7 ? -425.75 : 640 + index * 37.42;
    return [
      `2026-07-${day}`,
      `Fornecedor ${String(index + 1).padStart(2, "0")}`,
      index % 9 === 0
        ? "Licenciamento, suporte técnico e serviços recorrentes com descrição longa para validar quebra de linha"
        : `Serviço financeiro ${index + 1}`,
      index % 2 ? "Serviços" : "Infraestrutura TI",
      index % 3 ? "Administrativo" : "Operações",
      status,
      currency(value),
      status === "Paga" ? `2026-07-${day}` : "-",
    ];
  });

  const payableDocument = {
    title: "Contas a Pagar - Julho de 2026",
    reportType: "Contas a Pagar",
    description: "Pagamentos, obrigações e despesas do período.",
    companyName: "Alfa Tecnologia",
    companyCnpj: "12.345.678/0001-90",
    companyLogoDataUrl: logoData,
    filters: "Período: 01/07/2026 a 31/07/2026 | Status: Todos | Categoria: Serviços",
    appliedFilters: [
      { label: "Período", value: "01/07/2026 a 31/07/2026" },
      { label: "Base da data", value: "Vencimento" },
      { label: "Categoria", value: "Serviços" },
      { label: "Conta financeira", value: "Banco Idex" },
    ],
    period: {
      startDate: "2026-07-01",
      endDate: "2026-07-31",
      dateBasis: "Vencimento",
    },
    generatedAt: "2026-08-06T17:30:00.000Z",
    generatedBy: "Vitória Martins",
    notes: "Conferir os títulos vencidos antes do fechamento.\nValores negativos representam créditos aplicados no período.",
    orientation: "auto",
    sections: [
      {
        kind: "kpis",
        title: "Resumo",
        items: [
          { label: "Total geral", value: currency(248940.82) },
          { label: "Total pago", value: currency(112540.2) },
          { label: "Total pendente", value: currency(104300.62) },
          { label: "Total vencido", value: currency(32100) },
          { label: "Quantidade de lançamentos", value: "74" },
        ],
      },
      {
        kind: "table",
        title: "Lançamentos do período",
        columns: ["Vencimento", "Fornecedor", "Descrição", "Categoria", "Centro de custo", "Status", "Valor", "Pagamento"],
        rows: payableRows,
      },
    ],
  };

  const emptyDocument = {
    title: "Contas a Receber - Sem registros",
    reportType: "Contas a Receber",
    companyName: "Alfa Tecnologia",
    companyCnpj: "12.345.678/0001-90",
    filters: "Período: 01/08/2026 a 31/08/2026 | Status: Recebido",
    appliedFilters: [
      { label: "Período", value: "01/08/2026 a 31/08/2026" },
      { label: "Status", value: "Recebido" },
    ],
    period: {
      startDate: "2026-08-01",
      endDate: "2026-08-31",
      dateBasis: "Vencimento",
    },
    generatedAt: "2026-08-09T13:00:00.000Z",
    generatedBy: "Vitória Martins",
    orientation: "portrait",
    sections: [
      {
        kind: "kpis",
        title: "Resumo",
        items: [
          { label: "Total previsto", value: currency(0) },
          { label: "Total recebido", value: currency(0) },
          { label: "Total pendente", value: currency(0) },
          { label: "Total vencido", value: currency(0) },
          { label: "Inadimplência", value: "-" },
        ],
      },
      {
        kind: "table",
        title: "Lançamentos do período",
        columns: ["Vencimento", "Cliente", "Descrição", "Status", "Valor"],
        rows: [],
      },
    ],
  };

  const fixtures = [
    ["preview-contas-a-pagar.pdf", payableDocument],
    ["preview-sem-registros.pdf", emptyDocument],
  ] as const;

  for (const [fileName, document] of fixtures) {
    const pdf = fileName === "preview-contas-a-pagar.pdf"
      ? createIdexReportPdf(document)
      : createIdexReportPdf(document, logoData);
    await writeFile(path.join(outputDir, fileName), pdf);
  }
} finally {
  await vite.close();
}

