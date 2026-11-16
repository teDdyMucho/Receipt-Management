// The photo the camera screen just took, handed back to the Scan screen.

export interface CapturedPhoto {
  uri: string;
  width: number;
  height: number;
}

let pending: CapturedPhoto | null = null;

export function setCaptured(photo: CapturedPhoto): void {
  pending = photo;
}

/** Returns the photo once, then forgets it. */
export function takeCaptured(): CapturedPhoto | null {
  const photo = pending;
  pending = null;
  return photo;
}
