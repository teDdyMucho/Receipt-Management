import { Alert } from 'react-native';

// Message and confirm dialogs. They are drawn by the app itself (see
// components/DialogHost.tsx) so they look the same on the phone and in the
// browser. The system alert is only a fallback for before the app has mounted.

export interface DialogRequest {
  title: string;
  message?: string;
  /** Set for a question (Cancel + this button). Leave out for a plain message (OK). */
  confirmLabel?: string;
  destructive?: boolean;
  /** Ionicons name shown above the title. */
  icon?: string;
  resolve: (confirmed: boolean) => void;
}

let host: ((request: DialogRequest) => void) | null = null;

/** Called once by DialogHost. */
export function setDialogHost(next: typeof host): void {
  host = next;
}

export function showMessage(title: string, message?: string): void {
  if (host) host({ title, message, resolve: () => undefined });
  else Alert.alert(title, message);
}

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel: string;
  destructive?: boolean;
  icon?: string;
}

/** Resolves true when the user confirms. */
export function confirm(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (host) {
      host({ ...options, resolve });
      return;
    }
    Alert.alert(
      options.title,
      options.message,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: options.confirmLabel, style: options.destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
