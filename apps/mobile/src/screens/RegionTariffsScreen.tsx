import { SwipeDialog } from '../components/SwipeDialog';
import { GlassActionButton } from '../components/GlassActionButton';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { regionPhoto } from '../catalog/photos';
import { recommendTariff, tariffGigabytes } from '../home/recommendation';
import { formatCatalogPrice } from '../catalog/prices';
import { useState } from 'react';
import { Platform, Share, useWindowDimensions } from 'react-native';
import { ScrollView } from '../ui/ScrollView';
import { Pressable, View } from '../ui/Surface';
import { fonts, StyleSheet } from '../ui/design';
import { Text } from '../ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { countLabel, getCountries } from '../catalog/catalog';
import { getRegionBundle, getRegionHeadingPrefix, orderRegionCountries, regionBundleName } from '../catalog/regions';
import { LoadFailure, ServiceState } from '../components/ServiceState';
import { useOnline } from '../service/connectivity';
import { CountryFlag } from '../components/CountryFlag';
import { CatalogCountrySheet } from '../components/CatalogCountrySheet';
import { useCatalogTariffs } from '../hooks/useCatalogTariffs';
import type { RootStackParamList } from '../navigation/stack';
import { durationKey, formatDataAmount, formatDuration, formatTariffPrice, getDefaultDuration, getDefaultTariff, getDurations, getTariffsForDuration, getTariffSavings } from '../tariffs/tariffs';
import { colors } from '../theme';
import { TariffSkeleton } from '../components/SkeletonLayouts';
import { TariffPurchaseBar } from '../components/TariffPurchaseBar';
import { TariffDiscountBadge } from '../components/TariffDiscountBadge';
import { useSkeletonGate } from '../hooks/useSkeletonGate';

type Props = NativeStackScreenProps<RootStackParamList, 'RegionTariffs'>;
type Overlay = { type: 'countries' } | { type: 'notice'; title: string; message: string } | null;
const assets = {
  sticker: require('../../assets/regions/title-sticker.svg'),
};

export function RegionTariffsScreen({ route, navigation }: Props) {
  const online = useOnline();
  const { category } = route.params;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const bundle = getRegionBundle(category);
  const catalog = useCatalogTariffs(bundle?.id ?? null);
  const skeleton = useSkeletonGate(!!bundle && catalog.state.status === 'loading');
  const countries = orderRegionCountries(getCountries([category]), category.title);
  const [durationSelection, setDurationSelection] = useState<string | null>(null);
  const [tariffSelection, setTariffSelection] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const data = catalog.state.status === 'ready' && catalog.state.data.esim.id === bundle?.id ? catalog.state.data : null;
  const tariffs = data?.tariffs ?? [];
  const durations = getDurations(tariffs);
  const recommended = recommendTariff(tariffs, route.params);
  const activeDuration = durations.some((duration) => durationKey(duration) === durationSelection) ? durationSelection : recommended ? durationKey(recommended.duration) : getDefaultDuration(tariffs);
  const visibleTariffs = getTariffsForDuration(tariffs, activeDuration);
  const selected = visibleTariffs.find((tariff) => tariff.id === tariffSelection) ?? visibleTariffs.find(tariff => tariff.id === recommended?.id) ?? getDefaultTariff(visibleTariffs);
  const topInset = Platform.OS === 'web' ? 48 : insets.top;
  const bottomPadding = Platform.OS === 'web' ? 42 : Math.max(insets.bottom, 12) + 8;
  const prefix = getRegionHeadingPrefix(category.title);
  const stickerWidth = Math.min(Math.min(width, 600) - 48, Math.max(120, category.title.length * 15 + 22));
  const packageName = bundle ? regionBundleName(bundle) : null;
  const showPackageName = packageName?.toLocaleLowerCase('ru') !== category.title.trim().toLocaleLowerCase('ru');
  const summary = selected && packageName
    ? `${packageName}\n${formatDataAmount(selected)} · ${formatDuration(selected.duration)}\n${formatTariffPrice(selected)}`
    : category.title;

  const share = async () => {
    if (Platform.OS === 'web') {
      setOverlay({ type: 'notice', title: 'Поделиться предложением', message: summary });
      return;
    }
    try { await Share.share({ message: summary }); }
    catch { setOverlay({ type: 'notice', title: 'Поделиться предложением', message: summary }); }
  };

  if (catalog.state.status === 'error' && catalog.state.httpStatus === 404) {
    return <ServiceState kind="not-found" primary={{ label: 'На главную', onPress: () => navigation.reset({ index: 0, routes: [{ name: 'Main', params: { screen: 'Search' } }] }) }} />;
  }

  return <View style={styles.screen} testID="screen-region-tariffs">
    <ScrollView style={styles.scroll} contentInsetAdjustmentBehavior="never" contentContainerStyle={[styles.content, { paddingTop: topInset + 8, paddingBottom: selected ? bottomPadding + 92 : bottomPadding + 20 }]}>
      <View style={styles.heroPhoto} pointerEvents="none">
        <Image source={regionPhoto(category.title)} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} />
        <LinearGradient colors={['rgba(20,20,22,0.55)', 'rgba(20,20,22,0)', 'rgba(20,20,22,0.35)', colors.background]} locations={[0, 0.3, 0.62, 1]} style={StyleSheet.absoluteFill} />
      </View>
      <View style={styles.navbar}>
        <GlassActionButton action="back" onPress={() => navigation.goBack()} accessibilityLabel="Назад к категориям" testID="region-back" />
        <GlassActionButton action="share" onPress={share} accessibilityLabel="Поделиться предложением" testID="region-share" />
      </View>
      <View style={{ height: 140 }} />
      <View style={styles.heading} accessibilityRole="header" accessibilityLabel={`${prefix} ${category.title}`.trim()}>
        {prefix !== '' && <Text style={styles.title}>{prefix}</Text>}
        <View style={[styles.stickerFrame, { width: stickerWidth + 1.032 }]}>
          <View style={[styles.sticker, { width: stickerWidth }]}>
            <Image source={assets.sticker} style={[styles.stickerImage, { left: (stickerWidth - 120) / 2, transform: [{ scaleX: stickerWidth / 120 }] }]} contentFit="contain" accessible={false} />
            <Text style={styles.stickerText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>{category.title}</Text>
          </View>
        </View>
      </View>
      <Text style={styles.subtitle} testID="region-description">
        {countries.length > 0 ? `${countLabel(countries.length)} в категории. ` : ''}{bundle ? 'Выберите срок и объём интернета.' : 'Выберите направление для поездки.'}
      </Text>
      {countries.length > 0 && <View style={styles.chips} testID="region-country-chips">
        {countries.slice(0, 5).map((country) => <Pressable key={country.id} style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
          accessibilityRole="button" accessibilityLabel={`${country.display_name} — открыть список стран`} testID={`region-country-chip-${country.country_iso2}`}
          onPress={() => setOverlay({ type: 'countries' })}>
          <CountryFlag key={`${country.id}-${country.image_url}`} country={country} size={24} />
          <Text style={styles.chipText}>{country.display_name}</Text>
        </Pressable>)}
        {countries.length > 5 && <Pressable style={styles.moreChip} onPress={() => setOverlay({ type: 'countries' })} accessibilityRole="button" accessibilityLabel={`Показать все страны категории: ${countries.length}`} testID="region-more-countries"><Text style={styles.chipText}>ещё {countries.length - 5}</Text></Pressable>}
      </View>}

      {!bundle ? <View style={styles.status} testID="region-no-bundle"><Text style={styles.statusText}>{countries.length > 0 ? 'Региональный пакет пока недоступен. Выберите страну, чтобы посмотреть её тарифы.' : 'Направления категории пока недоступны.'}</Text></View>
        : catalog.state.status === 'error' || skeleton.timedOut ? <LoadFailure title="Тарифы не загрузились" top={40} testID="region-tariffs-error"
          onRetry={() => { skeleton.restart(); catalog.reload(); }} />
        : !data ? skeleton.visible ? <TariffSkeleton /> : null
        : tariffs.length === 0 ? <Text style={styles.statusText} testID="region-tariffs-empty">Тарифы регионального пакета пока недоступны.</Text>
        : <>
            {showPackageName && <Text style={styles.packageName} testID="region-package-name">Тарифы пакета «{packageName}»</Text>}
            <View style={styles.durations} testID="region-durations">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.durationContent}>
                {durations.map((duration) => {
                  const key = durationKey(duration);
                  const active = key === activeDuration;
                  return <Pressable key={key} style={[styles.duration, active && styles.durationActive]} onPress={() => { setDurationSelection(key); setTariffSelection(null); }} accessibilityRole="button" accessibilityState={{ selected: active }} aria-pressed={active} testID={`region-duration-${key}`}><Text style={[styles.durationText, active && styles.durationTextActive]}>{formatDuration(duration)}</Text></Pressable>;
                })}
              </ScrollView>
            </View>
            <View style={styles.packages} testID="region-packages">
              {visibleTariffs.map((tariff) => {
                const active = tariff.id === selected?.id;
                const savings = getTariffSavings(tariff, visibleTariffs);
                return <Pressable key={tariff.id} onPress={() => setTariffSelection(tariff.id)} style={({ pressed }) => [styles.package, active && styles.packageActive, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`${formatDataAmount(tariff)}, ${formatDuration(tariff.duration)}, ${formatTariffPrice(tariff)}`} accessibilityState={{ selected: active }} aria-pressed={active} testID={`region-tariff-${tariff.id}`}>
                  <View style={{ flex: 1, gap: 2 }}><Text style={styles.packageData} numberOfLines={1} adjustsFontSizeToFit>{formatDataAmount(tariff)}</Text><Text style={styles.unitPrice}>{tariff.is_unlimited ? 'Без ограничений по трафику' : tariffGigabytes(tariff) ? `${formatCatalogPrice({ amount: tariff.price_amount_minor / tariffGigabytes(tariff)!, currency: tariff.price_currency }).replace(/^от /, '')} за ГБ` : formatDuration(tariff.duration)}</Text></View>
                  <TariffDiscountBadge savings={savings} profitable={tariff.is_profitable_badge} />
                  <Text style={styles.packagePrice} numberOfLines={1}>{formatTariffPrice(tariff)}</Text>
                </Pressable>;
              })}
            </View>
          </>}
    </ScrollView>
    {data && selected && <TariffPurchaseBar
      tariff={selected}
      disabled={!online}
      bottomPadding={bottomPadding}
      onBuy={() => navigation.navigate('Checkout', { country: data.esim, tariff: selected })}
      testID="region-purchase"
      buyTestID="region-buy"
    />}
    {overlay?.type === 'countries' && <CatalogCountrySheet countries={countries} title={countLabel(countries.length)} subtitle={`Направления категории «${category.title}»`} onClose={() => setOverlay(null)} onSelectCountry={country => navigation.navigate('CountryTariffs', { country })} onSupport={() => navigation.navigate('Help')} testID="region-country-sheet" />}
    {overlay?.type === 'notice' && <SwipeDialog style={styles.modalCard} onClose={() => setOverlay(null)} padding={20}
      title={<Text style={styles.modalTitle} accessibilityRole="header">{overlay.title}</Text>} closeTestID="region-modal-close">
      <Text style={styles.noticeText} selectable>{overlay.message}</Text>
    </SwipeDialog>}
  </View>;
}

const fontFamily = fonts.text;
const displayFont = fonts.display;
const styles = StyleSheet.create({
  heroPhoto: { position: 'absolute', left: 0, right: 0, top: 0, height: 380 },
  unitPrice: { fontSize: 13, lineHeight: 16, color: '#8C8C99' },
  screen: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { width: '100%', paddingHorizontal: 12, gap: 12 },
  navbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heading: { paddingHorizontal: 12, flexDirection: 'row', flexWrap: 'wrap', columnGap: 8, rowGap: 2, alignItems: 'center' },
  title: { fontFamily: displayFont, fontSize: 28, lineHeight: 36, fontWeight: '900', color: colors.text, letterSpacing: -0.56 },
  stickerFrame: { height: 44.127, alignItems: 'center', justifyContent: 'center' },
  sticker: { height: 41, justifyContent: 'center', transform: [{ rotate: '1.5deg' }] },
  stickerImage: { position: 'absolute', top: 0, width: 120, height: 41 },
  stickerText: { paddingHorizontal: 11, fontFamily: displayFont, fontSize: 28, lineHeight: 36, fontWeight: '900', color: colors.text, letterSpacing: -0.56, textAlign: 'center' },
  subtitle: { paddingHorizontal: 12, fontFamily, fontSize: 14, lineHeight: 20, letterSpacing: -0.056, color: 'rgba(255,255,255,0.55)' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { minHeight: 32, maxWidth: '100%', paddingLeft: 4, paddingRight: 12, gap: 6, borderRadius: 16, borderCurve: 'continuous', flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface },
  chipText: { fontFamily, fontSize: 13, lineHeight: 19, fontWeight: '600', letterSpacing: -0.052, color: colors.text },
  moreChip: { height: 32, paddingHorizontal: 12, borderRadius: 16, borderCurve: 'continuous', justifyContent: 'center', backgroundColor: colors.tariffAccent },
  durations: { padding: 4, borderRadius: 14, borderCurve: 'continuous', backgroundColor: colors.surface, overflow: 'hidden' },
  durationContent: { flexGrow: 1 },
  duration: { flexGrow: 1, minWidth: 80, height: 36, paddingHorizontal: 12, borderRadius: 10, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  durationActive: { backgroundColor: colors.text },
  durationText: { fontFamily, fontSize: 14, lineHeight: 20, fontWeight: '600', letterSpacing: -0.056, color: 'rgba(255,255,255,0.6)' },
  durationTextActive: { color: colors.ink },
  packages: { gap: 8 },
  package: { minHeight: 74, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 2, borderColor: 'transparent', borderRadius: 20, borderCurve: 'continuous', backgroundColor: colors.surface, flexDirection: 'row', gap: 12, alignItems: 'center' },
  packageActive: { borderWidth: 2, borderColor: colors.tariffAccent },
  packageData: { fontFamily: displayFont, fontSize: 22, lineHeight: 28, fontWeight: '900', letterSpacing: -0.44, color: colors.text },
  packagePrice: { fontFamily, fontSize: 16, lineHeight: 22, fontWeight: '600', letterSpacing: -0.064, color: 'rgba(255,255,255,0.7)' },
  packageName: { paddingHorizontal: 12, fontFamily, fontSize: 14, lineHeight: 20, color: colors.mutedText },
  status: { paddingVertical: 24, gap: 16, alignItems: 'center' },
  statusText: { fontFamily, fontSize: 14, lineHeight: 20, color: colors.mutedText, textAlign: 'center' },
  pressed: { opacity: 0.8 },
  modalCard: { width: '100%', maxWidth: 520, maxHeight: '80%', padding: 20, gap: 20, borderRadius: 24, borderCurve: 'continuous', backgroundColor: colors.surface },
  modalTitle: { fontFamily: displayFont, fontSize: 22, lineHeight: 28, fontWeight: '900', color: colors.text },
  noticeText: { fontFamily, fontSize: 16, lineHeight: 24, color: colors.text },
});
