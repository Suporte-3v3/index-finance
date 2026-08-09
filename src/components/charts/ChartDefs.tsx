/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Gradientes e sombras SVG compartilhados pelos gráficos Recharts do app.
// Cores de dado (barras/linhas) permanecem literais em hex — assim como o
// resto da paleta de gráficos já usada no código, elas não variam por tema,
// só o card/eixo/tooltip ao redor acompanha claro/escuro.
export const CHART_GRADIENT = {
  navy: "url(#chartGradientNavy)",
  red: "url(#chartGradientRed)",
  redLight: "url(#chartGradientRedLight)",
  green: "url(#chartGradientGreen)",
  greenLight: "url(#chartGradientGreenLight)",
  gold: "url(#chartGradientGold)",
  areaNavy: "url(#chartAreaNavy)",
  areaGold: "url(#chartAreaGold)",
  areaGreen: "url(#chartAreaGreen)",
  areaRed: "url(#chartAreaRed)",
} as const;

export const CHART_SHADOW = "url(#chartDropShadow)";
export const CHART_LINE_SHADOW = "url(#chartLineShadow)";

export default function ChartDefs() {
  return (
    <defs>
      <linearGradient id="chartGradientNavy" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#174E83" stopOpacity={1} />
        <stop offset="100%" stopColor="#0B2C52" stopOpacity={0.88} />
      </linearGradient>
      <linearGradient id="chartGradientRed" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#E20D35" stopOpacity={1} />
        <stop offset="100%" stopColor="#C8102E" stopOpacity={0.88} />
      </linearGradient>
      <linearGradient id="chartGradientRedLight" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#F5AEB8" stopOpacity={1} />
        <stop offset="100%" stopColor="#F0929F" stopOpacity={0.75} />
      </linearGradient>
      <linearGradient id="chartGradientGreen" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#1FB683" stopOpacity={1} />
        <stop offset="100%" stopColor="#15996F" stopOpacity={0.88} />
      </linearGradient>
      <linearGradient id="chartGradientGreenLight" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#A6DAC7" stopOpacity={1} />
        <stop offset="100%" stopColor="#8FCDB8" stopOpacity={0.75} />
      </linearGradient>
      <linearGradient id="chartGradientGold" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#EFC988" stopOpacity={1} />
        <stop offset="100%" stopColor="#E7B967" stopOpacity={0.88} />
      </linearGradient>
      <linearGradient id="chartAreaNavy" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#174E83" stopOpacity={0.38} />
        <stop offset="100%" stopColor="#174E83" stopOpacity={0.015} />
      </linearGradient>
      <linearGradient id="chartAreaGold" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#E7B967" stopOpacity={0.44} />
        <stop offset="100%" stopColor="#E7B967" stopOpacity={0.02} />
      </linearGradient>
      <linearGradient id="chartAreaGreen" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#15996F" stopOpacity={0.38} />
        <stop offset="100%" stopColor="#15996F" stopOpacity={0.015} />
      </linearGradient>
      <linearGradient id="chartAreaRed" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#C8102E" stopOpacity={0.34} />
        <stop offset="100%" stopColor="#C8102E" stopOpacity={0.015} />
      </linearGradient>
      {/* Sombra suave para barras/áreas/fatias de pizza */}
      <filter id="chartDropShadow" x="-40%" y="-40%" width="180%" height="220%">
        <feDropShadow dx="0" dy="7" stdDeviation="5" floodColor="#061425" floodOpacity="0.28" />
        <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#174E83" floodOpacity="0.18" />
      </filter>
      {/* Sombra mais leve, ajustada para traços finos de linha */}
      <filter id="chartLineShadow" x="-20%" y="-60%" width="140%" height="260%">
        <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#061425" floodOpacity="0.32" />
      </filter>
    </defs>
  );
}
