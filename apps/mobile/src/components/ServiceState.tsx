import { Image } from 'expo-image';
import { Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../theme';
import { ScrollView } from '../ui/ScrollView';
import { Pressable, View } from '../ui/Surface';
import { Text } from '../ui/Text';
import { fonts, StyleSheet } from '../ui/design';
import { useOnline } from '../service/connectivity';

const illustrations = {
  offline: { source: require('../../assets/service/offline.png'), width: 253, height: 230, left: -28, top: 0 },
  server: { source: require('../../assets/service/server.png'), width: 225, height: 200, left: 0, top: 0 },
  maintenance: { source: require('../../assets/service/maintenance.png'), width: 225, height: 200, left: 0, top: 0 },
  update: { source: require('../../assets/service/update.png'), width: 253, height: 230, left: -28, top: 0 },
  'not-found': { source: require('../../assets/service/not-found.png'), width: 246, height: 223, left: -21, top: 0 },
  session: { source: require('../../assets/service/session.png'), width: 245, height: 224, left: 0, top: -24 },
};

const descriptions = {
  offline: ['Нет интернета', 'Проверьте Wi-Fi или мобильную сеть. Купленные eSIM и QR-коды доступны и без интернета'],
  server: ['Что-то сломалось у нас', 'Мы уже чиним. Попробуйте через пару минут — ваши eSIM и деньги в порядке'],
  maintenance: ['Обновляем сервис', 'Купленные eSIM работают как обычно'],
  update: ['Обновите приложение', 'Эта версия устарела. Обновление займёт минуту, eSIM и копилка сохранятся'],
  'not-found': ['Такой страницы нет', 'Ссылка устарела или тариф больше не продаётся. Посмотрите похожие на главной'],
  session: ['Войдите снова', 'Давно не заходили — для безопасности попросим код из письма. Покупки и копилка на месте'],
};

export type ServiceKind = keyof typeof illustrations;
type Action = { label: string; onPress: () => void; disabled?: boolean };

export function ServiceState({ kind, primary, secondary, description }: {
  kind: ServiceKind; primary?: Action; secondary?: Action; description?: string;
}) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const top = Platform.OS === 'web' ? 48 : insets.top;
  const bottom = (Platform.OS === 'web' ? 34 : insets.bottom) + 12;
  const [title, copy] = descriptions[kind];
  const { source, ...geometry } = illustrations[kind];

  return <ScrollView style={styles.screen} contentInsetAdjustmentBehavior="never"
    contentContainerStyle={[styles.screenContent, { minHeight: height, paddingTop: top + 8, paddingBottom: bottom }]}
    testID={`service-${kind}`}>
    <View style={styles.center}>
      <View style={styles.illustration}>
        <Image source={source} style={[styles.illustrationArtwork, geometry]} contentFit="contain" accessible={false} />
      </View>
      <Text style={styles.title} accessibilityRole="header">{title}</Text>
      <Text style={[styles.copy, styles.description]}>{description ?? copy}</Text>
    </View>
    <View style={styles.actions}>
      {primary && <ServiceButton {...primary} />}
      {secondary && <ServiceButton {...secondary} secondary />}
    </View>
  </ScrollView>;
}

export function ServiceButton({ label, onPress, disabled, secondary, compact }: Action & { secondary?: boolean; compact?: boolean }) {
  return <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled: !!disabled }}
    style={({ pressed }) => [styles.button, secondary && styles.secondary, compact && styles.compact, (pressed || disabled) && styles.dimmed]}>
    <Text style={styles.buttonText}>{label}</Text>
  </Pressable>;
}

export function LoadFailure({ title, onRetry, card, top = 0, testID }: {
  title: string; onRetry: () => void; card?: boolean; top?: number; testID?: string;
}) {
  const online = useOnline();
  return <View style={[styles.inline, { paddingTop: top }, card && styles.card]} testID={testID} accessibilityLiveRegion="polite">
    <View style={styles.inlineIllustration}>
      <Image source={card ? require('../../assets/service/inline-esims.png') : require('../../assets/service/inline-offline.png')}
        style={styles.inlineArtwork} contentFit="contain" accessible={false} />
    </View>
    <Text style={styles.inlineTitle} accessibilityRole="header">{title}</Text>
    <Text style={styles.copy}>Проверьте интернет и попробуйте ещё раз</Text>
    <ServiceButton label="Повторить" onPress={onRetry} disabled={!online} compact />
  </View>;
}

export function OfflineBanner() {
  const insets = useSafeAreaInsets();
  return <View pointerEvents="none" style={[styles.bannerPosition, { top: (Platform.OS === 'web' ? 48 : insets.top) + 8 }]}>
    <View style={styles.banner} accessibilityRole="alert" accessibilityLiveRegion="polite" testID="offline-banner">
      <Image source={require('../../assets/service/network.svg')} style={styles.bannerIcon} contentFit="contain" accessible={false} />
      <Text style={styles.bannerText}>Нет сети — показываем сохранённое</Text>
    </View>
  </View>;
}

export function PriceCheckFailure() {
  return <View style={styles.priceCard} accessibilityRole="alert" accessibilityLiveRegion="polite" testID="checkout-price-check-failed">
    <Image source={require('../../assets/service/refresh.svg')} style={styles.refreshIcon} contentFit="contain" accessible={false} />
    <View style={styles.priceCopy}>
      <Text style={styles.priceTitle}>Не получилось проверить цену</Text>
      <Text style={styles.priceHint}>Деньги не списали. Попробуйте ещё раз</Text>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  screenContent: { flexGrow: 1, width: '100%', maxWidth: 600, alignSelf: 'center', paddingHorizontal: 16 },
  center: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  illustration: { width: 225, height: 200, marginBottom: 36 },
  illustrationArtwork: { position: 'absolute' },
  title: { fontFamily: fonts.display, fontSize: 28, lineHeight: 34, fontWeight: '900', color: colors.text, textAlign: 'center' },
  copy: { fontFamily: fonts.text, fontSize: 16, lineHeight: 22, textAlign: 'center', color: 'rgba(255,255,255,0.6)' },
  description: { marginTop: 12 },
  actions: { minHeight: 108, justifyContent: 'flex-end', gap: 4 },
  button: { minHeight: 52, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center', borderRadius: 16, borderCurve: 'continuous', backgroundColor: colors.tariffAccent },
  secondary: { backgroundColor: 'transparent' },
  compact: { minHeight: 48, paddingHorizontal: 28, alignSelf: 'center', marginTop: 16 },
  buttonText: { color: colors.text, fontFamily: fonts.text, fontSize: 16, lineHeight: 19, fontWeight: '600', textAlign: 'center' },
  dimmed: { opacity: 0.55 },
  inline: { alignItems: 'center', gap: 12 },
  inlineIllustration: { width: 135, height: 120 },
  inlineArtwork: { position: 'absolute', width: 152, height: 138, left: -17, top: 0 },
  inlineTitle: { fontFamily: fonts.display, fontSize: 24, lineHeight: 29, fontWeight: '900', color: colors.text, textAlign: 'center' },
  card: { paddingTop: 28, paddingBottom: 20, paddingHorizontal: 24, borderRadius: 28, borderCurve: 'continuous', backgroundColor: colors.surface },
  bannerPosition: { position: 'absolute', left: 12, right: 12, zIndex: 100, alignItems: 'center' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 14, paddingRight: 16, paddingVertical: 10, borderRadius: 16, borderCurve: 'continuous', backgroundColor: colors.lime },
  bannerIcon: { width: 20, height: 20 },
  bannerText: { flexShrink: 1, color: '#0D0D0F', fontFamily: fonts.text, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  priceCard: { backgroundColor: colors.surface, flexDirection: 'row', gap: 12, alignItems: 'center', padding: 14, borderRadius: 16, borderCurve: 'continuous' },
  priceCopy: { flex: 1, gap: 2 },
  refreshIcon: { width: 24, height: 24 },
  priceTitle: { color: colors.text, fontFamily: fonts.text, fontWeight: '600', fontSize: 16, lineHeight: 22 },
  priceHint: { color: 'rgba(255,255,255,0.6)', fontFamily: fonts.text, fontSize: 14, lineHeight: 20 },
});
