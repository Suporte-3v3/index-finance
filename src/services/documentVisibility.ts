import { Document, User } from "../types";

const BPO_ROLES = new Set(["BPO_ADMIN", "BPO_TEAM"]);

export function isDocumentDeliveredByBpo(
  document: Document,
  recipientId: string,
): boolean {
  return (
    document.recipientId === recipientId &&
    document.uploadedById !== recipientId &&
    Boolean(document.sharedById) &&
    BPO_ROLES.has(document.sharedByRole || "")
  );
}

export function getDocumentsVisibleToUser(
  documents: Document[],
  user: User,
): Document[] {
  if (BPO_ROLES.has(user.role)) return documents;

  const authorizedCompanies = new Set(user.companies || []);
  return documents
    .filter(
      (document) =>
        authorizedCompanies.has(document.companyId) &&
        (document.uploadedById === user.id ||
          document.recipientId === user.id),
    )
    .map((document) => {
      const receivedFromBpo = isDocumentDeliveredByBpo(document, user.id);
      return {
        ...document,
        description: receivedFromBpo
          ? "Documento enviado pela equipe BPO."
          : "Documento enviado por este acesso.",
        aiSummary: undefined,
        extractedData: undefined,
        processingConfidence: undefined,
        analysisWarnings: undefined,
        supplier: undefined,
        dueDate: undefined,
        expenseType: undefined,
        documentNumber: undefined,
        amount: undefined,
        relatedEntityId: undefined,
        entryType: undefined,
        costCenter: undefined,
        bankAccountId: undefined,
        destinationBankAccountId: undefined,
        paymentMethod: undefined,
        recurrence: undefined,
        notes: undefined,
        launchedById: undefined,
        launchedByName: undefined,
        launchedAt: undefined,
      };
    });
}
