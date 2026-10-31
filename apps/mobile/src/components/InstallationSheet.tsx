import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Linking, Platform, useWindowDimensions } from 'react-native';
import { ScrollView } from '../ui/ScrollView';
import { Pressable, View } from '../ui/Surface';
import { fonts, StyleSheet } from '../ui/design';
import { Text } from '../ui/Text';
import type { OrderData } from '../../../../packages/shared/contracts/checkout';
import { appleInstallationUrl, manualDetails, supportsQuickInstall, type InstallationMethod } from '../orders/installation';
import { copyInstallationValue, exportInstallationQr } from '../orders/installationActions';
import { colors } from '../theme';

const assets = {
  heading: require('../../assets/installation/install-heading.svg'),
  phone: require('../../assets/installation/phone.svg'),
  close: require('../../assets/checkout/close.svg'),
  share: require('../../assets/installation/share.svg'),
  qr: require('../../assets/installation/qr.svg'),
};
const methods = [{ id: 'quick', label: 'Быстро' }, { id: 'qr', label: 'QR-код' }, { id: 'manual', label: 'Вручную' }] as const;
const steps = ['Настройки → Сотовая связь', 'Добавить eSIM → Ввести вручную', 'Вставьте адрес и код'];

type Props = {
  order: OrderData; topInset: number; bottomInset: number; onClose: () => void;
  onRefresh: () => void; refreshing: boolean; loadQr: () => Promise<Blob>;
  initialMethod?: InstallationMethod; previewQuickSupported?: boolean;
  statusError?: string | null;
};

export function InstallationSheet({ order, topInset, bottomInset, onClose, onRefresh, refreshing, loadQr, initialMethod = 'quick', previewQuickSupported, statusError }: Props) {
  const { height } = useWindowDimensions();
  const [method, setMethod] = useState<InstallationMethod>(initialMethod);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [instruction, setInstruction] = useState(false);
  const [qrFailed, setQrFailed] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mounted = useRef(true);
  const exporting = useRef(false);
  const detail = manualDetails(order);
  const quickUrl = appleInstallationUrl(order);
  const quickSupported = previewQuickSupported ?? supportsQuickInstall(Platform.OS, Platform.Version,
    Platform.OS === 'web' && typeof navigator !== 'undefined' ? navigator.userAgent : '', Platform.OS === 'ios' && Platform.isPad);
  const qrUrl = order.provision?.qr_code_url;
  const expires = order.provision?.qr_code_url_expires;
  const qrReady = !!qrUrl && !qrFailed && (!expires || Date.parse(expires) > Date.now());

  useEffect(() => {
    mounted.current = true;
    const back = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    if (Platform.OS === 'web') document.addEventListener('keydown', escape);
    return () => { mounted.current = false; clearTimeout(copyTimer.current); back.remove(); if (Platform.OS === 'web') document.removeEventListener('keydown', escape); };
  }, [onClose]);
  useEffect(() => { setQrFailed(false); }, [qrUrl]);

  const copy = async (key: string, value: string) => {
    setFailure(null);
    try {
      await copyInstallationValue(value);
      if (!mounted.current) return;
      setCopied(key); clearTimeout(copyTimer.current); copyTimer.current = setTimeout(() => setCopied(null), 2000);
    } catch (error) { if (mounted.current) setFailure(error instanceof Error ? error.message : 'Не удалось скопировать. Выделите текст и скопируйте вручную.'); }
  };
  const exportQr = async (intent: 'share' | 'save') => {
    if (exporting.current || !qrReady || !qrUrl) return;
    exporting.current = true; setWorking(true); setFailure(null); setFeedback(null);
    try {
      const blob = await loadQr();
      if (!mounted.current) return;
      const message = await exportInstallationQr(blob, intent, qrUrl);
      if (mounted.current) setFeedback(message);
    } catch (error) { if (mounted.current) setFailure(error instanceof Error ? error.message : 'Не удалось сохранить QR-код. Повторите попытку.'); }
    finally { exporting.current = false; if (mounted.current) setWorking(false); }
  };
  const quickInstall = async () => {
    setFailure(null);
    if (!quickSupported) { setMethod('qr'); return; }
    if (!quickUrl) { setFailure('Данные для быстрой установки ещё готовятся. Обновите заказ или выберите QR-код.'); return; }
    try { await Linking.openURL(quickUrl); }
    catch { setFailure('Не удалось открыть установку. Попробуйте QR-код или ручной способ.'); }
  };
  const waiting = <View style={styles.waiting}><Text style={styles.muted}>Данные установки ещё готовятся.</Text><Pressable onPress={onRefresh} disabled={refreshing} accessibilityRole="button" testID="installation-refresh"><Text style={styles.link}>{refreshing ? 'Обновляем…' : 'Обновить данные'}</Text></Pressable></View>;

  return <View style={styles.overlay} testID="installation-overlay" accessibilityViewIsModal>
    <Pressable onPress={onClose} style={styles.backdrop} accessibilityRole="button" accessibilityLabel="Закрыть установку" />
    <View style={[styles.sheet, { height: Math.min(594, height - Math.max(topInset + 8, 54)) }]} testID="installation-sheet">
      <ScrollView showsVerticalScrollIndicator={false} contentInsetAdjustmentBehavior="never" contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}>
        <View style={styles.header}>
          <View style={styles.headingSlot} accessibilityRole="header" accessibilityLabel="Установить eSIM"><Image source={assets.heading} style={styles.heading} contentFit="contain" accessible={false} /></View>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Закрыть установку" style={styles.close} testID="installation-close"><Image source={assets.close} style={styles.icon} contentFit="contain" accessible={false} /></Pressable>
        </View>
        <View style={styles.tabs} accessibilityRole="tablist">
          {methods.map(item => <Pressable key={item.id} onPress={() => { setMethod(item.id); setFailure(null); setFeedback(null); setInstruction(false); }} style={[styles.tab, method === item.id && styles.selectedTab]} accessibilityRole="tab" accessibilityState={{ selected: method === item.id }} testID={`installation-tab-${item.id}`}>
            <Text style={[styles.tabText, method === item.id && styles.selectedText]}>{item.label}</Text>
          </Pressable>)}
        </View>
        {method === 'quick' && <>
          <View style={styles.quickCard} testID="installation-quick-card">
            <View style={styles.phoneSlot}><Image source={assets.phone} style={styles.phone} contentFit="contain" accessible={false} /></View>
            <Text style={styles.quickTitle}>В один тап на этом iPhone</Text>
            <Text style={styles.muted}>{quickSupported ? 'iOS 17.4 и новее. Откроются настройки — останется нажать «Продолжить»' : 'На iPhone с iOS 17.4 и новее. На другом устройстве используйте QR-код или ручную установку'}</Text>
          </View>
          <Pressable onPress={() => void quickInstall()} style={({ pressed }) => [styles.primary, pressed && styles.pressed]} accessibilityRole="button" testID="installation-quick-install"><Text style={styles.primaryText}>{quickSupported ? 'Установить на этот iPhone' : 'Открыть QR-код'}</Text></Pressable>
        </>}
        {method === 'qr' && <>
          <View style={styles.qrCard} testID="installation-qr-card">
            {qrReady ? <View style={styles.qrWhite}><Image source={{ uri: qrUrl }} cachePolicy="none" style={styles.qrImage} contentFit="contain" onError={() => setQrFailed(true)} accessibilityLabel="QR-код для установки вашей eSIM" testID="installation-qr-image" /></View> : waiting}
            <Text style={styles.muted}>Отсканируйте камерой с телефона, на который ставите eSIM</Text>
          </View>
          <View style={styles.actions}>
            {([{ intent: 'share', label: 'Поделиться', icon: assets.share }, { intent: 'save', label: 'Сохранить', icon: assets.qr }] as const).map(action => <Pressable key={action.intent} onPress={() => void exportQr(action.intent)} disabled={!qrReady || working} accessibilityRole="button" accessibilityState={{ disabled: !qrReady || working, busy: working }} testID={`installation-${action.intent}`} style={[styles.secondary, (!qrReady || working) && styles.pressed]}>
              {working ? <ActivityIndicator color={colors.text} size="small" /> : <Image source={action.icon} style={styles.icon} contentFit="contain" accessible={false} />}<Text style={styles.actionText}>{action.label}</Text>
            </Pressable>)}
          </View>
        </>}
        {method === 'manual' && <>
          <View style={styles.manualCard} testID="installation-manual-card">
            {([{ key: 'address', label: 'SM-DP+ адрес', value: detail.address }, { key: 'code', label: 'Код активации', value: detail.matchingId }] as const).map((field, index) => <View key={field.key} style={[styles.field, index === 0 && styles.divider]}>
              <View style={styles.fieldCopy}><Text style={styles.fieldLabel}>{field.label}</Text><Text style={styles.fieldValue} selectable testID={`installation-${field.key}`}>{field.value || 'Ещё готовится'}</Text></View>
              <Pressable onPress={() => void copy(field.key, field.value)} disabled={!field.value} accessibilityRole="button" accessibilityLabel={`Копировать ${field.label}`} testID={`installation-copy-${field.key}`} style={[styles.copyButton, !field.value && styles.pressed]}><Text style={styles.copyText}>{copied === field.key ? 'Скопировано' : 'Копировать'}</Text></Pressable>
            </View>)}
          </View>
          {(!detail.address || !detail.matchingId) && waiting}
          <View style={styles.steps}>{steps.map((step, index) => <View key={step} style={styles.step}><View style={styles.stepNumber}><Text style={styles.stepNumberText}>{index + 1}</Text></View><Text style={styles.stepText}>{Platform.OS === 'android' && index === 0 ? 'Настройки → Сеть и интернет → SIM' : step}</Text></View>)}</View>
          <View style={styles.spacer} />
        </>}
        {(failure || statusError) && <Text style={styles.error} accessibilityRole="alert">{failure ?? statusError}</Text>}
        {feedback && <Text style={styles.feedback} accessibilityLiveRegion="polite">{feedback}</Text>}
        {instruction && <View style={styles.instructions}><Text style={styles.instructionTitle}>Как установить eSIM</Text><Text style={styles.instructionText}>1. Подключитесь к Wi-Fi.{ '\n' }2. Откройте настройки сотовой связи и выберите добавление eSIM.{ '\n' }3. Отсканируйте QR-код с другого экрана или введите SM-DP+ адрес и код активации из вкладки «Вручную».{ '\n' }4. Подтвердите добавление eSIM и следуйте подсказкам телефона.</Text></View>}
        <Pressable onPress={() => setInstruction(value => !value)} accessibilityRole="button" accessibilityState={{ expanded: instruction }} testID="installation-instructions"><Text style={styles.link}>{instruction ? 'Свернуть инструкцию' : 'Подробная инструкция'}</Text></Pressable>
      </ScrollView>
      <View style={styles.handle} pointerEvents="none" />
    </View>
  </View>;
}

const fontFamily = fonts.text;
const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 10, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { width: '100%', backgroundColor: '#1C1C1F', borderTopLeftRadius: 32, borderTopRightRadius: 32, overflow: 'hidden' },
  content: { flexGrow: 1, paddingTop: 28, paddingHorizontal: 12, gap: 14 },
  handle: { position: 'absolute', top: 8, left: '50%', marginLeft: -18, width: 36, height: 5, borderRadius: 3, borderCurve: 'continuous', backgroundColor: 'rgba(255,255,255,0.25)' },
  header: { height: 40, flexShrink: 0, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' },
  headingSlot: { flex: 1, height: 40 },
  heading: { position: 'absolute', left: 0.45703125, top: 11.796875, width: 193, height: 18 },
  close: { width: 40, height: 40, borderRadius: 20, borderCurve: 'continuous', backgroundColor: colors.selectedTab, alignItems: 'center', justifyContent: 'center' },
  icon: { width: 20, height: 20 },
  tabs: { flexDirection: 'row', flexShrink: 0, padding: 4, borderRadius: 14, borderCurve: 'continuous', backgroundColor: colors.surface },
  tab: { flex: 1, height: 36, borderRadius: 10, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  selectedTab: { backgroundColor: colors.text },
  tabText: { fontFamily, fontSize: 14, lineHeight: 20, letterSpacing: -0.056, fontWeight: '600', color: 'rgba(255,255,255,0.6)' },
  selectedText: { color: colors.ink },
  quickCard: { flexShrink: 0, paddingHorizontal: 16, paddingBottom: 20, borderRadius: 24, borderCurve: 'continuous', gap: 12, alignItems: 'center', backgroundColor: colors.surface },
  phoneSlot: { width: '100%', height: 200, overflow: 'hidden', alignItems: 'center' },
  phone: { width: 319, height: 200 },
  quickTitle: { fontFamily, fontSize: 18, lineHeight: 24, letterSpacing: -0.072, fontWeight: '600', color: colors.text, textAlign: 'center' },
  muted: { fontFamily, fontSize: 14, lineHeight: 20, letterSpacing: -0.056, color: 'rgba(255,255,255,0.55)', textAlign: 'center' },
  primary: { flexShrink: 0, height: 56, borderRadius: 16, borderCurve: 'continuous', backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontFamily, fontSize: 16, lineHeight: 22, letterSpacing: -0.064, fontWeight: '600', color: colors.ink },
  qrCard: { flexGrow: 1, flexShrink: 0, minHeight: 308, paddingHorizontal: 16, paddingVertical: 20, gap: 14, alignItems: 'center', borderRadius: 24, borderCurve: 'continuous', backgroundColor: colors.surface },
  qrWhite: { padding: 14, borderRadius: 20, borderCurve: 'continuous', backgroundColor: colors.text },
  qrImage: { width: 176, height: 176 },
  actions: { flexDirection: 'row', flexShrink: 0, gap: 8 },
  secondary: { flex: 1, height: 56, borderRadius: 16, borderCurve: 'continuous', backgroundColor: colors.selectedTab, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  actionText: { fontFamily, fontSize: 16, lineHeight: 22, letterSpacing: -0.064, fontWeight: '600', color: colors.text },
  manualCard: { flexShrink: 0, paddingHorizontal: 16, paddingVertical: 4, borderRadius: 24, borderCurve: 'continuous', backgroundColor: colors.surface },
  field: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  divider: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  fieldCopy: { flex: 1, minWidth: 0, gap: 2 },
  fieldLabel: { fontFamily, fontSize: 13, lineHeight: 19, letterSpacing: -0.052, color: colors.mutedText },
  fieldValue: { fontFamily, fontSize: 16, lineHeight: 22, letterSpacing: -0.064, fontWeight: '600', color: colors.text },
  copyButton: { height: 32, paddingHorizontal: 12, borderRadius: 14, borderCurve: 'continuous', backgroundColor: colors.selectedTab, justifyContent: 'center' },
  copyText: { fontFamily, fontSize: 13, lineHeight: 19, letterSpacing: -0.052, fontWeight: '600', color: colors.text },
  steps: { flexShrink: 0, padding: 16, borderRadius: 24, borderCurve: 'continuous', gap: 8, backgroundColor: colors.surface },
  step: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  stepNumber: { width: 24, height: 24, borderRadius: 12, borderCurve: 'continuous', backgroundColor: colors.tariffAccent, alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { fontFamily, fontSize: 12, lineHeight: 18, fontWeight: '700', letterSpacing: -0.048, color: colors.text },
  stepText: { flex: 1, fontFamily, fontSize: 14, lineHeight: 20, letterSpacing: -0.056, color: colors.text },
  spacer: { flexGrow: 1 },
  link: { fontFamily, fontSize: 14, lineHeight: 20, letterSpacing: -0.056, fontWeight: '600', color: '#99A6FF', textAlign: 'center' },
  waiting: { padding: 12, gap: 12, alignItems: 'center', justifyContent: 'center', minHeight: 160 },
  error: { fontFamily, fontSize: 13, lineHeight: 19, color: '#FFB59C', textAlign: 'center' },
  feedback: { fontFamily, fontSize: 13, lineHeight: 19, color: colors.lime, textAlign: 'center' },
  instructions: { padding: 16, borderRadius: 24, borderCurve: 'continuous', gap: 12, backgroundColor: colors.surface },
  instructionTitle: { fontFamily, fontSize: 18, lineHeight: 24, fontWeight: '700', color: colors.text },
  instructionText: { fontFamily, fontSize: 14, lineHeight: 22, color: colors.text },
  pressed: { opacity: 0.6 },
});
