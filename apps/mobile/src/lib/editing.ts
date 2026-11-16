import type { RemoteReceipt } from './api';

// The receipt a staff member tapped Edit on. The list already has all of its
// details, so the edit screen takes them from here instead of asking the server again.

let current: RemoteReceipt | null = null;

export function setEditing(receipt: RemoteReceipt): void {
  current = receipt;
}

export function getEditing(id: string): RemoteReceipt | null {
  return current?.id === id ? current : null;
}
