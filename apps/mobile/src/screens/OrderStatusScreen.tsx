import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import { useCallback, useEffect, useRef, useState, type ComponentProps } from 'react';
import { ActivityIndicator, Animated, Easing, Linking, Platform } from 'react-native';
import { ScrollView } from '../ui/ScrollView';
import { AnimatedView, Pressable, View } from '../ui/Surface';
import { fonts, StyleSheet } from '../ui/design';
import { Text } from '../ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CountryFlag } from '../components/CountryFlag';
import { GlassActionButton } from '../components/GlassActionButton';
import { LoadFailure, ServiceState } from '../components/ServiceState';
import { useOnline } from '../service/connectivity';
import { InstallationSheet } from '../components/InstallationSheet';
import { EsimDetailsView } from '../components/EsimDetailsView';
import { PurchasedEsimView } from '../components/PurchasedEsimView';
import { useAuth } from '../auth/AuthProvider';
import { useCatalogTariffs } from '../hooks/useCatalogTariffs';
import { useOrderStatus } from '../hooks/useOrderStatus';
import type { RootStackParamList } from '../navigation/stack';
import { orderCountry, orderDataLabel, orderPrice, orderStateLabel } from '../orders/display';
import { loadOrderInstallationQr } from '../orders/installationActions';
import { colors } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'OrderStatus'>;
const spinner = require('../../assets/checkout/payment-spinner.svg');

function PaymentSpinner() {
  const [progress] = useState(() => new Animated.Value(0));
  useFocusEffect(useCallback(() => {
    progress.setValue(0);
    const rotation = Animated.loop(Animated.timing(progress, {
      toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: Platform.OS !== 'web', isInteraction: false,
    }));
    rotation.start();
    return () => rotation.stop();
  }, [progress]));
  return <AnimatedView testID="order-payment-spinner" style={[styles.spinner, {
    transform: [{ rotate: progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
  }]}>
    <Image source={spinner} style={styles.spinner} contentFit="contain" accessible={false} />
  </AnimatedView>;
}

function PurchasedOrder({ order, ...props }: ComponentProps<typeof PurchasedEsimView>) {
  const { state } = useCatalogTariffs(order.esim.id);
  const country = state.status === 'ready' && state.data.esim.id === order.esim.id ? state.data.esim : undefined;
  return <PurchasedEsimView {...props} order={order} country={country} />;
}

export function OrderStatusScreen({ route, navigation }: Props) {
  const status = useOrderStatus(route.params.orderId);
  const auth = useAuth();
  const online = useOnline();
  const insets = useSafeAreaInsets();
  const attemptedOpen = useRef(false);
  const [openError, setOpenError] = useState<string | null>(null);
  const [installationOpen, setInstallationOpen] = useState(false);
  const closeInstallation = useCallback(() => setInstallationOpen(false), []);
  const order = status.order;
  const delivered = !!(auth.user || (!online && auth.offlineUserId)) && order?.id === route.params.orderId && order.state === 'delivered' && order.payment.state === 'captured';
  const pending = order?.state === 'pending_payment';
  const authorizing = pending && ['authorizing', 'authorized'].includes(order?.payment.state ?? '');
  const paymentUrl = order?.payment.url && (!order.payment.expires_at || Date.parse(order.payment.expires_at) > Date.now()) ? order.payment.url : null;
  const topInset = Platform.OS === 'web' ? 48 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 42 : Math.max(insets.bottom, 12) + 8;
  const goBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Main', { screen: 'MyEsims' });
  };

  const pay = async (url: string) => {
    setOpenError(null);
    try { await Linking.openURL(url); }
    catch { setOpenError('Не удалось открыть кассу. Нажмите «Перейти к оплате» ещё раз.'); }
  };
  useEffect(() => { attemptedOpen.current = false; setInstallationOpen(false); }, [route.params.orderId]);
  useEffect(() => {
    if (online && auth.accessToken && route.params.openPayment && order?.id === route.params.orderId && paymentUrl && !order.price_changed && !attemptedOpen.current) {
      attemptedOpen.current = true;
      void pay(paymentUrl);
    }
  }, [online, auth.accessToken, order, paymentUrl, route.params.openPayment, route.params.orderId]);

  if (status.notFound) {
    return <ServiceState kind="not-found" primary={{ label: 'На главную', onPress: () => navigation.reset({ index: 0, routes: [{ name: 'Main', params: { screen: 'Search' } }] }) }} />;
  }

  if (route.params.details && !order) {
    return <View style={[styles.screen, styles.detailsPlaceholder, { paddingTop: topInset + 8 }]} testID="screen-order-status">
      <View style={styles.detailsHeader}>
        <GlassActionButton action="back" onPress={() => navigation.goBack()} />
        <Text style={styles.detailsTitle} accessibilityRole="header">Моя eSIM</Text>
        <View style={{ width: 40 }} />
      </View>
      {status.loading ? <ActivityIndicator color={colors.text} accessibilityLabel="Загружаем детали eSIM" testID="order-details-loading" />
        : status.error && <LoadFailure title="Не удалось загрузить детали eSIM" onRetry={status.reload} testID="order-details-error" />}
    </View>;
  }

  if (delivered && order) {
    return <View style={styles.screen} testID="screen-order-status">
      <View style={styles.screen} accessibilityElementsHidden={installationOpen} importantForAccessibility={installationOpen ? 'no-hide-descendants' : 'auto'}>
        {route.params.details ? <EsimDetailsView key={order.id} order={order} initialTopUp={route.params.openTopUp} topInset={topInset} bottomInset={bottomInset} onBack={() => navigation.goBack()} onInstall={() => setInstallationOpen(true)} onCatalog={() => navigation.navigate('Main', { screen: 'Countries' })} /> : <PurchasedOrder order={order} topInset={topInset} bottomInset={bottomInset} onInstall={() => setInstallationOpen(true)} onLater={() => navigation.navigate('Main', { screen: 'MyEsims' })} />}
      </View>
      {status.error && !installationOpen && <Pressable onPress={status.reload} style={styles.deliveredError} accessibilityRole="button"><Text style={styles.warning}>{status.error} Нажмите, чтобы повторить.</Text></Pressable>}
      {installationOpen && <InstallationSheet order={order} topInset={topInset} bottomInset={bottomInset} onClose={closeInstallation} onRefresh={status.reload} refreshing={status.loading} statusError={status.error}
        initialMethod={online ? undefined : order.provision?.qr_code_url ? 'qr' : 'manual'} loadQr={() => loadOrderInstallationQr(order, auth.accessToken)} />}
    </View>;
  }

  const title = authorizing ? 'Подтверждаем оплату' : pending ? 'Ожидаем оплату' : order ? orderStateLabel(order) : 'Проверяем заказ';
  const refreshLabel = pending ? 'Проверить оплату' : 'Проверить состояние';
  const description = authorizing ? 'Касса обрабатывает платёж. Дождитесь подтверждения, повторно оплачивать заказ не нужно.'
    : pending ? 'Оплатите заказ на странице кассы и вернитесь в приложение. Мы проверим платёж и покажем вашу eSIM.'
    : order?.state === 'paid' || order?.state === 'provisioning' ? 'Оплата подтверждена. Поставщик готовит вашу eSIM.'
    : order?.state === 'failed' && order.payment.state === 'captured' ? 'Оплата прошла, но выдать eSIM пока не удалось. Сохраните номер заказа для обращения в поддержку.'
    : order?.state === 'failed' ? 'Оплата отклонена, истекла или заказ не был выполнен. Проверьте состояние перед новой покупкой.'
    : order?.state === 'cancelled' ? 'Этот заказ отменён. Данные установки для него недоступны.'
    : 'Состояние заказа будет показано после ответа сервера.';

  return <View style={styles.screen} testID="screen-order-status">
    <View style={[styles.statusHeader, { paddingTop: topInset + 8, paddingLeft: Math.max(insets.left, 12) }]}>
      <GlassActionButton action="back" onPress={goBack} testID="order-back" />
    </View>
    <ScrollView style={styles.statusScroll} contentInsetAdjustmentBehavior="never" contentContainerStyle={styles.content}>
      {(status.loading || ['pending_payment', 'paid', 'provisioning'].includes(order?.state ?? '')) && <PaymentSpinner />}
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
    <View style={[styles.footer, { paddingBottom: bottomInset }]}>
      {pending && paymentUrl && <Pressable style={[styles.footerButton, styles.pay]} disabled={!online} onPress={() => void pay(paymentUrl)} accessibilityRole="button" testID="order-open-payment"><Text style={styles.buttonText}>Перейти к оплате · {orderPrice(order!)}</Text></Pressable>}
      <Pressable style={[styles.footerButton, styles.refresh]} disabled={!online} onPress={status.reload} accessibilityRole="button"
        accessibilityLabel={refreshLabel} accessibilityState={{ busy: status.loading, disabled: !online }} testID="order-refresh">
        {status.loading ? <ActivityIndicator color={colors.text} /> : <Text style={styles.buttonText}>{refreshLabel}</Text>}
      </Pressable>
    </View>
  </View>;
}

const fontFamily = fonts.text;
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  detailsPlaceholder: { paddingHorizontal: 24, gap: 24 },
  detailsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailsTitle: { fontSize: 22, lineHeight: 28, fontWeight: '800', color: colors.text },
  deliveredError: { position: 'absolute', left: 24, right: 24, top: 48, padding: 12, borderRadius: 16, borderCurve: 'continuous', backgroundColor: colors.surface },
  statusHeader: { flexShrink: 0 },
  statusScroll: { flex: 1 },
  content: { width: '100%', paddingHorizontal: 24, paddingTop: 104, paddingBottom: 16, gap: 16, alignItems: 'center' },
  spinner: { width: 120, height: 120 },
  title: { fontFamily: fonts.display, fontSize: 26, lineHeight: 33, letterSpacing: -0.52, fontWeight: '900', color: colors.text, textAlign: 'center' },
  description: { fontFamily, fontSize: 16, lineHeight: 22, letterSpacing: -0.064, color: 'rgba(255,255,255,0.6)', textAlign: 'center' },
  summary: { paddingLeft: 12, paddingRight: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, borderCurve: 'continuous', backgroundColor: colors.surface },
  summaryText: { flexShrink: 1, fontFamily, fontSize: 14, lineHeight: 20, letterSpacing: -0.056, fontWeight: '600', color: colors.text },
  number: { fontFamily, fontSize: 13, lineHeight: 19, color: colors.mutedText },
  warning: { fontFamily, fontSize: 14, lineHeight: 20, color: '#FFB59C', textAlign: 'center' },
  footer: { flexShrink: 0, paddingTop: 12, paddingHorizontal: 12, gap: 10 },
  footerButton: { height: 56, borderRadius: 16, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  pay: { backgroundColor: colors.tariffAccent },
  refresh: { backgroundColor: colors.selectedTab },
  buttonText: { fontFamily, fontSize: 16, lineHeight: 22, fontWeight: '600', color: colors.text },
});
