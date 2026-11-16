// Opens a receipt file (photo or PDF) full screen. The screen itself is drawn by
// components/FileViewer.tsx, mounted once in the root layout.

export interface ViewerFile {
  title: string;
  contentType: string;
  /** A file on this phone, a data URL (browser), or a short-lived link from the server. */
  uri: string;
  /** The stored file name, when the file is on this phone. */
  localPath?: string | null;
}

let host: ((file: ViewerFile) => void) | null = null;

/** Called once by FileViewer. */
export function setViewerHost(next: typeof host): void {
  host = next;
}

export function openViewer(file: ViewerFile): void {
  host?.(file);
}

export const isPdf = (contentType: string | null | undefined) => contentType === 'application/pdf';
