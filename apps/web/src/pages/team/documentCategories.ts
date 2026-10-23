import type { DocumentCategory } from "../../api";

export const DOCUMENT_CATEGORIES: {
  code: DocumentCategory;
  label: string;
}[] = [
  { code: "benefit", label: "Benefit" },
  { code: "certificate", label: "Certyfikat" },
  { code: "diploma", label: "Dyplom" },
  { code: "employment_certificate", label: "Świadectwo pracy" },
  { code: "contract", label: "Umowa" },
  { code: "other", label: "Inny" },
];

export function documentCategoryLabel(code: string): string {
  return DOCUMENT_CATEGORIES.find((row) => row.code === code)?.label || code;
}

export const DOCUMENT_MAX_BYTES = 15 * 1024 * 1024;
export const DOCUMENT_ACCEPT =
  "application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png";

export function isAllowedDocumentFile(file: File): string | null {
  const name = file.name.toLowerCase();
  const okExt =
    name.endsWith(".pdf") ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".png");
  const okType =
    !file.type ||
    file.type === "application/pdf" ||
    file.type === "image/jpeg" ||
    file.type === "image/png" ||
    file.type === "application/octet-stream";
  if (!okExt || !okType) return "Dozwolone formaty: PDF, JPG, JPEG, PNG";
  if (file.size > DOCUMENT_MAX_BYTES) return "Maksymalny rozmiar pliku to 15 MB";
  if (file.size === 0) return "Plik jest pusty";
  return null;
}
