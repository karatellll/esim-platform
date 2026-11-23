import { View } from 'react-native';
import { colors } from '../theme';
import { StyleSheet } from '../ui/design';
import { Text } from '../ui/Text';

export function TariffDiscountBadge({ savings, profitable = false }: { savings: number | null; profitable?: boolean }) {
  if (savings === null && !profitable) return null;

  const label = savings === null ? 'Выгодный пакет' : `На ${savings}% дешевле за ГБ, чем минимальный пакет`;
  return <View style={styles.badge} accessibilityLabel={label}>
    <Text style={styles.text}>{savings === null ? 'Выгодно' : `−${savings}%`}</Text>
  </View>;
}

const styles = StyleSheet.create({
  badge: { backgroundColor: colors.lime, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, flexShrink: 0 },
  text: { color: colors.ink, fontSize: 12, lineHeight: 16, fontWeight: '700' },
});
