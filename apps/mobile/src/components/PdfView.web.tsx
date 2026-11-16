import React, { useEffect, useState } from 'react';
import type { ViewerFile } from '../lib/viewer';

// Browser version: the browser's own PDF viewer inside a frame.
// A data URL is turned into a blob link first, because browsers refuse to show
// a PDF straight from a long data URL.
export function PdfView({ file }: { file: ViewerFile }) {
  const [src, setSrc] = useState<string | null>(file.uri.startsWith('data:') ? null : file.uri);

  useEffect(() => {
    if (!file.uri.startsWith('data:')) return;
    let made: string | null = null;
    let cancelled = false;
    void fetch(file.uri)
      .then((res) => res.blob())
      .then((blob) => {
        if (cancelled) return;
        made = URL.createObjectURL(blob);
        setSrc(made);
      });
    return () => {
      cancelled = true;
      if (made) URL.revokeObjectURL(made);
    };
  }, [file.uri]);

  if (!src) return null;
  return <iframe src={src} title={file.title} style={{ flex: 1, width: '100%', height: '100%', border: 0, backgroundColor: '#FFFFFF' }} />;
}
