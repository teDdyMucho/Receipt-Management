import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { fileSize } from './files';

// Image rules from spec section 9: resize the longest side, re-encode as JPEG
// (this also converts HEIC and PNG), lower the quality until the file is small
// enough. PDFs never come through here.

interface ProcessOptions {
  uri: string;
  width: number;
  height: number;
  /** Clockwise rotation chosen by the user: 0, 90, 180 or 270. */
  rotation: number;
  /** Camera captures are compressed harder than library photos. */
  fromCamera: boolean;
}

const LIMITS = {
  camera: { maxSide: 1200, targetBytes: 400 * 1024, startQuality: 0.75 },
  library: { maxSide: 1600, targetBytes: 900 * 1024, startQuality: 0.85 },
};
const MIN_QUALITY = 0.5;

export async function processImage(options: ProcessOptions): Promise<{ uri: string; size: number }> {
  const limits = options.fromCamera ? LIMITS.camera : LIMITS.library;

  const context = ImageManipulator.manipulate(options.uri);
  const longest = Math.max(options.width, options.height);
  if (longest > limits.maxSide) {
    // Resize by the longer side; the other side keeps the aspect ratio.
    context.resize(options.width >= options.height ? { width: limits.maxSide } : { height: limits.maxSide });
  }
  if (options.rotation % 360 !== 0) context.rotate(options.rotation);
  const image = await context.renderAsync();

  let quality = limits.startQuality;
  for (;;) {
    const saved = await image.saveAsync({ compress: quality, format: SaveFormat.JPEG });
    const size = await fileSize(saved.uri);
    const nextQuality = Math.round((quality - 0.1) * 100) / 100;
    if (size <= limits.targetBytes || nextQuality < MIN_QUALITY) {
      return { uri: saved.uri, size };
    }
    quality = nextQuality;
  }
}
