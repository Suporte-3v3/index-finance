import React, { useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Download, Upload, XCircle } from "lucide-react";
import { useBPOState } from "../hooks/useBPOState";
import {
  downloadMasterDataTemplate,
  parseMasterDataImportFile,
  type ParsedMasterDataRow,
} from "../services/masterDataImport";
import type { MasterDataOption } from "../types";
import { Badge, Button, Card, CardHeader, Modal, Table, TableBody, TableHead, Td, Th, Tr, useToast } from "./ui";

const KIND_LABELS: Record<Exclude<ParsedMasterDataRow["kind"], null>, string> = {
  CATEGORY: "Categoria",
  SUBCATEGORY: "Subcategoria",
  COST_CENTER: "Centro de custo",
  PAYMENT_METHOD: "Forma de pagamento",
  DOCUMENT_TYPE: "Tipo de documento",
  SUPPLIER: "Fornecedor",
  CUSTOMER: "Cliente",
  BAKERY_REGISTER: "Caixa (Padaria)",
  BANK: "Conta bancária",
};

const normalizeName = (value: string) => value.trim().toLocaleLowerCase("pt-BR");

export default function ImportMasterDataActions() {
  const { showToast } = useToast();
  const {
    activeCompany,
    masterData,
    bankAccounts,
    addMasterData,
    addBankAccount,
  } = useBPOState();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [rows, setRows] = useState<ParsedMasterDataRow[]>([]);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ created: number; skipped: number; failed: number } | null>(null);

  const reference = useMemo(() => activeCompany ? {
    companyId: activeCompany.id,
    masterData,
    bankAccounts,
  } : null, [activeCompany, masterData, bankAccounts]);
  const invalidRows = rows.filter((row) => row.errors.length > 0);
  const skippedRows = rows.filter((row) => row.skip && row.errors.length === 0);
  const readyRows = rows.filter((row) => !row.skip && row.errors.length === 0 && row.kind);

  const close = () => {
    setOpen(false);
    setRows([]);
    setError("");
    setResult(null);
  };

  const downloadTemplate = async () => {
    setDownloading(true);
    try {
      await downloadMasterDataTemplate();
    } catch (downloadError) {
      showToast("error", "Não foi possível gerar a planilha modelo.", downloadError instanceof Error ? downloadError.message : undefined);
    } finally {
      setDownloading(false);
    }
  };

  const selectFile = async (file: File) => {
    if (!reference) return;
    setParsing(true);
    setError("");
    setResult(null);
    try {
      setRows(await parseMasterDataImportFile(file, reference));
    } catch (parseError) {
      setRows([]);
      setError(parseError instanceof Error ? parseError.message : "Não foi possível ler a planilha.");
    } finally {
      setParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const importRows = async () => {
    if (!activeCompany || invalidRows.length || !readyRows.length) return;
    setImporting(true);
    const categoryIds = new Map(
      masterData
        .filter((item) => item.companyId === activeCompany.id && item.type === "CATEGORY" && item.active)
        .map((item) => [normalizeName(item.name), item.id]),
    );
    const ordered = [...readyRows].sort((left, right) => {
      const priority = (row: ParsedMasterDataRow) => row.kind === "CATEGORY" ? 0 : row.kind === "SUBCATEGORY" ? 2 : 1;
      return priority(left) - priority(right) || left.row - right.row;
    });
    let created = 0;
    let failed = 0;
    const completedRows = new Set<number>();
    const failedRows = new Map<number, string>();
    for (const row of ordered) {
      try {
        if (row.kind === "BANK") {
          await addBankAccount({
            bankName: row.name,
            agency: row.agency,
            accountNumber: row.accountNumber,
            type: row.bankType || "Corrente",
            balance: row.initialBalance,
          });
        } else if (row.kind) {
          const parentId = row.kind === "SUBCATEGORY"
            ? categoryIds.get(normalizeName(row.parentCategory))
            : undefined;
          if (row.kind === "SUBCATEGORY" && !parentId) {
            throw new Error(`Categoria principal "${row.parentCategory}" não pôde ser cadastrada.`);
          }
          const item: MasterDataOption = await addMasterData(row.kind, row.name, parentId);
          if (row.kind === "CATEGORY") categoryIds.set(normalizeName(item.name), item.id);
        }
        created += 1;
        completedRows.add(row.row);
      } catch (importError) {
        failed += 1;
        failedRows.set(
          row.row,
          importError instanceof Error ? importError.message : "Não foi possível importar este cadastro.",
        );
      }
    }
    const summary = { created, skipped: skippedRows.length, failed };
    setResult(summary);
    if (!failed) {
      showToast("success", `${created} cadastro(s) importado(s).`, skippedRows.length ? `${skippedRows.length} já existente(s) foram ignorados.` : undefined);
      setRows([]);
    } else {
      setRows((currentRows) => currentRows.map((row) => {
        if (completedRows.has(row.row)) {
          return { ...row, skip: true, warnings: ["Cadastro importado nesta operação."], errors: [] };
        }
        const rowError = failedRows.get(row.row);
        return rowError ? { ...row, skip: false, errors: [rowError] } : row;
      }));
      showToast("warning", `${created} cadastro(s) importado(s) e ${failed} com falha.`, "Revise os cadastros e tente novamente apenas com os itens que faltaram.");
    }
    setImporting(false);
  };

  if (!activeCompany) return null;

  return (
    <>
      <Button variant="secondary" icon={<Upload className="h-4 w-4" />} onClick={() => setOpen(true)}>
        Importar cadastros
      </Button>
      <Modal
        open={open}
        onClose={close}
        title="Importar cadastros em massa"
        description="Use uma única planilha para cadastrar categorias, centros de custo, fornecedores, clientes, formas de pagamento e os demais cadastros."
        size="xl"
      >
        <div className="space-y-5">
          <Card>
            <CardHeader
              title="1. Baixar planilha modelo"
              description="O arquivo contém todos os tipos aceitos e as instruções de preenchimento."
            />
            <Button className="mt-4" variant="secondary" icon={<Download className="h-4 w-4" />} loading={downloading} onClick={downloadTemplate}>
              Baixar planilha modelo
            </Button>
          </Card>

          <Card>
            <CardHeader title="2. Enviar planilha preenchida" description="Apague as linhas de exemplo e envie um arquivo .xlsx ou .xls." />
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void selectFile(file);
              }}
            />
            <Button className="mt-4" variant="outline" icon={<Upload className="h-4 w-4" />} loading={parsing} onClick={() => fileInputRef.current?.click()}>
              Selecionar arquivo
            </Button>
            {error && <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-brand-red-600"><AlertCircle className="h-4 w-4" />{error}</p>}
          </Card>

          {rows.length > 0 && (
            <Card padding={false}>
              <div className="p-5">
                <CardHeader
                  title="3. Revisar e importar"
                  description="Linhas inválidas bloqueiam a importação. Cadastros já existentes são ignorados com segurança."
                  action={(
                    <div className="flex flex-wrap gap-2">
                      <Badge tone="green">{readyRows.length} novo(s)</Badge>
                      {skippedRows.length > 0 && <Badge tone="neutral">{skippedRows.length} existente(s)</Badge>}
                      {invalidRows.length > 0 && <Badge tone="red">{invalidRows.length} com erro</Badge>}
                    </div>
                  )}
                />
              </div>
              <div className="max-h-96 overflow-auto">
                <Table>
                  <TableHead>
                    <Tr><Th>Linha</Th><Th>Tipo</Th><Th>Nome</Th><Th>Status</Th></Tr>
                  </TableHead>
                  <TableBody>
                    {rows.map((row) => (
                      <Tr key={row.row} className={row.errors.length ? "bg-brand-red-50/50 dark:bg-brand-red-600/5" : undefined}>
                        <Td>{row.row}</Td>
                        <Td>{row.kind ? KIND_LABELS[row.kind] : "-"}</Td>
                        <Td>{row.name || "-"}</Td>
                        <Td>
                          {row.errors.length ? (
                            <span className="flex items-start gap-1.5 text-xs text-brand-red-600"><XCircle className="mt-0.5 h-4 w-4 shrink-0" />{row.errors.join(" ")}</span>
                          ) : row.skip ? (
                            <span className="text-xs text-ink-soft dark:text-ink-soft-dark">{row.warnings.join(" ")}</span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-xs text-brand-green-600"><CheckCircle2 className="h-4 w-4" />Pronto</span>
                          )}
                        </Td>
                      </Tr>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-line p-5 dark:border-line-dark">
                <p className="text-xs text-ink-soft dark:text-ink-soft-dark">
                  {result ? `${result.created} criado(s), ${result.skipped} ignorado(s), ${result.failed} com falha.` : "Nenhum cadastro é criado antes da confirmação."}
                </p>
                <Button loading={importing} disabled={invalidRows.length > 0 || readyRows.length === 0} onClick={importRows}>
                  Importar {readyRows.length} cadastro(s)
                </Button>
              </div>
            </Card>
          )}
        </div>
      </Modal>
    </>
  );
}
