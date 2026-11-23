import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Platform } from 'react-native';
import { ScrollView } from '../ui/ScrollView';
import { Pressable, View } from '../ui/Surface';
import { fonts, StyleSheet } from '../ui/design';
import { Text, TextInput } from '../ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { CheckoutSummaryResponse } from '../../../../packages/shared/contracts/checkout';
import { AuthApiError, sendEmailCode } from '../api/auth';
import { CheckoutApiError, createCheckoutOrder, getCheckoutSummary } from '../api/checkout';
import { useAuth } from '../auth/AuthProvider';
import { PriceCheckFailure } from '../components/ServiceState';
import { useOnline } from '../service/connectivity';
import { CountryFlag } from '../components/CountryFlag';
import { PromoCodeSheet } from '../components/PromoCodeSheet';
import { formatCatalogPrice } from '../catalog/prices';
import type { RootStackParamList } from '../navigation/stack';
import { formatDataAmount, formatDuration, formatTariffPrice } from '../tariffs/tariffs';
import { colors } from '../theme';

const assets = {
  close: require('../../assets/checkout/close.svg'),
  person: require('../../assets/checkout/person.svg'),
  sbp: require('../../assets/checkout/sbp.svg'),
  mir: require('../../assets/checkout/mir.svg'),
  gift: require('../../assets/checkout/promo-ticket.svg'),
  chevron: require('../../assets/checkout/chevron.svg'),
  heading: require('../../assets/checkout/heading.svg'),
  check: require('../../assets/home/check.svg'),
};

type Props = NativeStackScreenProps<RootStackParamList, 'Checkout'>;
const headerHeight = 68;
const submitHeight = 56;
const footerGap = 12;

export function CheckoutScreen({ route, navigation }: Props) {
  const auth = useAuth();
  const online = useOnline();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState(auth.user?.email ?? '');
  const [method, setMethod] = useState<'sbp' | 'card'>('sbp');
  const [promoOpen, setPromoOpen] = useState(false);
  const appliedCode = useRef<string | null>(null);
  const [summary, setSummary] = useState<CheckoutSummaryResponse['data'] | null>(null);
  const [summaryBusy, setSummaryBusy] = useState(true);
  const [summaryError, setSummaryError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [retryAt, setRetryAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [bodyHeight, setBodyHeight] = useState(496);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const submitting = useRef(false);
  const emailInput = useRef<TextInput>(null);
  const scroll = useRef<ScrollView>(null);
  const emailOffset = useRef(0);
  const { country: selectionCountry, tariff: selectionTariff } = route.params;
  const country = summary?.country ?? selectionCountry;
  const tariff = summary?.tariff ?? selectionTariff;
  const price = formatTariffPrice(summary ? { ...tariff, price_amount_minor: summary.amount, price_currency: summary.currency } : tariff);
  const promotion = summary?.promotion ?? null;
  const formatMoney = (amount: number) => formatCatalogPrice({ amount, currency: summary?.currency ?? tariff.price_currency }).replace(/^от /, '');
  const packagePrice = promotion ? formatMoney(promotion.subtotal_amount) : price;
  const wait = Math.max(0, Math.ceil((retryAt - now) / 1000));
  const topClearance = Platform.OS === 'web' ? 56 : insets.top + 8;
  const footerBottom = keyboardVisible ? 12 : Platform.OS === 'web' ? 42 : Math.max(insets.bottom, 12) + 8;

  useEffect(() => {
    if (auth.user) {
      setEmail(auth.user.email);
      setEmailError(null);
    }
  }, [auth.user]);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardVisible(false));
    setKeyboardVisible(Keyboard.isVisible());
    return () => { show.remove(); hide.remove(); };
  }, []);
  useEffect(() => {
    if (!retryAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [retryAt]);

  useFocusEffect(useCallback(() => {
    if (!online) { setSummaryBusy(false); return; }
    const controller = new AbortController();
    setSummaryBusy(true);
    setSummaryError(false);
    setSummary(null);
    getCheckoutSummary({ esim_id: selectionCountry.id, tariff_id: selectionTariff.id, ...(appliedCode.current ? { promo_code: appliedCode.current } : {}) }, controller.signal, auth.accessToken)
      .then((response) => {
        if (!controller.signal.aborted) setSummary(response.data);
      })
      .catch(() => {
        if (!controller.signal.aborted) setSummaryError(true);
      })
      .finally(() => { if (!controller.signal.aborted) setSummaryBusy(false); });
    return () => controller.abort();
  }, [selectionCountry.id, selectionTariff.id, attempt, auth.accessToken, online]));

  const close = () => { if (!submitting.current) { Keyboard.dismiss(); navigation.goBack(); } };

  const applyPromo = async (code: string, signal: AbortSignal) => {
    const response = await getCheckoutSummary({ esim_id: selectionCountry.id, tariff_id: selectionTariff.id, promo_code: code }, signal, auth.accessToken);
    if (signal.aborted) return;
    if (!response.data.promotion || response.data.promotion.code.toUpperCase() !== code.toUpperCase()) {
      throw new Error('Не удалось подтвердить скидку. Продолжите без промокода.');
    }
    appliedCode.current = response.data.promotion.code;
    setSummary(response.data);
  };

  const showEmailError = (message: string) => {
    setEmailError(message);
    emailInput.current?.focus();
    scroll.current?.scrollTo({ y: Math.max(0, emailOffset.current - 12), animated: true });
  };

  const submit = async () => {
    if (!online || submitting.current || summaryBusy || auth.loading || wait > 0 || promoOpen) return;
    setError(null);
    if (!summary) { setAttempt((value) => value + 1); return; }
    if (!auth.user && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      showEmailError('Введите корректный адрес электронной почты.');
      return;
    }
    setEmailError(null);
    submitting.current = true;
    setBusy(true);
    try {
      if (!auth.user || !auth.accessToken) {
        const challenge = await sendEmailCode(email.trim());
        if (navigation.isFocused()) {
          Keyboard.dismiss();
          navigation.navigate('EmailCode', { challenge, receivedAt: Date.now(), returnToCheckout: true });
        }
        return;
      }
      if (!summary.quote_id || !summary.ordering_available) {
        setAttempt((value) => value + 1);
        return;
      }
      const response = await createCheckoutOrder({ quote_id: summary.quote_id }, auth.accessToken);
      if (navigation.isFocused()) navigation.replace('OrderStatus', { orderId: response.data.id,
        openPayment: !response.data.price_changed && response.data.state === 'pending_payment' });
    } catch (cause) {
      if (!auth.user && cause instanceof AuthApiError && cause.status === 422) {
        showEmailError(cause.message);
        return;
      }
      setError(cause instanceof Error ? cause.message : 'Не удалось оформить заказ.');
      if (cause instanceof AuthApiError && cause.retryAfterSeconds) {
        setRetryAt(Date.now() + cause.retryAfterSeconds * 1000);
        setNow(Date.now());
      }
      if (cause instanceof CheckoutApiError && cause.status === 401) {
        try { await auth.retryRestore(); setError('Вход обновлён. Нажмите «Оформить» ещё раз.'); }
        catch { setError('Не удалось восстановить вход. Повторите вход через профиль.'); }
      }
      if (cause instanceof CheckoutApiError && ['price_changed', 'quote_expired'].includes(cause.code)) {
        // Both errors are checked before the server claims an order attempt.
        setError(null);
        setSummary(null);
        setSummaryError(true);
      }
    } finally { submitting.current = false; setBusy(false); }
  };

  const disabled = !online || busy || summaryBusy || auth.loading || wait > 0 || promoOpen;
  const paymentMethods = [
    { id: 'sbp' as const, title: 'СБП', description: 'Подтвердите в приложении банка', icon: assets.sbp },
    { id: 'card' as const, title: 'Карта', description: 'Банковская карта', icon: assets.mir },
  ];

  return <View style={styles.screen} testID="screen-checkout">
    <Pressable style={styles.backdrop} onPress={close} accessibilityRole="button" accessibilityLabel="Закрыть оформление" testID="checkout-backdrop" />
    <KeyboardAvoidingView style={[styles.bottom, { paddingTop: topClearance }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined} pointerEvents="box-none" accessibilityElementsHidden={promoOpen} importantForAccessibility={promoOpen ? 'no-hide-descendants' : 'auto'}>
      <View style={[styles.sheet, { height: headerHeight + bodyHeight + footerGap + submitHeight + footerBottom }]} accessibilityViewIsModal testID="checkout-sheet">
        <View style={styles.header}>
          <View style={styles.titleSlot} accessibilityRole="header" accessibilityLabel="Оформление"><Image source={assets.heading} style={styles.title} contentFit="contain" accessible={false} /></View>
          <Pressable onPress={close} disabled={busy} accessibilityRole="button" accessibilityLabel="Закрыть оформление" testID="checkout-close" style={styles.close}>
            <Image source={assets.close} style={styles.icon} contentFit="contain" accessible={false} />
          </Pressable>
        </View>
        <ScrollView ref={scroll} style={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentInsetAdjustmentBehavior="never"
          onContentSizeChange={(_, nextHeight) => setBodyHeight(previous => Math.abs(previous - nextHeight) > 0.5 ? nextHeight : previous)}
          contentContainerStyle={styles.content} testID="checkout-scroll">
          <View style={styles.order} testID="checkout-selection">
            <CountryFlag key={`${country.id}-${country.image_url}`} country={country} size={40} />
            <View style={styles.orderCopy}><Text style={styles.orderTitle} numberOfLines={1}>{country.display_name} · {formatDataAmount(tariff)}</Text><Text style={styles.orderDuration}>{formatDuration(tariff.duration)}</Text></View>
            <Text style={styles.orderPrice} testID="checkout-price">{packagePrice}</Text>
          </View>
          <View style={styles.emailGroup} testID="checkout-email-group" onLayout={event => { emailOffset.current = event.nativeEvent.layout.y; }}>
            <View style={[styles.emailField, emailError && styles.emailFieldError]}><Image source={assets.person} style={styles.icon} contentFit="contain" accessible={false} />
              <TextInput ref={emailInput} value={email} onChangeText={(value) => { setEmail(value); setEmailError(null); setError(null); }} editable={!busy && !auth.user}
                autoCapitalize="none" autoCorrect={false} autoComplete="email" keyboardType="email-address" inputMode="email" textContentType="emailAddress"
                returnKeyType="go" submitBehavior="submit" onSubmitEditing={() => void submit()} accessibilityHint={emailError ?? undefined}
                maxLength={254} placeholder="Ваша почта" placeholderTextColor={colors.mutedText} selectionColor={colors.tariffAccent} accessibilityLabel="Почта для заказа" testID="checkout-email" style={styles.emailInput} />
            </View>
            {emailError ? <Text style={[styles.emailHint, styles.emailError]} accessibilityRole="alert" accessibilityLiveRegion="polite" testID="checkout-email-error">{emailError}</Text>
              : <Text style={styles.emailHint}>{auth.user ? 'Покупка будет привязана к вашему аккаунту.' : 'Отправим код для подтверждения. Эта почта станет входом в личный кабинет с вашими eSIM.'}</Text>}
          </View>
          <View style={styles.methods}>
            {paymentMethods.map((item, index) => <Pressable key={item.id} onPress={() => { setMethod(item.id); setError(null); }} accessibilityRole="radio" accessibilityState={{ checked: method === item.id }}
              testID={`checkout-method-${item.id}`} style={({ pressed }) => [styles.method, index < paymentMethods.length - 1 && styles.methodDivider, pressed && styles.pressed]}>
              {item.icon ? <Image source={item.icon} style={styles.paymentIcon} contentFit="contain" accessible={false} /> : <View style={styles.foreignIcon}><Text style={styles.foreignIconText}>CARD</Text></View>}
              <View style={styles.methodCopy}><Text style={styles.methodTitle}>{item.title}</Text><Text style={styles.methodHint}>{item.description}</Text></View>
              <View style={[styles.radio, method === item.id && styles.radioActive]}>{method === item.id && <Image source={assets.check} style={styles.check} contentFit="contain" accessible={false} />}</View>
            </Pressable>)}
          </View>
          {promotion ? <>
            <Pressable onPress={() => { if (submitting.current) return; appliedCode.current = null; setSummary(null); setSummaryBusy(true); setAttempt(value => value + 1); }} disabled={!online || busy || summaryBusy} accessibilityRole="button" accessibilityLabel={`Удалить промокод ${promotion.code}`} testID="checkout-promo-remove" style={styles.promoApplied}>
              <Text style={styles.promoAppliedText}>{promotion.code} · −{new Intl.NumberFormat('ru', { maximumFractionDigits: 1 }).format(promotion.discount_amount / promotion.subtotal_amount * 100)}%</Text>
              <View style={styles.promoCheck}><Image source={require('../../assets/checkout/promo-check.svg')} style={styles.check} contentFit="contain" accessible={false} /></View>
            </Pressable>
            <View style={styles.breakdown} testID="checkout-breakdown">
              <View style={styles.breakdownRow}><Text style={styles.breakdownLabel}>Пакет</Text><Text style={styles.breakdownValue}>{packagePrice}</Text></View>
              <View style={styles.breakdownRow}><Text style={styles.breakdownLabel}>Промокод</Text><Text style={[styles.breakdownValue, styles.discount]}>−{formatMoney(promotion.discount_amount)}</Text></View>
              <View style={styles.breakdownRow}><Text style={styles.breakdownValue}>Итого</Text><Text style={styles.breakdownValue}>{price}</Text></View>
            </View>
          </> : <View style={styles.promo}>
            <Pressable onPress={() => { Keyboard.dismiss(); setPromoOpen(true); }} disabled={!online || busy || summaryBusy} accessibilityRole="button" accessibilityState={{ expanded: promoOpen }} testID="checkout-promo-toggle" style={styles.promoRow}>
              <View style={styles.giftSlot}><Image source={assets.gift} style={styles.promoTicket} contentFit="contain" accessible={false} /></View>
              <Text style={styles.promoTitle}>Есть промокод?</Text>
              <Image source={assets.chevron} style={styles.icon} contentFit="contain" accessible={false} />
            </Pressable>
          </View>}
          {summaryError ? <PriceCheckFailure /> : <Text style={styles.terms}>Продолжая, вы соглашаетесь с условиями сервиса</Text>}
          {error && <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite" testID="checkout-error">{error}</Text>}
        </ScrollView>
        <View style={[styles.footer, { paddingBottom: footerBottom }]} testID="checkout-footer">
          <Pressable onPress={() => void submit()} disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled, busy: busy || summaryBusy }} testID="checkout-submit"
            style={({ pressed }) => [styles.submit, (disabled || pressed) && styles.pressed]}>
            {busy || summaryBusy ? <ActivityIndicator color={colors.text} /> : <Text style={styles.submitText} numberOfLines={1} adjustsFontSizeToFit>{wait > 0 ? `Повторить через ${wait} с` : summaryError ? 'Повторить' : `${summary?.existing_order_id ? 'Продолжить оплату' : 'Оплатить'} · ${price}`}</Text>}
          </Pressable>
        </View>
        <View style={styles.handle} pointerEvents="none" />
      </View>
    </KeyboardAvoidingView>
    {promoOpen && <PromoCodeSheet onClose={() => setPromoOpen(false)} onApply={applyPromo} />}
  </View>;
}

const fontFamily = fonts.text;
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  backdrop: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)' },
  bottom: { flex: 1, justifyContent: 'flex-end' },
  sheet: { width: '100%', flexShrink: 1, backgroundColor: '#1C1C1F', borderTopLeftRadius: 32, borderTopRightRadius: 32, overflow: 'hidden' },
  body: { flex: 1 },
  content: { paddingTop: 12, paddingHorizontal: 12, gap: 12 },
  footer: { flexShrink: 0, paddingTop: footerGap, paddingHorizontal: 12 },
  handle: { position: 'absolute', top: 8, left: '50%', marginLeft: -18, width: 36, height: 5, borderRadius: 3, borderCurve: 'continuous', backgroundColor: 'rgba(255,255,255,0.25)' },
  header: { height: headerHeight, flexShrink: 0, paddingTop: 28, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center' },
  titleSlot: { flex: 1, height: 30 },
  title: { position: 'absolute', left: 0, top: 7.09, width: 153, height: 22 },
  close: { width: 40, height: 40, borderRadius: 20, borderCurve: 'continuous', backgroundColor: colors.selectedTab, alignItems: 'center', justifyContent: 'center' },
  icon: { width: 20, height: 20 },
  order: { minHeight: 65, paddingLeft: 12, paddingRight: 14, paddingVertical: 12, borderRadius: 20, borderCurve: 'continuous', backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 12 },
  orderCopy: { flex: 1, minWidth: 0 },
  orderTitle: { fontFamily, fontSize: 16, lineHeight: 22, fontWeight: '600', letterSpacing: -0.064, color: colors.text },
  orderDuration: { fontFamily, fontSize: 13, lineHeight: 19, letterSpacing: -0.052, color: colors.mutedText },
  orderPrice: { fontFamily, fontSize: 16, lineHeight: 22, fontWeight: '600', letterSpacing: -0.064, color: colors.text },
  emailGroup: { gap: 6 },
  emailField: { height: 52, borderRadius: 16, borderCurve: 'continuous', borderWidth: 1, borderColor: 'transparent', paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface },
  emailFieldError: { borderColor: '#FF9696' },
  emailInput: { flex: 1, minWidth: 0, fontFamily, fontSize: 16, lineHeight: 22, letterSpacing: -0.064, color: colors.text, padding: 0, outlineWidth: 0 },
  emailHint: { fontFamily, fontSize: 12, lineHeight: 18, letterSpacing: -0.048, color: 'rgba(255,255,255,0.45)', paddingHorizontal: 14 },
  emailError: { color: '#FF9696' },
  methods: { paddingHorizontal: 14, paddingVertical: 2, borderRadius: 20, borderCurve: 'continuous', backgroundColor: colors.surface },
  method: { paddingVertical: 12, minHeight: 67, flexDirection: 'row', alignItems: 'center', gap: 12 },
  methodDivider: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  paymentIcon: { width: 40, height: 40 },
  foreignIcon: { width: 40, height: 40, borderRadius: 10, borderCurve: 'continuous', backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center' },
  foreignIconText: { fontFamily, fontSize: 9, fontWeight: '700', color: colors.ink },
  methodCopy: { flex: 1, gap: 2 },
  methodTitle: { fontFamily, fontSize: 16, lineHeight: 22, fontWeight: '500', letterSpacing: -0.064, color: colors.text },
  methodHint: { fontFamily, fontSize: 13, lineHeight: 19, letterSpacing: -0.052, color: colors.mutedText },
  radio: { width: 24, height: 24, borderRadius: 12, borderCurve: 'continuous', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  radioActive: { backgroundColor: colors.tariffAccent, borderColor: colors.tariffAccent },
  check: { width: 16, height: 16 },
  promo: { paddingHorizontal: 14, borderRadius: 16, borderCurve: 'continuous', backgroundColor: colors.surface },
  promoRow: { height: 64, flexDirection: 'row', alignItems: 'center', gap: 12 },
  giftSlot: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  promoTicket: { width: 36.9783, height: 23.5109, transform: [{ rotate: '-12deg' }] },
  promoApplied: { height: 56, paddingLeft: 14, paddingRight: 10, borderRadius: 16, borderWidth: 2, borderColor: '#40CC73', backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 10 },
  promoAppliedText: { flex: 1, fontSize: 17, lineHeight: 23, fontWeight: '600', color: colors.text, letterSpacing: -0.068 },
  promoCheck: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#40CC73', alignItems: 'center', justifyContent: 'center' },
  breakdown: { paddingHorizontal: 14, paddingVertical: 12, gap: 6, borderRadius: 16, backgroundColor: colors.surface },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  breakdownLabel: { fontSize: 15, lineHeight: 21, color: 'rgba(255,255,255,0.6)', letterSpacing: -0.06 },
  breakdownValue: { fontSize: 15, lineHeight: 21, fontWeight: '600', color: colors.text, letterSpacing: -0.06 },
  discount: { color: '#40CC73' },
  promoTitle: { flex: 1, fontFamily, fontSize: 16, lineHeight: 22, fontWeight: '500', letterSpacing: -0.064, color: colors.text },
  terms: { fontFamily, fontSize: 12, lineHeight: 18, letterSpacing: -0.048, color: 'rgba(255,255,255,0.4)', textAlign: 'center' },
  submit: { height: submitHeight, borderRadius: 16, borderCurve: 'continuous', backgroundColor: colors.tariffAccent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  submitText: { fontFamily, fontSize: 16, lineHeight: 22, fontWeight: '600', letterSpacing: -0.064, color: colors.text },
  error: { fontFamily, fontSize: 13, lineHeight: 19, color: '#FF9696', textAlign: 'center', flexShrink: 1 },
  pressed: { opacity: 0.65 },
});
