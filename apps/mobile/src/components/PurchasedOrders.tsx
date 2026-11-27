import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { Platform, useWindowDimensions, View as NativeView, type NativeScrollEvent, type NativeSyntheticEvent, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import type { CatalogEsim } from '../../../../packages/shared/contracts/catalog';
import { orderCountry, orderDataLabel, orderPrice, orderStateLabel } from '../orders/display';
import { elapsedDuration, esimDisplayStatus, groupOrders, historyMonth, trafficDisplay, type DisplayOrder } from '../orders/myEsims';
import { formatDuration } from '../tariffs/tariffs';
import { colors } from '../theme';
import { fonts, StyleSheet } from '../ui/design';
import { ScrollView } from '../ui/ScrollView';
import { Pressable, View } from '../ui/Surface';
import { Text } from '../ui/Text';
import { CountryFlag } from './CountryFlag';

const artwork = {
  track: require('../../assets/my-esims/ring.svg'),
  traffic: require('../../assets/my-esims/traffic.svg'),
  duration: require('../../assets/my-esims/duration.svg'),
};
const cardGap = 8;
const cardPeek = 24;
export type OrderAction = 'details' | 'install' | 'top-up';

type Props = {
  orders: readonly DisplayOrder[];
  countries?: ReadonlyMap<string, CatalogEsim>;
  leftInset: number;
  rightInset: number;
  onSelect: (id: string, action: OrderAction) => void;
};

const heading = (label: string) => <Text accessibilityRole="header" style={styles.heading}>{label}</Text>;

function arc(r: number, strokeWidth: number, ratio: number, color: string) {
  const length = 2 * Math.PI * r;
  return ratio > 0 ? <Circle cx={75} cy={75} r={r} fill="none" stroke={color} strokeWidth={strokeWidth}
    rotation={-90} origin="75, 75" strokeDasharray={ratio < 1 ? [length * ratio, length] : undefined} /> : null;
}

function ActiveCard({ order, country, onSelect }: { order: DisplayOrder; country?: CatalogEsim; onSelect: Props['onSelect'] }) {
  const traffic = trafficDisplay(order);
  const duration = elapsedDuration(order);
  const caption = traffic.observed ? `${traffic.unit} осталось` : 'остаток уточняется';
  const time = duration?.days != null
    ? `${duration.days} из ${order.tariff.duration.amount} дней`
    : formatDuration(order.tariff.duration);

  return <View style={styles.activeCard} testID={`my-esims-active-${order.id}`}>
    <View style={styles.countryRow}>
      <CountryFlag country={country ?? orderCountry(order)} size={40} />
      <View style={styles.copy}>
        <Text style={styles.countryTitle} numberOfLines={1}>{order.esim.name}</Text>
        {!!country?.network && <Text style={styles.network} numberOfLines={1}>{country.network}</Text>}
      </View>
    </View>
    <View style={styles.allowance}>
      <NativeView style={styles.ring} accessible accessibilityLabel={traffic.observed ? `${traffic.amount} ${caption}` : caption}>
        <Image source={artwork.track} style={styles.track} accessible={false} />
        <Svg width={150} height={150} viewBox="0 0 150 150" style={styles.track} accessible={false}>
          {arc(68.25, 13.5, traffic.observed ? traffic.ratio : 0, colors.lime)}
          {arc(54.25, 9.5, duration?.ratio ?? 0, colors.tariffAccent)}
        </Svg>
        <Text style={styles.amount} numberOfLines={1} adjustsFontSizeToFit>{traffic.observed ? traffic.amount : '—'}</Text>
        <Text style={styles.caption} numberOfLines={2}>{caption}</Text>
      </NativeView>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={styles.legendLabelRow}><Image source={artwork.traffic} style={styles.dot} accessible={false} /><Text style={styles.network}>Трафик</Text></View>
          <Text style={styles.legendValue}>{traffic.legend}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={styles.legendLabelRow}><Image source={artwork.duration} style={styles.dot} accessible={false} /><Text style={styles.network}>Срок</Text></View>
          <Text style={styles.legendValue}>{time}</Text>
        </View>
      </View>
    </View>
    <View style={styles.actions}>
      <Pressable onPress={() => onSelect(order.id, 'top-up')} accessibilityRole="button" testID={`my-esims-top-up-${order.id}`}
        style={({ pressed }) => [styles.button, styles.topUp, pressed && styles.pressed]}><Text style={[styles.buttonText, styles.topUpText]}>Докупить</Text></Pressable>
      <Pressable onPress={() => onSelect(order.id, 'details')} accessibilityRole="button" testID={`my-esims-details-${order.id}`}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}><Text style={styles.buttonText}>Детали</Text></Pressable>
    </View>
  </View>;
}

function ActiveOrders({ active, countries, onSelect, leftInset, rightInset }: Pick<Props, 'countries' | 'onSelect' | 'leftInset' | 'rightInset'> & { active: DisplayOrder[] }) {
  const scroll = useRef<ScrollView>(null);
  const { width: windowWidth } = useWindowDimensions();
  const [measured, setMeasured] = useState(0);
  const [index, setIndex] = useState(0);
  const width = measured || windowWidth;
  const cardWidth = Math.max(1, width - leftInset - rightInset - cardPeek);
  const stride = cardWidth + cardGap;
  const pageOffsets = active.map((_, page) => page * stride);
  const lastIndex = active.length - 1;
  const selected = Math.min(index, lastIndex);
  const web = Platform.OS === 'web';

  useEffect(() => {
    if (index > lastIndex) setIndex(lastIndex);
  }, [index, lastIndex]);

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.max(0, Math.min(lastIndex, Math.round(event.nativeEvent.contentOffset.x / stride))));
  };
  const select = (next: number) => {
    scroll.current?.scrollTo({ x: pageOffsets[next], animated: true });
    setIndex(next);
  };
  const render = (order: DisplayOrder) => <ActiveCard order={order} country={countries?.get(order.esim.id)} onSelect={onSelect} />;

  return <>
    {heading('Активные')}
    {active.length === 1 ? render(active[0]) : <>
      <NativeView style={{ marginLeft: -leftInset, marginRight: -rightInset }} onLayout={event => setMeasured(event.nativeEvent.layout.width)}>
        <ScrollView ref={scroll} horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled directionalLockEnabled
          decelerationRate="fast" snapToOffsets={web ? undefined : pageOffsets} pagingEnabled={web} disableIntervalMomentum
          style={web ? { scrollPaddingLeft: leftInset } as ViewStyle : undefined} onScroll={onScroll} scrollEventThrottle={16}
          contentContainerStyle={{ paddingLeft: leftInset, paddingRight: Math.max(0, width - leftInset - cardWidth), gap: cardGap }}
          testID="my-esims-carousel">
          {active.map(order => <NativeView key={order.id} style={{ width: cardWidth }}>{render(order)}</NativeView>)}
        </ScrollView>
      </NativeView>
      <NativeView style={styles.pages} testID="my-esims-carousel-pages">
        {active.map((order, page) => <Pressable key={order.id} onPress={() => select(page)} accessibilityRole="button"
          accessibilityLabel={`Показать ${order.esim.name}, ${page + 1} из ${active.length}`} accessibilityState={{ selected: page === selected }}
          hitSlop={6} testID={`my-esims-page-${page + 1}`} style={[styles.page, page === selected && styles.currentPage]} />)}
      </NativeView>
    </>}
  </>;
}

export function PurchasedOrders({ orders, countries, leftInset, rightInset, onSelect }: Props) {
  const { active, waiting, history, other } = groupOrders(orders);

  return <>
    {active.length > 0 && <ActiveOrders active={active} countries={countries} onSelect={onSelect} leftInset={leftInset} rightInset={rightInset} />}
    {waiting.length > 0 && <>
      {heading('Ждёт установки')}
      {waiting.map(order => {
        const installed = esimDisplayStatus(order) === 'installed';
        return <View key={order.id} style={[styles.waitingRow, styles.installRow]} testID={`my-esims-waiting-${order.id}`}>
          <Pressable onPress={() => onSelect(order.id, 'details')} accessibilityRole="button"
            accessibilityLabel={`Детали — ${order.esim.name}, ${orderDataLabel(order)}`} testID={`my-esims-details-${order.id}`}
            style={({ pressed }) => [styles.waitingDetails, pressed && styles.pressed]}>
            <CountryFlag country={countries?.get(order.esim.id) ?? orderCountry(order)} size={40} />
            <Text style={[styles.copy, styles.buttonText]} numberOfLines={2}>{order.esim.name} · {orderDataLabel(order)}</Text>
            {installed && <View style={styles.install}><Text style={styles.installText}>Детали</Text></View>}
          </Pressable>
          {!installed && <Pressable onPress={() => onSelect(order.id, 'install')} accessibilityRole="button"
            accessibilityLabel={`Установить — ${order.esim.name}`}
            testID={`my-esims-install-${order.id}`} style={({ pressed }) => [styles.install, pressed && styles.pressed]}>
            <Text style={styles.installText}>Установить</Text>
          </Pressable>}
        </View>;
      })}
    </>}
    {history.length > 0 && <>
      {heading('Где уже были')}
      <View style={styles.history} testID="my-esims-history">
        {history.map(order => {
          const month = historyMonth(order);
          return <View key={order.id} style={styles.historyCell}>
            <Pressable onPress={() => onSelect(order.id, 'details')} accessibilityRole="button" testID={`my-esims-history-${order.id}`}
              style={({ pressed }) => [styles.historyCard, pressed && styles.pressed]}>
              <NativeView style={styles.historyFlag}><CountryFlag country={countries?.get(order.esim.id) ?? orderCountry(order)} size={32} /></NativeView>
              <View style={styles.copy}>
                <Text style={styles.historyTitle} numberOfLines={1}>{order.esim.name}</Text>
                {!!month && <Text style={styles.historyDate}>{month}</Text>}
              </View>
            </Pressable>
          </View>;
        })}
      </View>
    </>}
    {other.length > 0 && <>
      {heading('Заказы')}
      {other.map(order => <Pressable key={order.id} onPress={() => onSelect(order.id, 'details')} accessibilityRole="button"
        accessibilityLabel={`${order.esim.name}, ${orderDataLabel(order)}, ${orderStateLabel(order)}`} testID={`my-esims-order-${order.id}`}
        style={({ pressed }) => [styles.waitingRow, pressed && styles.pressed]}>
        <CountryFlag country={countries?.get(order.esim.id) ?? orderCountry(order)} size={40} />
        <View style={styles.copy}><Text style={styles.buttonText}>{order.esim.name} · {orderDataLabel(order)}</Text>
          <Text style={styles.network}>{orderStateLabel(order)}</Text></View>
        <Text style={styles.installText}>{orderPrice(order)}</Text>
      </Pressable>)}
    </>}
  </>;
}

const styles = StyleSheet.create({
  heading: { paddingTop: 8, paddingHorizontal: 12, fontSize: 20, lineHeight: 25, fontWeight: '900', color: colors.text },
  activeCard: { padding: 18, gap: 18, borderRadius: 28, borderCurve: 'continuous', backgroundColor: colors.surface },
  countryRow: { minHeight: 47, flexDirection: 'row', alignItems: 'center', gap: 12 },
  copy: { flex: 1, minWidth: 0 },
  countryTitle: { fontSize: 22, lineHeight: 28, fontWeight: '900', color: colors.text },
  network: { fontSize: 13, lineHeight: 19, color: colors.mutedText },
  allowance: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  ring: { width: 150, height: 150, flexShrink: 0 },
  track: { position: 'absolute', top: 0, left: 0, width: 150, height: 150 },
  amount: { position: 'absolute', top: 44, width: '100%', textAlign: 'center', fontFamily: fonts.accent, fontSize: 38, lineHeight: 46, letterSpacing: -1.52, color: colors.text },
  caption: { position: 'absolute', top: 88, width: '100%', textAlign: 'center', fontSize: 12, lineHeight: 18, color: 'rgba(255,255,255,0.55)' },
  legend: { flex: 1, minWidth: 0, gap: 14 },
  legendItem: { gap: 2 },
  legendLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8 },
  legendValue: { fontSize: 16, lineHeight: 22, fontWeight: '600', color: colors.text },
  actions: { flexDirection: 'row', gap: 8 },
  button: { flex: 1, minWidth: 0, height: 52, borderRadius: 16, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.selectedTab },
  topUp: { backgroundColor: colors.lime },
  topUpText: { color: colors.ink },
  buttonText: { fontSize: 16, lineHeight: 22, fontWeight: '600', color: colors.text },
  pages: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  page: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)' },
  currentPage: { width: 18, backgroundColor: colors.text },
  waitingRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 14, paddingRight: 12, paddingVertical: 12, borderRadius: 20, borderCurve: 'continuous', backgroundColor: 'rgba(38,38,41,0.5)' },
  installRow: { paddingLeft: 0, paddingVertical: 0 },
  waitingDetails: { flex: 1, minWidth: 0, alignSelf: 'stretch', paddingLeft: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  install: { height: 36, borderRadius: 18, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.tariffAccent },
  installText: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.text },
  history: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4, rowGap: 8 },
  historyCell: { width: '50%', paddingHorizontal: 4 },
  historyCard: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 10, paddingRight: 12, paddingVertical: 10, borderRadius: 20, borderCurve: 'continuous', backgroundColor: 'rgba(38,38,41,0.3)' },
  historyFlag: { opacity: 0.6 },
  historyTitle: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },
  historyDate: { fontSize: 12, lineHeight: 18, color: 'rgba(255,255,255,0.4)' },
  pressed: { opacity: 0.72 },
});
