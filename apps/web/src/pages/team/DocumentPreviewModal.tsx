import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { ApiError, openFileUrl, type EmployeeDocument } from "../../api";
import { Button, Message, Modal } from "../../components";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;

export function DocumentPreviewModal({
  employeeId,
  document,
  onClose,
}: {
  employeeId: string;
  document: EmployeeDocument;
  onClose: () => void;
}) {
  const [zoom, setZoom] = useState(1);
  const filePath = `/employees/${employeeId}/documents/${document.id}/file`;

  const file = useQuery({
    queryKey: ["document-preview", employeeId, document.id],
    queryFn: () => openFileUrl(filePath, document.original_filename),
  });

  useEffect(() => {
    const url = file.data?.url;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [file.data?.url]);

  const contentType =
    file.data?.contentType || document.content_type || "";
  const nameLower = document.original_filename.toLowerCase();
  const isImage =
    contentType.startsWith("image/") ||
    nameLower.endsWith(".png") ||
    nameLower.endsWith(".jpg") ||
    nameLower.endsWith(".jpeg");
  const isPdf =
    contentType === "application/pdf" || nameLower.endsWith(".pdf");

  const bumpZoom = (delta: number) => {
    setZoom((z) =>
      Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round((z + delta) * 100) / 100)),
    );
  };

  return (
    <Modal
      title={document.name}
      description={document.original_filename}
      size="a4"
      layer={1}
      onClose={onClose}
      footer={
        <>
          {isImage && file.data ? (
            <div className="doc-preview-zoom">
              <Button
                type="button"
                variant="quiet"
                size="small"
                aria-label="Pomniejsz"
                disabled={zoom <= MIN_ZOOM}
                onClick={() => bumpZoom(-ZOOM_STEP)}
              >
                <Minus size={16} />
              </Button>
              <span className="doc-preview-zoom-label">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                type="button"
                variant="quiet"
                size="small"
                aria-label="Powiększ"
                disabled={zoom >= MAX_ZOOM}
                onClick={() => bumpZoom(ZOOM_STEP)}
              >
                <Plus size={16} />
              </Button>
              <Button
                type="button"
                variant="quiet"
                size="small"
                aria-label="Resetuj zoom"
                onClick={() => setZoom(1)}
              >
                <RotateCcw size={16} />
              </Button>
            </div>
          ) : null}
          <Button type="button" variant="quiet" onClick={onClose}>
            Zamknij
          </Button>
        </>
      }
    >
      <div className="doc-preview-body">
        {file.isLoading ? (
          <p className="subtle doc-preview-status">Ładowanie podglądu…</p>
        ) : file.isError ? (
          <Message>{(file.error as ApiError).message}</Message>
        ) : file.data && isImage ? (
          <div
            className="doc-preview-page"
            onWheel={(e) => {
              if (!e.ctrlKey && !e.metaKey) return;
              e.preventDefault();
              bumpZoom(e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP);
            }}
          >
            <img
              src={file.data.url}
              alt={document.name}
              className="doc-preview-image"
              style={{ transform: `scale(${zoom})` }}
              draggable={false}
            />
          </div>
        ) : file.data && isPdf ? (
          <div className="doc-preview-page doc-preview-page-pdf">
            <iframe
              title={document.name}
              src={`${file.data.url}#toolbar=1&navpanes=0`}
              className="doc-preview-frame"
            />
          </div>
        ) : (
          <Message>Podgląd tego typu pliku nie jest dostępny.</Message>
        )}
      </div>
    </Modal>
  );
}
