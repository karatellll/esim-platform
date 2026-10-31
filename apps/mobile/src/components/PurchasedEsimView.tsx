import { Image } from 'expo-image';
import { Platform } from 'react-native';
import { ScrollView } from '../ui/ScrollView';
import { Pressable, View } from '../ui/Surface';
import { fonts, StyleSheet } from '../ui/design';
import { Text } from '../ui/Text';
import type { OrderData } from '../../../../packages/shared/contracts/checkout';
import { orderCountry, orderDataLabel, orderPrice } from '../orders/display';
import { installationState, trafficDisplay } from '../orders/installation';
import { formatDuration } from '../tariffs/tariffs';
import { colors } from '../theme';
import { CountryFlag } from './CountryFlag';

const assets = {
  heading: require('../../assets/installation/success-heading.svg'),
  track: require('../../assets/installation/ring-track.svg'),
  progress: require('../../assets/installation/ring-progress.svg'),
  status: require('../../assets/installation/status-dot.svg'),
  traffic: require('../../assets/installation/traffic-dot.svg'),
  duration: require('../../assets/installation/duration-dot.svg'),
  coins: require('../../assets/installation/coins.svg'),
  wifi: require('../../assets/installation/wifi.svg'),
};

export function AllowanceRing({ ratio, amount, caption }: { ratio: number; amount: string; caption: string }) {
  return <View style={styles.ring} accessible accessibilityLabel={`${amount} ${caption}`}>
    <Image source={assets.track} style={styles.circle} contentFit="contain" accessible={false} />
    <View style={[styles.half, { left: 75 }]}>
      <View style={[styles.rotor, { left: -75, transform: [{ rotate: `${Math.min(ratio, 0.5) * 360}deg` }] }]}>
        <View style={[styles.half, { left: 0 }]}><Image source={assets.progress} style={styles.circle} contentFit="contain" accessible={false} /></View>
      </View>
    </View>
    <View style={[styles.half, { left: 0 }]}>
      <View style={[styles.rotor, { left: 0, transform: [{ rotate: `${Math.max(0, ratio - 0.5) * 360}deg` }] }]}>
        <View style={[styles.half, { left: 75 }]}><Image source={assets.progress} style={[styles.circle, { left: -75 }]} contentFit="contain" accessible={false} /></View>
      </View>
    </View>
    <Text style={styles.amount} testID="purchased-allowance">{amount}</Text>
    <Text style={styles.caption} numberOfLines={2}>{caption}</Text>
  </View>;
}

type Props = { order: OrderData; topInset: number; bottomInset: number; onInstall: () => void; onLater: () => void };

export function PurchasedEsimView({ order, topInset, bottomInset, onInstall, onLater }: Props) {
  const traffic = trafficDisplay(order);
  const duration = formatDuration(order.tariff.duration);
  const expiry = order.expires_at ? new Date(order.expires_at) : null;
  const expiresText = expiry && Number.isFinite(expiry.getTime()) ? new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(expiry) : null;
  const alreadyActive = ['activated', 'active', 'depleted', 'expired'].includes(order.esim_status ?? '');
  return <View style={styles.screen} testID="screen-esim-purchased">
    <ScrollView showsVerticalScrollIndicator={false} contentInsetAdjustmentBehavior="never" contentContainerStyle={[styles.content, { paddingTop: topInset + 16, paddingBottom: bottomInset + 170 }]}>
      <View accessibilityRole="header" accessibilityLabel="Готово — eSIM ваша" style={styles.headingSlot}>
        <Image source={assets.heading} style={styles.heading} contentFit="contain" accessible={false} />
      </View>
      <View style={styles.card} testID="purchased-esim-card">
        <View style={styles.row}>
          <CountryFlag key={`${order.esim.id}-${order.esim.image}`} country={orderCountry(order)} size={40} />
          <View style={styles.countryCopy}><Text style={styles.country} numberOfLines={1}>{order.esim.name}</Text><Text style={styles.plan} numberOfLines={1}>{orderDataLabel(order)} · {duration}</Text></View>
          <View style={styles.badge}><Image source={assets.status} style={styles.statusDot} contentFit="contain" accessible={false} /><Text style={styles.badgeText} numberOfLines={1}>{installationState(order)}</Text></View>
        </View>
        <View style={styles.allowanceRow}>
          <AllowanceRing ratio={traffic.ratio} amount={traffic.amount} caption={`${traffic.unit} на ${duration}`} />
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={styles.legendHeading}><Image source={assets.traffic} style={styles.legendDot} contentFit="contain" accessible={false} /><Text style={styles.legendLabel}>{traffic.observed ? 'Трафик' : 'Ваш пакет'}</Text></View>
              <Text style={styles.legendValue}>{traffic.legend}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={styles.legendHeading}><Image source={assets.duration} style={styles.legendDot} contentFit="contain" accessible={false} /><Text style={styles.legendLabel}>{expiresText ? 'Действует до' : order.activated_at ? 'Активирована' : alreadyActive ? 'Срок пакета' : 'Срок пойдёт'}</Text></View>
              <Text style={styles.legendValue}>{expiresText ?? (order.activated_at ? new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(new Date(order.activated_at)) : alreadyActive ? duration : 'с активации')}</Text>
            </View>
          </View>
        </View>
      </View>
      <View style={styles.notice} testID="purchased-payment-summary">
        <View style={styles.coinCircle}><Image source={assets.coins} style={styles.coins} contentFit="contain" accessible={false} /></View>
        <Text style={styles.payment}>Оплачено {orderPrice(order)}{ '\n' }Заказ № {order.order_number}</Text>
      </View>
      <View style={styles.notice}>
        <Image source={assets.wifi} style={styles.wifi} contentFit="contain" accessible={false} />
        <Text style={styles.hint}>Установите сейчас, пока есть Wi-Fi. Данные установки — в приложении</Text>
      </View>
    </ScrollView>
    <View style={[styles.footer, { paddingBottom: bottomInset }]}>
      <Pressable onPress={onInstall} accessibilityRole="button" testID="purchased-install" style={({ pressed }) => [styles.button, styles.install, pressed && styles.pressed]}><Text style={styles.installText}>Установить eSIM</Text></Pressable>
      <Pressable onPress={onLater} accessibilityRole="button" testID="purchased-later" style={({ pressed }) => [styles.button, styles.later, pressed && styles.pressed]}><Text style={styles.laterText}>Позже</Text></Pressable>
    </View>
  </View>;
}

const fontFamily = fonts.text;
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', paddingHorizontal: 12, gap: 16 },
  headingSlot: { height: 95, width: '100%', overflow: 'visible' },
  heading: { width: '100%', height: 95 },
  card: { padding: 18, borderRadius: 28, borderCurve: 'continuous', backgroundColor: colors.surface, gap: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  countryCopy: { flex: 1, minWidth: 0 },
  country: { fontFamily, fontSize: 22, lineHeight: 28, letterSpacing: -0.44, fontWeight: '900', color: colors.text },
  plan: { fontFamily, fontSize: 13, lineHeight: 19, letterSpacing: -0.052, color: colors.mutedText },
  badge: { maxWidth: 132, flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 8, paddingRight: 10, paddingVertical: 4, borderRadius: 12, borderCurve: 'continuous', backgroundColor: colors.selectedTab },
  statusDot: { width: 7, height: 7 },
  badgeText: { flexShrink: 1, fontFamily, fontSize: 12, lineHeight: 16, letterSpacing: -0.048, fontWeight: '700', color: colors.text },
  allowanceRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  ring: { width: 150, height: 150, overflow: 'hidden' },
  circle: { position: 'absolute', left: 0, top: 0, width: 150, height: 150 },
  half: { position: 'absolute', top: 0, width: 75, height: 150, overflow: 'hidden' },
  rotor: { position: 'absolute', top: 0, width: 150, height: 150 },
  amount: { position: 'absolute', top: 44, width: 150, textAlign: 'center', fontFamily, fontSize: 38, lineHeight: 46, fontWeight: '900', letterSpacing: -1.52, color: colors.text },
  caption: { position: 'absolute', top: 88, width: 150, textAlign: 'center', fontFamily, fontSize: 12, lineHeight: 18, letterSpacing: -0.048, color: 'rgba(255,255,255,0.55)' },
  legend: { flex: 1, minWidth: 0, gap: 14 },
  legendItem: { gap: 2 },
  legendHeading: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8 },
  legendLabel: { fontFamily, fontSize: 13, lineHeight: 19, letterSpacing: -0.052, color: 'rgba(255,255,255,0.55)' },
  legendValue: { fontFamily, fontSize: 16, lineHeight: 22, letterSpacing: -0.064, fontWeight: '600', color: colors.text },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 12, paddingRight: 14, paddingVertical: 12, borderRadius: 16, borderCurve: 'continuous', backgroundColor: colors.surface, minHeight: 64 },
  coinCircle: { width: 32, height: 32, borderRadius: 16, borderCurve: 'continuous', backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  coins: { width: 18, height: 18 },
  wifi: { width: 22, height: 22 },
  payment: { flex: 1, fontFamily, fontSize: 14, lineHeight: 20, letterSpacing: -0.056, fontWeight: '600', color: colors.text },
  hint: { flex: 1, fontFamily, fontSize: 14, lineHeight: 20, letterSpacing: -0.056, color: 'rgba(255,255,255,0.7)' },
  footer: { position: 'absolute', bottom: 0, width: '100%', paddingTop: 12, paddingHorizontal: 12, gap: 10, backgroundColor: colors.background },
  button: { height: 56, borderRadius: 16, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  install: { backgroundColor: colors.lime },
  later: { backgroundColor: colors.selectedTab },
  installText: { fontFamily, fontSize: 16, lineHeight: 22, letterSpacing: -0.064, fontWeight: '600', color: colors.ink },
  laterText: { fontFamily, fontSize: 16, lineHeight: 22, letterSpacing: -0.064, fontWeight: '600', color: colors.text },
  pressed: { opacity: 0.75 },
});
