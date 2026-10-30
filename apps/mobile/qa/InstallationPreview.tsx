// Development-only visual harness. This never reads accounts or creates orders.
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { OrderData } from '../../../packages/shared/contracts/checkout';
import { InstallationSheet } from '../src/components/InstallationSheet';
import { PurchasedEsimView } from '../src/components/PurchasedEsimView';
import type { InstallationMethod } from '../src/orders/installation';

// Metro selects Expo Image's web resolver. Keep the native-only source out of
// this web harness's type graph; its internal RN import has no declarations.
const resolveAssetSource = require('expo-image/src/utils/resolveAssetSource').default as (asset: number) => { uri: string } | undefined;
const localImage = (asset: number) => {
  const source = resolveAssetSource(asset);
  return source ? new URL(source.uri, window.location.href).toString() : '';
};
const fixture = (): OrderData => ({
  id: '00000000-0000-4000-8000-000000000001', order_number: 10001,
  state: 'delivered', total_amount_minor: 890, total_currency: 'RUB', created_at: '2026-10-21T10:00:00Z',
  esim: { id: '00000000-0000-4000-8000-000000000002', name: 'Турция', image: localImage(require('../assets/home/flag-tr.svg')) },
  tariff: { id: '00000000-0000-4000-8000-000000000003', data_amount: { amount: 5, unit: 'GB' }, duration: { amount: 15, unit: 'day' } },
  remaining: { amount: 5, unit: 'GB' }, esim_status: 'issued',
  payment: { state: 'captured', amount_minor: 890, currency: 'RUB', url: null, expires_at: null, failure_code: null },
  items: [{ id: '00000000-0000-4000-8000-000000000004', storefront_plan_id: '00000000-0000-4000-8000-000000000003', display_name: '5 ГБ / 15 дней', price_amount_minor: 890, price_currency: 'RUB', data_amount: { amount: 5, unit: 'GB' }, duration: { amount: 15, unit: 'day' } }],
  provision: { state: 'delivered', iccid: 'TEST-ONLY', activation_code: 'LPA:1$consumer.rsp.esim.ru$EXAMPLE-NOT-ACTIVE', smdp_address: 'consumer.rsp.esim.ru', matching_id: 'EXAMPLE-NOT-ACTIVE', qr_code_url: localImage(require('./fixture-qr.svg')), qr_code_url_expires: null },
  activated_at: null, expires_at: null, price_changed: false,
});

function Phone({ initial }: { initial?: InstallationMethod }) {
  const [open, setOpen] = useState(!!initial);
  const close = useCallback(() => setOpen(false), []);
  const [order] = useState(fixture);
  return <View style={styles.scaled}>
    <View style={styles.phone}>
      <PurchasedEsimView order={order} topInset={48} bottomInset={42} onInstall={() => setOpen(true)} onLater={close} />
      {open && <InstallationSheet order={order} topInset={48} bottomInset={42} onClose={close} onRefresh={() => {}} refreshing={false} initialMethod={initial} previewQuickSupported loadQr={() => Promise.reject(new Error('Это превью с тестовыми данными. Реальный QR доступен после покупки.'))} />}
    </View>
  </View>;
}

export function InstallationPreview() {
  return <ScrollView style={styles.page} contentContainerStyle={styles.pageContent}>
    <Text style={styles.disclaimer}>Визуальная проверка · тестовые данные · заказы и оплата не создаются</Text>
    <View style={styles.gallery}>
      {([{ title: 'eSIM куплена' }, { title: 'Установка · быстро', initial: 'quick' }, { title: 'Установка · QR-код', initial: 'qr' }, { title: 'Установка · вручную', initial: 'manual' }] as const).map(item => <View key={item.title} style={styles.column}><Text style={styles.label}>{item.title}</Text><Phone initial={'initial' in item ? item.initial : undefined} /></View>)}
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#FFFFFF' },
  pageContent: { padding: 24, gap: 20 },
  disclaimer: { fontSize: 14, color: '#555555' },
  gallery: { flexDirection: 'row', flexWrap: 'wrap', gap: 26, alignItems: 'flex-start' },
  column: { gap: 12 },
  label: { fontSize: 18, lineHeight: 24, color: '#1681DA' },
  scaled: { width: 281.25, height: 609 },
  phone: { width: 375, height: 812, overflow: 'hidden', transform: [{ scale: 0.75 }], transformOrigin: 'top left' },
});
