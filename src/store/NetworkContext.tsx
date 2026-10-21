import NetInfo from '@react-native-community/netinfo';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { network } from '@/backend/network';

const NetworkContext = createContext({ isOnline: true });

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(
    () =>
      NetInfo.addEventListener((state) => {
        // isConnected is null while unknown; only treat an explicit false as offline.
        const online = state.isConnected !== false;
        network.setOnline(online);
        setIsOnline(online);
      }),
    [],
  );

  return <NetworkContext.Provider value={{ isOnline }}>{children}</NetworkContext.Provider>;
}

export const useNetwork = () => useContext(NetworkContext);
