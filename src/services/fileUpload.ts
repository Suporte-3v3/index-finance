import { SupportAttachment } from '../types';

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(new Error('Não foi possível preparar o anexo.'));
    reader.readAsDataURL(file);
  });
}

export async function uploadSupportAttachment(file: File): Promise<SupportAttachment> {
  if (file.size > 20 * 1024 * 1024) throw new Error('O anexo excede o limite de 20 MB.');
  const response = await fetch('/api/documents/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: await readFileAsBase64(file), fileName: file.name, mimeType: file.type })
  });
  const result = await response.json() as { url?: string; error?: string };
  if (!response.ok || !result.url) throw new Error(result.error || 'Não foi possível enviar o anexo.');
  return { id: `att-${Date.now()}`, name: file.name, url: result.url, mimeType: file.type || 'application/octet-stream', size: file.size };
}
