import NetInfo from '@react-native-community/netinfo';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { removeUploadedCopies } from './sync';
import { getDb,listReceipts, subscribe, type LocalReceipt } from './db';
import { clearIdentity, loadIdentity, saveIdentity, type Identity } from './identity';

// App-wide state: who is scanning, whether the phone is online, and the
// receipt list (re-read from SQLite whenever something is written).

interface Session {
  loading: boolean;
  identity: Identity | null;
  online: boolean;
  receipts: LocalReceipt[];
  setIdentity: (identity: Identity) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [identity, setIdentityState] = useState<Identity | null>(null);
  const [online, setOnline] = useState(true);
  const [receipts, setReceipts] = useState<LocalReceipt[]>([]);

  useEffect(() => {
    (async () => {
      await getDb();
      setIdentityState(await loadIdentity());
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    return NetInfo.addEventListener((state) => {
      setOnline(state.isConnected !== false && state.isInternetReachable !== false);
    });
  }, []);

  const name = identity?.name ?? null;
  const refresh = useCallback(async () => {
    setReceipts(name ? await listReceipts(name) : []);
  }, [name]);

  useEffect(() => {
    void refresh();
    return subscribe(() => void refresh());
  }, [refresh]);

  // Uploaded receipts are not kept on the phone. This clears any left by an older version.
  useEffect(() => {
    if (name) void removeUploadedCopies(name).catch(() => undefined);
  }, [name]);

  const setIdentity = useCallback(async (next: Identity) => {
    await saveIdentity(next);
    setIdentityState(next);
  }, []);

  const signOut = useCallback(async () => {
    await clearIdentity();
    setIdentityState(null);
  }, []);

  const value = useMemo(
    () => ({ loading, identity, online, receipts, setIdentity, signOut, refresh }),
    [loading, identity, online, receipts, setIdentity, signOut, refresh],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession must be used inside SessionProvider');
  return session;
}
