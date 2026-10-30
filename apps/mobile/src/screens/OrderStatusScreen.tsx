import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CountryFlag } from '../components/CountryFlag';
import { InstallationSheet } from '../components/InstallationSheet';
import { PurchasedEsimView } from '../components/PurchasedEsimView';
import { getOrderQr } from '../api/checkout';
import { useAuth } from '../auth/AuthProvider';
import { useOrderStatus } from '../hooks/useOrderStatus';
import type { RootStackParamList } from '../navigation/stack';
import { orderCountry, orderDataLabel, orderPrice, orderStateLabel } from '../orders/display';
import { colors } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'OrderStatus'>;
const spinner = require('../../assets/checkout/payment-spinner.svg');

export function OrderStatusScreen({ route, navigation }: Props) {
  const status = useOrderStatus(route.params.orderId);
  const auth = useAuth();
  const insets = useSafeAreaInsets();
  const attemptedOpen = useRef(false);
  const [openError, setOpenError] = useState<string | null>(null);
  const [installationOpen, setInstallationOpen] = useState(false);
  const closeInstallation = useCallback(() => setInstallationOpen(false), []);
  const order = status.order;
  const delivered = !!auth.user && order?.id === route.params.orderId && order.state === 'delivered' && order.payment.state === 'captured';
  const pending = order?.state === 'pending_payment';
  const authorizing = pending && ['authorizing', 'authorized'].includes(order?.payment.state ?? '');
  const paymentUrl = order?.payment.url && (!order.payment.expires_at || Date.parse(order.payment.expires_at) > Date.now()) ? order.payment.url : null;

  const pay = async (url: string) => {
    setOpenError(null);
    try { await Linking.openURL(url); }
    catch { setOpenError('Не удалось открыть кассу. Нажмите «Перейти к оплате» ещё раз.'); }
  };
  useEffect(() => { attemptedOpen.current = false; setInstallationOpen(false); }, [route.params.orderId]);
  useEffect(() => {
    if (auth.accessToken && route.params.openPayment && order?.id === route.params.orderId && paymentUrl && !order.price_changed && !attemptedOpen.current) {
      attemptedOpen.current = true;
      void pay(paymentUrl);
    }
  }, [auth.accessToken, order, paymentUrl, route.params.openPayment, route.params.orderId]);

  if (delivered && order) {
    const topInset = Platform.OS === 'web' ? 48 : insets.top;
    const bottomInset = Platform.OS === 'web' ? 42 : Math.max(insets.bottom, 12) + 8;
    return <View style={styles.screen} testID="screen-order-status">
      <View style={styles.screen} accessibilityElementsHidden={installationOpen} importantForAccessibility={installationOpen ? 'no-hide-descendants' : 'auto'}>
        <PurchasedEsimView order={order} topInset={topInset} bottomInset={bottomInset} onInstall={() => setInstallationOpen(true)} onLater={() => navigation.navigate('Main', { screen: 'MyEsims' })} />
      </View>
      {status.error && !installationOpen && <Pressable onPress={status.reload} style={styles.deliveredError} accessibilityRole="button"><Text style={styles.warning}>{status.error} Нажмите, чтобы повторить.</Text></Pressable>}
      {installationOpen && <InstallationSheet order={order} topInset={topInset} bottomInset={bottomInset} onClose={closeInstallation} onRefresh={status.reload} refreshing={status.loading} statusError={status.error} loadQr={() => {
        if (!auth.accessToken) return Promise.reject(new Error('Войдите в аккаунт, чтобы скачать QR-код.'));
        return getOrderQr(order.id, auth.accessToken);
      }} />}
    </View>;
  }

  const title = authorizing ? 'Подтверждаем оплату' : pending ? 'Ожидаем оплату' : order ? orderStateLabel(order) : 'Проверяем заказ';
  const description = authorizing ? 'Касса обрабатывает платёж. Дождитесь подтверждения, повторно оплачивать заказ не нужно.'
    : pending ? 'Оплатите заказ на странице кассы и вернитесь в приложение. Мы проверим платёж и покажем вашу eSIM.'
    : order?.state === 'paid' || order?.state === 'provisioning' ? 'Оплата подтверждена. Поставщик готовит вашу eSIM.'
    : order?.state === 'failed' && order.payment.state === 'captured' ? 'Оплата прошла, но выдать eSIM пока не удалось. Сохраните номер заказа для обращения в поддержку.'
    : order?.state === 'failed' ? 'Оплата отклонена, истекла или заказ не был выполнен. Проверьте состояние перед новой покупкой.'
    : order?.state === 'cancelled' ? 'Этот заказ отменён. Данные установки для него недоступны.'
    : 'Состояние заказа будет показано после ответа сервера.';

  return <View style={styles.screen} testID="screen-order-status">
    <ScrollView contentInsetAdjustmentBehavior="never" contentContainerStyle={[styles.content, { paddingTop: (Platform.OS === 'web' ? 48 : insets.top) + 152, paddingBottom: (Platform.OS === 'web' ? 42 : Math.max(insets.bottom, 12) + 8) + 150 }]}>
      {(status.loading || ['pending_payment', 'paid', 'provisioning'].includes(order?.state ?? '')) && <Image source={spinner} style={styles.spinner} contentFit="contain" accessible={false} />}
      <Text style={styles.title} accessibilityRole="header" testID="order-state">{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {order && <>
        <View style={styles.summary}><CountryFlag country={orderCountry(order)} size={28} /><Text style={styles.summaryText}>{order.esim.name} · {orderDataLabel(order)} · {orderPrice(order)}</Text></View>
        <Text style={styles.number} selectable>Заказ № {order.order_number}</Text>
        {order.price_changed && pending && <Text style={styles.warning} testID="order-price-changed">Цена изменилась после расчёта. Проверьте сумму {orderPrice(order)} перед оплатой.</Text>}
        {pending && !authorizing && !paymentUrl && <Text style={styles.warning}>Платёжная ссылка пока недоступна или её срок истёк. Обновите состояние заказа.</Text>}
      </>}
      {(status.error || openError) && <Text style={styles.warning} accessibilityRole="alert">{status.error ?? openError}</Text>}
    </ScrollView>
    <View style={[styles.footer, { paddingBottom: Platform.OS === 'web' ? 42 : Math.max(insets.bottom, 12) + 8 }]}>
      {pending && paymentUrl && <Pressable style={styles.pay} onPress={() => void pay(paymentUrl)} accessibilityRole="button" testID="order-open-payment"><Text style={styles.buttonText}>Перейти к оплате · {orderPrice(order!)}</Text></Pressable>}
      <Pressable style={styles.refresh} onPress={status.reload} accessibilityRole="button" testID="order-refresh">{status.loading ? <ActivityIndicator color={colors.text} /> : <Text style={styles.buttonText}>Проверить состояние</Text>}</Pressable>
      <Pressable onPress={() => navigation.navigate('Main', { screen: 'MyEsims' })} accessibilityRole="button" testID="order-my-esims"><Text style={styles.back}>Мои eSIM</Text></Pressable>
    </View>
  </View>;
}

const fontFamily = Platform.select({ ios: 'System', android: 'sans-serif', default: 'system-ui' });
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  deliveredError: { position: 'absolute', left: 24, right: 24, top: 48, padding: 12, borderRadius: 16, backgroundColor: colors.surface },
  content: { width: '100%', maxWidth: 375, alignSelf: 'center', paddingHorizontal: 24, gap: 16, alignItems: 'center' },
  spinner: { width: 120, height: 120 },
  title: { fontFamily: Platform.OS === 'web' ? 'Arial' : fontFamily, fontSize: 26, lineHeight: 33, letterSpacing: -0.52, fontWeight: '900', color: colors.text, textAlign: 'center' },
  description: { fontFamily, fontSize: 16, lineHeight: 22, letterSpacing: -0.064, color: 'rgba(255,255,255,0.6)', textAlign: 'center' },
  summary: { paddingLeft: 12, paddingRight: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, backgroundColor: colors.surface },
  summaryText: { flexShrink: 1, fontFamily, fontSize: 14, lineHeight: 20, letterSpacing: -0.056, fontWeight: '600', color: colors.text },
  number: { fontFamily, fontSize: 13, lineHeight: 19, color: colors.mutedText },
  warning: { fontFamily, fontSize: 14, lineHeight: 20, color: '#FFB59C', textAlign: 'center' },
  footer: { position: 'absolute', bottom: 0, width: '100%', maxWidth: 375, alignSelf: 'center', backgroundColor: colors.background, paddingTop: 12, paddingHorizontal: 12, gap: 10 },
  pay: { height: 56, borderRadius: 16, backgroundColor: colors.tariffAccent, alignItems: 'center', justifyContent: 'center' },
  refresh: { height: 48, borderRadius: 16, backgroundColor: colors.selectedTab, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontFamily, fontSize: 16, lineHeight: 22, fontWeight: '600', color: colors.text },
  back: { fontFamily, fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.mutedText, textAlign: 'center' },
});
