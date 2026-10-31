import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, View } from '../ui/Surface';
import { fonts, StyleSheet } from '../ui/design';
import { Text } from '../ui/Text';
import type { RouteOption, TripRoute } from '../home/smartSearch';
import { totalPrice } from '../home/smartSearch';
import { formatCatalogPrice } from '../catalog/prices';
import { CountryFlag } from './CountryFlag';
import { colors } from '../theme';

export function TripFlags({ countries, size = 22 }: { countries: RouteOption['countries']; size?: number }) {
  return <View style={styles.flags}>{countries.slice(0, countries.length > 3 ? 2 : 3).map(country => <View key={country.id} style={[styles.flag, { width: size, height: size, borderRadius: size / 2 }]}><CountryFlag country={country} size={size - 4} /></View>)}{countries.length > 3 && <View style={[styles.flag, styles.more, { width: size, height: size, borderRadius: size / 2 }]}><Text style={{ color: 'white', fontSize: size > 24 ? 12 : 10 }}>+{countries.length - 2}</Text></View>}</View>;
}
export function TripRoutePanel({ route, expanded, onExpand, onOpen, loading, error, onRetry }: {
  route: TripRoute; expanded: boolean; onExpand: (value: boolean) => void;
  onOpen: (option: RouteOption) => void; loading: boolean; error: boolean; onRetry: () => void;
}) {
  const [bulkNotice, setBulkNotice] = useState(false);
  const primary = route.primary;
  if (error) return <View style={styles.panel}><Text style={styles.heading}>Не получилось загрузить цены</Text><Text style={styles.caption}>Страны сохранили — попробуйте ещё раз через пару секунд</Text><Pressable onPress={onRetry} style={styles.secondary} accessibilityRole="button"><Text style={styles.name}>Повторить</Text></Pressable></View>;
  if (!primary) return <View style={styles.panel}><Text style={styles.heading}>{loading ? 'Подбираем eSIM…' : 'Не нашли общий тариф'}</Text><Text style={styles.caption}>Выбранные страны сохранятся. Попробуйте изменить маршрут.</Text></View>;
  const world = primary.esim.country_iso2?.toUpperCase() === 'XG';
  const name = world ? 'Весь мир' : primary.category?.title ?? primary.esim.display_name;
  const price = formatCatalogPrice(totalPrice([primary]));
  const alternative = route.alternative;
  const mainRow = <><View style={styles.art}>{world ? <Image source={require('../../assets/search/world.svg')} style={styles.world} contentFit="contain" /> : <TripFlags countries={primary.countries} size={32} />}</View><View style={styles.copy}><View style={styles.titleRow}><Text style={styles.heading}>{name}</Text><Text style={styles.name}>{loading ? '…' : price}</Text></View><Text style={styles.lime}>{primary.countries.length === 1 ? 'одна eSIM для поездки' : 'гигабайты общие для поездки'}</Text></View></>;
  return <View style={styles.panel} testID="trip-route-panel">
    <Text style={styles.heading}>{expanded && alternative ? `${alternative.length} eSIM на маршрут` : 'Одна eSIM на всю поездку'}</Text>
    {!expanded && <Text style={styles.caption}>{world ? 'Страны в разных регионах — удобнее «Весь мир»' : primary.countries.length > 1 ? `Все страны маршрута в регионе «${name}»` : primary.esim.display_name}</Text>}
    {expanded && alternative ? <>
      <View style={styles.selected}><Pressable onPress={() => setBulkNotice(true)} accessibilityRole="button"><View style={styles.titleRow}><Text style={styles.heading}>Все {alternative.length} сразу</Text><Text style={styles.name}>{formatCatalogPrice(totalPrice(alternative))}</Text></View><Text style={styles.lime}>Выберите eSIM ниже для оформления</Text></Pressable>
        {alternative.map(option => <Pressable key={option.esim.id} onPress={() => onOpen(option)} accessibilityRole="button" style={styles.row}><TripFlags countries={option.countries} size={32} /><View style={styles.copy}><View style={styles.titleRow}><Text style={styles.name}>{option.category?.title ?? option.esim.display_name}</Text><Text style={styles.name}>{formatCatalogPrice(totalPrice([option]))}</Text></View><Text style={styles.caption}>{option.category ? `${option.countries.length} страны маршрута` : 'отдельная eSIM'}</Text></View><Image source={require('../../assets/search/right.svg')} style={styles.arrow} contentFit="contain" /></Pressable>)}
      </View>
      <Pressable style={styles.secondaryRow} onPress={() => { onExpand(false); setBulkNotice(false); }} accessibilityRole="button">{mainRow}</Pressable>
      {bulkNotice && <Text style={styles.caption}>Общая оплата комплекта пока недоступна. Можно оформить каждую eSIM отдельно.</Text>}
    </> : <>
      <Pressable onPress={() => onExpand(false)} style={[styles.row, styles.selected]} accessibilityRole="radio" accessibilityState={{ checked: true }}>{mainRow}</Pressable>
      {alternative && <Pressable onPress={() => onExpand(true)} style={styles.secondaryRow} accessibilityRole="button" testID="trip-cheaper-alternative"><View style={styles.copy}><View style={styles.titleRow}><Text style={styles.name}>Дешевле — {alternative.length} eSIM</Text><Text style={styles.name}>{formatCatalogPrice(totalPrice(alternative))}</Text></View><Text style={styles.caption}>{alternative.map(option => option.category?.title ?? option.esim.display_name).join(', ')} отдельно</Text></View><Image source={require('../../assets/search/right.svg')} style={styles.arrow} contentFit="contain" /></Pressable>}
      {route.separateMoreExpensive && <Text style={styles.caption}>По отдельности вышло бы дороже или столько же.</Text>}
    </>}
    {primary.category && <Text style={styles.fine}>Страны указаны по составу категории. Точное покрытие пакета уточняйте перед покупкой.</Text>}
  </View>;
}
const styles = StyleSheet.create({
  panel: { paddingHorizontal: 12, paddingTop: 16, paddingBottom: 12, gap: 10, backgroundColor: '#242426', borderRadius: 20 },
  heading: { fontFamily: fonts.display, fontSize: 18, lineHeight: 22, fontWeight: '800', color: 'white', flexShrink: 1 },
  name: { fontSize: 16, lineHeight: 19, fontWeight: '600', color: 'white', flexShrink: 1 },
  caption: { fontSize: 14, lineHeight: 17, color: 'rgba(255,255,255,0.55)' },
  fine: { fontSize: 11, lineHeight: 15, color: colors.mutedText },
  lime: { fontSize: 14, lineHeight: 17, color: colors.lime },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  selected: { padding: 14, borderWidth: 1.5, borderColor: colors.tariffAccent, backgroundColor: 'rgba(77,92,255,0.14)', borderRadius: 16 },
  secondaryRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 16 },
  secondary: { padding: 12, borderRadius: 12, alignSelf: 'flex-start', backgroundColor: colors.selectedTab },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  art: { maxWidth: 80 }, world: { width: 46, height: 40 }, arrow: { width: 16, height: 16 },
  flags: { flexDirection: 'row', alignItems: 'center', paddingRight: 6 },
  flag: { marginRight: -6, alignItems: 'center', justifyContent: 'center', backgroundColor: '#242426', borderWidth: 2, borderColor: '#242426', overflow: 'hidden' },
  more: { backgroundColor: '#3D3D45' },
});
