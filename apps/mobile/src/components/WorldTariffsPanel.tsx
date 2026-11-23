import { Image } from 'expo-image';
import { Modal, Platform, Share } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TariffPurchaseBar } from './TariffPurchaseBar';
import { TariffDiscountBadge } from './TariffDiscountBadge';
import { CountryFlag } from './CountryFlag';
import { CatalogStatus } from './CatalogStatus';
import { GlassActionButton } from './GlassActionButton';
import { LoadFailure } from './ServiceState';
import { useOnline } from '../service/connectivity';
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

type Props = TripPreferences & { bundle: CatalogEsim | null; onReloadCatalog: () => void; catalogState: CatalogState; onBack: () => void };
const featuredCodes = ['FR', 'IT', 'DE', 'ES', 'BE'];
const icons = {
  sticker: require('../../assets/world/title-sticker.svg'),
};

export function WorldTariffsPanel({ bundle, onReloadCatalog, catalogState, onBack, ...preferences }: Props) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const online = useOnline();
  const insets = useSafeAreaInsets();
  const top = (Platform.OS === 'web' ? 48 : insets.top) + 8;
  const bottom = Platform.OS === 'web' ? 42 : Math.max(insets.bottom, 12) + 8;
  const catalog = useCatalogTariffs(bundle?.id ?? null);
  const data = catalog.state.status === 'ready' && catalog.state.data.esim.id === bundle?.id ? catalog.state.data : null;
  const skeleton = useSkeletonGate(!!bundle && catalog.state.status === 'loading');
  const [durationSelection, setDurationSelection] = useState<string | null>(null);
  const [tariffSelection, setTariffSelection] = useState<string | null>(null);
  const [countriesOpen, setCountriesOpen] = useState(false);
  const [shareText, setShareText] = useState<string | null>(null);
  const countries = useMemo(() => catalogState.status === 'ready' ? getCountries(catalogState.categories) : [], [catalogState]);
  const featured = featuredCodes.flatMap(code => countries.filter(country => country.country_iso2?.toUpperCase() === code));
  const remaining = countries.length - featured.length;
  const tariffs = data?.tariffs ?? [];
  const durations = getDurations(tariffs);
  const recommended = recommendTariff(tariffs, preferences);
  const week = durations.find(duration => duration.amount === 7 && /^days?$/.test(duration.unit));
  const activeDuration = durations.some((duration) => durationKey(duration) === durationSelection) ? durationSelection : recommended ? durationKey(recommended.duration) : week ? durationKey(week) : getDefaultDuration(tariffs);
  const visibleTariffs = getTariffsForDuration(tariffs, activeDuration);
  const selected = visibleTariffs.find((tariff) => tariff.id === tariffSelection) ?? visibleTariffs.find(tariff => tariff.id === recommended?.id) ?? visibleTariffs.find(tariff => tariffGigabytes(tariff) === 3) ?? getDefaultTariff(visibleTariffs);

  const share = async () => {
    const message = selected
      ? `Весь мир — ${formatDataAmount(selected)} · ${formatDuration(selected.duration)} · ${formatTariffPrice(selected)}`
      : 'ТурСим — Весь мир';
    if (Platform.OS === 'web') { setShareText(message); return; }
    try { await Share.share({ message }); }
    catch { setShareText(message); }
  };

  return <View style={styles.screen} testID="world-tariffs-panel">
    <ScrollView contentInsetAdjustmentBehavior="never" contentContainerStyle={[styles.panel, {
      paddingTop: top, paddingBottom: selected ? bottom + 84 : bottom + 12,
      paddingLeft: Math.max(insets.left, 12), paddingRight: Math.max(insets.right, 12),
    }]}>
      <View style={styles.hero} pointerEvents="none">
        <LinearGradient colors={['rgba(20,20,22,0.55)', 'rgba(20,20,22,0)', 'rgba(20,20,22,0.35)', colors.background]}
          locations={[0, 0.3, 0.62, 1]} style={StyleSheet.absoluteFill} />
        <Text style={styles.photoLabel}>Место под фото «Весь мир», 375 × 380</Text>
      </View>
      <View style={styles.nav}>
        <GlassActionButton action="back" onPress={onBack} testID="world-back" />
        <GlassActionButton action="share" onPress={share} testID="world-share" />
      </View>
      <View style={styles.heroSpace} />
      <View style={styles.titleRow} accessibilityRole="header" accessibilityLabel="Весь мир">
        <Text style={styles.title}>Весь</Text>
        <View style={styles.stickerSlot}>
          <View style={styles.sticker}>
            <Image source={icons.sticker} style={StyleSheet.absoluteFill} contentFit="contain" accessible={false} />
            <Text style={[styles.title, styles.stickerText]}>мир</Text>
          </View>
        </View>
      </View>
      <Text style={styles.subtitle}>Одна eSIM на 120+ стран — переезжайте без новых покупок</Text>
      <View style={styles.flags} testID="world-coverage-flags">
        {featured.map(country => <Pressable key={country.id} style={styles.chip} accessibilityRole="button"
          accessibilityLabel={`${country.display_name} — открыть список стран`} testID={`world-country-chip-${country.country_iso2}`}
          onPress={() => setCountriesOpen(true)}>
          <CountryFlag country={country} size={24} />
          <Text style={styles.coverageText}>{country.display_name}</Text>
        </Pressable>)}
        <Pressable style={({ pressed }) => [styles.coverage, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Открыть список стран" testID="world-coverage" onPress={() => setCountriesOpen(true)}>
          <Text style={styles.coverageText}>{remaining > 0 && featured.length ? `ещё ${remaining}` : 'Список стран'}</Text>
        </Pressable>
      </View>
    {!bundle && catalogState.status !== 'ready'
      ? <CatalogStatus state={catalogState} onRetry={onReloadCatalog} title="Тарифы не загрузились" />
      : !bundle ? <View style={styles.status} testID="world-unavailable">
      <Text style={styles.statusText}>Глобальный пакет пока недоступен. Попробуйте позже.</Text>
      <Pressable style={styles.retry} onPress={onReloadCatalog} disabled={!online} accessibilityRole="button" testID="world-catalog-retry"><Text style={styles.buttonText}>Повторить</Text></Pressable>
    </View>: catalog.state.status === 'error' || skeleton.timedOut ? <LoadFailure title="Тарифы не загрузились" top={40} testID="world-tariffs-error"
      onRetry={() => { skeleton.restart(); catalog.reload(); }} />
    : !data ? skeleton.visible ? <TariffSkeleton /> : null : tariffs.length === 0 ? <Text style={styles.statusText} testID="world-tariffs-empty">Глобальные тарифы пока недоступны.</Text> : <>
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
            <TariffDiscountBadge savings={savings} />
            <Text style={styles.packagePrice} numberOfLines={1}>{formatTariffPrice(tariff)}</Text>
          </Pressable>;
        })}
      </View>
    </>}
    </ScrollView>
    {data && selected && <TariffPurchaseBar tariff={selected} bottomPadding={bottom} disabled={!online}
      onBuy={() => navigation.navigate('Checkout', { country: data.esim, tariff: selected })}
      testID="world-purchase" buyTestID="world-buy" />}
    <Modal visible={shareText !== null} transparent animationType="fade" onRequestClose={() => setShareText(null)}>
      <View style={styles.shareBackdrop}><View style={styles.shareCard} accessibilityViewIsModal>
        <Text style={styles.buttonText} selectable>{shareText}</Text>
        <Pressable style={styles.retry} accessibilityRole="button" onPress={() => setShareText(null)}><Text style={styles.buttonText}>Готово</Text></Pressable>
      </View></View>
    </Modal>
    {countriesOpen && <CatalogCountrySheet countries={countries} title="Страны каталога" subtitle="Покрытие пакета нужно уточнить"
      loading={catalogState.status === 'loading'} error={catalogState.status === 'error' ? catalogState.message : undefined} onRetry={onReloadCatalog}
      onClose={() => setCountriesOpen(false)} onSelectCountry={country => navigation.navigate('CountryTariffs', { country })} onSupport={() => navigation.navigate('Help')} testID="world-country-sheet" />}
  </View>;
}

const fontFamily = fonts.text;
const displayFont = fonts.display;
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  panel: { gap: 12 },
  hero: { position: 'absolute', top: 0, left: 0, right: 0, height: 380, backgroundColor: '#595961', alignItems: 'center' },
  photoLabel: { position: 'absolute', top: 150, color: 'rgba(255,255,255,0.7)', fontSize: 14, lineHeight: 20, textAlign: 'center' },
  nav: { flexDirection: 'row', justifyContent: 'space-between' },
  heroSpace: { height: 140 },
  titleRow: { paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontFamily: displayFont, fontSize: 28, lineHeight: 36, fontWeight: '900', letterSpacing: -0.56, color: colors.text },
  stickerSlot: { width: 81.046, height: 43.08, alignItems: 'center', justifyContent: 'center' },
  sticker: { width: 80, height: 41, transform: [{ rotate: '1.5deg' }] },
  stickerText: { position: 'absolute', top: 3, left: 12 },
  subtitle: { paddingHorizontal: 12, fontFamily, fontSize: 14, lineHeight: 20, letterSpacing: -0.056, color: 'rgba(255,255,255,0.55)' },
  flags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { height: 32, paddingLeft: 4, paddingRight: 12, borderRadius: 16, borderCurve: 'continuous', flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: colors.surface },
  coverage: { height: 32, paddingHorizontal: 12, borderRadius: 16, borderCurve: 'continuous', backgroundColor: colors.tariffAccent, justifyContent: 'center' },
  coverageText: { fontFamily, fontSize: 13, lineHeight: 19, fontWeight: '600', letterSpacing: -0.052, color: colors.text },
  durations: { padding: 4, borderRadius: 14, borderCurve: 'continuous', backgroundColor: colors.surface, overflow: 'hidden' },
  durationContent: { flexGrow: 1 },
  duration: { flexGrow: 1, minWidth: 72, height: 36, paddingHorizontal: 6, borderRadius: 10, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  durationActive: { backgroundColor: colors.text },
  durationText: { fontFamily, fontSize: 14, lineHeight: 20, fontWeight: '600', letterSpacing: -0.056, color: 'rgba(255,255,255,0.6)' },
  durationTextActive: { color: colors.ink },
  packages: { gap: 8 },
  package: { minHeight: 74, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 2, borderColor: 'transparent', borderRadius: 20, borderCurve: 'continuous', backgroundColor: colors.surface, flexDirection: 'row', gap: 10, alignItems: 'center' },
  packageActive: { paddingVertical: 14, borderColor: colors.tariffAccent },
  packageCopy: { flex: 1, minWidth: 0, gap: 2 },
  packageData: { fontFamily: displayFont, fontSize: 22, lineHeight: 28, fontWeight: '900', letterSpacing: -0.44, color: colors.text },
  unitPrice: { fontSize: 13, lineHeight: 16, color: '#8C8C99' },
  packagePrice: { fontSize: 16, lineHeight: 22, fontWeight: '600', letterSpacing: -0.064, color: 'rgba(255,255,255,0.7)', flexShrink: 1 },
  shareBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.6)', padding: 24 },
  shareCard: { borderRadius: 24, borderCurve: 'continuous', gap: 16, padding: 20, backgroundColor: colors.surface },
  buttonText: { fontFamily, fontSize: 16, lineHeight: 22, fontWeight: '600', letterSpacing: -0.064, color: colors.text },
  status: { paddingVertical: 24, gap: 16, alignItems: 'center' },
  statusText: { fontFamily, fontSize: 14, lineHeight: 20, color: colors.mutedText, textAlign: 'center' },
  retry: { paddingVertical: 14, paddingHorizontal: 24, borderRadius: 16, borderCurve: 'continuous', backgroundColor: colors.tariffAccent, alignItems: 'center' },
  pressed: { opacity: 0.8 },
});
