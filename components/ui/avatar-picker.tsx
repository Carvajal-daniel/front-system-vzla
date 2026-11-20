"use client";

import { useRef } from "react";
import { Camera, Trash2, UserCircle2 } from "lucide-react";
import { useLocale } from "@/lib/i18n/locale-context";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface AvatarPickerProps {
  id: string;
  value: string | null;
  onChange: (next: string | null) => void;
}

/**
 * Redimensiona a imagem no cliente para 256x256 JPEG antes de enviar à API,
 * mantendo o payload leve (< 40 KB) e compatível com avatar_url no PostgreSQL.
 */
function resizeImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => reject(new Error("Invalid image"));
      img.onload = () => {
        const size = 256;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas unavailable"));
          return;
        }
        const scale = Math.max(size / img.width, size / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function AvatarPicker({ id, value, onChange }: AvatarPickerProps) {
  const { t } = useLocale();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      onChange(dataUrl);
    } catch {
      // Ignora arquivo inválido
    } finally {
      event.target.value = "";
    }
  };

  return (
    <div className="space-y-2.5">
      <Label htmlFor={id}>{t.common.avatarLabel}</Label>
      <div className="flex items-center gap-4">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border border-border-subtle bg-subtle flex items-center justify-center">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value}
              alt={t.common.avatarLabel}
              className="h-full w-full object-cover"
            />
          ) : (
            <UserCircle2
              className="h-8 w-8 text-ink-muted"
              aria-hidden="true"
            />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => void handleFileChange(e)}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border-strong bg-surface px-4 text-xs font-semibold text-ink transition-colors hover:bg-subtle cursor-pointer"
          >
            <Camera className="h-4 w-4" aria-hidden="true" />
            {t.common.avatarLabel}
          </button>

          {value && (
            <button
              type="button"
              onClick={() => onChange(null)}
              aria-label={t.common.delete}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--status-danger-border)] text-[var(--status-danger-ink)] hover:bg-[var(--status-danger-bg)] cursor-pointer"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      <Input
        id={id}
        type="url"
        placeholder="https://..."
        value={value && !value.startsWith("data:") ? value : ""}
        onChange={(e) => onChange(e.target.value.trim() || null)}
        className="min-h-11 rounded-xl border-border-strong bg-surface px-3.5 text-xs"
      />
      <p className="text-xs text-ink-muted">{t.common.avatarHint}</p>
    </div>
  );
}
