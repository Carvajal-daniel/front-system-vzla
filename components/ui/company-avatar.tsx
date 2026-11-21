"use client";

import { useState } from "react";
import Image from "next/image";
import { Scissors } from "lucide-react";

export function CompanyAvatar({ url }: { url?: string | null }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const src = url?.trim();

  return (
    <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border-subtle bg-accent text-accent-ink shadow-xs">
      {src && src !== failedUrl ? (
        <Image src={src} alt="" width={36} height={36} unoptimized
          className="size-full object-cover" onError={() => setFailedUrl(src)} />
      ) : (
        <Scissors className="size-4" />
      )}
    </span>
  );
}
