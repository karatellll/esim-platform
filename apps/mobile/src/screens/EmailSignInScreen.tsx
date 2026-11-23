import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { Pressable } from '../ui/Surface';
import { Text, TextInput } from '../ui/Text';

import { AuthApiError, sendEmailCode } from '../api/auth';
import { AuthLayout, authStyles } from '../components/AuthLayout';
import type { RootStackParamList } from '../navigation/stack';
import { colors } from '../theme';

import { useOnline } from '../service/connectivity';

type Props = NativeStackScreenProps<RootStackParamList, 'EmailSignIn'>;
export function EmailSignInScreen({ navigation }: Props) {
  const online = useOnline();
  const [email, setEmail] = useState('');
  const [focused, setFocused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryAt, setRetryAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const running = useRef(false);
  const input = useRef<TextInput>(null);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => navigation.addListener('transitionEnd', ({ data }) => {
    if (!data.closing && navigation.isFocused()) input.current?.focus();
  }), [navigation]);
  const wait = Math.max(0, Math.ceil((retryAt - now) / 1000));
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const submit = async () => {
    if (!online || running.current || !valid || Date.now() < retryAt) return;
    running.current = true;
    setBusy(true);
    setError(null);
    try {
      const challenge = await sendEmailCode(email.trim());
      if (!navigation.isFocused()) return;
      navigation.navigate('EmailCode', { challenge, receivedAt: Date.now() });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось отправить код.');
      if (cause instanceof AuthApiError && cause.retryAfterSeconds) setRetryAt(Date.now() + cause.retryAfterSeconds * 1000);
    } finally { running.current = false; setBusy(false); }
  };
  return <AuthLayout variant="email" onBack={() => navigation.goBack()} subtitle="Введите вашу почту, пришлём код">
    <TextInput ref={input} value={email} onChangeText={value => { setEmail(value); setError(null); setRetryAt(0); }} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} autoFocus autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" keyboardType="email-address" inputMode="email" returnKeyType="send" onSubmitEditing={() => void submit()} editable={!busy} maxLength={254} placeholder="Ваша почта" placeholderTextColor={colors.mutedText} selectionColor={colors.tariffAccent} accessibilityLabel="Адрес электронной почты" testID="auth-email" style={[authStyles.input, focused && authStyles.focused]} />
    {error && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={authStyles.error} testID="auth-email-error">{error}</Text>}
    <Pressable onPress={() => void submit()} disabled={!online || busy || !valid || wait > 0} accessibilityRole="button" accessibilityState={{ disabled: !online || busy || !valid || wait > 0, busy }} testID="auth-send-code" style={({ pressed }) => [authStyles.button, (!online || busy || !valid || wait > 0) && authStyles.disabled, pressed && authStyles.pressed]}>
      {busy ? <ActivityIndicator color={colors.text} /> : <Text style={authStyles.buttonText}>{wait > 0 ? 'Повторить через ' + wait + ' с' : 'Получить код'}</Text>}
    </Pressable>
  </AuthLayout>;
}
