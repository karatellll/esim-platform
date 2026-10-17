import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { countLabel, getCountries } from '../catalog/catalog';
import { getRegionBundle, getRegionHeadingPrefix, orderRegionCountries, regionBundleName } from '../catalog/regions';
import { CountryFlag } from '../components/CountryFlag';
import { useCatalogTariffs } from '../hooks/useCatalogTariffs';
import type { RootStackParamList } from '../navigation/stack';
import { durationKey, formatDataAmount, formatDuration, formatTariffPrice, getDefaultDuration, getDefaultTariff, getDurations, getTariffsForDuration } from '../tariffs/tariffs';
import { colors } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'RegionTariffs'>;
type Overlay = { type: 'countries' } | { type: 'notice'; title: string; message: string } | null;
const assets = {
  back: require('../../assets/tariffs/back.svg'),
  share: require('../../assets/tariffs/share.svg'),
  sticker: require('../../assets/regions/title-sticker.svg'),
};

export function RegionTariffsScreen({ route, navigation }: Props) {
  const { category } = route.params;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const bundle = getRegionBundle(category);
  const catalog = useCatalogTariffs(bundle?.id ?? null);
  const countries = orderRegionCountries(getCountries([category]), category.title);
  const [durationSelection, setDurationSelection] = useState<string | null>(null);
  const [tariffSelection, setTariffSelection] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [countryQuery, setCountryQuery] = useState('');
  const data = catalog.state.status === 'ready' && catalog.state.data.esim.id === bundle?.id ? catalog.state.data : null;
  const tariffs = data?.tariffs ?? [];
  const durations = getDurations(tariffs);
  const activeDuration = durations.some((duration) => durationKey(duration) === durationSelection) ? durationSelection : getDefaultDuration(tariffs);
  const visibleTariffs = getTariffsForDuration(tariffs, activeDuration);
  const selected = visibleTariffs.find((tariff) => tariff.id === tariffSelection) ?? getDefaultTariff(visibleTariffs);
  const topInset = Platform.OS === 'web' ? 48 : insets.top;
  const bottomPadding = Platform.OS === 'web' ? 42 : Math.max(insets.bottom, 12) + 8;
  const prefix = getRegionHeadingPrefix(category.title);
  const stickerWidth = Math.min(Math.min(width, 600) - 48, Math.max(120, category.title.length * 15 + 22));
  const packageName = bundle ? regionBundleName(bundle) : null;
  const showPackageName = packageName?.toLocaleLowerCase('ru') !== category.title.trim().toLocaleLowerCase('ru');
  const summary = selected && packageName
    ? `${packageName}\n${formatDataAmount(selected)} · ${formatDuration(selected.duration)}\n${formatTariffPrice(selected)}`
    : category.title;
  const query = countryQuery.trim().toLocaleLowerCase('ru');
  const filteredCountries = countries.filter((country) => `${country.display_name} ${country.country_iso2}`.toLocaleLowerCase('ru').includes(query));

  const share = async () => {
    if (Platform.OS === 'web') {
      setOverlay({ type: 'notice', title: 'Поделиться предложением', message: summary });
      return;
    }
    try { await Share.share({ message: summary }); }
    catch { setOverlay({ type: 'notice', title: 'Поделиться предложением', message: summary }); }
  };

  return <View style={styles.screen} testID="screen-region-tariffs">
    <ScrollView style={styles.scroll} contentInsetAdjustmentBehavior="never" contentContainerStyle={[styles.content, { paddingTop: topInset + 8, paddingBottom: selected ? bottomPadding + 92 : bottomPadding + 20 }]}>
      <View style={styles.navbar}>
        <Pressable onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Назад к категориям" testID="region-back" style={({ pressed }) => [styles.navButton, pressed && styles.pressed]}><Image source={assets.back} style={styles.navIcon} contentFit="contain" accessible={false} /></Pressable>
        <Pressable onPress={share} accessibilityRole="button" accessibilityLabel="Поделиться предложением" testID="region-share" style={({ pressed }) => [styles.navButton, pressed && styles.pressed]}><Image source={assets.share} style={styles.navIcon} contentFit="contain" accessible={false} /></Pressable>
      </View>
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
        {countries.slice(0, 5).map((country) => <Pressable key={country.id} style={({ pressed }) => [styles.chip, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`Тарифы: ${country.display_name}`} onPress={() => navigation.navigate('CountryTariffs', { country })}>
          <CountryFlag key={`${country.id}-${country.image_url}`} country={country} size={24} />
          <Text style={styles.chipText}>{country.display_name}</Text>
        </Pressable>)}
        {countries.length > 5 && <Pressable style={styles.moreChip} onPress={() => { setCountryQuery(''); setOverlay({ type: 'countries' }); }} accessibilityRole="button" accessibilityLabel={`Показать все страны категории: ${countries.length}`} testID="region-more-countries"><Text style={styles.chipText}>ещё {countries.length - 5}</Text></Pressable>}
      </View>}

      {!bundle ? <View style={styles.status} testID="region-no-bundle"><Text style={styles.statusText}>{countries.length > 0 ? 'Региональный пакет пока недоступен. Выберите страну, чтобы посмотреть её тарифы.' : 'Направления категории пока недоступны.'}</Text></View>
        : catalog.state.status === 'error' ? <View style={styles.status} testID="region-tariffs-error" accessibilityLiveRegion="polite">
            <Text style={styles.statusText}>{catalog.state.message}</Text>
            <Pressable onPress={catalog.reload} style={styles.action} accessibilityRole="button" testID="region-tariffs-retry"><Text style={styles.buttonText}>Повторить</Text></Pressable>
          </View>
        : !data ? <View style={styles.status} testID="region-tariffs-loading"><ActivityIndicator color={colors.tariffAccent} /><Text style={styles.statusText}>Загружаем тарифы региона…</Text></View>
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
                return <Pressable key={tariff.id} onPress={() => setTariffSelection(tariff.id)} style={({ pressed }) => [styles.package, active && styles.packageActive, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={`${formatDataAmount(tariff)}, ${formatDuration(tariff.duration)}, ${formatTariffPrice(tariff)}`} accessibilityState={{ selected: active }} aria-pressed={active} testID={`region-tariff-${tariff.id}`}>
                  <Text style={styles.packageData} numberOfLines={1} adjustsFontSizeToFit>{formatDataAmount(tariff)}</Text>
                  <Text style={styles.packagePrice} numberOfLines={1}>{formatTariffPrice(tariff)}</Text>
                </Pressable>;
              })}
            </View>
          </>}
    </ScrollView>
    {selected && <View style={[styles.footer, { paddingBottom: bottomPadding }]}>
      <Pressable onPress={() => setOverlay({ type: 'notice', title: 'Выбранный тариф', message: `${summary}\n\nПокупка будет доступна позже.` })} style={({ pressed }) => [styles.buy, pressed && styles.pressed]} accessibilityRole="button" testID="region-buy"><Text style={styles.buttonText}>Купить за {formatTariffPrice(selected)}</Text></Pressable>
      {Platform.OS === 'web' && <View style={styles.homeIndicator} />}
    </View>}
    <Modal visible={overlay !== null} transparent animationType="fade" onRequestClose={() => setOverlay(null)}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalCard, overlay?.type === 'countries' && styles.countriesModal]} accessibilityViewIsModal>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{overlay?.type === 'countries' ? 'Страны категории' : overlay?.title}</Text>
            <Pressable onPress={() => setOverlay(null)} accessibilityRole="button" accessibilityLabel="Закрыть" testID="region-modal-close"><Text style={styles.closeText}>Закрыть</Text></Pressable>
          </View>
          {overlay?.type === 'countries' ? <>
            <TextInput value={countryQuery} onChangeText={setCountryQuery} placeholder="Найти страну" placeholderTextColor={colors.mutedText} accessibilityLabel="Найти страну категории" testID="region-country-search" style={styles.search} autoCapitalize="none" autoCorrect={false} />
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.countryList}>
              {filteredCountries.map((country) => <Pressable key={country.id} style={styles.countryRow} accessibilityRole="button" onPress={() => { setOverlay(null); navigation.navigate('CountryTariffs', { country }); }} testID={`region-country-${country.country_iso2}`}>
                <CountryFlag key={`${country.id}-${country.image_url}`} country={country} size={24} /><Text style={styles.countryText}>{country.display_name}</Text>
              </Pressable>)}
              {filteredCountries.length === 0 && <Text style={styles.statusText}>По запросу ничего не найдено.</Text>}
            </ScrollView>
          </> : <Text style={styles.noticeText} selectable>{overlay?.message}</Text>}
        </View>
      </View>
    </Modal>
  </View>;
}

const fontFamily = Platform.select({ ios: 'System', android: 'sans-serif', default: 'system-ui' });
const displayFont = Platform.OS === 'web' ? 'Arial' : fontFamily;
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { width: '100%', maxWidth: 600, alignSelf: 'center', paddingHorizontal: 12, gap: 12 },
  navbar: { paddingHorizontal: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  navButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.selectedTab, alignItems: 'center', justifyContent: 'center' },
  navIcon: { width: 20, height: 20 },
  heading: { paddingHorizontal: 12, flexDirection: 'row', flexWrap: 'wrap', columnGap: 8, rowGap: 2, alignItems: 'center' },
  title: { fontFamily: displayFont, fontSize: 28, lineHeight: 36, fontWeight: '900', color: colors.text, letterSpacing: -0.56 },
  stickerFrame: { height: 44.127, alignItems: 'center', justifyContent: 'center' },
  sticker: { height: 41, justifyContent: 'center', transform: [{ rotate: '1.5deg' }] },
  stickerImage: { position: 'absolute', top: 0, width: 120, height: 41 },
  stickerText: { paddingHorizontal: 11, fontFamily: displayFont, fontSize: 28, lineHeight: 36, fontWeight: '900', color: colors.text, letterSpacing: -0.56, textAlign: 'center' },
  subtitle: { paddingHorizontal: 12, fontFamily, fontSize: 14, lineHeight: 20, letterSpacing: -0.056, color: 'rgba(255,255,255,0.55)' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { minHeight: 32, maxWidth: '100%', paddingLeft: 4, paddingRight: 12, gap: 6, borderRadius: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface },
  chipText: { fontFamily, fontSize: 13, lineHeight: 19, fontWeight: '600', letterSpacing: -0.052, color: colors.text },
  moreChip: { height: 32, paddingHorizontal: 12, borderRadius: 16, justifyContent: 'center', backgroundColor: colors.tariffAccent },
  durations: { padding: 4, borderRadius: 14, backgroundColor: colors.surface, overflow: 'hidden' },
  durationContent: { flexGrow: 1 },
  duration: { flexGrow: 1, minWidth: 80, height: 36, paddingHorizontal: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  durationActive: { backgroundColor: colors.text },
  durationText: { fontFamily, fontSize: 14, lineHeight: 20, fontWeight: '600', letterSpacing: -0.056, color: 'rgba(255,255,255,0.6)' },
  durationTextActive: { color: colors.ink },
  packages: { gap: 8 },
  package: { minHeight: 57, padding: 16, borderRadius: 20, backgroundColor: colors.surface, flexDirection: 'row', gap: 12, alignItems: 'center' },
  packageActive: { borderWidth: 2, borderColor: colors.tariffAccent },
  packageData: { flex: 1, fontFamily: displayFont, fontSize: 20, lineHeight: 25, fontWeight: '900', letterSpacing: -0.4, color: colors.text },
  packagePrice: { fontFamily: displayFont, fontSize: 20, lineHeight: 25, fontWeight: '900', letterSpacing: -0.4, color: colors.text },
  packageName: { paddingHorizontal: 12, fontFamily, fontSize: 14, lineHeight: 20, color: colors.mutedText },
  footer: { position: 'absolute', bottom: 0, width: '100%', maxWidth: 600, alignSelf: 'center', paddingTop: 12, paddingHorizontal: 12, backgroundColor: colors.background },
  buy: { height: 56, borderRadius: 16, backgroundColor: colors.tariffAccent, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontFamily, fontSize: 16, lineHeight: 22, fontWeight: '600', letterSpacing: -0.064, color: colors.text },
  homeIndicator: { position: 'absolute', bottom: 8, left: '50%', marginLeft: -67, width: 134, height: 5, borderRadius: 100, backgroundColor: colors.text },
  status: { paddingVertical: 24, gap: 16, alignItems: 'center' },
  statusText: { fontFamily, fontSize: 14, lineHeight: 20, color: colors.mutedText, textAlign: 'center' },
  action: { paddingVertical: 14, paddingHorizontal: 24, borderRadius: 16, backgroundColor: colors.tariffAccent },
  pressed: { opacity: 0.8 },
  modalBackdrop: { flex: 1, padding: 20, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center' },
  modalCard: { width: '100%', maxWidth: 520, maxHeight: '80%', padding: 20, gap: 20, borderRadius: 24, backgroundColor: colors.surface },
  countriesModal: { height: '75%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  modalTitle: { fontFamily: displayFont, fontSize: 22, lineHeight: 28, fontWeight: '900', color: colors.text, flex: 1 },
  closeText: { fontFamily, fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.accent, paddingVertical: 8 },
  search: { fontFamily, fontSize: 16, lineHeight: 22, padding: 12, borderRadius: 12, color: colors.text, backgroundColor: colors.selectedTab },
  countryList: { gap: 4, paddingBottom: 12 },
  countryRow: { paddingVertical: 12, flexDirection: 'row', gap: 12, alignItems: 'center' },
  countryText: { fontFamily, fontSize: 16, lineHeight: 22, color: colors.text, flex: 1 },
  noticeText: { fontFamily, fontSize: 16, lineHeight: 24, color: colors.text },
});
