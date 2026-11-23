import * as SecureStore from 'expo-secure-store';

const key = 'tursim.refresh.v1';
export const loadRefreshToken = () => SecureStore.getItemAsync(key);
export const saveRefreshToken = (token: string | null) => token === null
  ? SecureStore.deleteItemAsync(key)
  : SecureStore.setItemAsync(key, token, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });

const userKey = 'tursim.offline-user.v1';
export const loadOfflineUser = () => SecureStore.getItemAsync(userKey);
export const saveOfflineUser = (id: string | null) => id === null
  ? SecureStore.deleteItemAsync(userKey)
  : SecureStore.setItemAsync(userKey, id, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
