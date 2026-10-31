import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { Image, type ImageSource } from 'expo-image';
import { useState } from 'react';
import { Modal, Platform } from 'react-native';
import { ScrollView } from '../ui/ScrollView';
import { Pressable, View } from '../ui/Surface';
import { fonts, StyleSheet } from '../ui/design';
import { Text } from '../ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { AuthUser } from '../../../../packages/shared/contracts/auth';
import { useAuth } from '../auth/AuthProvider';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/stack';
import type { RootTabParamList } from '../navigation/tabs';
import { colors, getTabBarBottom, tabBarLayout } from '../theme';

const assets = {
  savingsArrow: require('../../assets/profile-account/savings-arrow.svg'),
  history: require('../../assets/profile-account/history.svg'),
  chevron: require('../../assets/profile-account/chevron.svg'),
  payment: require('../../assets/profile-account/payment.svg'),
  invite: require('../../assets/profile-account/invite.svg'),
  notifications: require('../../assets/profile-account/notifications.svg'),
  language: require('../../assets/profile-account/language.svg'),
  install: require('../../assets/profile-account/install.svg'),
  support: require('../../assets/profile-account/support.svg'),
};

type Notice = { title: string; message: string };
type RowProps = {
  label: string;
  icon: ImageSource;
  testID: string;
  detail?: string;
  accent?: boolean;
  divider?: boolean;
  onPress: () => void;
};

function AccountRow({ label, icon, detail, accent, divider, testID, onPress }: RowProps) {
  return <Pressable accessibilityRole="button" accessibilityLabel={detail ? label + ', ' + detail : label} onPress={onPress} testID={testID} style={({ pressed }) => [styles.row, divider && styles.divider, pressed && styles.pressed]}>
    <Image source={icon} style={styles.icon} contentFit="contain" accessible={false} />
    <Text style={styles.rowLabel} numberOfLines={1}>{label}</Text>
    {detail && <Text style={[styles.detail, accent && styles.detailAccent]}>{detail}</Text>}
    <Image source={assets.chevron} style={styles.icon} contentFit="contain" accessible={false} />
  </Pressable>;
}

// Figma MVP 64:4555. Values from the design are examples, not account data.
export function ProfileAccountScreen({ user }: { user: AuthUser }) {
  const auth = useAuth();
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  const stack = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  // The authentication contract currently contains email only; use its login as a label.
  const label = user.display_name || user.email.split('@')[0] || 'Пользователь';
  const initial = Array.from(label)[0]?.toLocaleUpperCase('ru') || 'П';
  const topInset = Platform.OS === 'web' ? 48 : insets.top;
  const bottomInset = getTabBarBottom(insets.bottom, Platform.OS === 'web');
  const unavailable = (title: string, message: string) => setNotice({ title, message });
  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try { await auth.signOut(); }
    catch (error) { unavailable('Не удалось выйти', error instanceof Error ? error.message : 'Попробуйте ещё раз.'); }
    finally { setSigningOut(false); }
  };

  return <View style={styles.screen} testID="screen-profile">
    <ScrollView style={styles.screen} contentInsetAdjustmentBehavior="never" showsVerticalScrollIndicator={false} bounces={false} overScrollMode="never" testID="profile-account-scroll" contentContainerStyle={[styles.content, { paddingTop: topInset + 12, paddingHorizontal: Math.max(12, insets.left, insets.right), paddingBottom: Math.max(120, bottomInset + tabBarLayout.height + 20) }]}>
      <Pressable onPress={() => stack.navigate('ProfileEdit')} accessibilityRole="button" accessibilityLabel="Редактировать профиль" style={styles.header} testID="profile-account-header">
        <View style={styles.avatar} accessible={false}>{user.avatar ? <Image source={{ uri: user.avatar }} style={{ width: 64, height: 64, borderRadius: 32 }} /> : <Image source={require('../../assets/mvp/25309.svg')} style={{ width: 32, height: 32 }} />}</View>
        <View style={styles.identity}>
          <Text style={styles.name} numberOfLines={1} testID="profile-name">{label}</Text>
          <Text style={styles.email} numberOfLines={1} selectable testID="profile-email">{user.email}</Text>
        </View>
        <Image source={assets.chevron} style={styles.icon} />
      </Pressable>

      <Pressable onPress={() => navigation.navigate('Savings')} accessibilityRole="button" accessibilityLabel="Копилка. Баланс пока недоступен" testID="profile-savings" style={({ pressed }) => [styles.savings, pressed && styles.pressed]}>
        <Text style={styles.savingsLabel}>Копилка</Text>
        <Text style={styles.balance} testID="profile-savings-balance">—</Text>
        <Text style={styles.cashback}>5% с каждой покупки</Text>
        <View pointerEvents="none" style={{ position: 'absolute', right: 10, top: -38.6, width: 120, height: 190 }}>
          {[[14,144.88],[18,132.88],[11,120.88],[19,108.88]].map(([left, top], index) => <Image key={index} source={require('../../assets/mvp/9f283.svg')} style={{ position: 'absolute', left, top, width: 92, height: 45.12 }} />)}
          <Image source={require('../../assets/mvp/3894e.svg')} style={{ position: 'absolute', left: 26.3, top: 50.6, width: 71.4, height: 76.5 }} />
        </View>
      </Pressable>

      <View style={[styles.card, styles.purchases]} testID="profile-purchases">
        <View style={styles.cardHeading}><Text style={styles.cardTitle} accessibilityRole="header">Покупки</Text></View>
        <AccountRow label="История и чеки" icon={assets.history} testID="profile-history" divider onPress={() => navigation.navigate('MyEsims')} />
        <AccountRow label="Способы оплаты" icon={assets.payment} detail="СБП" testID="profile-payments" divider onPress={() => unavailable('Способы оплаты', 'Настройка оплаты пока недоступна.')} />
        <AccountRow label="Пригласить друга" icon={assets.invite} detail="+150 ₽" accent testID="profile-invite" onPress={() => stack.navigate('Loyalty', { mode: 'invite' })} />
      </View>

      <View style={styles.card} testID="profile-settings">
        <View style={styles.cardHeading}><Text style={styles.cardTitle} accessibilityRole="header">Настройки</Text></View>
        <AccountRow label="Уведомления" icon={assets.notifications} detail="выкл" testID="profile-notifications" divider onPress={() => unavailable('Уведомления', 'Push-уведомления пока не подключены.')} />
        <AccountRow label="Язык и валюта" icon={assets.language} detail="RU · ₽" testID="profile-language" onPress={() => unavailable('Язык и валюта', 'Сейчас интерфейс доступен на русском языке. Выбор языка и валюты появится позже.')} />
      </View>

      <View style={styles.card} testID="profile-help">
        <View style={styles.cardHeading}><Text style={styles.cardTitle} accessibilityRole="header">Помощь</Text></View>
        <AccountRow label="Как поставить eSIM" icon={assets.install} testID="profile-install" divider onPress={() => stack.navigate('Help', { installation: true })} />
        <AccountRow label="Написать в поддержку" icon={assets.support} detail="24/7" testID="profile-support" onPress={() => stack.navigate('Help')} />
      </View>

      <Pressable onPress={() => void signOut()} disabled={signingOut} accessibilityRole="button" testID="profile-sign-out" style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}><Text style={styles.signOutText}>{signingOut ? 'Выходим…' : 'Выйти из аккаунта'}</Text></Pressable>
      {auth.restoreError && <Pressable onPress={() => void auth.retryRestore().catch(() => {})} accessibilityRole="button" testID="profile-restore-retry"><Text style={styles.noticeText}>{auth.restoreError} Нажмите, чтобы повторить.</Text></Pressable>}
    </ScrollView>

    <Modal visible={notice !== null} transparent animationType="fade" onRequestClose={() => setNotice(null)}>
      <View style={styles.modalBackdrop}><View style={styles.modalCard} accessibilityViewIsModal>
        <Text style={styles.cardTitle}>{notice?.title}</Text>
        <Text style={styles.noticeText}>{notice?.message}</Text>
        <Pressable onPress={() => setNotice(null)} accessibilityRole="button" testID="profile-notice-close" style={({ pressed }) => [styles.close, pressed && styles.pressed]}><Text style={styles.closeText}>Понятно</Text></Pressable>
      </View></View>
    </Modal>
  </View>;
}

const fontFamily = fonts.text;
const displayFont = fonts.display;
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', gap: 12 },
  header: { height: 72, paddingHorizontal: 12, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 64, height: 64, borderRadius: 32, borderCurve: 'continuous', backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: displayFont, fontSize: 28, lineHeight: 36, fontWeight: '900', letterSpacing: -0.56, color: colors.text, includeFontPadding: false },
  identity: { flex: 1, minWidth: 0, gap: 4 },
  name: { fontFamily: displayFont, fontSize: 26, lineHeight: 33, fontWeight: '900', letterSpacing: -0.52, color: colors.text, includeFontPadding: false },
  email: { fontFamily, fontSize: 14, lineHeight: 20, letterSpacing: -0.056, color: colors.mutedText, includeFontPadding: false },
  savings: { height: 132, borderRadius: 24, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: colors.lime },
  savingsLabel: { position: 'absolute', left: 18, top: 18, fontFamily, fontSize: 14, lineHeight: 20, fontWeight: '600', letterSpacing: -0.056, color: colors.mutedInk, includeFontPadding: false },
  balance: { position: 'absolute', left: 16, top: 38, fontFamily: displayFont, fontSize: 26, lineHeight: 32, fontWeight: '900', letterSpacing: -0.78, color: colors.ink, includeFontPadding: false },
  cashback: { position: 'absolute', left: 16, top: 86, backgroundColor: colors.ink, borderRadius: 16, borderCurve: 'continuous', paddingHorizontal: 10, paddingVertical: 5, fontFamily, fontSize: 14, lineHeight: 20, fontWeight: '600', letterSpacing: -0.056, color: colors.lime, includeFontPadding: false },
  savingsArrow: { position: 'absolute', right: 18, top: 18, width: 40, height: 40 },
  card: { paddingTop: 16, paddingBottom: 4, borderRadius: 24, borderCurve: 'continuous', backgroundColor: colors.surface, overflow: 'hidden' },
  purchases: { height: 196, paddingBottom: 3 },
  cardHeading: { paddingHorizontal: 16, paddingBottom: 6 },
  cardTitle: { fontFamily: displayFont, fontSize: 20, lineHeight: 25, fontWeight: '900', letterSpacing: -0.4, color: colors.text, includeFontPadding: false },
  row: { height: 48, paddingHorizontal: 16, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', gap: 12 },
  divider: { height: 49, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  icon: { width: 20, height: 20, flexShrink: 0 },
  rowLabel: { flex: 1, minWidth: 0, fontFamily, fontSize: 16, lineHeight: 22, letterSpacing: -0.064, color: colors.text, includeFontPadding: false },
  detail: { fontFamily, fontSize: 14, lineHeight: 20, letterSpacing: -0.056, color: 'rgba(255,255,255,0.45)', includeFontPadding: false },
  detailAccent: { color: colors.lime },
  pressed: { opacity: 0.8 },
  signOut: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 16, borderCurve: 'continuous', backgroundColor: colors.surface },
  signOutText: { fontFamily, fontSize: 16, lineHeight: 22, color: colors.mutedText },
  modalBackdrop: { flex: 1, padding: 24, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center' },
  modalCard: { width: '100%', maxWidth: 400, padding: 24, borderRadius: 24, borderCurve: 'continuous', gap: 20, backgroundColor: colors.surface },
  noticeText: { fontFamily, fontSize: 16, lineHeight: 22, color: colors.text },
  close: { minHeight: 48, padding: 12, borderRadius: 16, borderCurve: 'continuous', backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontFamily, fontSize: 16, lineHeight: 22, fontWeight: '600', color: colors.text },
});
