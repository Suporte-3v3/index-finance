/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useRef, useState } from "react";
import { useBPOState } from "../hooks/useBPOState";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Table,
  TableHead,
  TableBody,
  Tr,
  Th,
  Td,
  Tooltip,
  useToast,
} from "../components/ui";
import {
  buildImportTemplateMasterData,
  downloadImportTemplate,
  parseImportFile,
  toImportPayload,
  type ImportEntriesResult,
  type ParsedImportRow,
} from "../services/financialEntriesImport";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Upload,
  XCircle,
} from "lucide-react";

const formatBRL = (value: number) =>
  `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

export default function ImportEntriesView() {
  const { activeCompany, masterData, bankAccounts, hasPermission, importFinancialEntries } = useBPOState();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDownloading, setIsDownloading] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState("");
  const [rows, setRows] = useState<ParsedImportRow[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportEntriesResult | null>(null);

  const canCreatePayable = hasPermission("accounts-payable.create");
  const canCreateReceivable = hasPermission("accounts-receivable.create");

  const reference = useMemo(
    () =>
      activeCompany
        ? buildImportTemplateMasterData(masterData, bankAccounts, activeCompany.id)
        : null,
    [activeCompany, masterData, bankAccounts],
  );

  const validRows = rows.filter((row) => row.errors.length === 0);
  const invalidRows = rows.filter((row) => row.errors.length > 0);

  const handleDownloadTemplate = async () => {
    if (!activeCompany || !reference) return;
    setIsDownloading(true);
    try {
      await downloadImportTemplate(activeCompany.tradeName, reference);
    } catch (error) {
      showToast("error", "Não foi possível gerar a planilha modelo.", error instanceof Error ? error.message : undefined);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleFileSelected = async (file: File) => {
    if (!reference) return;
    setParseError("");
    setImportResult(null);
    setIsParsing(true);
    try {
      const parsed = await parseImportFile(file, reference);
      setRows(parsed);
    } catch (error) {
      setRows([]);
      setParseError(error instanceof Error ? error.message : "Não foi possível ler o arquivo enviado.");
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleImport = async () => {
    if (!activeCompany || !validRows.length) return;
    setIsImporting(true);
    try {
      const outcome = await importFinancialEntries(
        activeCompany.id,
        validRows.map((row) => toImportPayload(row)),
      );
      if (!outcome.success || !outcome.result) {
        showToast("error", "Não foi possível importar os lançamentos.", outcome.error);
        return;
      }
      const { result } = outcome;
      setImportResult(result);
      if (result.failedCount === 0) {
        showToast("success", `${result.createdCount} lançamento(s) importado(s) com sucesso.`);
        setRows([]);
      } else {
        showToast(
          "warning",
          `${result.createdCount} importado(s), ${result.failedCount} com falha.`,
          "Veja o detalhe de cada linha abaixo.",
        );
      }
    } finally {
      setIsImporting(false);
    }
  };

  if (!activeCompany) {
    return (
      <div className="p-6">
        <EmptyState
          icon={<FileSpreadsheet />}
          title="Selecione uma empresa"
          description="Entre em uma empresa cliente para baixar o modelo e importar lançamentos."
        />
      </div>
    );
  }

  if (!canCreatePayable && !canCreateReceivable) {
    return (
      <div className="p-6">
        <EmptyState
          icon={<AlertCircle />}
          title="Sem permissão"
          description="Você não tem permissão para cadastrar contas a pagar ou a receber nesta empresa."
        />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-lg font-bold text-ink dark:text-ink-dark tracking-tight">
          Importar Lançamentos
        </h1>
        <p className="text-xs text-ink-soft dark:text-ink-soft-dark mt-1">
          Baixe a planilha modelo, preencha uma linha por lançamento (contas a pagar e a
          receber podem ir juntas) e envie o arquivo de volta para criar tudo de uma vez.
        </p>
      </div>

      <Card>
        <CardHeader
          title="1. Baixar planilha modelo"
          description="O modelo já vem com as categorias, centros de custo, formas de pagamento e contas bancárias cadastradas para esta empresa."
        />
        <div className="mt-4">
          <Button
            variant="secondary"
            icon={<Download className="h-4 w-4" />}
            loading={isDownloading}
            onClick={handleDownloadTemplate}
          >
            Baixar planilha modelo
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="2. Enviar planilha preenchida"
          description="Aceita arquivos .xlsx ou .xls."
        />
        <div className="mt-4 flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFileSelected(file);
            }}
          />
          <Button
            variant="outline"
            icon={<Upload className="h-4 w-4" />}
            loading={isParsing}
            onClick={() => fileInputRef.current?.click()}
          >
            Selecionar arquivo
          </Button>
        </div>
        {parseError && (
          <p className="mt-3 text-xs font-semibold text-brand-red-600 dark:text-red-400 flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {parseError}
          </p>
        )}
      </Card>

      {rows.length > 0 && (
        <Card padding={false}>
          <div className="p-5 pb-0">
            <CardHeader
              title="3. Revisar e confirmar"
              description="Linhas com erro não serão importadas — corrija-as na planilha e envie novamente."
              action={
                <div className="flex items-center gap-2">
                  <Badge tone="green" icon={<CheckCircle2 className="h-3.5 w-3.5" />}>
                    {validRows.length} válida(s)
                  </Badge>
                  {invalidRows.length > 0 && (
                    <Badge tone="red" icon={<XCircle className="h-3.5 w-3.5" />}>
                      {invalidRows.length} com erro
                    </Badge>
                  )}
                </div>
              }
            />
          </div>
          <div className="mt-4">
            <Table>
              <TableHead>
                <Tr>
                  <Th>Status</Th>
                  <Th>Tipo</Th>
                  <Th>Descrição</Th>
                  <Th>Fornecedor/Cliente</Th>
                  <Th align="right">Valor</Th>
                  <Th>Vencimento</Th>
                </Tr>
              </TableHead>
              <TableBody>
                {rows.map((row) => {
                  const hasErrors = row.errors.length > 0;
                  const hasWarnings = row.warnings.length > 0;
                  const messages = [...row.errors, ...row.warnings];
                  return (
                    <Tr key={row.row}>
                      <Td>
                        <Tooltip
                          content={
                            messages.length ? (
                              <ul className="space-y-0.5">
                                {messages.map((message, index) => (
                                  <li key={index}>{message}</li>
                                ))}
                              </ul>
                            ) : (
                              "Linha pronta para importação."
                            )
                          }
                        >
                          <span className="inline-flex items-center gap-1.5 cursor-help">
                            {hasErrors ? (
                              <XCircle className="h-4 w-4 text-brand-red-600" />
                            ) : hasWarnings ? (
                              <AlertTriangle className="h-4 w-4 text-amber-600" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4 text-brand-green-600" />
                            )}
                            <span className="text-xs text-ink-soft dark:text-ink-soft-dark">
                              Linha {row.row}
                            </span>
                          </span>
                        </Tooltip>
                      </Td>
                      <Td>
                        {row.type ? (
                          <Badge tone={row.type === "PAGAR" ? "red" : "green"}>
                            {row.type === "PAGAR" ? "A Pagar" : "A Receber"}
                          </Badge>
                        ) : (
                          "-"
                        )}
                      </Td>
                      <Td className="max-w-64 truncate">{row.fields.description || "-"}</Td>
                      <Td className="max-w-48 truncate">{row.fields.partyName || "-"}</Td>
                      <Td align="right">
                        {Number.isFinite(row.fields.amount) ? formatBRL(row.fields.amount) : "-"}
                      </Td>
                      <Td>{row.fields.dueDate || "-"}</Td>
                    </Tr>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <div className="p-5 flex justify-end">
            <Button
              icon={<Upload className="h-4 w-4" />}
              loading={isImporting}
              disabled={!validRows.length}
              onClick={handleImport}
            >
              Importar {validRows.length} lançamento(s)
            </Button>
          </div>
        </Card>
      )}

      {importResult && (
        <Card>
          <CardHeader
            title="Resultado da importação"
            description={`${importResult.createdCount} de ${importResult.total} lançamento(s) criado(s) com sucesso.`}
          />
          {importResult.failedCount > 0 && (
            <div className="mt-4 space-y-1.5">
              {importResult.results
                .filter((result): result is Extract<typeof result, { success: false }> => !result.success)
                .map((result) => (
                  <p
                    key={result.row}
                    className="text-xs text-brand-red-600 dark:text-red-400 flex items-center gap-1.5"
                  >
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    Linha {result.row}: {result.error}
                  </p>
                ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
