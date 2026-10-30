import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AuthApiError, sendEmailCode } from '../api/auth';
import { useAuth } from '../auth/AuthProvider';
import { AuthLayout, authStyles } from '../components/AuthLayout';
import type { RootStackParamList } from '../navigation/stack';
import { colors } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'EmailCode'>;
export function EmailCodeScreen({ route, navigation }: Props) {
  const auth = useAuth();
  const [challenge, setChallenge] = useState(route.params.challenge);
  const [code, setCode] = useState('');
  const [focused, setFocused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [resendAt, setResendAt] = useState(route.params.receivedAt + challenge.resend_after_seconds * 1000);
  const [expiresAt, setExpiresAt] = useState(route.params.receivedAt + challenge.expires_in * 1000);
  const [blockedUntil, setBlockedUntil] = useState(0);
  const running = useRef(false);
  const resending = useRef(false);
  const input = useRef<TextInput>(null);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const wait = Math.max(0, Math.ceil((resendAt - now) / 1000));
  const blocked = now < blockedUntil;
  const expired = now >= expiresAt;
  const verify = async (value: string) => {
    if (running.current || resending.current || value.length !== 6 || Date.now() < blockedUntil || Date.now() >= expiresAt) return;
    running.current = true;
    setBusy(true);
    setError(null);
    try {
      await auth.signIn(challenge.challenge_id, value);
      if (navigation.isFocused()) {
        if (route.params.returnToCheckout) navigation.goBack();
        else navigation.pop(2);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось проверить код.');
      if (cause instanceof AuthApiError && cause.retryAfterSeconds) setBlockedUntil(Date.now() + cause.retryAfterSeconds * 1000);
      setCode('');
      input.current?.focus();
    } finally { running.current = false; setBusy(false); }
  };
  const resend = async () => {
    if (running.current || resending.current || Date.now() < resendAt) return;
    resending.current = true;
    setSending(true);
    setError(null);
    try {
      const next = await sendEmailCode(challenge.email);
      setChallenge(next);
      setResendAt(Date.now() + next.resend_after_seconds * 1000);
      setExpiresAt(Date.now() + next.expires_in * 1000);
      setCode('');
      input.current?.focus();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось отправить код.');
      if (cause instanceof AuthApiError && cause.retryAfterSeconds) setResendAt(Date.now() + cause.retryAfterSeconds * 1000);
    } finally { resending.current = false; setSending(false); }
  };
  return <AuthLayout variant="code" onBack={() => navigation.goBack()} subtitle={'Отправили на ' + challenge.email}>
    <View style={styles.codeField}>
      <View style={styles.cells} pointerEvents="none" accessible={false}>
        {Array.from({ length: 6 }, (_, index) => <View key={index} style={[styles.cell, focused && index === Math.min(code.length, 5) && !busy && authStyles.focused]}>
          <Text style={styles.digit}>{code[index] || ''}</Text>
          {focused && index === code.length && !busy && <View style={styles.cursor} />}
        </View>)}
      </View>
      <TextInput ref={input} value={code} onChangeText={value => { const next = value.replace(/[^0-9]/g, '').slice(0, 6); setCode(next); setError(null); if (next.length === 6) void verify(next); }} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} autoFocus keyboardType="number-pad" inputMode="numeric" autoComplete="one-time-code" textContentType="oneTimeCode" maxLength={6} caretHidden selectionColor="transparent" onSubmitEditing={() => void verify(code)} editable={!busy && !sending && !blocked && !expired} accessibilityLabel="Шестизначный код из письма" testID="auth-code" style={styles.codeInput} />
    </View>
    {busy && <ActivityIndicator color={colors.tariffAccent} accessibilityLabel="Проверяем код" />}
    {(error || expired) && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={authStyles.error} testID="auth-code-error">{error || 'Срок действия кода истёк. Отправьте новый.'}</Text>}
    <Pressable onPress={() => void resend()} disabled={wait > 0 || busy || sending} accessibilityRole="button" testID="auth-resend" style={authStyles.link}>
      <Text style={[authStyles.linkText, wait === 0 && { color: colors.accent }]}>{sending ? 'Отправляем…' : wait > 0 ? 'Отправить снова через ' + Math.floor(wait / 60) + ':' + String(wait % 60).padStart(2, '0') : 'Отправить код снова'}</Text>
    </Pressable>
    <Pressable onPress={() => navigation.goBack()} disabled={busy || sending} accessibilityRole="button" testID="auth-change-email" style={authStyles.link}><Text style={authStyles.linkText}>Изменить почту</Text></Pressable>
  </AuthLayout>;
}

const styles = StyleSheet.create({
  codeField: { height: 60, position: 'relative' },
  cells: { flexDirection: 'row', gap: 8, height: 60 },
  cell: { flex: 1, minWidth: 0, height: 60, borderRadius: 14, borderWidth: 2, borderColor: 'transparent', backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' },
  digit: { fontSize: 26, lineHeight: 33, fontWeight: '900', letterSpacing: -0.52, color: colors.text, includeFontPadding: false },
  cursor: { position: 'absolute', width: 2, height: 24, backgroundColor: colors.tariffAccent },
  codeInput: { position: 'absolute', left: 0, top: 0, width: '100%', height: 60, color: 'transparent', backgroundColor: 'transparent', opacity: 0.02, fontSize: 16 },
});
