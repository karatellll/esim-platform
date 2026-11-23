import { GlassActionButton } from './GlassActionButton';
import { Image } from 'expo-image';
import { useEffect, useState, type PropsWithChildren } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform } from 'react-native';
import { ScrollView } from '../ui/ScrollView';
import { Pressable, View } from '../ui/Surface';
import { fonts, StyleSheet } from '../ui/design';
import { Text } from '../ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../theme';

type Props = PropsWithChildren<{ variant: 'email' | 'code'; onBack: () => void; subtitle: string }>;
export function AuthLayout({ children, variant, onBack, subtitle }: Props) {
  const insets = useSafeAreaInsets();
  const isEmail = variant === 'email';
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  useEffect(() => {
    if (!isEmail || Platform.OS === 'web') return;
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardVisible(false));
    setKeyboardVisible(Keyboard.isVisible());
    return () => { show.remove(); hide.remove(); };
  }, [isEmail]);

  return <KeyboardAvoidingView style={authStyles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <Pressable style={StyleSheet.absoluteFill} accessible={false} onPress={onBack} />
    <ScrollView style={authStyles.scroll} contentInsetAdjustmentBehavior="never" keyboardShouldPersistTaps="handled" accessibilityViewIsModal
      contentContainerStyle={[authStyles.content, isEmail && authStyles.emailContent, {
        paddingBottom: isEmail && keyboardVisible ? 16 : Math.max(24, insets.bottom + 16),
      }]}>
      {isEmail ? <>
        <View style={authStyles.handle} accessible={false} />
        <View style={authStyles.emailHeader}>
          <View style={authStyles.emailTitleRow}>
            <Text style={[authStyles.title, authStyles.emailTitle]} accessibilityRole="header">Вход</Text>
            <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Закрыть вход" testID="auth-back"
              style={({ pressed }) => [authStyles.back, authStyles.close, pressed && authStyles.pressed]}>
              <Image source={require('../../assets/auth/email-close.svg')} style={authStyles.backIcon} contentFit="contain" accessible={false} />
            </Pressable>
          </View>
          <Text style={[authStyles.subtitle, authStyles.emailSubtitle]}>{subtitle}</Text>
        </View>
      </> : <>
        <View style={authStyles.navbar}>
          <GlassActionButton action="back" onPress={onBack} testID="auth-back" />
        </View>
        <View style={authStyles.heading} accessibilityRole="header" accessibilityLabel="Код из письма">
          <Text style={authStyles.title}>Код</Text>
          <Text style={authStyles.title}>из</Text>
          <View style={authStyles.codeSticker}>
            <Image source={require('../../assets/auth/code-sticker.svg')} style={authStyles.codeSticker} contentFit="contain" accessible={false} />
            <Text style={authStyles.stickerText}>письма</Text>
          </View>
        </View>
        <Text style={authStyles.subtitle}>{subtitle}</Text>
      </>}
      {children}
    </ScrollView>
  </KeyboardAvoidingView>;
}

const fontFamily = fonts.text;
const displayFont = fonts.display;
export const authStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  scroll: { flexGrow: 0, maxHeight: '85%' },
  content: { width: '100%', paddingTop: 28, paddingHorizontal: 12, gap: 16, flexGrow: 0, backgroundColor: '#1d1d20', borderTopLeftRadius: 32, borderTopRightRadius: 32 },
  emailContent: { paddingHorizontal: 16, backgroundColor: '#1C1C1F' },
  emailHeader: { gap: 4 },
  emailTitleRow: { flexDirection: 'row', alignItems: 'center' },
  emailTitle: { flex: 1 },
  emailSubtitle: { paddingHorizontal: 0 },
  handle: { position: 'absolute', alignSelf: 'center', top: 8, width: 36, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)' },
  close: { flexShrink: 0, backgroundColor: 'rgba(244,244,247,0.15)' },
  navbar: { position: 'absolute', right: 24, top: 28, zIndex: 2 },
  back: { height: 40, width: 40, borderRadius: 20, borderCurve: 'continuous', backgroundColor: colors.selectedTab, alignItems: 'center', justifyContent: 'center' },
  backIcon: { width: 20, height: 20 },
  heading: { paddingHorizontal: 12, gap: 8, flexDirection: 'row', alignItems: 'center', paddingRight: 56 },
  title: { fontFamily: displayFont, fontSize: 30, lineHeight: 38, fontWeight: '900', letterSpacing: -0.6, color: colors.text, includeFontPadding: false },
  codeSticker: { width: 135, height: 48 },
  stickerText: { position: 'absolute', left: 12, top: 3, fontFamily: displayFont, fontSize: 30, lineHeight: 38, fontWeight: '900', letterSpacing: -0.6, color: colors.text, transform: [{ rotate: '1.5deg' }], includeFontPadding: false },
  subtitle: { paddingHorizontal: 12, fontFamily, fontSize: 15, lineHeight: 21, letterSpacing: -0.06, color: 'rgba(255,255,255,0.6)' },
  input: { height: 56, borderRadius: 16, borderCurve: 'continuous', borderWidth: 2, borderColor: 'transparent', backgroundColor: colors.surface, paddingHorizontal: 16, fontFamily, fontSize: 17, lineHeight: 23, letterSpacing: -0.068, color: colors.text },
  focused: { borderColor: colors.tariffAccent },
  button: { height: 56, borderRadius: 16, borderCurve: 'continuous', backgroundColor: colors.tariffAccent, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontFamily, fontSize: 16, lineHeight: 22, fontWeight: '600', letterSpacing: -0.064, color: colors.text },
  error: { paddingHorizontal: 12, fontFamily, fontSize: 14, lineHeight: 20, color: '#FF9999' },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.5 },
  link: { paddingHorizontal: 12, paddingVertical: 2, alignSelf: 'flex-start' },
  linkText: { fontFamily, fontSize: 14, lineHeight: 20, color: colors.mutedText },
});
