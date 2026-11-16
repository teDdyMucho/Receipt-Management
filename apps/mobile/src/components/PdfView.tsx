import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { readReceiptBase64 } from '../lib/files';
import type { ViewerFile } from '../lib/viewer';

// Phone version (PdfView.web.tsx is the browser one).
// iPhone: the system web view shows a PDF by itself.
// Android: the system web view cannot, so the pages are drawn with pdf.js.

const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174';
const ANDROID_PAGE = `<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5">
<style>body{margin:0;background:#15171A}canvas{display:block;width:100%;margin:0 0 8px}p{color:#fff;font:16px sans-serif;padding:24px;text-align:center}</style>
<script src="${PDFJS}/pdf.min.js"></script></head><body><script>
(async function () {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '${PDFJS}/pdf.worker.min.js';
    var src = window.PDF_SRC;
    var doc = await pdfjsLib.getDocument(src.data ? { data: atob(src.data) } : { url: src.url }).promise;
    for (var i = 1; i <= doc.numPages; i++) {
      var page = await doc.getPage(i);
      var viewport = page.getViewport({ scale: 2 });
      var canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      document.body.appendChild(canvas);
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: viewport }).promise;
    }
  } catch (e) {
    document.body.innerHTML = '<p>This PDF could not be shown here. Use the open button at the top.</p>';
  }
})();
</script></body></html>`;

export function PdfView({ file }: { file: ViewerFile }) {
  // Android only: a file on the phone is handed to the page as base64.
  const [source, setSource] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    let cancelled = false;
    void (async () => {
      const base64 = file.localPath ? await readReceiptBase64(file.localPath) : null;
      if (!cancelled) setSource(JSON.stringify(base64 ? { data: base64 } : { url: file.uri }));
    })();
    return () => {
      cancelled = true;
    };
  }, [file]);

  if (Platform.OS === 'ios') {
    return <WebView source={{ uri: file.uri }} originWhitelist={['*']} allowFileAccess allowingReadAccessToURL={file.uri} style={styles.view} />;
  }
  if (!source) {
    return (
      <View style={styles.waiting}>
        <ActivityIndicator color="#FFFFFF" />
      </View>
    );
  }
  return (
    <WebView
      source={{ html: ANDROID_PAGE, baseUrl: 'https://localhost' }}
      originWhitelist={['*']}
      injectedJavaScriptBeforeContentLoaded={`window.PDF_SRC = ${source}; true;`}
      style={styles.view}
    />
  );
}

const styles = StyleSheet.create({
  view: { flex: 1, backgroundColor: '#15171A' },
  waiting: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
