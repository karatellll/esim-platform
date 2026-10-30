import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, Share, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CountryFlag } from '../components/CountryFlag';
import { useCatalogTariffs } from '../hooks/useCatalogTariffs';
import { recommendTariff } from '../home/recommendation';
import type { RootStackParamList } from '../navigation/stack';
import { getTariffHeading } from '../tariffs/countryTitle';
import { durationKey, formatDataAmount, formatDuration, formatTariffPrice, getDefaultDuration, getDefaultTariff, getDurations, getTariffsForDuration } from '../tariffs/tariffs';
import { colors } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'CountryTariffs'>;
const assets = {
  back: require('../../assets/tariffs/back.svg'),
  share: require('../../assets/tariffs/share.svg'),
  sticker: require('../../assets/tariffs/sticker.svg'),
  eyesCard: require('../../assets/tariffs/eyes-card.svg'),
  eyesHint: require('../../assets/tariffs/eyes-hint.svg'),
};

export function CountryTariffsScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const catalog = useCatalogTariffs(route.params.country.id);
  const [durationSelection, setDurationSelection] = useState<string | null>(null);
  const [tariffSelection, setTariffSelection] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ title: string; message: string } | null>(null);
  const country = catalog.state.status === 'ready' ? catalog.state.data.esim : route.params.country;
  const tariffs = catalog.state.status === 'ready' ? catalog.state.data.tariffs : [];
  const recommended = recommendTariff(tariffs, route.params);
  const durations = getDurations(tariffs);
  const activeDuration = durations.some((duration) => durationKey(duration) === durationSelection) ? durationSelection : recommended ? durationKey(recommended.duration) : getDefaultDuration(tariffs);
  const visibleTariffs = getTariffsForDuration(tariffs, activeDuration);
  const selected = visibleTariffs.find((tariff) => tariff.id === tariffSelection)
    ?? visibleTariffs.find((tariff) => tariff.id === recommended?.id) ?? getDefaultTariff(visibleTariffs);
  const isGlobal = country.country_iso2?.toUpperCase() === 'XG';
  const heading = getTariffHeading(country);
  const countryName = heading.label;
  const stickerWidth = Math.min(Math.min(width, 600) - 48, Math.max(123, countryName.length * (isGlobal ? 17 : 15) + 22));
  const packageWidth = (Math.min(width, 600) - 32) / 2;
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

  return (
    <View style={styles.screen} testID={isGlobal ? 'screen-global-tariffs' : 'screen-country-tariffs'}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: topInset + 8, paddingBottom: selected ? bottomPadding + 92 : bottomPadding + 20 }]}
        contentInsetAdjustmentBehavior="never"
      >
        <View style={styles.navbar}>
          <Pressable onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Назад" testID="tariffs-back" style={({ pressed }) => [styles.navButton, pressed && styles.pressed]}>
            <Image source={assets.back} style={styles.navIcon} contentFit="contain" accessible={false} />
          </Pressable>
          <Pressable onPress={share} accessibilityRole="button" accessibilityLabel="Поделиться тарифом" testID="tariffs-share" style={({ pressed }) => [styles.navButton, pressed && styles.pressed]}>
            <Image source={assets.share} style={styles.navIcon} contentFit="contain" accessible={false} />
          </Pressable>
        </View>
        <View style={styles.header}>
          <CountryFlag key={`${country.id}-${country.image_url}`} country={country} size={52} />
          <View style={styles.titleRow} accessibilityRole="header" accessibilityLabel={`${heading.prefix} ${countryName}`}>
            <Text style={styles.title}>{heading.prefix}</Text>
            <View style={[styles.stickerFrame, { width: stickerWidth }]}>
              <View style={[styles.sticker, { width: stickerWidth }]}>
                <Image source={assets.sticker} style={[styles.stickerImage, { left: (stickerWidth - 123) / 2, transform: [{ scaleX: stickerWidth / 123 }] }]} contentFit="contain" accessible={false} />
                <Text style={styles.stickerText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>{countryName}</Text>
              </View>
            </View>
          </View>
          <Text style={styles.subtitle}>Выберите срок и объём интернета</Text>
        </View>

        {catalog.state.status === 'loading' ? (
          <View style={styles.status} testID="tariffs-loading"><ActivityIndicator color={colors.tariffAccent} /><Text style={styles.statusText}>Загружаем тарифы…</Text></View>
        ) : catalog.state.status === 'error' ? (
          <View style={styles.status} testID="tariffs-error" accessibilityLiveRegion="polite">
            <Text style={styles.statusText}>{catalog.state.message}</Text>
            <Pressable style={styles.retry} onPress={catalog.reload} accessibilityRole="button" testID="tariffs-retry"><Text style={styles.buttonText}>Повторить</Text></Pressable>
          </View>
        ) : tariffs.length === 0 ? (
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
                return <Pressable key={tariff.id} testID={`tariff-${tariff.id}`} accessibilityRole="button" accessibilityLabel={`${formatDataAmount(tariff)}, ${formatDuration(tariff.duration)}, ${formatTariffPrice(tariff)}`} accessibilityState={{ selected: active }} aria-pressed={active} onPress={() => setTariffSelection(tariff.id)} style={({ pressed }) => [styles.package, { width: packageWidth }, active && styles.packageActive, pressed && styles.pressed]}>
                  <Text style={[styles.packageTitle, active && { paddingRight: 36 }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>{formatDataAmount(tariff)}</Text>
                  {active && <Image source={assets.eyesCard} style={styles.eyesCard} contentFit="contain" accessible={false} />}
                  <View style={styles.packageBottom}>
                    <Text style={styles.packagePrice} numberOfLines={1} adjustsFontSizeToFit>{formatTariffPrice(tariff)}</Text>
                    {tariff.is_profitable_badge && <View style={styles.badge}><Text style={styles.badgeText}>Выгодно</Text></View>}
                  </View>
                </Pressable>;
              })}
            </View>
            {selected && <View style={styles.hint} testID="tariff-selection-hint">
              <Image source={assets.eyesHint} style={styles.eyesHint} contentFit="contain" accessible={false} />
              <Text style={styles.hintText}>Выбрано: {formatDataAmount(selected)} · {formatDuration(selected.duration)}</Text>
            </View>}
          </>
        )}
      </ScrollView>
      {selected && <View style={[styles.purchase, { paddingBottom: bottomPadding }]} testID="tariff-purchase">
        <View style={styles.total} accessibilityLiveRegion="polite">
          <Text style={styles.totalPrice} numberOfLines={1} adjustsFontSizeToFit testID="selected-tariff-price">{formatTariffPrice(selected)}</Text>
          <Text style={styles.totalDetails} numberOfLines={1} testID="selected-tariff-details">{formatDataAmount(selected)} · {formatDuration(selected.duration)}</Text>
        </View>
        <Pressable onPress={() => navigation.navigate('Checkout', { country, tariff: selected })} accessibilityRole="button" testID="tariff-buy" style={({ pressed }) => [styles.buy, pressed && styles.pressed]}><Text style={styles.buttonText}>Купить</Text></Pressable>
      </View>}
      <Modal visible={notice !== null} transparent animationType="fade" onRequestClose={() => setNotice(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard} accessibilityViewIsModal>
            <Text style={styles.modalTitle}>{notice?.title}</Text>
            <Text style={styles.modalText} selectable>{notice?.message}</Text>
            <Pressable style={styles.retry} onPress={() => setNotice(null)} accessibilityRole="button" testID="tariff-notice-close"><Text style={styles.buttonText}>Готово</Text></Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const fontFamily = Platform.select({ ios: 'System', android: 'sans-serif', default: 'system-ui' });
const displayFont = Platform.OS === 'web' ? 'Arial' : fontFamily;
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { width: '100%', maxWidth: 600, alignSelf: 'center', paddingHorizontal: 12, gap: 12 },
  navbar: { paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.selectedTab, alignItems: 'center', justifyContent: 'center' },
  navIcon: { width: 20, height: 20 },
  header: { alignItems: 'center', gap: 6, paddingBottom: 8 },
  titleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', columnGap: 8, rowGap: 2, maxWidth: '100%' },
  title: { fontFamily: displayFont, fontSize: 28, lineHeight: 36, fontWeight: '900', letterSpacing: -0.56, color: colors.text },
  stickerFrame: { height: 44.206, alignItems: 'center', justifyContent: 'center' },
  sticker: { height: 41, transform: [{ rotate: '1.5deg' }], justifyContent: 'center' },
  stickerImage: { position: 'absolute', top: 0, width: 123, height: 41 },
  stickerText: { fontFamily: displayFont, fontSize: 28, lineHeight: 36, fontWeight: '900', letterSpacing: -0.56, color: colors.text, paddingHorizontal: 11, textAlign: 'center' },
  subtitle: { fontFamily, fontSize: 14, lineHeight: 20, letterSpacing: -0.056, color: colors.mutedText, textAlign: 'center' },
  durations: { padding: 4, borderRadius: 16, backgroundColor: colors.surface, overflow: 'hidden' },
  durationContent: { flexGrow: 1 },
  duration: { flexGrow: 1, minWidth: 80, height: 40, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  durationActive: { backgroundColor: colors.text },
  durationText: { fontFamily, fontSize: 14, lineHeight: 20, fontWeight: '600', color: 'rgba(255,255,255,0.6)', letterSpacing: -0.056 },
  durationTextActive: { color: colors.ink },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  package: { height: 100, borderRadius: 20, padding: 14, paddingTop: 12, paddingBottom: 8, backgroundColor: colors.surface, borderWidth: 2, borderColor: 'transparent', justifyContent: 'space-between', overflow: 'hidden' },
  packageActive: { borderColor: colors.tariffAccent },
  packageTitle: { fontFamily: displayFont, fontSize: 22, lineHeight: 28, fontWeight: '900', letterSpacing: -0.44, color: colors.text },
  packageBottom: { flexDirection: 'row', gap: 4, alignItems: 'center', justifyContent: 'space-between' },
  packagePrice: { fontFamily, fontSize: 16, lineHeight: 22, fontWeight: '600', letterSpacing: -0.064, color: 'rgba(255,255,255,0.7)', flexShrink: 1 },
  eyesCard: { position: 'absolute', top: 16, right: 16, width: 28.8, height: 18 },
  badge: { borderRadius: 8, backgroundColor: colors.lime, paddingHorizontal: 8, paddingVertical: 2, flexShrink: 0 },
  badgeText: { fontFamily, fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.ink },
  hint: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingHorizontal: 8 },
  eyesHint: { width: 25.6, height: 16 },
  hintText: { fontFamily, fontSize: 14, lineHeight: 20, color: 'rgba(255,255,255,0.6)', letterSpacing: -0.056, flex: 1 },
  purchase: { position: 'absolute', bottom: 0, alignSelf: 'center', width: '100%', maxWidth: 600, paddingTop: 12, paddingLeft: 24, paddingRight: 12, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: colors.surface, flexDirection: 'row', gap: 12, alignItems: 'center' },
  total: { flex: 1, minWidth: 0 },
  totalPrice: { fontFamily: displayFont, fontSize: 24, lineHeight: 30, fontWeight: '900', letterSpacing: -0.48, color: colors.text },
  totalDetails: { fontFamily, fontSize: 14, lineHeight: 20, color: colors.mutedText, letterSpacing: -0.056 },
  buy: { width: 170, maxWidth: '52%', height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: colors.tariffAccent },
  buttonText: { fontFamily, fontSize: 16, lineHeight: 22, fontWeight: '600', color: colors.text },
  status: { paddingVertical: 32, alignItems: 'center', gap: 16 },
  statusText: { fontFamily, fontSize: 14, lineHeight: 20, color: colors.mutedText, textAlign: 'center' },
  retry: { borderRadius: 16, backgroundColor: colors.tariffAccent, paddingHorizontal: 24, paddingVertical: 14, alignItems: 'center' },
  pressed: { opacity: 0.8 },
  modalBackdrop: { flex: 1, padding: 24, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { width: '100%', maxWidth: 420, padding: 24, gap: 20, borderRadius: 24, backgroundColor: colors.surface },
  modalTitle: { fontFamily: displayFont, fontSize: 22, lineHeight: 28, fontWeight: '900', color: colors.text },
  modalText: { fontFamily, fontSize: 16, lineHeight: 24, color: colors.text },
});
