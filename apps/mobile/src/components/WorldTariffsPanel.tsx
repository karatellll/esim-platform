import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState } from 'react';
import { ScrollView } from '../ui/ScrollView';
import { Pressable, View } from '../ui/Surface';
import { fonts, StyleSheet } from '../ui/design';
import { Text } from '../ui/Text';

import type { CatalogEsim } from '../../../../packages/shared/contracts/catalog';
import type { CatalogState } from '../hooks/useCatalogCategories';
import { getCountries } from '../catalog/catalog';
import { formatCatalogPrice } from '../catalog/prices';
import { CatalogCountrySheet } from './CatalogCountrySheet';
import { useCatalogTariffs } from '../hooks/useCatalogTariffs';
import { durationKey, formatDataAmount, formatDuration, formatTariffPrice, getDefaultDuration, getDefaultTariff, getDurations, getTariffsForDuration, getTariffSavings } from '../tariffs/tariffs';
import { colors } from '../theme';
import type { RootStackParamList } from '../navigation/stack';
import { TariffSkeleton } from './SkeletonLayouts';
import { useSkeletonGate } from '../hooks/useSkeletonGate';

import { recommendTariff, tariffGigabytes, type TripPreferences } from '../home/recommendation';

type Props = TripPreferences & { bundle: CatalogEsim | null; onReloadCatalog: () => void; catalogState: CatalogState };
const globe = require('../../assets/mvp/21390.svg');
// Presentation copy and flag artwork explicitly requested from Figma 103:49495.
const coverageFlags = [
  require('../../assets/world/flag-fr.png'),
  require('../../assets/world/flag-it.png'),
  require('../../assets/world/flag-de.png'),
  require('../../assets/world/flag-es.png'),
  require('../../assets/world/flag-jp.svg'),
  require('../../assets/world/flag-th.png'),
];

export function WorldTariffsPanel({ bundle, onReloadCatalog, catalogState, ...preferences }: Props) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const catalog = useCatalogTariffs(bundle?.id ?? null);
  const data = catalog.state.status === 'ready' && catalog.state.data.esim.id === bundle?.id ? catalog.state.data : null;
  const skeleton = useSkeletonGate(!!bundle && catalog.state.status === 'loading');
  const [durationSelection, setDurationSelection] = useState<string | null>(null);
  const [tariffSelection, setTariffSelection] = useState<string | null>(null);
  const [countriesOpen, setCountriesOpen] = useState(false);
  const countries = useMemo(() => catalogState.status === 'ready' ? getCountries(catalogState.categories) : [], [catalogState]);
  const tariffs = data?.tariffs ?? [];
  const durations = getDurations(tariffs);
  const recommended = recommendTariff(tariffs, preferences);
  const activeDuration = durations.some((duration) => durationKey(duration) === durationSelection) ? durationSelection : recommended ? durationKey(recommended.duration) : getDefaultDuration(tariffs);
  const visibleTariffs = getTariffsForDuration(tariffs, activeDuration);
  const selected = visibleTariffs.find((tariff) => tariff.id === tariffSelection) ?? visibleTariffs.find(tariff => tariff.id === recommended?.id) ?? getDefaultTariff(visibleTariffs);

  return <View style={styles.panel} testID="world-tariffs-panel">
    <View style={styles.card} testID="world-summary-card">
      <LinearGradient colors={['#2B2B3D', '#17171F']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
      <Image source={globe} style={styles.globe} contentFit="contain" accessible={false} />
      <Text style={styles.cardTitle}>Весь мир</Text>
      <Text style={styles.cardSubtitle}>120+ стран · одна eSIM</Text>
      <View style={styles.flags} testID="world-coverage-flags">
        {coverageFlags.map((source, index) => <View key={index} style={[styles.flag, { zIndex: coverageFlags.length + 1 - index }]}>
          <Image source={source} style={styles.flagImage} contentFit="contain" accessible={false} />
        </View>)}
        <Pressable style={({ pressed }) => [styles.coverage, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Открыть список стран" testID="world-coverage" onPress={() => setCountriesOpen(true)}>
          <Text style={styles.coverageText}>+114</Text>
        </Pressable>
      </View>
    </View>
    {!bundle ? <View style={styles.status} testID="world-unavailable">
      <Text style={styles.statusText}>Глобальный пакет пока недоступен. Попробуйте позже.</Text>
      <Pressable style={styles.retry} onPress={onReloadCatalog} accessibilityRole="button" testID="world-catalog-retry"><Text style={styles.buttonText}>Повторить</Text></Pressable>
    </View> : catalog.state.status === 'error' ? <View style={styles.status} testID="world-tariffs-error" accessibilityLiveRegion="polite">
      <Text style={styles.statusText}>{catalog.state.message}</Text>
      <Pressable style={styles.retry} onPress={catalog.reload} accessibilityRole="button" testID="world-tariffs-retry"><Text style={styles.buttonText}>Повторить</Text></Pressable>
    </View> : !data ? skeleton.timedOut ? <View style={styles.status}><Text style={styles.statusText}>Загрузка тарифов заняла слишком много времени.</Text><Pressable style={styles.retry} onPress={() => { skeleton.restart(); catalog.reload(); }} accessibilityRole="button"><Text style={styles.buttonText}>Повторить</Text></Pressable></View> : skeleton.visible ? <TariffSkeleton /> : null : tariffs.length === 0 ? <Text style={styles.statusText} testID="world-tariffs-empty">Глобальные тарифы пока недоступны.</Text> : <>
      <View style={styles.durations} testID="world-durations">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.durationContent}>
          {durations.map((duration) => {
            const key = durationKey(duration);
            const active = key === activeDuration;
            return <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected: active }} aria-pressed={active} testID={`world-duration-${key}`} onPress={() => { setDurationSelection(key); setTariffSelection(null); }} style={[styles.duration, active && styles.durationActive]}>
              <Text style={[styles.durationText, active && styles.durationTextActive]}>{formatDuration(duration)}</Text>
            </Pressable>;
          })}
        </ScrollView>
      </View>
      <View style={styles.packages} testID="world-packages">
        {visibleTariffs.map((tariff) => {
          const active = tariff.id === selected?.id;
          const savings = getTariffSavings(tariff, visibleTariffs);
          const gb = tariffGigabytes(tariff);
          return <Pressable key={tariff.id} accessibilityRole="button" accessibilityLabel={`${formatDataAmount(tariff)}, ${formatDuration(tariff.duration)}, ${formatTariffPrice(tariff)}`} accessibilityState={{ selected: active }} aria-pressed={active} testID={`world-tariff-${tariff.id}`} onPress={() => setTariffSelection(tariff.id)} style={({ pressed }) => [styles.package, active && styles.packageActive, pressed && styles.pressed]}>
            <View style={styles.packageCopy}><Text style={styles.packageData} numberOfLines={1} adjustsFontSizeToFit>{formatDataAmount(tariff)}</Text>
              <Text style={styles.unitPrice}>{tariff.is_unlimited ? 'Без ограничений по трафику' : gb ? `${formatCatalogPrice({ amount: tariff.price_amount_minor / gb, currency: tariff.price_currency }).replace(/^от /, '')} за ГБ` : formatDuration(tariff.duration)}</Text>
            </View>
            {savings !== null && <View style={styles.badge} accessibilityLabel={`На ${savings}% дешевле за ГБ, чем минимальный пакет`}><Text style={styles.badgeText}>−{savings}%</Text></View>}
            <Text style={styles.packagePrice} numberOfLines={1}>{formatTariffPrice(tariff)}</Text>
          </Pressable>;
        })}
      </View>
      {selected && <Pressable style={({ pressed }) => [styles.buy, pressed && styles.pressed]} accessibilityRole="button" testID="world-buy" onPress={() => navigation.navigate('Checkout', { country: data.esim, tariff: selected })}>
        <Text style={styles.buttonText} accessibilityLiveRegion="polite">Купить за {formatTariffPrice(selected)}</Text>
      </Pressable>}
    </>}
    {countriesOpen && <CatalogCountrySheet countries={countries} title="Страны каталога" subtitle="Покрытие пакета нужно уточнить"
      loading={catalogState.status === 'loading'} error={catalogState.status === 'error' ? catalogState.message : undefined} onRetry={onReloadCatalog}
      onClose={() => setCountriesOpen(false)} onSelectCountry={country => navigation.navigate('CountryTariffs', { country })} onSupport={() => navigation.navigate('Help')} testID="world-country-sheet" />}
  </View>;
}

const fontFamily = fonts.text;
const displayFont = fonts.display;
const styles = StyleSheet.create({
  panel: { gap: 12 },
  card: { height: 120, borderRadius: 24, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: '#17171F' },
  globe: { position: 'absolute', width: 210, height: 210, right: -53, top: -44.63916 },
  cardTitle: { position: 'absolute', top: 16, left: 16, fontFamily: displayFont, fontSize: 22, lineHeight: 28, fontWeight: '900', letterSpacing: -0.44, color: colors.text },
  cardSubtitle: { position: 'absolute', top: 46, left: 16, fontFamily, fontSize: 13, lineHeight: 19, letterSpacing: -0.052, opacity: 0.75, color: colors.text },
  flags: { position: 'absolute', top: 80, left: 16, flexDirection: 'row', alignItems: 'center', isolation: 'isolate' },
  flag: { width: 26, height: 26, marginRight: -8, borderRadius: 13, borderCurve: 'continuous', overflow: 'hidden', flexShrink: 0 },
  flagImage: { width: 26, height: 26 },
  coverage: { height: 26, paddingHorizontal: 12, borderRadius: 16, borderCurve: 'continuous', backgroundColor: colors.tariffAccent, justifyContent: 'center', flexShrink: 0, zIndex: 1 },
  coverageText: { fontFamily, fontSize: 13, lineHeight: 19, fontWeight: '600', letterSpacing: -0.052, color: colors.text },
  durations: { padding: 4, borderRadius: 14, borderCurve: 'continuous', backgroundColor: colors.surface, overflow: 'hidden' },
  durationContent: { flexGrow: 1 },
  duration: { flexGrow: 1, minWidth: 80, height: 36, paddingHorizontal: 12, borderRadius: 10, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  durationActive: { backgroundColor: colors.text },
  durationText: { fontFamily, fontSize: 14, lineHeight: 20, fontWeight: '600', letterSpacing: -0.056, color: 'rgba(255,255,255,0.6)' },
  durationTextActive: { color: colors.ink },
  packages: { gap: 8 },
  package: { minHeight: 74, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 2, borderColor: 'transparent', borderRadius: 20, borderCurve: 'continuous', backgroundColor: colors.surface, flexDirection: 'row', gap: 10, alignItems: 'center' },
  packageActive: { borderWidth: 2, borderColor: colors.tariffAccent },
  packageCopy: { flex: 1, minWidth: 0, gap: 2 },
  packageData: { fontFamily: displayFont, fontSize: 22, lineHeight: 28, fontWeight: '900', letterSpacing: -0.44, color: colors.text },
  unitPrice: { fontSize: 13, lineHeight: 16, color: '#8C8C99' },
  packagePrice: { fontSize: 16, lineHeight: 22, fontWeight: '600', letterSpacing: -0.064, color: 'rgba(255,255,255,0.7)', flexShrink: 1 },
  badge: { backgroundColor: colors.lime, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  badgeText: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.ink },
  buy: { height: 56, borderRadius: 16, borderCurve: 'continuous', backgroundColor: colors.tariffAccent, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontFamily, fontSize: 16, lineHeight: 22, fontWeight: '600', letterSpacing: -0.064, color: colors.text },
  status: { paddingVertical: 24, gap: 16, alignItems: 'center' },
  statusText: { fontFamily, fontSize: 14, lineHeight: 20, color: colors.mutedText, textAlign: 'center' },
  retry: { paddingVertical: 14, paddingHorizontal: 24, borderRadius: 16, borderCurve: 'continuous', backgroundColor: colors.tariffAccent, alignItems: 'center' },
  pressed: { opacity: 0.8 },
});
