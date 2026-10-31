import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Modal, Platform, useWindowDimensions } from 'react-native';
import { ScrollView } from '../ui/ScrollView';
import { Pressable, View } from '../ui/Surface';
import { fonts, StyleSheet } from '../ui/design';
import { Text } from '../ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthProvider';
import type { RootStackParamList } from '../navigation/stack';
import { colors, getTabBarBottom, tabBarLayout } from '../theme';

const assets = {
  sticker: require('../../assets/savings/title-sticker.svg'),
  passport: require('../../assets/savings/passport.svg'),
  coins: require('../../assets/savings/coins.svg'),
  mascot: require('../../assets/savings/mascot.svg'),
};

type Notice = { title: string; message: string };

// Figma MVP 64:5238. Personal balances and transactions require the loyalty API.
export function SavingsScreen() {
  const auth = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [notice, setNotice] = useState<Notice | null>(null);
  const topInset = Platform.OS === 'web' ? 48 : insets.top;
  const bottomInset = getTabBarBottom(insets.bottom, Platform.OS === 'web');
  const horizontalInset = Math.max(12, insets.left, insets.right);
  const contentWidth = width;
  const cardWidth = contentWidth - horizontalInset * 2;
  const isReferenceWidth = contentWidth >= 375;
  const openExchange = () => {
    if (!auth.user) { navigation.navigate('EmailSignIn'); return; }
    navigation.navigate('Loyalty', { mode: 'exchange' });
  };
  const openPassport = () => {
    if (!auth.user) { navigation.navigate('EmailSignIn'); return; }
    setNotice({ title: 'Паспорт путешествий', message: 'Паспорт путешествий скоро появится в приложении.' });
  };

  return <View style={styles.screen} testID="screen-savings">
    <ScrollView style={styles.screen} showsVerticalScrollIndicator={false} bounces={false} overScrollMode="never" contentInsetAdjustmentBehavior="never" testID="savings-scroll" contentContainerStyle={[styles.content, { paddingTop: topInset + 8, paddingHorizontal: horizontalInset, paddingBottom: Math.max(120, bottomInset + tabBarLayout.height + 20) }]}>
      <View style={styles.header}>
        <View style={styles.heading} accessibilityRole="header" accessibilityLabel="Тут копят рубли">
          <Text style={styles.headingText}>Тут копят</Text>
          <View style={styles.stickerSlot}>
            <Image source={assets.sticker} style={styles.stickerImage} contentFit="contain" accessible={false} />
            <Text style={styles.stickerText}>рубли</Text>
          </View>
        </View>

      </View>

      <View style={styles.balanceCard} testID="savings-balance-card">
        <Text style={styles.balanceLabel}>В копилке</Text>
        <Text style={styles.balanceAmount} testID="savings-balance" accessibilityLabel="Баланс пока недоступен">—</Text>
        <Text style={[styles.balanceHint, { maxWidth: Math.max(100, cardWidth - 150) }]}>{auth.user ? 'Баланс пока\nнедоступен' : 'Войдите, чтобы\nсохранять накопления'}</Text>
        <View style={styles.illustration} pointerEvents="none" accessible={false}>
          <View style={{ position: 'absolute', right: 6, top: -41.82, width: 150, height: 240 }}>
            {[[20,186.4],[24,172.4],[17,158.4],[25,144.4],[20,130.4]].map(([left, top], index) => <Image key={index} source={require('../../assets/mvp/b024b.svg')} style={{ position: 'absolute', left, top, width: 110, height: 53.6 }} />)}
            <Image source={require('../../assets/mvp/b655d.svg')} style={{ position: 'absolute', left: 31.1, top: 53.82, width: 91.8, height: 98.3571 }} />
          </View>
        </View>
      </View>

      <Pressable onPress={openExchange} disabled={auth.loading} accessibilityRole="button" testID={auth.user ? 'savings-exchange' : 'savings-sign-in'} accessibilityHint={auth.user ? 'Информация об обмене накоплений' : 'Для обмена потребуется войти по почте'} style={({ pressed }) => [styles.exchange, auth.loading && styles.disabled, pressed && styles.pressed]}>
        <Text style={styles.exchangeText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>Обменять на бесплатную eSIM</Text>
      </Pressable>

      <View style={styles.card} testID="savings-how-it-works">
        <Text style={styles.cardTitle} accessibilityRole="header">Как работает</Text>
        <View style={styles.rule}>
          <Text style={styles.ruleTitle}>5% с каждой eSIM</Text>
          <Text style={styles.ruleDescription}>{isReferenceWidth ? 'Возвращаем рублями на счёт сразу после\nоплаты' : 'Возвращаем рублями на счёт сразу после оплаты'}</Text>
        </View>
        <View style={styles.rule}>
          <Text style={styles.ruleTitle}>+150 ₽ за друга</Text>
          <Text style={styles.ruleDescription}>{isReferenceWidth ? 'Когда друг купит первую eSIM по вашему\nкоду' : 'Когда друг купит первую eSIM по вашему коду'}</Text>
        </View>
        <View style={styles.rule}>
          <Text style={styles.ruleTitle}>Списать при оплате</Text>
          <Text style={styles.ruleDescription}>Или обменяйте на бесплатную eSIM</Text>
        </View>
      </View>

      <View style={[styles.card, styles.history]} testID="savings-history">
        <Text style={styles.cardTitle} accessibilityRole="header">История</Text>
        <View style={styles.historyEmpty} testID="savings-history-unavailable">
          <Text style={styles.emptyTitle}>{auth.user ? 'История пока недоступна' : 'Войдите в аккаунт'}</Text>
          <Text style={styles.emptyDescription}>{auth.user ? 'Здесь появятся начисления за покупки и приглашения друзей.' : 'Здесь будет история ваших накоплений.'}</Text>
          {!auth.user && <Pressable onPress={() => navigation.navigate('EmailSignIn')} disabled={auth.loading} accessibilityRole="button" testID="savings-history-sign-in" style={styles.historySignIn}><Text style={styles.historySignInText}>Войти по почте</Text></Pressable>}
        </View>
      </View>
    </ScrollView>

    <Modal visible={notice !== null} transparent animationType="fade" onRequestClose={() => setNotice(null)}>
      <View style={styles.modalBackdrop}><View style={styles.modalCard} accessibilityViewIsModal>
        <Text style={styles.cardTitle}>{notice?.title}</Text>
        <Text style={styles.noticeText}>{notice?.message}</Text>
        <Pressable onPress={() => setNotice(null)} accessibilityRole="button" testID="savings-notice-close" style={({ pressed }) => [styles.close, pressed && styles.pressed]}><Text style={styles.exchangeText}>Понятно</Text></Pressable>
      </View></View>
    </Modal>
  </View>;
}

const fontFamily = fonts.text;
const displayFont = fonts.display;
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', gap: 12 },
  header: { minHeight: 56, paddingTop: 4, paddingBottom: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  heading: { gap: 8, flexDirection: 'row', alignItems: 'center' },
  headingText: { fontFamily: displayFont, fontSize: 28, lineHeight: 36, fontWeight: '900', letterSpacing: -0.56, color: colors.text, includeFontPadding: false },
  stickerSlot: { width: 106.003, height: 46.38675 },
  stickerImage: { width: 106, height: 47 },
  stickerText: { position: 'absolute', left: 11, top: 3, fontFamily: displayFont, fontSize: 28, lineHeight: 36, fontWeight: '900', letterSpacing: -0.56, color: colors.text, includeFontPadding: false, transform: [{ rotate: '3deg' }] },
  passport: { width: 40, height: 40, borderRadius: 20, borderCurve: 'continuous', backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  passportIcon: { width: 20, height: 20 },
  balanceCard: { height: 184, borderRadius: 24, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: colors.lime },
  balanceLabel: { position: 'absolute', left: 18, top: 18, fontFamily, fontSize: 14, lineHeight: 20, fontWeight: '600', letterSpacing: -0.056, color: colors.mutedInk, includeFontPadding: false },
  balanceAmount: { position: 'absolute', left: 16, top: 40, fontFamily: fonts.accent, fontSize: 56, lineHeight: 58, fontWeight: '900', letterSpacing: -1.68, color: colors.ink, includeFontPadding: false },
  balanceHint: { position: 'absolute', left: 18, top: 118, fontFamily, fontSize: 14, lineHeight: 20, letterSpacing: -0.056, color: 'rgba(10,10,13,0.7)', includeFontPadding: false },
  illustration: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  // Figma SVG export trims the tower to the portion visible inside the balance card.
  coins: { position: 'absolute', right: 20, top: 67.6416, width: 96, height: 117 },
  mascot: { position: 'absolute', right: 16.76064, top: 44.8688, width: 102, height: 109 },
  exchange: { height: 52, paddingHorizontal: 12, borderRadius: 16, borderCurve: 'continuous', backgroundColor: colors.tariffAccent, justifyContent: 'center', alignItems: 'center' },
  exchangeText: { fontFamily, fontSize: 16, lineHeight: 22, letterSpacing: -0.064, fontWeight: '600', color: colors.text },
  card: { paddingTop: 16, paddingBottom: 8, paddingHorizontal: 16, borderRadius: 24, borderCurve: 'continuous', backgroundColor: colors.surface, overflow: 'hidden' },
  cardTitle: { fontFamily: displayFont, fontSize: 20, lineHeight: 24, fontWeight: '900', color: colors.text, includeFontPadding: false },
  rule: { paddingVertical: 12, gap: 2 },
  ruleTitle: { fontFamily, fontSize: 16, lineHeight: 19, fontWeight: '600', color: colors.text, includeFontPadding: false },
  ruleDescription: { fontFamily, fontSize: 14, lineHeight: 17, color: 'rgba(255,255,255,0.55)', includeFontPadding: false },
  history: { minHeight: 292 },
  historyEmpty: { flex: 1, minHeight: 244, paddingVertical: 28, gap: 8, justifyContent: 'center' },
  emptyTitle: { fontFamily, fontSize: 16, lineHeight: 22, color: colors.text },
  emptyDescription: { fontFamily, fontSize: 14, lineHeight: 20, color: colors.mutedText },
  historySignIn: { paddingVertical: 8, alignSelf: 'flex-start' },
  historySignInText: { fontFamily, fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.accent },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.5 },
  modalBackdrop: { flex: 1, padding: 24, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center' },
  modalCard: { width: '100%', maxWidth: 400, padding: 24, borderRadius: 24, borderCurve: 'continuous', gap: 20, backgroundColor: colors.surface },
  noticeText: { fontFamily, fontSize: 16, lineHeight: 22, color: colors.text },
  close: { minHeight: 48, borderRadius: 16, borderCurve: 'continuous', backgroundColor: colors.tariffAccent, alignItems: 'center', justifyContent: 'center' },
});
