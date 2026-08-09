const ACCEPTED_LOGO_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

const MAX_SOURCE_SIZE = 5 * 1024 * 1024;
const MAX_STORED_DATA_URL_LENGTH = 800_000;
const MAX_DIMENSION = 512;

export const COMPANY_LOGO_ACCEPT = "image/png,image/jpeg,image/webp";

export const isCompanyLogoDataUrl = (
  value: unknown,
): value is string =>
  typeof value === "string" &&
  value.length <= MAX_STORED_DATA_URL_LENGTH &&
  /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=\s]+$/i.test(value);

export const resolveCompanyLogo = (
  companyLogo: unknown,
  fallbackLogo: string,
): string => (isCompanyLogoDataUrl(companyLogo) ? companyLogo : fallbackLogo);

const loadImage = (source: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Não foi possível ler a imagem selecionada."));
    image.src = source;
  });

const renderTransparentPng = (
  image: HTMLImageElement,
  maxDimension: number,
): string => {
  const scale = Math.min(
    1,
    maxDimension / image.naturalWidth,
    maxDimension / image.naturalHeight,
  );
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("O navegador não conseguiu processar a logo.");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
};

const imageToStoredPng = (image: HTMLImageElement): string => {
  for (const dimension of [MAX_DIMENSION, 384, 320, 256]) {
    const dataUrl = renderTransparentPng(image, dimension);
    if (isCompanyLogoDataUrl(dataUrl)) return dataUrl;
  }
  throw new Error("A logo processada ficou muito grande. Use uma imagem mais simples.");
};

export async function convertCompanyLogoToPng(
  logoDataUrl: string,
): Promise<string> {
  if (!isCompanyLogoDataUrl(logoDataUrl)) {
    throw new Error("A logo cadastrada não possui um formato válido.");
  }
  if (logoDataUrl.startsWith("data:image/png")) return logoDataUrl;
  return imageToStoredPng(await loadImage(logoDataUrl));
}

export async function normalizeCompanyLogo(file: File): Promise<string> {
  if (!ACCEPTED_LOGO_TYPES.has(file.type)) {
    throw new Error("Selecione uma imagem PNG, JPG ou WebP.");
  }
  if (file.size > MAX_SOURCE_SIZE) {
    throw new Error("A logo deve ter no máximo 5 MB.");
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(objectUrl);
    if (!image.naturalWidth || !image.naturalHeight) {
      throw new Error("A imagem selecionada não possui dimensões válidas.");
    }

    return imageToStoredPng(image);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
