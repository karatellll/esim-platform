import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { Image, type ImageSource } from 'expo-image';
import { useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { AuthUser } from '../../../../packages/shared/contracts/auth';
import { useAuth } from '../auth/AuthProvider';
import type { RootTabParamList } from '../navigation/tabs';
import { colors, tabBarLayout } from '../theme';

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
  const insets = useSafeAreaInsets();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  // The authentication contract currently contains email only; use its login as a label.
  const label = user.email.split('@')[0] || 'Пользователь';
  const initial = Array.from(label)[0]?.toLocaleUpperCase('ru') || 'П';
  const topInset = Platform.OS === 'web' ? 48 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 36 : Math.max(insets.bottom, 12) + 2;
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
      <View style={styles.header} testID="profile-account-header">
        <View style={styles.avatar} accessible={false}><Text style={styles.initial}>{initial}</Text></View>
        <View style={styles.identity}>
          <Text style={styles.name} numberOfLines={1} testID="profile-name">{label}</Text>
          <Text style={styles.email} numberOfLines={1} selectable testID="profile-email">{user.email}</Text>
        </View>
      </View>

      <Pressable onPress={() => navigation.navigate('Savings')} accessibilityRole="button" accessibilityLabel="Копилка. Баланс пока недоступен" testID="profile-savings" style={({ pressed }) => [styles.savings, pressed && styles.pressed]}>
        <Text style={styles.savingsLabel}>Копилка</Text>
        <Text style={styles.balance} testID="profile-savings-balance">—</Text>
        <Text style={styles.cashback}>5% с каждой покупки</Text>
        <Image source={assets.savingsArrow} style={styles.savingsArrow} contentFit="contain" accessible={false} />
      </Pressable>

      <View style={[styles.card, styles.purchases]} testID="profile-purchases">
        <View style={styles.cardHeading}><Text style={styles.cardTitle} accessibilityRole="header">Покупки</Text></View>
        <AccountRow label="История и чеки" icon={assets.history} testID="profile-history" divider onPress={() => unavailable('История и чеки', 'История покупок и чеки появятся после подключения заказов.')} />
        <AccountRow label="Способы оплаты" icon={assets.payment} detail="СБП" testID="profile-payments" divider onPress={() => unavailable('Способы оплаты', 'Настройка оплаты пока недоступна.')} />
        <AccountRow label="Пригласить друга" icon={assets.invite} detail="+200 ₽" accent testID="profile-invite" onPress={() => unavailable('Пригласить друга', 'Приглашения и начисление бонусов за друзей пока не подключены.')} />
      </View>

      <View style={styles.card} testID="profile-settings">
        <View style={styles.cardHeading}><Text style={styles.cardTitle} accessibilityRole="header">Настройки</Text></View>
        <AccountRow label="Уведомления" icon={assets.notifications} detail="выкл" testID="profile-notifications" divider onPress={() => unavailable('Уведомления', 'Push-уведомления пока не подключены.')} />
        <AccountRow label="Язык и валюта" icon={assets.language} detail="RU · ₽" testID="profile-language" onPress={() => unavailable('Язык и валюта', 'Сейчас интерфейс доступен на русском языке. Выбор языка и валюты появится позже.')} />
      </View>

      <View style={styles.card} testID="profile-help">
        <View style={styles.cardHeading}><Text style={styles.cardTitle} accessibilityRole="header">Помощь</Text></View>
        <AccountRow label="Как поставить eSIM" icon={assets.install} testID="profile-install" divider onPress={() => unavailable('Как поставить eSIM', 'Инструкция по установке скоро появится.')} />
        <AccountRow label="Написать в поддержку" icon={assets.support} detail="24/7" testID="profile-support" onPress={() => unavailable('Написать в поддержку', 'Поддержка в приложении пока недоступна.')} />
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

const fontFamily = Platform.select({ ios: 'System', android: 'sans-serif', default: 'system-ui' });
const displayFont = Platform.OS === 'web' ? 'Arial' : fontFamily;
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 375, alignSelf: 'center', gap: 12 },
  header: { height: 72, paddingHorizontal: 12, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.tariffAccent, alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: displayFont, fontSize: 28, lineHeight: 36, fontWeight: '900', letterSpacing: -0.56, color: colors.text, includeFontPadding: false },
  identity: { flex: 1, minWidth: 0, gap: 4 },
  name: { fontFamily: displayFont, fontSize: 26, lineHeight: 33, fontWeight: '900', letterSpacing: -0.52, color: colors.text, includeFontPadding: false },
  email: { fontFamily, fontSize: 14, lineHeight: 20, letterSpacing: -0.056, color: colors.mutedText, includeFontPadding: false },
  savings: { height: 132, borderRadius: 24, overflow: 'hidden', backgroundColor: colors.lime },
  savingsLabel: { position: 'absolute', left: 18, top: 18, fontFamily, fontSize: 14, lineHeight: 20, fontWeight: '600', letterSpacing: -0.056, color: colors.mutedInk, includeFontPadding: false },
  balance: { position: 'absolute', left: 16, top: 38, fontFamily: displayFont, fontSize: 26, lineHeight: 32, fontWeight: '900', letterSpacing: -0.78, color: colors.ink, includeFontPadding: false },
  cashback: { position: 'absolute', left: 18, top: 92, fontFamily, fontSize: 14, lineHeight: 20, fontWeight: '600', letterSpacing: -0.056, color: colors.ink, includeFontPadding: false },
  savingsArrow: { position: 'absolute', right: 18, top: 18, width: 40, height: 40 },
  card: { paddingTop: 16, paddingBottom: 4, borderRadius: 24, backgroundColor: colors.surface, overflow: 'hidden' },
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
  signOut: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: colors.surface },
  signOutText: { fontFamily, fontSize: 16, lineHeight: 22, color: colors.mutedText },
  modalBackdrop: { flex: 1, padding: 24, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center' },
  modalCard: { width: '100%', maxWidth: 400, padding: 24, borderRadius: 24, gap: 20, backgroundColor: colors.surface },
  noticeText: { fontFamily, fontSize: 16, lineHeight: 22, color: colors.text },
  close: { minHeight: 48, padding: 12, borderRadius: 16, backgroundColor: colors.tariffAccent, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontFamily, fontSize: 16, lineHeight: 22, fontWeight: '600', color: colors.text },
});
