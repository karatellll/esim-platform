import type { PropsWithChildren } from 'react';
import { View } from 'react-native';

// Web clips the measured host directly. Keep the native module out of its bundle.
export function ContentMask({ children }: PropsWithChildren<{ width: number; height: number; path: string }>) {
  return <View style={{ flexGrow: 1 }}>{children}</View>;
}
