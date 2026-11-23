import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import type { CatalogEsim } from '../../../../packages/shared/contracts/catalog';
import { countLabel } from '../catalog/catalog';
import { regionCountryCodes, type TripDestination } from '../home/tripSearch';
import { colors } from '../theme';
import { StyleSheet } from '../ui/design';
import { Pressable, View } from '../ui/Surface';
import { Text } from '../ui/Text';
import { CountryFlag } from './CountryFlag';

export const searchArtwork = {
  search: require('../../assets/home-v3/search.svg'),
  world: require('../../assets/trip-search/world.png'),
  globe: require('../../assets/trip-search/globe.png'),
  europe: require('../../assets/trip-search/europe.png'),
  asia: require('../../assets/trip-search/asia.png'),
  caucasus: require('../../assets/trip-search/caucasus.png'),
  plus: require('../../assets/trip-search/plus.svg'),
  check: require('../../assets/trip-search/check.svg'),
  close: require('../../assets/trip-search/close.svg'),
  remove: require('../../assets/trip-search/remove.svg'),
  right: require('../../assets/trip-search/right.svg'),
  error: require('../../assets/trip-search/error.svg'),
};

export const searchRegions = [
  { title: 'Европа', artwork: searchArtwork.europe },
  { title: 'Азия', artwork: searchArtwork.asia },
  { title: 'Кавказ', artwork: searchArtwork.caucasus },
];

export function DestinationIcon({ destination, small = false }: {
  destination: Exclude<TripDestination, { kind: 'countries' }>; small?: boolean;
}) {
  const artwork = destination.kind === 'world' ? searchArtwork.globe
    : searchRegions.find(region => region.title.toLocaleLowerCase('ru') === destination.category.title.trim().toLocaleLowerCase('ru'))?.artwork;
  const size = small ? 24 : 36;
  return artwork
    ? <View style={[styles.regionIcon, { height: size, width: Math.round(size * 41 / 36) }]}>
        <Image source={artwork} style={styles.fill} contentFit="contain" accessible={false} />
      </View>
    : <CountryFlag country={destination.esim} size={size} shape="rectangle" />;
}

export function SearchFlags({ countries, size = 24 }: { countries: readonly CatalogEsim[]; size?: number }) {
  if (countries.length === 1) return <CountryFlag country={countries[0]} size={size} shape="rectangle" />;
  const flagCount = countries.length > 3 ? 2 : 3;
  return <View style={styles.flags}>
    {countries.slice(0, flagCount).map((country, index) => (
      <View key={country.id} style={{ marginLeft: index ? -8 : 0, zIndex: 3 - index }}>
        <CountryFlag country={country} size={size} borderWidth={1} />
      </View>
    ))}
    {countries.length > flagCount && <View style={[styles.moreFlags, { width: size, height: size }]}>
      <Text style={styles.moreCount}>+{countries.length - flagCount}</Text>
    </View>}
  </View>;
}

export function SearchSummary({ label, onPress, icon, arrow, testID }: {
  label: string; onPress: () => void; icon?: ReactNode; arrow?: boolean; testID: string;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`Изменить: ${label}`} testID={testID} onPress={onPress}
    style={({ pressed }) => [styles.summary, !!icon && styles.summaryWithIcon, pressed && styles.pressed]}>
    {icon}<Text style={styles.summaryText} numberOfLines={1}>{label}</Text>
    {arrow && <Image source={searchArtwork.right} style={styles.arrow} accessible={false} />}
  </Pressable>;
}

export function SearchButton({ label, onPress, testID, disabled }: {
  label: string; onPress: () => void; testID?: string; disabled?: boolean;
}) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} testID={testID}
    style={({ pressed }) => [styles.button, (pressed || disabled) && styles.pressed]}>
    <Text style={styles.buttonText}>{label}</Text>
  </Pressable>;
}

export function describeDestination(destination: TripDestination) {
  if (destination.kind === 'countries') {
    return destination.countries.length === 1 ? destination.countries[0].display_name : countLabel(destination.countries.length);
  }
  if (destination.kind === 'world') return 'Весь мир';
  const regionCount = regionCountryCodes(destination.category).size;
  return regionCount ? `${destination.category.title}, ${countLabel(regionCount)}` : destination.category.title;
}

export const searchSurfaces = {
  panel: 'rgba(38,38,41,0.5)',
  divider: 'rgba(255,255,255,0.08)',
  blue: '#4D5CFF',
};

const styles = StyleSheet.create({
  fill: { width: '100%', height: '100%' },
  regionIcon: { borderRadius: 12, backgroundColor: colors.selectedTab, overflow: 'hidden' },
  flags: { flexDirection: 'row', alignItems: 'center' },
  moreFlags: { marginLeft: -5, borderRadius: 20, backgroundColor: colors.selectedTab, alignItems: 'center', justifyContent: 'center' },
  moreCount: { fontSize: 10, color: colors.text },
  summary: { minHeight: 36, gap: 8, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, flexDirection: 'row', alignItems: 'center', backgroundColor: searchSurfaces.panel, maxWidth: '100%' },
  summaryWithIcon: { paddingLeft: 6 },
  summaryText: { flexShrink: 1, fontSize: 14, lineHeight: 20, color: colors.text },
  arrow: { width: 16, height: 16 },
  button: { paddingHorizontal: 24, paddingVertical: 12, minHeight: 46, borderRadius: 16, cornerSmoothing: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: searchSurfaces.blue },
  buttonText: { fontSize: 16, lineHeight: 22, fontWeight: '600', color: colors.text },
  pressed: { opacity: 0.72 },
});
