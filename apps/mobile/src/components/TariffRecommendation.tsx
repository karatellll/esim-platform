import { Image } from 'expo-image';

import type { CatalogTariff } from '../../../../packages/shared/contracts/catalog';
import { formatDataAmount, formatDuration, formatTariffPrice } from '../tariffs/tariffs';
import { colors } from '../theme';
import { View } from '../ui/Surface';
import { Text } from '../ui/Text';
import { StyleSheet } from '../ui/design';

const recommendationLabel = 'Подходящий тариф по запросу';

export function tariffOptionLabel(tariff: CatalogTariff, recommended: boolean) {
  const label = `${formatDataAmount(tariff)}, ${formatDuration(tariff.duration)}, ${formatTariffPrice(tariff)}`;
  return recommended ? `${label}, ${recommendationLabel}` : label;
}

export function TariffRecommendationIcon() {
  return <Image source={require('../../assets/tariffs/eyes-card.svg')} style={styles.icon} contentFit="contain" accessible={false} testID="tariff-recommendation-icon" />;
}

export function TariffRecommendationHint() {
  return <View style={styles.hint} testID="tariff-recommendation-hint">
    <Image source={require('../../assets/tariffs/eyes-hint.svg')} style={styles.hintIcon} contentFit="contain" accessible={false} />
    <Text style={styles.hintText}>{recommendationLabel}</Text>
  </View>;
}

const styles = StyleSheet.create({
  icon: { width: 28.8, height: 18 },
  hint: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingHorizontal: 8 },
  hintIcon: { width: 25.6, height: 16 },
  hintText: { flex: 1, fontSize: 14, lineHeight: 20, color: colors.mutedText },
});
