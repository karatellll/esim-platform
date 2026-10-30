import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthProvider';
import type { RootStackParamList } from '../navigation/stack';
import { Image, type ImageSource } from 'expo-image';
import { useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { version } from '../../package.json';
import { colors, tabBarLayout } from '../theme';

const assets = {
  sticker: require('../../assets/profile/heading-sticker.svg'),
  install: require('../../assets/profile/install.svg'),
  support: require('../../assets/profile/support.svg'),
  privacy: require('../../assets/profile/privacy.svg'),
  terms: require('../../assets/profile/terms.svg'),
  chevron: require('../../assets/profile/chevron.svg'),
};

type Notice = { title: string; message: string };
type MenuRowProps = {
  label: string;
  icon: ImageSource;
  testID: string;
  detail?: string;
  divider?: boolean;
  onPress: () => void;
};

function MenuRow({ label, icon, testID, detail, divider, onPress }: MenuRowProps) {
  return <Pressable accessibilityRole="button" accessibilityLabel={detail ? `${label}, ${detail}` : label} testID={testID} onPress={onPress} style={({ pressed }) => [styles.row, divider && styles.divider, pressed && styles.pressed]}>
    <View style={styles.iconSlot}><Image source={icon} style={styles.icon} contentFit="contain" accessible={false} /></View>
    <Text style={styles.rowLabel} numberOfLines={1}>{label}</Text>
    {detail && <Text style={styles.detail}>{detail}</Text>}
    <Image source={assets.chevron} style={styles.icon} contentFit="contain" accessible={false} />
  </Pressable>;
}

export function ProfileGuestScreen() {
  const auth = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [notice, setNotice] = useState<Notice | null>(null);
  const topInset = Platform.OS === 'web' ? 48 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 36 : Math.max(insets.bottom, 12) + 2;
  const horizontalInset = Math.max(12, insets.left, insets.right);
  const contentWidth = Math.min(width, 375);
  const headingScale = Math.min(1, (contentWidth - horizontalInset * 2 - 24) / 319.996826);

  return <View style={styles.screen} testID="screen-profile">
    <ScrollView style={styles.screen} scrollEnabled={false} bounces={false} overScrollMode="never" contentInsetAdjustmentBehavior="never" showsVerticalScrollIndicator={false} testID="profile-scroll" contentContainerStyle={[styles.content, { paddingTop: topInset + 16, paddingBottom: Math.max(120, bottomInset + tabBarLayout.height + 20), paddingHorizontal: horizontalInset }]}>
      <View style={styles.heading} accessibilityRole="header" accessibilityLabel="Войдите — и eSIM не потеряются">
        <Text style={styles.headingText} numberOfLines={1}>Войдите —</Text>
        <View style={{ width: 319.996826 * headingScale, height: 46.82341 * headingScale }}>
          <View style={[styles.headingRow, { transform: [{ scale: headingScale }] }]}>
            <Text style={[styles.headingText, styles.headingPrefix]} numberOfLines={1}>и eSIM</Text>
            <View style={styles.stickerFrame}>
              <View style={styles.sticker}>
                <Image source={assets.sticker} style={styles.stickerImage} contentFit="contain" accessible={false} />
                <Text style={styles.stickerText} numberOfLines={1}>не потеряются</Text>
              </View>
            </View>
          </View>
        </View>
        <Text style={styles.subtitle}>Покупки, копилка и паспорт сохранятся,{contentWidth >= 375 ? '\n' : ' '}даже если смените телефон</Text>
      </View>
      <View style={styles.signInSlot}>
        <Pressable accessibilityRole="button" testID="profile-sign-in" disabled={auth.loading} onPress={() => navigation.navigate('EmailSignIn')} style={({ pressed }) => [styles.signIn, pressed && styles.pressed]}>
          <Text style={styles.signInText}>{auth.loading ? 'Проверяем вход…' : 'Войти по почте'}</Text>
        </Pressable>
      </View>
      {auth.restoreError && <Pressable onPress={() => void auth.retryRestore().catch(() => {})} accessibilityRole="button" testID="profile-restore-retry"><Text style={styles.noticeText}>{auth.restoreError} Нажмите, чтобы повторить.</Text></Pressable>}
      <View style={styles.card} testID="profile-help">
        <Text style={styles.cardTitle} accessibilityRole="header">Помощь</Text>
        <MenuRow label="Как установить eSIM" icon={assets.install} testID="profile-install" divider onPress={() => setNotice({ title: 'Как установить eSIM', message: 'Инструкция по установке скоро появится.' })} />
        <MenuRow label="Поддержка" icon={assets.support} detail="24/7" testID="profile-support" onPress={() => setNotice({ title: 'Поддержка', message: 'Поддержка в приложении пока недоступна.' })} />
      </View>
      <View style={styles.card} testID="profile-about">
        <Text style={styles.cardTitle} accessibilityRole="header">О сервисе</Text>
        <MenuRow label="Конфиденциальность" icon={assets.privacy} testID="profile-privacy" divider onPress={() => setNotice({ title: 'Конфиденциальность', message: 'Политика конфиденциальности скоро появится.' })} />
        <MenuRow label="Условия использования" icon={assets.terms} testID="profile-terms" onPress={() => setNotice({ title: 'Условия использования', message: 'Условия использования скоро появятся.' })} />
      </View>
      <Text style={styles.version} testID="profile-version">Версия {version}</Text>
    </ScrollView>
    <Modal visible={notice !== null} transparent animationType="fade" onRequestClose={() => setNotice(null)}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard} accessibilityViewIsModal>
          <Text style={styles.cardTitle}>{notice?.title}</Text>
          <Text style={styles.noticeText}>{notice?.message}</Text>
          <Pressable accessibilityRole="button" testID="profile-notice-close" onPress={() => setNotice(null)} style={({ pressed }) => [styles.close, pressed && styles.pressed]}><Text style={styles.closeText}>Понятно</Text></Pressable>
        </View>
      </View>
    </Modal>
  </View>;
}

const fontFamily = Platform.select({ ios: 'System', android: 'sans-serif', default: 'system-ui' });
const displayFont = Platform.OS === 'web' ? 'Arial' : fontFamily;
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 375, alignSelf: 'center', gap: 12 },
  heading: { paddingHorizontal: 12, paddingBottom: 4, gap: 4, minHeight: 136.82341 },
  headingText: { height: 36, fontFamily: displayFont, fontWeight: '900', fontSize: 28, lineHeight: 36, letterSpacing: -0.56, color: colors.text, includeFontPadding: false },
  headingRow: { position: 'absolute', width: 319.996826, height: 46.82341, flexDirection: 'row', alignItems: 'center', gap: 8, transformOrigin: 'top left' },
  headingPrefix: { width: 88 },
  stickerFrame: { width: 223.99684, height: 46.82341, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  sticker: { width: 223, height: 41, transform: [{ rotate: '1.5deg' }] },
  stickerImage: { position: 'absolute', width: 223, height: 41 },
  stickerText: { position: 'absolute', left: 11, top: 3, fontFamily: displayFont, fontWeight: '900', fontSize: 28, lineHeight: 36, letterSpacing: -0.56, color: colors.text, includeFontPadding: false },
  subtitle: { minHeight: 42, fontFamily, fontSize: 15, lineHeight: 21, letterSpacing: -0.06, color: 'rgba(255,255,255,0.6)', includeFontPadding: false },
  signInSlot: { height: 64, paddingVertical: 4 },
  signIn: { height: 56, borderRadius: 16, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center' },
  signInText: { height: 22, fontFamily, fontSize: 16, lineHeight: 22, letterSpacing: -0.064, fontWeight: '600', color: colors.ink, includeFontPadding: false },
  card: { height: 174, padding: 16, borderRadius: 24, backgroundColor: colors.surface, gap: 2 },
  cardTitle: { height: 25, fontFamily: displayFont, fontSize: 20, lineHeight: 25, letterSpacing: -0.4, fontWeight: '900', color: colors.text, includeFontPadding: false },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, height: 56 },
  divider: { height: 57, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  iconSlot: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  icon: { width: 20, height: 20, flexShrink: 0 },
  rowLabel: { flex: 1, height: 22, fontFamily, fontSize: 16, lineHeight: 22, letterSpacing: -0.064, fontWeight: '500', color: colors.text, includeFontPadding: false },
  detail: { width: 32, height: 20, fontFamily, fontSize: 14, lineHeight: 20, letterSpacing: -0.056, fontWeight: '600', color: 'rgba(255,255,255,0.6)', includeFontPadding: false },
  version: { height: 18, textAlign: 'center', fontFamily, fontSize: 12, lineHeight: 18, letterSpacing: -0.048, color: 'rgba(255,255,255,0.3)', includeFontPadding: false },
  pressed: { opacity: 0.8 },
  modalBackdrop: { flex: 1, padding: 24, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center' },
  modalCard: { width: '100%', maxWidth: 400, padding: 24, borderRadius: 24, gap: 20, backgroundColor: colors.surface },
  noticeText: { fontFamily, fontSize: 16, lineHeight: 22, color: colors.text },
  close: { minHeight: 48, padding: 12, borderRadius: 16, backgroundColor: colors.tariffAccent, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontFamily, fontSize: 16, lineHeight: 22, fontWeight: '600', color: colors.text },
});
