import { SwipeDialog } from '../components/SwipeDialog';
import { GlassActionButton } from '../components/GlassActionButton';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { countryPhoto } from '../catalog/photos';
import { tariffGigabytes } from '../home/recommendation';
import { formatCatalogPrice } from '../catalog/prices';
import { useState } from 'react';
import { Platform, Share, useWindowDimensions } from 'react-native';
import { ScrollView } from '../ui/ScrollView';
import { Pressable, View } from '../ui/Surface';
import { fonts, StyleSheet } from '../ui/design';
import { Text } from '../ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LoadFailure, ServiceState } from '../components/ServiceState';
import { useOnline } from '../service/connectivity';
import { CountryFlag } from '../components/CountryFlag';
import { TariffSkeleton } from '../components/SkeletonLayouts';
import { TariffPurchaseBar, TariffPurchaseBarSkeleton } from '../components/TariffPurchaseBar';
import { TariffDiscountBadge } from '../components/TariffDiscountBadge';
import { TariffRecommendationHint, TariffRecommendationIcon, tariffOptionLabel } from '../components/TariffRecommendation';
import { useSkeletonGate } from '../hooks/useSkeletonGate';
import { useCatalogTariffs } from '../hooks/useCatalogTariffs';
import { recommendTariff } from '../home/recommendation';
import type { RootStackParamList } from '../navigation/stack';
import { getTariffHeading } from '../tariffs/countryTitle';
import { durationKey, formatDataAmount, formatDuration, formatTariffPrice, getDefaultDuration, getDefaultTariff, getDurations, getTariffsForDuration, getTariffSavings } from '../tariffs/tariffs';
import { colors } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'CountryTariffs'>;
const assets = {
  sticker: require('../../assets/tariffs/sticker.svg'),
};

export function CountryTariffsScreen({ route, navigation }: Props) {
  const online = useOnline();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const destination = route.params.country;
  const catalog = useCatalogTariffs(destination.id);
  const data = catalog.state.status === 'ready' && catalog.state.data.esim.id === destination.id ? catalog.state.data : null;
  const loading = catalog.state.status === 'loading' || (catalog.state.status === 'ready' && !data);
  const skeletonGate = useSkeletonGate(loading);
  const [durationSelection, setDurationSelection] = useState<string | null>(null);
  const [tariffSelection, setTariffSelection] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ title: string; message: string } | null>(null);
  const failed = catalog.state.status === 'error' || skeletonGate.timedOut;
  const country = data?.esim ?? destination;
  const tariffs = data?.tariffs ?? [];
  const { initialTariffId, recommendedTariffId } = route.params;
  const initial = tariffs.find(tariff => tariff.id === initialTariffId) ?? recommendTariff(tariffs, route.params);
  const durations = getDurations(tariffs);
  const activeDuration = durations.some((duration) => durationKey(duration) === durationSelection) ? durationSelection : initial ? durationKey(initial.duration) : getDefaultDuration(tariffs);
  const visibleTariffs = getTariffsForDuration(tariffs, activeDuration);
  const selected = visibleTariffs.find((tariff) => tariff.id === tariffSelection)
    ?? visibleTariffs.find((tariff) => tariff.id === initial?.id) ?? getDefaultTariff(visibleTariffs);
  const isGlobal = country.country_iso2?.toUpperCase() === 'XG';
  const heading = getTariffHeading(country);
  const countryName = heading.label;
  const stickerWidth = Math.min(Math.min(width, 600) - 48, Math.max(123, countryName.length * (isGlobal ? 17 : 15) + 22));
  const topInset = Platform.OS === 'web' ? 48 : insets.top;
  const bottomPadding = Platform.OS === 'web' ? 42 : Math.max(insets.bottom, 12) + 8;
  const summary = selected ? `${country.display_name}\n${formatDataAmount(selected)} · ${formatDuration(selected.duration)}\n${formatTariffPrice(selected)}` : country.display_name;

  const share = async () => {
    if (Platform.OS === 'web') {
      setNotice({ title: 'Поделиться тарифом', message: summary });
      return;
    }
    try { await Share.share({ message: summary }); }
    catch { setNotice({ title: 'Поделиться тарифом', message: summary }); }
  };

  if (catalog.state.status === 'error' && catalog.state.httpStatus === 404) {
    return <ServiceState kind="not-found" primary={{ label: 'На главную', onPress: () => navigation.reset({ index: 0, routes: [{ name: 'Main', params: { screen: 'Search' } }] }) }} />;
  }

  return (
    <View style={styles.screen} testID={isGlobal ? 'screen-global-tariffs' : 'screen-country-tariffs'}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: topInset + 8, paddingBottom: selected ? bottomPadding + 92 : bottomPadding + 20 }]}
        contentInsetAdjustmentBehavior="never"
      >
        {!isGlobal && !failed && <View pointerEvents="none" style={styles.heroPhoto}>
          <Image source={countryPhoto(destination.country_iso2)} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} />
          <LinearGradient colors={['rgba(20,20,22,0.6)', 'rgba(20,20,22,0.15)', 'rgba(20,20,22,0.5)', colors.background]} locations={[0, 0.3, 0.62, 1]} style={StyleSheet.absoluteFill} />
        </View>}
        <View style={styles.navbar}>
          <GlassActionButton action="back" onPress={() => navigation.goBack()} accessibilityLabel="Назад" testID="tariffs-back" />
          <GlassActionButton action="share" onPress={share} accessibilityLabel="Поделиться тарифом" testID="tariffs-share" />
        </View>
        {!isGlobal && !failed && <View style={styles.heroSpace} />}
        <View style={[styles.header, !isGlobal && !failed && styles.photoHeader]}>
          {(isGlobal || failed) && <CountryFlag key={`${country.id}-${country.image_url}`} country={country} size={52} />}
          <View style={[styles.titleRow, !isGlobal && !failed && styles.photoTitleRow]} accessibilityRole="header" accessibilityLabel={`${heading.prefix} ${countryName}`}>
            <Text style={styles.title}>{heading.prefix}</Text>
            <View style={[styles.stickerFrame, { width: stickerWidth }]}>
              <View style={[styles.sticker, { width: stickerWidth }]}>
                <Image source={assets.sticker} style={[styles.stickerImage, { left: (stickerWidth - 123) / 2, transform: [{ scaleX: stickerWidth / 123 }] }]} contentFit="contain" accessible={false} />
                <Text style={styles.stickerText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>{countryName}</Text>
              </View>
            </View>
          </View>
          <Text style={[styles.subtitle, !isGlobal && !failed && styles.photoSubtitle]}>{country.network?.trim() || 'Выберите срок и объём интернета'}</Text>
        </View>

        {failed ? <LoadFailure title="Тарифы не загрузились" top={40} testID="tariffs-error"
          onRetry={() => { skeletonGate.restart(); catalog.reload(); }} />
        : loading ? skeletonGate.visible ? <TariffSkeleton /> : null
        : tariffs.length === 0 ? (
          <Text style={styles.statusText} testID="tariffs-empty">Тарифы для этого направления пока недоступны.</Text>
        ) : (
          <>
            <View style={styles.durations} testID="tariff-durations">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.durationContent}>
                {durations.map((duration) => {
                  const key = durationKey(duration);
                  const active = key === activeDuration;
                  return <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected: active }} aria-pressed={active} testID={`duration-${key}`} onPress={() => { setDurationSelection(key); setTariffSelection(null); }} style={[styles.duration, active && styles.durationActive]}>
                    <Text style={[styles.durationText, active && styles.durationTextActive]}>{formatDuration(duration)}</Text>
                  </Pressable>;
                })}
              </ScrollView>
            </View>
            <View style={styles.grid} testID="tariff-packages">
              {visibleTariffs.map((tariff) => {
                const active = tariff.id === selected?.id;
                const recommended = tariff.id === recommendedTariffId;
                const savings = getTariffSavings(tariff, visibleTariffs);
                return <Pressable key={tariff.id} testID={`tariff-${tariff.id}`} accessibilityRole="button" accessibilityLabel={tariffOptionLabel(tariff, recommended)} accessibilityState={{ selected: active }} aria-pressed={active} onPress={() => setTariffSelection(tariff.id)} style={({ pressed }) => [styles.package, active && styles.packageActive, pressed && styles.pressed]}>
                  <View style={{ flex: 1, gap: 2 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={styles.packageTitle}>{formatDataAmount(tariff)}</Text>
                    {recommended && <TariffRecommendationIcon />}
                  </View><Text style={styles.unitPrice}>{tariff.is_unlimited ? 'Без ограничений по трафику' : tariffGigabytes(tariff) ? `${formatCatalogPrice({ amount: tariff.price_amount_minor / tariffGigabytes(tariff)!, currency: tariff.price_currency }).replace(/^от /, '')} за ГБ` : formatDuration(tariff.duration)}</Text></View>
                  <TariffDiscountBadge savings={savings} profitable={tariff.is_profitable_badge} />
                  <Text style={styles.packagePrice}>{formatTariffPrice(tariff)}</Text>
                </Pressable>;
              })}
            </View>
            {visibleTariffs.some(tariff => tariff.id === recommendedTariffId) && <TariffRecommendationHint />}
          </>
        )}
      </ScrollView>
      {selected && <TariffPurchaseBar
        tariff={selected}
        disabled={!online}
        bottomPadding={bottomPadding}
        onBuy={() => navigation.navigate('Checkout', { country, tariff: selected })}
        testID="tariff-purchase"
        buyTestID="tariff-buy"
      />}
      {loading && skeletonGate.visible && !skeletonGate.timedOut && <TariffPurchaseBarSkeleton bottomPadding={bottomPadding} />}
      {notice !== null && <SwipeDialog style={styles.modalCard} onClose={() => setNotice(null)}
        title={<Text style={styles.modalTitle} accessibilityRole="header">{notice.title}</Text>}>
        <Text style={styles.modalText} selectable>{notice.message}</Text>
        <Pressable style={styles.retry} onPress={() => setNotice(null)} accessibilityRole="button" testID="tariff-notice-close"><Text style={styles.buttonText}>Готово</Text></Pressable>
      </SwipeDialog>}
    </View>
  );
}

const fontFamily = fonts.text;
const displayFont = fonts.display;
const styles = StyleSheet.create({
  unitPrice: { color: '#8C8C99', fontSize: 13, lineHeight: 16 },
  screen: { flex: 1, backgroundColor: colors.background },
  heroPhoto: { position: 'absolute', top: 0, left: 0, right: 0, height: 400, overflow: 'hidden' },
  heroSpace: { height: 170 },
  scroll: { flex: 1 },
  content: { width: '100%', paddingHorizontal: 12, gap: 12 },
  navbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  header: { alignItems: 'center', gap: 6, paddingBottom: 8 },
  photoHeader: { alignItems: 'flex-start' },
  photoTitleRow: { justifyContent: 'flex-start', alignItems: 'flex-start' },
  photoSubtitle: { textAlign: 'left' },
  titleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', columnGap: 8, rowGap: 2, maxWidth: '100%' },
  title: { fontFamily: displayFont, fontSize: 28, lineHeight: 36, fontWeight: '900', letterSpacing: -0.56, color: colors.text },
  stickerFrame: { height: 44.206, alignItems: 'center', justifyContent: 'center' },
  sticker: { height: 41, transform: [{ rotate: '1.5deg' }], justifyContent: 'center' },
  stickerImage: { position: 'absolute', top: 0, width: 123, height: 41 },
  stickerText: { fontFamily: displayFont, fontSize: 28, lineHeight: 36, fontWeight: '900', letterSpacing: -0.56, color: colors.text, paddingHorizontal: 11, textAlign: 'center' },
  subtitle: { fontFamily, fontSize: 14, lineHeight: 20, letterSpacing: -0.056, color: colors.mutedText, textAlign: 'center' },
  durations: { padding: 4, borderRadius: 16, borderCurve: 'continuous', backgroundColor: colors.surface, overflow: 'hidden' },
  durationContent: { flexGrow: 1 },
  duration: { flexGrow: 1, minWidth: 80, height: 40, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  durationActive: { backgroundColor: colors.text },
  durationText: { fontFamily, fontSize: 14, lineHeight: 20, fontWeight: '600', color: 'rgba(255,255,255,0.6)', letterSpacing: -0.056 },
  durationTextActive: { color: colors.ink },
  grid: { gap: 8 },
  package: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 20, borderCurve: 'continuous', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.surface, borderWidth: 2, borderColor: 'transparent', justifyContent: 'space-between', overflow: 'hidden' },
  packageActive: { borderColor: colors.tariffAccent },
  packageTitle: { flexShrink: 1, fontFamily: displayFont, fontSize: 22, lineHeight: 28, fontWeight: '900', letterSpacing: -0.44, color: colors.text },
  packageBottom: { flexDirection: 'row', gap: 4, alignItems: 'center', justifyContent: 'space-between' },
  packagePrice: { fontFamily, fontSize: 16, lineHeight: 22, fontWeight: '600', letterSpacing: -0.064, color: 'rgba(255,255,255,0.7)', flexShrink: 1 },
  buttonText: { fontFamily, fontSize: 16, lineHeight: 22, fontWeight: '600', color: colors.text },
  statusText: { fontFamily, fontSize: 14, lineHeight: 20, color: colors.mutedText, textAlign: 'center' },
  retry: { borderRadius: 16, borderCurve: 'continuous', backgroundColor: colors.tariffAccent, paddingHorizontal: 24, paddingVertical: 14, alignItems: 'center' },
  pressed: { opacity: 0.8 },
  modalCard: { width: '100%', maxWidth: 420, padding: 24, gap: 20, borderRadius: 24, borderCurve: 'continuous', backgroundColor: colors.surface },
  modalTitle: { fontFamily: displayFont, fontSize: 22, lineHeight: 28, fontWeight: '900', color: colors.text },
  modalText: { fontFamily, fontSize: 16, lineHeight: 24, color: colors.text },
});
