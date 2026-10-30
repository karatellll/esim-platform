import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { CatalogEsim } from '../../../../packages/shared/contracts/catalog';
import { useCatalogTariffs } from '../hooks/useCatalogTariffs';
import { durationKey, formatDataAmount, formatDuration, formatTariffPrice, getDefaultDuration, getDefaultTariff, getDurations, getTariffsForDuration } from '../tariffs/tariffs';
import { colors } from '../theme';
import type { RootStackParamList } from '../navigation/stack';

type Props = { bundle: CatalogEsim | null; onReloadCatalog: () => void };
const globe = require('../../assets/world/globe.svg');
// Presentation copy and flag artwork explicitly requested from Figma 103:49495.
const coverageFlags = [
  require('../../assets/world/flag-fr.png'),
  require('../../assets/world/flag-it.png'),
  require('../../assets/world/flag-de.png'),
  require('../../assets/world/flag-es.png'),
  require('../../assets/world/flag-jp.svg'),
  require('../../assets/world/flag-th.png'),
];

export function WorldTariffsPanel({ bundle, onReloadCatalog }: Props) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const catalog = useCatalogTariffs(bundle?.id ?? null);
  const [durationSelection, setDurationSelection] = useState<string | null>(null);
  const [tariffSelection, setTariffSelection] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ title: string; message: string } | null>(null);
  const data = catalog.state.status === 'ready' && catalog.state.data.esim.id === bundle?.id ? catalog.state.data : null;
  const tariffs = data?.tariffs ?? [];
  const durations = getDurations(tariffs);
  const activeDuration = durations.some((duration) => durationKey(duration) === durationSelection) ? durationSelection : getDefaultDuration(tariffs);
  const visibleTariffs = getTariffsForDuration(tariffs, activeDuration);
  const selected = visibleTariffs.find((tariff) => tariff.id === tariffSelection) ?? getDefaultTariff(visibleTariffs);

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
        <Pressable style={({ pressed }) => [styles.coverage, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Ещё 114 стран" testID="world-coverage" onPress={() => setNotice({ title: 'Страны покрытия', message: 'Список стран покрытия глобального пакета пока недоступен. Уточните его перед покупкой.' })}>
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
    </View> : !data ? <View style={styles.status} testID="world-tariffs-loading">
      <ActivityIndicator color={colors.tariffAccent} /><Text style={styles.statusText}>Загружаем глобальные тарифы…</Text>
    </View> : tariffs.length === 0 ? <Text style={styles.statusText} testID="world-tariffs-empty">Глобальные тарифы пока недоступны.</Text> : <>
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
          return <Pressable key={tariff.id} accessibilityRole="button" accessibilityLabel={`${formatDataAmount(tariff)}, ${formatDuration(tariff.duration)}, ${formatTariffPrice(tariff)}`} accessibilityState={{ selected: active }} aria-pressed={active} testID={`world-tariff-${tariff.id}`} onPress={() => setTariffSelection(tariff.id)} style={({ pressed }) => [styles.package, active && styles.packageActive, pressed && styles.pressed]}>
            <Text style={styles.packageData} numberOfLines={1} adjustsFontSizeToFit>{formatDataAmount(tariff)}</Text>
            <Text style={styles.packagePrice} numberOfLines={1}>{formatTariffPrice(tariff)}</Text>
          </Pressable>;
        })}
      </View>
      {selected && <Pressable style={({ pressed }) => [styles.buy, pressed && styles.pressed]} accessibilityRole="button" testID="world-buy" onPress={() => navigation.navigate('Checkout', { country: data.esim, tariff: selected })}>
        <Text style={styles.buttonText} accessibilityLiveRegion="polite">Купить за {formatTariffPrice(selected)}</Text>
      </Pressable>}
    </>}
    <Modal visible={notice !== null} transparent animationType="fade" onRequestClose={() => setNotice(null)}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard} accessibilityViewIsModal>
          <Text style={styles.modalTitle}>{notice?.title}</Text>
          <Text style={styles.modalText} selectable>{notice?.message}</Text>
          <Pressable style={styles.retry} onPress={() => setNotice(null)} accessibilityRole="button" testID="world-notice-close"><Text style={styles.buttonText}>Готово</Text></Pressable>
        </View>
      </View>
    </Modal>
  </View>;
}

const fontFamily = Platform.select({ ios: 'System', android: 'sans-serif', default: 'system-ui' });
const displayFont = Platform.OS === 'web' ? 'Arial' : fontFamily;
const styles = StyleSheet.create({
  panel: { gap: 12 },
  card: { height: 120, borderRadius: 24, overflow: 'hidden', backgroundColor: '#17171F' },
  globe: { position: 'absolute', width: 210, height: 210, right: -60, top: -45 },
  cardTitle: { position: 'absolute', top: 16, left: 16, fontFamily: displayFont, fontSize: 22, lineHeight: 28, fontWeight: '900', letterSpacing: -0.44, color: colors.text },
  cardSubtitle: { position: 'absolute', top: 46, left: 16, fontFamily, fontSize: 13, lineHeight: 19, letterSpacing: -0.052, opacity: 0.75, color: colors.text },
  flags: { position: 'absolute', top: 80, left: 16, flexDirection: 'row', alignItems: 'center' },
  flag: { width: 26, height: 26, marginRight: -8, borderRadius: 13, overflow: 'hidden', flexShrink: 0 },
  flagImage: { width: 26, height: 26 },
  coverage: { height: 26, paddingHorizontal: 12, borderRadius: 16, backgroundColor: colors.tariffAccent, justifyContent: 'center', flexShrink: 0, zIndex: 1 },
  coverageText: { fontFamily, fontSize: 13, lineHeight: 19, fontWeight: '600', letterSpacing: -0.052, color: colors.text },
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
  buy: { height: 56, borderRadius: 16, backgroundColor: colors.tariffAccent, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontFamily, fontSize: 16, lineHeight: 22, fontWeight: '600', letterSpacing: -0.064, color: colors.text },
  status: { paddingVertical: 24, gap: 16, alignItems: 'center' },
  statusText: { fontFamily, fontSize: 14, lineHeight: 20, color: colors.mutedText, textAlign: 'center' },
  retry: { paddingVertical: 14, paddingHorizontal: 24, borderRadius: 16, backgroundColor: colors.tariffAccent, alignItems: 'center' },
  pressed: { opacity: 0.8 },
  modalBackdrop: { flex: 1, padding: 24, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center' },
  modalCard: { width: '100%', maxWidth: 420, padding: 24, gap: 20, borderRadius: 24, backgroundColor: colors.surface },
  modalTitle: { fontFamily: displayFont, fontSize: 22, lineHeight: 28, fontWeight: '900', color: colors.text },
  modalText: { fontFamily, fontSize: 16, lineHeight: 24, color: colors.text },
});
