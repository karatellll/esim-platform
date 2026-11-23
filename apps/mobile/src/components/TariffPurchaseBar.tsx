import type { CatalogTariff } from '../../../../packages/shared/contracts/catalog';
import { formatDataAmount, formatDuration, formatTariffPrice } from '../tariffs/tariffs';
import { colors } from '../theme';
import { fonts, StyleSheet } from '../ui/design';
import { Pressable, View } from '../ui/Surface';
import { Text } from '../ui/Text';
import { SkeletonBlock, SkeletonGroup } from './Skeleton';

type Props = {
  tariff: CatalogTariff;
  bottomPadding: number;
  onBuy: () => void;
  disabled?: boolean;
  testID: string;
  buyTestID: string;
};

export function TariffPurchaseBar({ tariff, bottomPadding, onBuy, disabled, testID, buyTestID }: Props) {
  return (
    <View style={[styles.bar, { paddingBottom: bottomPadding }]} testID={testID}>
      <View style={styles.total} accessibilityLiveRegion="polite">
        <Text style={styles.price} numberOfLines={1} adjustsFontSizeToFit testID="selected-tariff-price">
          {formatTariffPrice(tariff)}
        </Text>
        <Text style={styles.details} numberOfLines={1} testID="selected-tariff-details">
          {formatDataAmount(tariff)} · {formatDuration(tariff.duration)}
        </Text>
      </View>
      <Pressable
        onPress={onBuy}
        disabled={disabled}
        accessibilityState={{ disabled: !!disabled }}
        accessibilityRole="button"
        testID={buyTestID}
        style={({ pressed }) => [styles.buy, (pressed || disabled) && styles.pressed]}
      >
        <Text style={styles.buttonText}>Купить</Text>
      </Pressable>
    </View>
  );
}

export function TariffPurchaseBarSkeleton({ bottomPadding }: { bottomPadding: number }) {
  return (
    <SkeletonGroup style={[styles.bar, { paddingBottom: bottomPadding }]}>
      <View style={{ flex: 1, gap: 8 }}>
        <SkeletonBlock style={{ width: 72, height: 20 }} />
        <SkeletonBlock style={{ width: 98, height: 10 }} />
      </View>
      <View style={[styles.buy, { opacity: 0.4 }]}>
        <SkeletonBlock style={{ width: 56, height: 12 }} />
      </View>
    </SkeletonGroup>
  );
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', bottom: 0, alignSelf: 'stretch', width: '100%', paddingTop: 12, paddingLeft: 24, paddingRight: 12, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: colors.surface, flexDirection: 'row', gap: 12, alignItems: 'center' },
  total: { flex: 1, minWidth: 0 },
  price: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30, fontWeight: '900', letterSpacing: -0.48, color: colors.text },
  details: { fontFamily: fonts.text, fontSize: 14, lineHeight: 20, color: colors.mutedText, letterSpacing: -0.056 },
  buy: { width: 170, maxWidth: '52%', height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 16, borderCurve: 'continuous', backgroundColor: colors.tariffAccent },
  buttonText: { fontFamily: fonts.text, fontSize: 16, lineHeight: 22, fontWeight: '600', color: colors.text },
  pressed: { opacity: 0.8 },
});
