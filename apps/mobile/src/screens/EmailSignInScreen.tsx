import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput } from 'react-native';

import { AuthApiError, sendEmailCode } from '../api/auth';
import { AuthLayout, authStyles } from '../components/AuthLayout';
import type { RootStackParamList } from '../navigation/stack';
import { colors } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'EmailSignIn'>;
export function EmailSignInScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [focused, setFocused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryAt, setRetryAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const running = useRef(false);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const wait = Math.max(0, Math.ceil((retryAt - now) / 1000));
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const submit = async () => {
    if (running.current || !valid || Date.now() < retryAt) return;
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
  return <AuthLayout variant="email" onBack={() => navigation.goBack()} subtitle="Пришлём код. Пароль не нужен">
    <TextInput value={email} onChangeText={value => { setEmail(value); setError(null); setRetryAt(0); }} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} autoFocus autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" keyboardType="email-address" inputMode="email" returnKeyType="send" onSubmitEditing={() => void submit()} editable={!busy} maxLength={254} placeholder="Ваша почта" placeholderTextColor={colors.mutedText} selectionColor={colors.tariffAccent} accessibilityLabel="Адрес электронной почты" testID="auth-email" style={[authStyles.input, focused && authStyles.focused]} />
    {error && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={authStyles.error} testID="auth-email-error">{error}</Text>}
    <Pressable onPress={() => void submit()} disabled={busy || !valid || wait > 0} accessibilityRole="button" accessibilityState={{ disabled: busy || !valid || wait > 0, busy }} testID="auth-send-code" style={({ pressed }) => [authStyles.button, (busy || !valid || wait > 0) && authStyles.disabled, pressed && authStyles.pressed]}>
      {busy ? <ActivityIndicator color={colors.text} /> : <Text style={authStyles.buttonText}>{wait > 0 ? 'Повторить через ' + wait + ' с' : 'Получить код'}</Text>}
    </Pressable>
  </AuthLayout>;
}
