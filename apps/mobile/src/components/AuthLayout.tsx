import { Image } from 'expo-image';
import type { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../theme';

type Props = PropsWithChildren<{ variant: 'email' | 'code'; onBack: () => void; subtitle: string }>;
export function AuthLayout({ children, variant, onBack, subtitle }: Props) {
  const insets = useSafeAreaInsets();
  return <KeyboardAvoidingView style={authStyles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView contentInsetAdjustmentBehavior="never" keyboardShouldPersistTaps="handled" contentContainerStyle={[authStyles.content, { paddingTop: (Platform.OS === 'web' ? 48 : insets.top) + 8, paddingBottom: Math.max(24, insets.bottom + 16) }]}>
      <View style={authStyles.navbar}>
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Назад" testID="auth-back" style={({ pressed }) => [authStyles.back, pressed && authStyles.pressed]}>
          <Image source={require('../../assets/auth/back.svg')} style={authStyles.backIcon} contentFit="contain" accessible={false} />
        </Pressable>
      </View>
      <View style={authStyles.heading} accessibilityRole="header" accessibilityLabel={variant === 'email' ? 'Ваша почта' : 'Код из письма'}>
        <Text style={authStyles.title}>{variant === 'email' ? 'Ваша' : 'Код'}</Text>
        <View style={authStyles.headingRow}>
          {variant === 'code' && <Text style={authStyles.title}>из</Text>}
          <View style={variant === 'email' ? authStyles.emailSticker : authStyles.codeSticker}>
            <Image source={variant === 'email' ? require('../../assets/auth/email-sticker.svg') : require('../../assets/auth/code-sticker.svg')} style={variant === 'email' ? authStyles.emailSticker : authStyles.codeSticker} contentFit="contain" accessible={false} />
            <Text style={[authStyles.stickerText, variant === 'email' && { color: colors.ink }]}>{variant === 'email' ? 'почта' : 'письма'}</Text>
          </View>
        </View>
      </View>
      <Text style={authStyles.subtitle}>{subtitle}</Text>
      {children}
    </ScrollView>
  </KeyboardAvoidingView>;
}

const fontFamily = Platform.select({ ios: 'System', android: 'sans-serif', default: 'system-ui' });
const displayFont = Platform.OS === 'web' ? 'Arial' : fontFamily;
export const authStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 375, alignSelf: 'center', paddingHorizontal: 12, gap: 16, flexGrow: 1 },
  navbar: { paddingHorizontal: 12, height: 40 },
  back: { height: 40, width: 40, borderRadius: 20, backgroundColor: colors.selectedTab, alignItems: 'center', justifyContent: 'center' },
  backIcon: { width: 20, height: 20 },
  heading: { paddingHorizontal: 12, gap: 2 },
  title: { fontFamily: displayFont, fontSize: 30, lineHeight: 38, fontWeight: '900', letterSpacing: -0.6, color: colors.text, includeFontPadding: false },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  emailSticker: { width: 111, height: 47 },
  codeSticker: { width: 135, height: 48 },
  stickerText: { position: 'absolute', left: 12, top: 3, fontFamily: displayFont, fontSize: 30, lineHeight: 38, fontWeight: '900', letterSpacing: -0.6, color: colors.text, transform: [{ rotate: '1.5deg' }], includeFontPadding: false },
  subtitle: { paddingHorizontal: 12, fontFamily, fontSize: 15, lineHeight: 21, letterSpacing: -0.06, color: 'rgba(255,255,255,0.6)' },
  input: { height: 56, borderRadius: 16, borderWidth: 2, borderColor: 'transparent', backgroundColor: colors.surface, paddingHorizontal: 16, fontFamily, fontSize: 17, lineHeight: 23, color: colors.text },
  focused: { borderColor: colors.tariffAccent },
  button: { height: 56, borderRadius: 16, backgroundColor: colors.tariffAccent, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontFamily, fontSize: 16, lineHeight: 22, fontWeight: '600', color: colors.text },
  error: { paddingHorizontal: 12, fontFamily, fontSize: 14, lineHeight: 20, color: '#FF9999' },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.5 },
  link: { paddingHorizontal: 12, paddingVertical: 2, alignSelf: 'flex-start' },
  linkText: { fontFamily, fontSize: 14, lineHeight: 20, color: colors.mutedText },
});
