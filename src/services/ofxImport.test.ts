import assert from "node:assert/strict";
import test from "node:test";
import { parseOfxFile } from "./ofxImport";
import { toStatementImportPayload } from "./reconciliationImport";

test("mantém o OFX compatível com a prévia brasileira e o envio ao banco", async () => {
  const file = new File([
    `<OFX>
      <BANKACCTFROM><ACCTID>12345</BANKACCTFROM>
      <STMTTRN>
        <DTPOSTED>20260801120000[-3:BRT]
        <TRNAMT>-150.25
        <FITID>ofx-1
        <MEMO>PIX FORNECEDOR
        <CHECKNUM>DOC-1
      </STMTTRN>
    </OFX>`,
  ], "extrato.ofx", { type: "application/x-ofx" });

  const { rows, accountNumberHint } = await parseOfxFile(file);
  assert.equal(accountNumberHint, "12345");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].date, "01-08-2026");
  assert.equal(rows[0].errors.length, 0);
  assert.equal(toStatementImportPayload(rows[0]).date, "2026-08-01");
});
