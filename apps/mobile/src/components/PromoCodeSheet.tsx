import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Modal, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pressable, View } from '../ui/Surface';
import { ScrollView } from '../ui/ScrollView';
import { fonts, StyleSheet } from '../ui/design';
import { Text, TextInput } from '../ui/Text';
import { colors } from '../theme';

type Props = {
  onClose: () => void;
  onApply: (code: string, signal: AbortSignal) => Promise<void>;
};

// Mount only while open: an unconfirmed draft never changes the checkout price.
export function PromoCodeSheet({ onClose, onApply }: Props) {
  const insets = useSafeAreaInsets();
  const input = useRef<TextInput>(null);
  const request = useRef<AbortController | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState(false);
  useEffect(() => () => request.current?.abort(), []);

  const close = () => { request.current?.abort(); Keyboard.dismiss(); onClose(); };
  const apply = async () => {
    if (request.current || !code.trim()) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError(null);
    try {
      await onApply(code.trim().toUpperCase(), controller.signal);
      if (!controller.signal.aborted) close();
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Не удалось проверить промокод. Попробуйте ещё раз.');
    } finally {
      if (request.current === controller) request.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  };

  return <Modal transparent visible animationType="slide" statusBarTranslucent onRequestClose={close} onShow={() => input.current?.focus()}>
    <View style={s.overlay} testID="promo-overlay">
      <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityRole="button" accessibilityLabel="Вернуться к оформлению" />
      <KeyboardAvoidingView style={s.bottom} behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined} pointerEvents="box-none">
        <View style={[s.sheet, { marginTop: Math.max(insets.top + 8, 32) }]} accessibilityViewIsModal testID="promo-sheet">
          <ScrollView keyboardShouldPersistTaps="handled" bounces={false} contentContainerStyle={[s.content, { paddingBottom: focused ? 20 : Math.max(insets.bottom + 20, 32) }]}>
            <View style={s.handle} />
            <View style={s.header}>
              <Pressable style={s.back} onPress={close} accessibilityRole="button" accessibilityLabel="Назад к оформлению" testID="promo-back">
                <Image source={require('../../assets/checkout/promo-back.svg')} style={s.icon} accessible={false} />
              </Pressable>
              <Text style={s.title} accessibilityRole="header">Промокод</Text>
            </View>
            <View style={s.form}>
              <View style={[s.field, (focused || !!code) && s.fieldFocused, !!error && s.fieldError]} testID="promo-field">
                <TextInput ref={input} autoFocus value={code} onChangeText={value => { setCode(value.toUpperCase()); setError(null); }}
                  editable={!busy} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} maxLength={64}
                  autoCapitalize="characters" autoCorrect={false} spellCheck={false} returnKeyType="done" submitBehavior="submit"
                  onSubmitEditing={() => void apply()} selectionColor={colors.tariffAccent} underlineColorAndroid="transparent"
                  placeholder="Введите промокод" placeholderTextColor={colors.mutedText} style={s.input}
                  accessibilityLabel="Промокод" testID="checkout-promo-input" />
                {error ? <Pressable onPress={() => { setCode(''); setError(null); input.current?.focus(); }} hitSlop={12} accessibilityRole="button" accessibilityLabel="Очистить промокод" testID="promo-clear" style={s.clear}>
                  <Image source={require('../../assets/checkout/promo-clear.svg')} style={s.clearIcon} accessible={false} />
                </Pressable> : <Pressable onPress={() => void apply()} disabled={busy || !code.trim()} accessibilityRole="button" accessibilityLabel="Применить промокод" accessibilityState={{ disabled: busy || !code.trim(), busy }} testID="checkout-promo-apply" style={[s.apply, !code.trim() && s.disabled]}>
                  {busy ? <ActivityIndicator color={colors.text} /> : <Text style={s.applyText}>Применить</Text>}
                </Pressable>}
              </View>
              <Text style={[s.hint, !!error && s.error]} accessibilityRole={error ? 'alert' : undefined} accessibilityLiveRegion="polite" testID={error ? 'checkout-promo-error' : 'promo-hint'}>
                {error ?? 'Скидка применится к этому заказу — сумма обновится в оформлении'}
              </Text>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </View>
  </Modal>;
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  bottom: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', maxWidth: 600, maxHeight: '90%', flexShrink: 1, backgroundColor: '#1C1C1F', borderTopLeftRadius: 32, borderTopRightRadius: 32, overflow: 'hidden' },
  content: { paddingTop: 8, paddingHorizontal: 16, gap: 14 },
  handle: { width: 36, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)', alignSelf: 'center' },
  header: { paddingTop: 8, flexDirection: 'row', gap: 12, alignItems: 'center' },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  icon: { width: 20, height: 20 },
  title: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30, fontWeight: '800', color: colors.text },
  form: { gap: 8 },
  field: { height: 56, paddingLeft: 14.5, paddingRight: 4.5, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 16, borderWidth: 1.5, borderColor: 'transparent', backgroundColor: '#2A2A2E' },
  fieldFocused: { borderColor: colors.tariffAccent },
  fieldError: { borderColor: '#FF5A5F', paddingRight: 14.5 },
  input: { flex: 1, minWidth: 0, padding: 0, outlineWidth: 0, borderWidth: 0, fontFamily: fonts.text, fontSize: 18, lineHeight: 24, fontWeight: '500', color: colors.text },
  clear: { width: 24, height: 40, justifyContent: 'center', alignItems: 'center' },
  clearIcon: { width: 18, height: 18 },
  apply: { height: 41, paddingHorizontal: 16, borderRadius: 12, backgroundColor: colors.tariffAccent, alignItems: 'center', justifyContent: 'center' },
  applyText: { fontSize: 16, lineHeight: 21, fontWeight: '600', color: colors.text },
  hint: { fontSize: 14, lineHeight: 17, color: colors.mutedText },
  error: { color: '#FF5A5F' },
  disabled: { opacity: 0.5 },
});
