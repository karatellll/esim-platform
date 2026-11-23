import { createContext, useContext } from 'react';

export const ConnectivityContext = createContext<boolean | null>(true);
export const useOnline = () => useContext(ConnectivityContext) !== false;
