import React, { useEffect, useState } from 'react';
import { AlertCircle, FileText, LoaderCircle, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';

interface DocumentPreviewProps {
  name: string;
  url?: string;
}

const imagePattern = /\.(png|jpe?g|gif|webp|bmp|svg)$/i;
const spreadsheetPattern = /\.(xlsx|xls|xlsm|ods)$/i;

function parseCsvLine(line: string, delimiter: string) {
  const values: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && line[index + 1] === '"' && quoted) {
      value += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === delimiter && !quoted) {
      values.push(value.trim());
      value = '';
    } else {
      value += character;
    }
  }
  values.push(value.trim());
  return values;
}

function parseCsv(content: string) {
  const lines = content.replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim());
  const delimiter = (lines[0]?.split(';').length || 0) > (lines[0]?.split(',').length || 0) ? ';' : ',';
  return lines.map(line => parseCsvLine(line, delimiter));
}

function formatXml(content: string) {
  const parsed = new DOMParser().parseFromString(content, 'application/xml');
  if (parsed.querySelector('parsererror')) throw new Error('O XML está malformado e não pôde ser interpretado.');
  const compact = new XMLSerializer().serializeToString(parsed);
  let depth = 0;
  return compact.replace(/(>)(<)(\/*)/g, '$1\n$2$3').split('\n').map(line => {
    if (line.match(/^<\//)) depth = Math.max(0, depth - 1);
    const formatted = `${'  '.repeat(depth)}${line}`;
    if (line.match(/^<[^!?/][^>]*[^/]>/) && !line.includes('</')) depth += 1;
    return formatted;
  }).join('\n');
}

export default function DocumentPreview({ name, url }: DocumentPreviewProps) {
  const [rows, setRows] = useState<string[][]>([]);
  const [textContent, setTextContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [zoom, setZoom] = useState(100);

  useEffect(() => {
    setRows([]);
    setTextContent('');
    setError('');
    if (!url || (!/\.(csv|xml)$/i.test(name) && !spreadsheetPattern.test(name))) return;

    let active = true;
    setLoading(true);
    const loadPreview = async () => {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Não foi possível carregar o arquivo.');
        if (!active) return;
        if (spreadsheetPattern.test(name)) {
          const XLSX = await import('xlsx');
          const workbook = XLSX.read(await response.arrayBuffer(), { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          setRows(XLSX.utils.sheet_to_json<(string | number | boolean)[]>(firstSheet, { header: 1, defval: '' }).map(row => row.map(String)));
        } else {
          const content = await response.text();
          if (/\.csv$/i.test(name)) setRows(parseCsv(content));
          else setTextContent(formatXml(content));
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Falha ao visualizar o arquivo.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadPreview();
    return () => { active = false; };
  }, [name, url]);

  let content: React.ReactNode;
  if (!url) content = <EmptyPreview message="O arquivo deste registro não possui uma origem de visualização." />;
  else if (imagePattern.test(name)) content = <div className="w-full h-full flex items-center justify-center"><img src={url} alt={name} className="max-w-full max-h-full object-contain rounded-lg shadow-sm bg-white" /></div>;
  else if (/\.pdf$/i.test(name)) content = <iframe title={`Visualização de ${name}`} src={url} className="w-full h-full bg-white rounded-lg border border-zinc-200" />;
  else if (loading) content = <div className="h-full flex items-center justify-center text-sm text-zinc-500"><LoaderCircle className="h-5 w-5 mr-2 animate-spin" /> Processando arquivo...</div>;
  else if (error) content = <EmptyPreview message={error} error />;
  else if (/\.xml$/i.test(name)) content = <pre className="h-full whitespace-pre-wrap bg-[#07111f] text-blue-100 rounded-lg p-5 text-xs font-mono leading-relaxed">{textContent}</pre>;
  else if (/\.csv$/i.test(name) || spreadsheetPattern.test(name)) content = <TablePreview rows={rows} />;
  else content = <EmptyPreview message="Este formato não possui visualização integrada." />;

  const changeZoom = (nextZoom: number) => setZoom(Math.min(200, Math.max(50, nextZoom)));
  return <div className="h-full flex flex-col gap-2">
    <div className="bg-white border border-zinc-200 rounded-lg px-3 py-2 flex items-center justify-center gap-2 shrink-0 shadow-sm">
      <button onClick={() => changeZoom(zoom - 10)} disabled={zoom <= 50} className="p-1.5 rounded-md hover:bg-zinc-100 disabled:opacity-30 cursor-pointer" title="Diminuir zoom"><ZoomOut className="h-4 w-4" /></button>
      <input aria-label="Nível de zoom" type="range" min="50" max="200" step="10" value={zoom} onChange={event => changeZoom(Number(event.target.value))} className="w-28 accent-[#0B2C52]" />
      <span className="w-12 text-center text-xs font-bold text-zinc-700 tabular-nums">{zoom}%</span>
      <button onClick={() => changeZoom(zoom + 10)} disabled={zoom >= 200} className="p-1.5 rounded-md hover:bg-zinc-100 disabled:opacity-30 cursor-pointer" title="Aumentar zoom"><ZoomIn className="h-4 w-4" /></button>
      <button onClick={() => setZoom(100)} className="p-1.5 rounded-md hover:bg-zinc-100 text-zinc-500 cursor-pointer" title="Restaurar zoom"><RotateCcw className="h-4 w-4" /></button>
    </div>
    <div className="flex-1 min-h-0 overflow-auto">
      <div style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top left', width: `${10000 / zoom}%`, height: `${10000 / zoom}%` }}>{content}</div>
    </div>
  </div>;
}

function TablePreview({ rows }: { rows: string[][] }) {
  if (!rows.length) return <EmptyPreview message="A tabela está vazia." />;
  return <div className="h-full overflow-auto bg-white rounded-lg border border-zinc-200"><table className="min-w-full border-collapse text-xs"><thead className="sticky top-0 z-10 bg-[#0B2C52] text-white"><tr>{rows[0].map((cell, index) => <th key={index} className="px-3 py-2.5 text-left font-bold border-r border-white/10 whitespace-nowrap">{cell || `Coluna ${index + 1}`}</th>)}</tr></thead><tbody>{rows.slice(1).map((row, rowIndex) => <tr key={rowIndex} className="odd:bg-white even:bg-zinc-50 hover:bg-blue-50">{Array.from({ length: Math.max(rows[0].length, row.length) }, (_, cellIndex) => <td key={cellIndex} className="px-3 py-2 border-r border-b border-zinc-100 whitespace-nowrap">{row[cellIndex] || ''}</td>)}</tr>)}</tbody></table></div>;
}

function EmptyPreview({ message, error = false }: { message: string; error?: boolean }) {
  return <div className="h-full bg-white rounded-xl border border-zinc-200 flex flex-col items-center justify-center text-center p-8">{error ? <AlertCircle className="h-12 w-12 text-rose-300 mb-3" /> : <FileText className="h-12 w-12 text-zinc-300 mb-3" />}<p className={`text-sm font-bold ${error ? 'text-rose-700' : 'text-zinc-700'}`}>{error ? 'Não foi possível abrir o arquivo' : 'Pré-visualização indisponível'}</p><p className="text-xs text-zinc-500 mt-1">{message}</p></div>;
}
