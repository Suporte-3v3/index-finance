import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx";
import type { ReportDocumentData } from "./reportFiles";
import { createExcel } from "./reportExcel";
import type { ReportRecord } from "../types";
import {
  hasDownloadableReportFile,
  persistedReportFileUrl,
} from "./reportDownload";

test("Excel dos relatórios usa datas reais no padrão DD-MM-AAAA", () => {
  const document: ReportDocumentData = {
    title: "Contas a Pagar",
    companyName: "Empresa Teste",
    period: { startDate: "2026-08-01", endDate: "2026-08-31" },
    filters: "Período: 01-08-2026 a 31-08-2026",
    generatedAt: "2026-08-17T12:30:00.000Z",
    generatedBy: "Teste",
    timeZone: "America/Sao_Paulo",
    sections: [{
      kind: "table",
      title: "Lançamentos",
      columns: ["Vencimento", "Descrição", "Competência"],
      rows: [["2026-08-20", "Fornecedor", "2026-08"]],
    }],
  };

  const workbook = XLSX.read(createExcel(document), {
    type: "base64",
    cellDates: true,
    cellNF: true,
  });
  const summary = workbook.Sheets.Resumo;
  const entries = workbook.Sheets["Lançamentos"];

  assert.equal(summary.B5.v, "01-08-2026 a 31-08-2026");
  assert.equal(summary.B7.v, "17-08-2026 09:30");
  assert.ok(entries.A3.v instanceof Date);
  assert.equal(entries.A3.z, "dd-mm-yyyy");
  assert.equal(entries.C3.v, "08-2026");
});

test("reconhece relatório histórico com arquivo persistido", () => {
  const report: ReportRecord = {
    id: "report-1",
    companyId: "company-1",
    name: "Histórico",
    type: "Contas a Pagar",
    filters: "Sem filtros",
    generatedAt: "2026-08-18T12:00:00.000Z",
    generatedById: "user-1",
    generatedByName: "Teste",
    fileName: "historico.pdf",
    fileUrl: "/uploads/historico.pdf",
    fileSize: "10 KB",
  };
  assert.equal(hasDownloadableReportFile(report), true);
  assert.equal(persistedReportFileUrl(report), "/uploads/historico.pdf");
});
