/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useRef, useState } from "react";
import { useBPOState } from "../hooks/useBPOState";
import CurrencyInput from "./CurrencyInput";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Modal,
  Table,
  TableHead,
  TableBody,
  Tr,
  Th,
  Td,
  Tooltip,
  useToast,
} from "./ui";
import {
  buildImportTemplateMasterData,
  downloadImportTemplate,
  parseImportFile,
  toImportPayload,
  validateImportRow,
  type ImportEntriesResult,
  type ImportFieldKey,
  type ParsedImportRow,
} from "../services/financialEntriesImport";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  Pencil,
  Upload,
  XCircle,
} from "lucide-react";

const formatBRL = (value: number) =>
  `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const EDIT_INPUT_CLASS = "mt-1 w-full rounded-lg border bg-surface px-3 py-2 text-xs text-ink outline-none transition-colors dark:bg-surface-dark dark:text-ink-dark";

function editInputClass(hasError: boolean) {
  return `${EDIT_INPUT_CLASS} ${
    hasError
      ? "border-brand-red-600 focus:ring-1 focus:ring-brand-red-600 dark:border-red-500"
      : "border-line focus:ring-1 focus:ring-brand-navy-700 dark:border-line-dark"
  }`;
}

function EditableField({
  label,
  errors = [],
  warnings = [],
  children,
  className = "",
}: {
  label: string;
  errors?: string[];
  warnings?: string[];
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-[10px] font-bold uppercase tracking-wide text-ink-soft dark:text-ink-soft-dark">
        {label}
      </span>
      {children}
      {errors.map((message) => (
        <span key={message} className="mt-1 flex items-start gap-1 text-[10px] font-semibold text-brand-red-600 dark:text-red-400">
          <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" /> {message}
        </span>
      ))}
      {warnings.map((message) => (
        <span key={message} className="mt-1 flex items-start gap-1 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {message}
        </span>
      ))}
    </label>
  );
}

export default function ImportEntriesActions() {
  const { activeCompany, masterData, bankAccounts, hasPermission, importFinancialEntries } = useBPOState();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDownloading, setIsDownloading] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState("");
  const [rows, setRows] = useState<ParsedImportRow[]>([]);
  const [editingRows, setEditingRows] = useState<Set<number>>(new Set());
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportEntriesResult | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);

  const canCreatePayable = hasPermission("accounts-payable.create");
  const canCreateReceivable = hasPermission("accounts-receivable.create");
  const canImport = canCreatePayable || canCreateReceivable;

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
      setEditingRows(new Set(parsed.filter((row) => row.errors.length > 0).map((row) => row.row)));
    } catch (error) {
      setRows([]);
      setEditingRows(new Set());
      setParseError(error instanceof Error ? error.message : "Não foi possível ler o arquivo enviado.");
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleImport = async () => {
    if (!activeCompany || !validRows.length || invalidRows.length > 0) return;
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
        setEditingRows(new Set());
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

  const updateRow = (rowNumber: number, update: (row: ParsedImportRow) => ParsedImportRow) => {
    if (!reference) return;
    setRows((current) => current.map((row) => (
      row.row === rowNumber ? validateImportRow(update(row), reference) : row
    )));
  };

  const updateField = <K extends keyof ParsedImportRow["fields"]>(
    rowNumber: number,
    field: K,
    value: ParsedImportRow["fields"][K],
  ) => {
    updateRow(rowNumber, (row) => ({
      ...row,
      fields: { ...row.fields, [field]: value },
    }));
  };

  const toggleRowEditor = (rowNumber: number) => {
    setEditingRows((current) => {
      const next = new Set(current);
      if (next.has(rowNumber)) next.delete(rowNumber);
      else next.add(rowNumber);
      return next;
    });
  };

  const closeImport = () => {
    setIsImportOpen(false);
    setParseError("");
    setRows([]);
    setEditingRows(new Set());
    setImportResult(null);
  };

  if (!activeCompany) return null;

  return (
    <>
      <Button
        variant="outline"
        icon={<Download className="h-4 w-4" />}
        loading={isDownloading}
        disabled={!canImport}
        title={canImport ? "Baixar planilha modelo" : "Sem permissão para importar lançamentos"}
        onClick={handleDownloadTemplate}
      >
        Baixar modelo
      </Button>
      <Button
        variant="secondary"
        icon={<Upload className="h-4 w-4" />}
        disabled={!canImport}
        title={canImport ? "Importar planilha de lançamentos" : "Sem permissão para importar lançamentos"}
        onClick={() => setIsImportOpen(true)}
      >
        Importar planilha
      </Button>

      <Modal
        open={isImportOpen}
        onClose={closeImport}
        title="Importar lançamentos"
        description="Use a planilha modelo para importar contas a pagar e a receber de uma só vez."
        size="xl"
      >
        <div className="space-y-5">

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
              description="Os campos com erro estão destacados. Edite a linha aqui; ela será revalidada automaticamente."
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
                  <Th align="right">Ação</Th>
                </Tr>
              </TableHead>
              <TableBody>
                {rows.map((row) => {
                  const hasErrors = row.errors.length > 0;
                  const hasWarnings = row.warnings.length > 0;
                  const messages = [...row.errors, ...row.warnings];
                  const isEditing = editingRows.has(row.row);
                  const errorsFor = (field: ImportFieldKey) => row.fieldErrors[field] ?? [];
                  const warningsFor = (field: ImportFieldKey) => row.fieldWarnings[field] ?? [];
                  const invalidBankAccount = Boolean(
                    row.fields.bankAccountId
                    && !reference?.bankAccounts.some((account) => account.id === row.fields.bankAccountId),
                  );
                  return (
                    <React.Fragment key={row.row}>
                      <Tr className={hasErrors ? "bg-brand-red-50/50 dark:bg-brand-red-600/5" : undefined}>
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
                        <Td align="right">
                          <Button
                            size="sm"
                            variant={hasErrors ? "secondary" : "outline"}
                            icon={isEditing ? <ChevronUp className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                            iconRight={!isEditing ? <ChevronDown className="h-3.5 w-3.5" /> : undefined}
                            onClick={() => toggleRowEditor(row.row)}
                          >
                            {isEditing ? "Ocultar" : "Editar"}
                          </Button>
                        </Td>
                      </Tr>
                      {isEditing && (
                        <Tr className="bg-canvas/70 hover:bg-canvas/70 dark:bg-white/[0.025] dark:hover:bg-white/[0.025]">
                          <Td colSpan={7} className="p-5 align-top">
                            <div className="mb-4 flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-bold text-ink dark:text-ink-dark">Editar linha {row.row}</p>
                                <p className="text-xs text-ink-soft dark:text-ink-soft-dark">
                                  Datas devem ser informadas como DD-MM-AAAA. Os erros desaparecem assim que o valor fica válido.
                                </p>
                              </div>
                              {hasErrors ? (
                                <Badge tone="red" icon={<XCircle className="h-3.5 w-3.5" />}>
                                  {row.errors.length} erro(s)
                                </Badge>
                              ) : (
                                <Badge tone="green" icon={<CheckCircle2 className="h-3.5 w-3.5" />}>
                                  Linha válida
                                </Badge>
                              )}
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                              <EditableField label="Tipo" errors={errorsFor("type")}>
                                <select
                                  className={editInputClass(errorsFor("type").length > 0)}
                                  value={row.type ?? ""}
                                  onChange={(event) => updateRow(row.row, (current) => ({
                                    ...current,
                                    type: event.target.value === "PAGAR" || event.target.value === "RECEBER"
                                      ? event.target.value
                                      : null,
                                  }))}
                                >
                                  <option value="">Selecione</option>
                                  <option value="PAGAR">A Pagar</option>
                                  <option value="RECEBER">A Receber</option>
                                </select>
                              </EditableField>
                              <EditableField label="Descrição" errors={errorsFor("description")} className="lg:col-span-2">
                                <input
                                  className={editInputClass(errorsFor("description").length > 0)}
                                  value={row.fields.description}
                                  onChange={(event) => updateField(row.row, "description", event.target.value)}
                                />
                              </EditableField>
                              <EditableField
                                label={row.type === "RECEBER" ? "Cliente" : "Fornecedor"}
                                errors={errorsFor("partyName")}
                              >
                                <input
                                  className={editInputClass(errorsFor("partyName").length > 0)}
                                  value={row.fields.partyName}
                                  onChange={(event) => updateField(row.row, "partyName", event.target.value)}
                                />
                              </EditableField>
                              <EditableField label="Categoria" errors={errorsFor("category")} warnings={warningsFor("category")}>
                                <input
                                  list={`import-categories-${row.row}`}
                                  className={editInputClass(errorsFor("category").length > 0)}
                                  value={row.fields.category}
                                  onChange={(event) => updateField(row.row, "category", event.target.value)}
                                />
                                <datalist id={`import-categories-${row.row}`}>
                                  {reference?.categories.map((name) => <option key={name} value={name} />)}
                                </datalist>
                              </EditableField>
                              <EditableField label="Centro de custo" errors={errorsFor("costCenter")} warnings={warningsFor("costCenter")}>
                                <input
                                  list={`import-cost-centers-${row.row}`}
                                  className={editInputClass(errorsFor("costCenter").length > 0)}
                                  value={row.fields.costCenter}
                                  onChange={(event) => updateField(row.row, "costCenter", event.target.value)}
                                />
                                <datalist id={`import-cost-centers-${row.row}`}>
                                  {reference?.costCenters.map((name) => <option key={name} value={name} />)}
                                </datalist>
                              </EditableField>
                              <EditableField label="Competência (AAAA-MM)" errors={errorsFor("competenceMonth")}>
                                <input
                                  className={editInputClass(errorsFor("competenceMonth").length > 0)}
                                  placeholder="2026-08"
                                  value={row.fields.competenceMonth}
                                  onChange={(event) => updateField(row.row, "competenceMonth", event.target.value)}
                                />
                              </EditableField>
                              <EditableField label="Data de emissão (DD-MM-AAAA)" errors={errorsFor("issueDate")}>
                                <input
                                  className={editInputClass(errorsFor("issueDate").length > 0)}
                                  inputMode="numeric"
                                  placeholder="01-08-2026"
                                  value={row.fields.issueDate}
                                  onChange={(event) => updateField(row.row, "issueDate", event.target.value)}
                                />
                              </EditableField>
                              <EditableField label="Vencimento (DD-MM-AAAA)" errors={errorsFor("dueDate")}>
                                <input
                                  className={editInputClass(errorsFor("dueDate").length > 0)}
                                  inputMode="numeric"
                                  placeholder="10-08-2026"
                                  value={row.fields.dueDate}
                                  onChange={(event) => updateField(row.row, "dueDate", event.target.value)}
                                />
                              </EditableField>
                              {([
                                ["amount", "Valor"],
                                ["interest", "Juros"],
                                ["penalty", "Multa"],
                                ["discount", "Desconto"],
                              ] as const).map(([field, label]) => (
                                <EditableField key={field} label={label} errors={errorsFor(field)}>
                                  <CurrencyInput
                                    className={editInputClass(errorsFor(field).length > 0)}
                                    value={Number.isFinite(row.fields[field]) ? row.fields[field] : 0}
                                    onChange={(value) => updateField(row.row, field, value)}
                                  />
                                </EditableField>
                              ))}
                              <EditableField
                                label="Forma de pagamento"
                                errors={errorsFor("paymentMethod")}
                                warnings={warningsFor("paymentMethod")}
                              >
                                <input
                                  list={`import-payment-methods-${row.row}`}
                                  className={editInputClass(errorsFor("paymentMethod").length > 0)}
                                  value={row.fields.paymentMethod}
                                  onChange={(event) => updateField(row.row, "paymentMethod", event.target.value)}
                                />
                                <datalist id={`import-payment-methods-${row.row}`}>
                                  {reference?.paymentMethods.map((name) => <option key={name} value={name} />)}
                                </datalist>
                              </EditableField>
                              <EditableField label="Conta bancária" errors={errorsFor("bankAccountId")}>
                                <select
                                  className={editInputClass(errorsFor("bankAccountId").length > 0)}
                                  value={row.fields.bankAccountId ?? ""}
                                  onChange={(event) => updateField(row.row, "bankAccountId", event.target.value || undefined)}
                                >
                                  <option value="">Não informar</option>
                                  {invalidBankAccount && (
                                    <option value={row.fields.bankAccountId}>Conta não reconhecida</option>
                                  )}
                                  {reference?.bankAccounts.map((account) => (
                                    <option key={account.id} value={account.id}>
                                      {account.bankName} - Ag {account.agency || "-"} - CC {account.accountNumber}
                                    </option>
                                  ))}
                                </select>
                              </EditableField>
                              <EditableField label="Nº do documento" errors={errorsFor("documentNumber")}>
                                <input
                                  className={editInputClass(errorsFor("documentNumber").length > 0)}
                                  value={row.fields.documentNumber ?? ""}
                                  onChange={(event) => updateField(row.row, "documentNumber", event.target.value || undefined)}
                                />
                              </EditableField>
                              <EditableField label="Observações" errors={errorsFor("notes")} className="sm:col-span-2 lg:col-span-4">
                                <textarea
                                  rows={2}
                                  className={editInputClass(errorsFor("notes").length > 0)}
                                  value={row.fields.notes ?? ""}
                                  onChange={(event) => updateField(row.row, "notes", event.target.value || undefined)}
                                />
                              </EditableField>
                            </div>
                          </Td>
                        </Tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <div className="p-5 flex justify-end">
            <Button
              icon={<Upload className="h-4 w-4" />}
              loading={isImporting}
              disabled={!validRows.length || invalidRows.length > 0}
              title={invalidRows.length > 0 ? "Corrija todas as linhas com erro antes de importar." : undefined}
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
      </Modal>
    </>
  );
}
