import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthProvider';
import { LoadFailure, ServiceButton } from '../components/ServiceState';
import { SkeletonBlock } from '../components/Skeleton';
import { useSavingsBalance } from '../hooks/useSavingsBalance';
import { useSkeletonGate } from '../hooks/useSkeletonGate';
import type { RootStackParamList } from '../navigation/stack';
import { useOnline } from '../service/connectivity';
import { colors, getTabBarBottom, tabBarLayout } from '../theme';
import { ScrollView } from '../ui/ScrollView';
import { View } from '../ui/Surface';
import { Text } from '../ui/Text';
import { fonts, StyleSheet } from '../ui/design';

const rules = [
  ['5% с каждой eSIM', 'Возвращаем рублями на счёт сразу после оплаты'],
  ['+150 ₽ за друга', 'Когда друг купит первую eSIM по вашему коду и включит её в поездке. Ему — тоже 150 ₽'],
  ['Списать при оплате', 'Или обменяйте на бесплатную eSIM'],
];

export function SavingsScreen() {
  const auth = useAuth();
  const online = useOnline();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const balance = useSavingsBalance();
  const loading = auth.loading || (!!auth.user && balance.state.status === 'loading');
  const gate = useSkeletonGate(loading);
  const failed = !!auth.user && (balance.state.status === 'error' || gate.timedOut);
  const guest = !auth.user;
  const topInset = Platform.OS === 'web' ? 48 : insets.top;
  const bottomInset = getTabBarBottom(insets.bottom, Platform.OS === 'web');
  const amount = balance.state.status === 'ready' ? balance.state.amount : null;
  const choose = () => navigation.navigate('Main', { screen: 'Countries' });
  const signIn = () => navigation.navigate('EmailSignIn');

  return <View style={styles.screen} testID="screen-savings">
    <ScrollView style={styles.screen} showsVerticalScrollIndicator={false} contentInsetAdjustmentBehavior="never"
      testID="savings-scroll" contentContainerStyle={[styles.content, {
        paddingTop: topInset + 8, paddingHorizontal: Math.max(12, insets.left, insets.right),
        paddingBottom: Math.max(120, bottomInset + tabBarLayout.height + 20),
      }]}>
      <View style={styles.header}>
        <View style={styles.heading} accessibilityRole="header" accessibilityLabel="Тут копят рубли">
          <Text style={styles.headingText}>Тут копят</Text>
          <View style={styles.stickerSlot}>
            <Image source={require('../../assets/savings/title-sticker.svg')} style={styles.stickerImage} contentFit="contain" accessible={false} />
            <Text style={styles.stickerText}>рубли</Text>
          </View>
        </View>
      </View>

      {failed ? <LoadFailure title="Копилка не загрузилась" top={56} testID="savings-load-error"
        onRetry={() => { gate.restart(); balance.reload(); }} />
        : loading ? gate.visible ? <SkeletonBlock style={styles.loading} /> : null
        : <>
          <View style={styles.balanceCard} testID="savings-balance-card">
            <Image source={require('../../assets/service/savings-illustration.png')} style={styles.illustration} accessible={false} />
            <Text style={styles.balanceLabel}>{guest ? 'Копилка' : 'В копилке'}</Text>
            <Text style={styles.balanceAmount} testID="savings-balance">{guest ? '5%' : amount === null ? null : `${new Intl.NumberFormat('ru-RU').format(amount)} ₽`}</Text>
            <Text style={styles.balanceHint}>{guest ? 'Возвращаем рублями\nс каждой eSIM' : 'Вернём 5% рублями\nс первой eSIM'}</Text>
          </View>
          <ServiceButton label={guest ? 'Войти по почте' : 'Выбрать eSIM'} onPress={guest ? signIn : choose} disabled={guest && !online} />
          <View style={styles.card} testID="savings-how-it-works">
            <Text style={styles.cardTitle} accessibilityRole="header">Как работает</Text>
            {rules.map(([label, copy]) => <View key={label} style={styles.rule}>
              <Text style={styles.ruleTitle}>{label}</Text>
              <Text style={styles.ruleDescription}>{copy}</Text>
            </View>)}
          </View>
        </>}
    </ScrollView>
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
  balanceCard: { height: 184, borderRadius: 24, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: colors.lime },
  balanceLabel: { position: 'absolute', left: 18, top: 18, fontFamily, fontSize: 14, lineHeight: 20, fontWeight: '600', letterSpacing: -0.056, color: colors.mutedInk, includeFontPadding: false },
  balanceAmount: { position: 'absolute', left: 16, top: 40, fontFamily: fonts.accent, fontSize: 56, lineHeight: 58, fontWeight: '900', letterSpacing: -1.68, color: colors.ink, includeFontPadding: false },
  balanceHint: { position: 'absolute', left: 18, top: 118, fontFamily, fontSize: 14, lineHeight: 20, letterSpacing: -0.056, color: 'rgba(10,10,13,0.7)', includeFontPadding: false },
  illustration: { position: 'absolute', top: 0, right: 6, width: 150, height: 184 },
  card: { paddingTop: 16, paddingBottom: 8, paddingHorizontal: 16, borderRadius: 24, borderCurve: 'continuous', backgroundColor: colors.surface, overflow: 'hidden' },
  cardTitle: { fontFamily: displayFont, fontSize: 20, lineHeight: 24, fontWeight: '900', color: colors.text, includeFontPadding: false },
  rule: { paddingVertical: 12, gap: 2 },
  ruleTitle: { fontFamily, fontSize: 16, lineHeight: 19, fontWeight: '600', color: colors.text, includeFontPadding: false },
  ruleDescription: { fontFamily, fontSize: 14, lineHeight: 17, color: 'rgba(255,255,255,0.55)', includeFontPadding: false },
  loading: { width: '100%', height: 184, borderRadius: 24 },
});
