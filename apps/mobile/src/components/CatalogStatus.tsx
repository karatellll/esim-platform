import { Platform } from 'react-native';
import { Pressable, View } from '../ui/Surface';
import { fonts, StyleSheet } from '../ui/design';
import { Text } from '../ui/Text';

import type { CatalogState } from '../hooks/useCatalogCategories';
import { colors } from '../theme';
import { useSkeletonGate } from '../hooks/useSkeletonGate';
import { CountryRowsSkeleton } from './SkeletonLayouts';

export function CatalogStatus({ state, onRetry }: { state: CatalogState; onRetry: () => void }) {
  const gate = useSkeletonGate(state.status === 'loading');
  if (state.status === 'ready') return null;
  if (state.status === 'loading') {
    if (gate.timedOut) return <View style={styles.status}><Text style={styles.text}>Не удалось загрузить направления.</Text><Pressable onPress={() => { gate.restart(); onRetry(); }} accessibilityRole="button" style={styles.retry}><Text style={styles.retryText}>Повторить</Text></Pressable></View>;
    return gate.visible ? <CountryRowsSkeleton count={5} /> : null;
  }
  return (
    <View style={styles.status} testID="catalog-error" accessibilityLiveRegion="polite">
      <Text style={styles.text}>{state.message}</Text>
      <Pressable onPress={onRetry} accessibilityRole="button" testID="catalog-retry" style={styles.retry}>
          <Text style={styles.retryText}>Повторить</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  status: { alignItems: 'center', gap: 12, paddingVertical: 20 },
  text: { fontFamily: fonts.text, fontSize: 14, lineHeight: 20, color: colors.mutedText, textAlign: 'center' },
  retry: { backgroundColor: colors.surface, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 18 },
  retryText: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.text },
});
