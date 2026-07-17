import React from "react";
import {
  File,
  FileCode2,
  FileImage,
  FileSpreadsheet,
  FileText,
  Landmark,
} from "lucide-react";

type Props = {
  name: string;
  mimeType?: string;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
};

export default function FileTypeIcon({
  name,
  mimeType = "",
  size = "md",
  showLabel = true,
}: Props) {
  const extension = name.split(".").pop()?.toLowerCase() || "";
  const type = mimeType.toLowerCase();
  const config = (() => {
    if (extension === "pdf" || type.includes("pdf"))
      return {
        Icon: FileText,
        label: "PDF",
        box: "bg-red-50 text-red-600 border-red-100",
      };
    if (
      ["xls", "xlsx", "csv"].includes(extension) ||
      type.includes("spreadsheet") ||
      type.includes("excel") ||
      type.includes("csv")
    )
      return {
        Icon: FileSpreadsheet,
        label: extension === "csv" ? "CSV" : "XLS",
        box: "bg-emerald-50 text-emerald-700 border-emerald-100",
      };
    if (
      ["png", "jpg", "jpeg", "gif", "webp", "heic", "svg"].includes(
        extension,
      ) ||
      type.startsWith("image/")
    )
      return {
        Icon: FileImage,
        label: "IMG",
        box: "bg-violet-50 text-violet-700 border-violet-100",
      };
    if (extension === "xml" || type.includes("xml"))
      return {
        Icon: FileCode2,
        label: "XML",
        box: "bg-orange-50 text-orange-700 border-orange-100",
      };
    if (extension === "ofx")
      return {
        Icon: Landmark,
        label: "OFX",
        box: "bg-blue-50 text-blue-700 border-blue-100",
      };
    if (
      ["doc", "docx", "txt", "rtf"].includes(extension) ||
      type.includes("word") ||
      type.startsWith("text/")
    )
      return {
        Icon: FileText,
        label: extension.toUpperCase() || "TXT",
        box: "bg-sky-50 text-sky-700 border-sky-100",
      };
    return {
      Icon: File,
      label: extension.slice(0, 4).toUpperCase() || "DOC",
      box: "bg-zinc-50 text-zinc-600 border-zinc-200",
    };
  })();
  const dimensions =
    size === "sm" ? "h-7 w-7" : size === "lg" ? "h-11 w-11" : "h-9 w-9";
  const iconSize =
    size === "sm" ? "h-3.5 w-3.5" : size === "lg" ? "h-5 w-5" : "h-4 w-4";
  const { Icon } = config;
  return (
    <span
      title={`${config.label} · ${name}`}
      className={`${dimensions} ${config.box} relative rounded-lg border flex items-center justify-center shrink-0`}
    >
      <Icon className={iconSize} />
      {showLabel && (
        <span className="absolute -bottom-1 -right-1 rounded bg-white border border-current/15 px-1 text-[6px] font-black leading-3 shadow-sm">
          {config.label}
        </span>
      )}
    </span>
  );
}
