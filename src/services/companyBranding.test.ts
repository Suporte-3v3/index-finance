import assert from "node:assert/strict";
import test from "node:test";
import {
  isCompanyLogoDataUrl,
  resolveCompanyLogo,
} from "./companyBranding";

const validLogo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB";

test("aceita somente logos raster em data URL", () => {
  assert.equal(isCompanyLogoDataUrl(validLogo), true);
  assert.equal(isCompanyLogoDataUrl("https://example.com/logo.png"), false);
  assert.equal(isCompanyLogoDataUrl("data:image/svg+xml;base64,PHN2Zz4="), false);
  assert.equal(isCompanyLogoDataUrl(undefined), false);
});

test("usa a logo da empresa e mantém a Idex como fallback", () => {
  assert.equal(resolveCompanyLogo(validLogo, "idex.png"), validLogo);
  assert.equal(resolveCompanyLogo("invalid", "idex.png"), "idex.png");
  assert.equal(resolveCompanyLogo(undefined, "idex.png"), "idex.png");
});

