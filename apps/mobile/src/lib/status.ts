import type { LocalReceipt } from './db';
import { colors } from './theme';

// What the person sees about an upload. There are only two results: Success
// (the receipt is in the office database) or Failed (it is not, and it stays on
// this phone until it is tried again). Before the first try it is "Not uploaded".

export type UploadState = 'success' | 'failed' | 'uploading' | 'waiting';

export function uploadState(receipt: Pick<LocalReceipt, 'sync_status' | 'attempts' | 'last_error'>): UploadState {
  if (receipt.sync_status === 'synced') return 'success';
  if (receipt.sync_status === 'uploading') return 'uploading';
  // A try that did not work is a failure, even while more tries are allowed.
  if (receipt.sync_status === 'failed' || receipt.attempts > 0 || receipt.last_error) return 'failed';
  return 'waiting';
}

export const UPLOAD_BADGE: Record<UploadState, { label: string; color: string; bg: string }> = {
  success: { label: 'Success', color: colors.synced, bg: colors.syncedBg },
  failed: { label: 'Failed', color: colors.failed, bg: colors.failedBg },
  uploading: { label: 'Uploading', color: colors.uploading, bg: colors.uploadingBg },
  waiting: { label: 'Not uploaded', color: colors.pending, bg: colors.pendingBg },
};
