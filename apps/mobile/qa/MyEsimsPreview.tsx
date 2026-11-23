// Development-only preview. Demo orders stay in memory and never use the order API.
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { CatalogEsim } from '../../../packages/shared/contracts/catalog';
import type { OrderData } from '../../../packages/shared/contracts/checkout';
import { EsimDetailsView } from '../src/components/EsimDetailsView';
import { InstallationSheet } from '../src/components/InstallationSheet';
import { PurchasedOrders, type OrderAction } from '../src/components/PurchasedOrders';
import { MyEsimsLayout } from '../src/screens/MyEsimsScreen';
import { colors } from '../src/theme';

const resolveAsset = require('expo-image/src/utils/resolveAssetSource').default as (asset: number) => { uri: string };
const day = 86_400_000;
const id = (number: number) => `11111111-1111-4111-8111-${String(number).padStart(12, '0')}`;
const countries = new Map<string, CatalogEsim>();

function destination(number: number, country_iso2: string, display_name: string, network?: string) {
  const esim: CatalogEsim = { id: id(number), country_iso2, display_name, network,
    image_url: null, min_price_amount: null, min_price_currency: null };
  countries.set(esim.id, esim);
  return esim;
}

const turkey = destination(101, 'TR', 'Турция', 'Turkcell · 5G');
const emirates = destination(102, 'AE', 'ОАЭ', 'du · 5G');
const georgia = destination(103, 'GE', 'Грузия');
const japan = destination(104, 'JP', 'Япония');
const armenia = destination(105, 'AM', 'Армения');

function demoOrder(number: number, country: CatalogEsim, capacity: number, days: number, remaining: number | null,
  status: string, activatedAt: string | null, qr: string): OrderData {
  const tariff = { id: id(200 + number), data_amount: { amount: capacity, unit: 'GB' }, duration: { amount: days, unit: 'day' } };
  return {
    id: id(number), order_number: 10000 + number, state: 'delivered', esim_status: status,
    esim: { id: country.id, name: country.display_name, image: null }, tariff,
    total_amount_minor: 490, total_currency: 'RUB',
    remaining: remaining === null ? null : { amount: remaining, unit: 'GB' },
    created_at: activatedAt ?? new Date().toISOString(), activated_at: activatedAt,
    expires_at: activatedAt ? new Date(Date.parse(activatedAt) + days * day).toISOString() : null,
    items: [{ id: id(300 + number), storefront_plan_id: tariff.id, display_name: `${capacity} ГБ`,
      price_amount_minor: 490, price_currency: 'RUB', data_amount: tariff.data_amount, duration: tariff.duration }],
    payment: { state: 'captured', amount_minor: 490, currency: 'RUB', url: null, expires_at: null, failure_code: null },
    provision: { state: 'delivered', iccid: 'DEMO', activation_code: 'LPA:1$demo.invalid$DEMO-ONLY',
      smdp_address: 'demo.invalid', matching_id: 'DEMO-ONLY', qr_code_url: qr, qr_code_url_expires: null },
    price_changed: false,
  };
}

function demoOrders() {
  const qr = new URL(resolveAsset(require('./fixture-qr.svg')).uri, window.location.href).href;
  const daysAgo = (days: number) => new Date(Date.now() - days * day - 60_000).toISOString();
  return [
    demoOrder(1, turkey, 5, 15, 3.2, 'activated', daysAgo(5), qr),
    demoOrder(2, emirates, 10, 30, 8.4, 'active', daysAgo(3), qr),
    demoOrder(3, georgia, 3, 7, null, 'issued', null, qr),
    demoOrder(4, japan, 10, 15, 0, 'expired', '2026-08-04T10:00:00Z', qr),
    demoOrder(5, armenia, 5, 7, 0, 'depleted', '2026-07-14T10:00:00Z', qr),
  ];
}

export function MyEsimsPreview() {
  const [orders, setOrders] = useState(demoOrders);
  const [route, setRoute] = useState<{ id: string; action: OrderAction } | null>(null);
  const [installationOpen, setInstallationOpen] = useState(false);
  const closeInstallation = useCallback(() => setInstallationOpen(false), []);
  const open = (id: string, action: OrderAction) => {
    setRoute({ id, action });
    setInstallationOpen(action === 'install');
  };
  const back = () => { closeInstallation(); setRoute(null); };
  const catalog = () => window.location.assign('/countries');
  const order = orders.find(item => item.id === route?.id);
  const activate = () => {
    if (!order) return;
    const now = Date.now();
    setOrders(items => items.map(item => item.id === order.id ? { ...item, esim_status: 'activated',
      activated_at: new Date(now).toISOString(), remaining: item.tariff.data_amount,
      expires_at: new Date(now + item.tariff.duration.amount * day).toISOString(),
    } : item));
    back();
  };

  return <SafeAreaProvider style={styles.page}>
    <View style={styles.preview}>
      <View style={styles.banner}>
        <Text style={styles.bannerText}>Демо · тестовые eSIM</Text>
        {order?.esim_status === 'issued' && <Pressable onPress={activate} accessibilityRole="button" testID="demo-esim-activate">
          <Text style={styles.link}>Сымитировать активацию</Text>
        </Pressable>}
        <Pressable onPress={() => window.location.assign('/my-esims')} accessibilityRole="button">
          <Text style={styles.link}>Выйти из демо</Text>
        </Pressable>
      </View>
      <View style={{ flex: 1 }}>
        <View style={[StyleSheet.absoluteFill, !!order && styles.hidden]}>
          <MyEsimsLayout populated onAdd={catalog}>
            {insets => <PurchasedOrders {...insets} orders={orders} countries={countries} onSelect={open} />}
          </MyEsimsLayout>
        </View>
        {order && <EsimDetailsView key={order.id} order={order} country={countries.get(order.esim.id)}
          initialTopUp={route?.action === 'top-up'} topInset={48} bottomInset={42} onBack={back}
          onCatalog={catalog} onInstall={() => setInstallationOpen(true)} />}
        {order && installationOpen && <InstallationSheet order={order} topInset={48} bottomInset={42}
          onClose={closeInstallation} onRefresh={() => {}} refreshing={false} previewQuickSupported={false}
          loadQr={async () => (await fetch(order.provision!.qr_code_url)).blob()} />}
      </View>
    </View>
  </SafeAreaProvider>;
}

const styles = StyleSheet.create({
  page: { backgroundColor: colors.background },
  preview: { alignSelf: 'center', flex: 1, width: '100%', maxWidth: 480 },
  banner: { padding: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between', backgroundColor: colors.surface },
  bannerText: { fontSize: 12, color: colors.text },
  link: { fontSize: 12, color: '#AAB4FF' },
  hidden: { display: 'none' },
});
