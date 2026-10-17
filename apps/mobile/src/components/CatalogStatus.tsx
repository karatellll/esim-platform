import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import type { CatalogState } from '../hooks/useCatalogCategories';
import { colors } from '../theme';

export function CatalogStatus({ state, onRetry }: { state: CatalogState; onRetry: () => void }) {
  if (state.status === 'ready') return null;
  return (
    <View style={styles.status} testID={state.status === 'loading' ? 'catalog-loading' : 'catalog-error'} accessibilityLiveRegion="polite">
      {state.status === 'loading' && <ActivityIndicator color={colors.accent} />}
      <Text style={styles.text}>{state.status === 'loading' ? 'Загружаем направления…' : state.message}</Text>
      {state.status === 'error' && (
        <Pressable onPress={onRetry} accessibilityRole="button" testID="catalog-retry" style={styles.retry}>
          <Text style={styles.retryText}>Повторить</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  status: { alignItems: 'center', gap: 12, paddingVertical: 20 },
  text: { fontFamily: Platform.select({ ios: 'System', android: 'sans-serif', default: 'system-ui' }), fontSize: 14, lineHeight: 20, color: colors.mutedText, textAlign: 'center' },
  retry: { backgroundColor: colors.surface, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 18 },
  retryText: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.text },
});
