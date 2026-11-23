import { Image } from 'expo-image';
import { useMemo } from 'react';
import { Keyboard } from 'react-native';
import type { CatalogCategory, CatalogEsim } from '../../../../packages/shared/contracts/catalog';
import { countLabel } from '../catalog/catalog';
import { getGlobalBundle } from '../catalog/global';
import { formatCatalogPrice, getCatalogPrice } from '../catalog/prices';
import { getRegionBundle } from '../catalog/regions';
import { homeDestinations } from '../home/designAssets';
import { findRegions, isSearchRegion, MAX_TRIP_COUNTRIES, searchableCountries, searchCountries, tripCountries } from '../home/smartSearch';
import { regionCountryCodes, type TripDestination } from '../home/tripSearch';
import { colors } from '../theme';
import { StyleSheet } from '../ui/design';
import { ScrollView } from '../ui/ScrollView';
import { Pressable, View } from '../ui/Surface';
import { Text, TextInput } from '../ui/Text';
import { CountryFlag } from './CountryFlag';
import { TripSearchCoverage } from './TripSearchExtras';
import { DestinationIcon, SearchButton, searchArtwork, searchRegions, searchSurfaces } from './TripSearchUI';

type QuickDestination = Exclude<TripDestination, { kind: 'countries' }>;
type SearchDestination = QuickDestination | { kind: 'region-countries'; category: CatalogCategory };
type Props = {
  countries: readonly CatalogEsim[];
  categories: readonly CatalogCategory[];
  selected: readonly CatalogEsim[];
  query: string;
  onQuery: (value: string) => void;
  onClear: () => void;
  onToggle: (country: CatalogEsim) => void;
  onChoose: (destination: TripDestination) => void;
  onOpenRegion: (category: CatalogCategory) => void;
  catalogStatus: 'loading' | 'ready' | 'error';
  onRetry: () => void;
  onSignIn: () => void;
};

const code = (country: CatalogEsim) => country.country_iso2?.toUpperCase() ?? '';
const titleKey = (title: string) => title.trim().toLocaleLowerCase('ru');

function CountryName({ name, query }: { name: string; query: string }) {
  const index = query ? titleKey(name).indexOf(titleKey(query)) : -1;
  if (index < 0) return <Text style={styles.rowTitle}>{name}</Text>;
  return <Text style={styles.rowTitle}>{name.slice(0, index)}<Text style={styles.match}>{name.slice(index, index + query.length)}</Text>{name.slice(index + query.length)}</Text>;
}

export function TripSearchDestinations({
  countries, categories, selected, query, onQuery, onClear, onToggle, onChoose, onOpenRegion, catalogStatus, onRetry, onSignIn,
}: Props) {
  const term = query.trim();
  const eligible = tripCountries(countries);
  const availableIds = new Set(eligible.map(country => country.id));
  const selectedIds = new Set(selected.map(country => country.id));
  const searchIndex = useMemo(() => searchableCountries(countries), [countries]);
  const matches = useMemo(() => term ? searchCountries(searchIndex, term) : [], [searchIndex, term]);
  const popularIds = new Map(eligible.map(country => [code(country), country]));
  const popular = [...new Map([...selected, ...homeDestinations.flatMap(destination => {
    const country = popularIds.get(destination.code);
    return country ? [country] : [];
  }), ...eligible].map(country => [country.id, country])).values()].slice(0, 8);

  const worldBundle = getGlobalBundle(categories);
  const world: QuickDestination | null = worldBundle ? { kind: 'world', esim: worldBundle } : null;
  const regions = categories.filter(isSearchRegion).map(category => {
    const esim = getRegionBundle(category);
    const artworkIndex = searchRegions.findIndex(region => titleKey(region.title) === titleKey(category.title));
    const destination: SearchDestination = esim ? { kind: 'region', category, esim } : { kind: 'region-countries', category };
    return { category, destination, codes: regionCountryCodes(category), artworkIndex };
  });
  const quickRegions = [...regions].sort((a, b) =>
    (a.artworkIndex < 0 ? searchRegions.length : a.artworkIndex) - (b.artworkIndex < 0 ? searchRegions.length : b.artworkIndex));
  const firstMatch = matches.find(match => availableIds.has(match.country.id))?.country;
  const directlyMatched = new Set(findRegions(categories, term));
  const regionMatches = term ? regions.flatMap(({ category, destination, codes }) => {
    const related = firstMatch && codes.has(code(firstMatch)) ? firstMatch : null;
    return directlyMatched.has(category) || related ? [{ destination, count: codes.size, related }] : [];
  }) : [];
  const worldMatches = /^(весь мир|мир|world|global)$/iu.test(term);
  const worldFallback = world && (worldMatches || (!firstMatch && !regionMatches.length));
  const canClear = !!query || !!selected.length;

  const toggleCountry = (country: CatalogEsim) => {
    if (!availableIds.has(country.id) && !selectedIds.has(country.id)) return;
    onToggle(country);
    if (!selectedIds.has(country.id)) onQuery('');
  };

  const choose = (destination: TripDestination | SearchDestination) => {
    Keyboard.dismiss();
    if (destination.kind === 'region-countries') onOpenRegion(destination.category);
    else onChoose(destination);
  };

  const countryRow = (country: CatalogEsim, reason: string | null, queryMatch: boolean) => {
    const active = selectedIds.has(country.id);
    const available = availableIds.has(country.id);
    const disabled = !active && (!available || selected.length >= MAX_TRIP_COUNTRIES);
    const price = getCatalogPrice(country);
    const caption = code(country) === 'RU' ? 'Используйте свою SIM дома'
      : !available ? catalogStatus === 'ready' ? 'Тарифы пока недоступны' : 'Проверяем доступность'
      : reason?.startsWith('Возможно') ? 'Может, вы искали эту страну'
      : (queryMatch ? country.network : null) || (price ? formatCatalogPrice(price) : reason);
    const canNotify = queryMatch && catalogStatus === 'ready' && !!code(country) && code(country) !== 'RU' && !available;
    return <View key={country.id}><Pressable onPress={() => toggleCountry(country)} disabled={disabled}
      accessibilityRole="button" accessibilityLabel={`${active ? 'Убрать' : 'Добавить'} ${country.display_name}`}
      accessibilityState={{ selected: active, disabled }} testID={`trip-country-${code(country)}`}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <CountryFlag country={country} shape="rectangle" />
      <View style={styles.rowCopy}>
        <CountryName name={country.display_name} query={queryMatch ? term : ''} />
        {!!caption && <Text style={styles.caption}>{caption}</Text>}
      </View>
      <View style={[styles.toggle, active && styles.activeToggle, disabled && styles.pressed]}>
        <Image source={active ? searchArtwork.check : searchArtwork.plus} style={styles.toggleIcon} accessible={false} />
      </View>
    </Pressable>{canNotify && <TripSearchCoverage country={country} onSignIn={onSignIn} />}</View>;
  };

  const regionRow = (destination: SearchDestination, subtitle: string) => {
    const title = destination.kind === 'world' ? 'Весь мир' : destination.category.title;
    const id = destination.kind === 'region-countries' ? title : destination.esim.id;
    return <Pressable key={title} onPress={() => choose(destination)} accessibilityRole="button"
      testID={`trip-suggestion-${id}`} style={({ pressed }) => [styles.row, styles.separator, pressed && styles.pressed]}>
      {destination.kind === 'region-countries'
        ? <Image source={searchArtwork.globe} style={styles.regionIcon} contentFit="contain" accessible={false} />
        : <DestinationIcon destination={destination} />}
      <View style={styles.rowCopy}>
        <CountryName name={title} query={term} />
        {!!subtitle && <Text style={styles.caption}>{subtitle}</Text>}
      </View>
      <Image source={searchArtwork.right} style={styles.arrow} accessible={false} />
    </Pressable>;
  };

  return <>
    <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} testID="trip-destinations">
      <View style={styles.field}>
        <Image source={searchArtwork.search} style={styles.searchIcon} accessible={false} />
        <View style={styles.chips}>
          {selected.map(country => <Pressable key={country.id} onPress={() => toggleCountry(country)} accessibilityRole="button"
            accessibilityLabel={`Убрать ${country.display_name}`} testID={`trip-remove-${code(country)}`} style={styles.chip}>
            <CountryFlag country={country} size={20} shape="rectangle" />
            <Text style={styles.chipLabel} numberOfLines={1}>{country.display_name}</Text>
            <Image source={searchArtwork.remove} style={styles.closeIcon} accessible={false} />
          </Pressable>)}
          <TextInput autoFocus autoCorrect={false} autoCapitalize="none" keyboardAppearance="dark" returnKeyType="search"
            value={query} onChangeText={onQuery} selectionColor={searchSurfaces.blue} placeholderTextColor={colors.mutedText}
            placeholder={selected.length ? 'Ещё страна' : 'Страна, город или регион'}
            accessibilityLabel="Страна, город или регион" style={[styles.input, selected.length === 0 && styles.emptyInput]}
            testID="trip-query" />
        </View>
        {canClear && <Pressable accessibilityRole="button" accessibilityLabel={query ? 'Очистить запрос' : 'Убрать все страны'}
          onPress={query ? () => onQuery('') : onClear} testID="trip-clear" style={styles.clear} hitSlop={6}>
          <Image source={searchArtwork.close} style={styles.closeIcon} accessible={false} />
        </Pressable>}
      </View>

      {!term && !selected.length && (world || quickRegions.length > 0) && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.rail} testID="trip-region-rail">
          {world && <Pressable onPress={() => choose(world)} accessibilityRole="button" testID="trip-quick-world"
            style={({ pressed }) => [styles.tile, styles.worldTile, pressed && styles.pressed]}>
            <Image source={searchArtwork.world} style={styles.worldArtwork} contentFit="contain" accessible={false} />
            <Image source={searchArtwork.globe} style={styles.globeArtwork} contentFit="contain" accessible={false} />
            <Text style={styles.tileTitle}>Весь мир</Text><Text style={styles.tileCaption}>Одна eSIM</Text>
          </Pressable>}
          {quickRegions.map(({ category, destination, codes, artworkIndex }) => {
            const artwork = searchRegions[artworkIndex]?.artwork ?? searchArtwork.globe;
            const id = destination.kind === 'region' ? destination.esim.id : category.title;
            return <Pressable key={category.title} onPress={() => choose(destination)} accessibilityRole="button"
              testID={`trip-quick-${id}`} style={({ pressed }) => [styles.tile, pressed && styles.pressed]}>
              <Image source={artwork} style={styles.tileArtwork} contentFit="contain" accessible={false} />
              <Text style={styles.tileTitle}>{category.title}</Text>
              {!!codes.size && <Text style={styles.tileCaption}>{countLabel(codes.size)}</Text>}
            </Pressable>;
          })}
        </ScrollView>
      )}

      {term ? <View style={styles.panel} testID="trip-query-results">
        {matches.slice(0, 10).map(({ country, reason }) => countryRow(country, reason, true))}
        {regionMatches.map(({ destination, count, related }) => regionRow(destination,
          [count ? countLabel(count) : '', related ? `${related.display_name} тоже входит` : ''].filter(Boolean).join(', ')))}
        {worldFallback && regionRow(world, 'Глобальная eSIM')}
        {!matches.length && !regionMatches.length && !worldFallback && catalogStatus === 'ready' && (
          <Text style={styles.message}>Ничего не нашли. Попробуйте изменить запрос.</Text>
        )}
      </View> : popular.length > 0 && <View style={styles.panel}>
        <Text style={styles.panelLabel}>Популярные</Text>
        {popular.map(country => countryRow(country, null, false))}
      </View>}

      {catalogStatus === 'loading' && <Text style={styles.message} accessibilityLiveRegion="polite">Загружаем направления…</Text>}
      {catalogStatus === 'error' && <View style={styles.catalogError}>
        <Text style={styles.caption}>Не удалось загрузить направления</Text>
        <SearchButton label="Повторить" onPress={onRetry} testID="trip-catalog-retry" />
      </View>}
    </ScrollView>
    {selected.length > 0 && <View style={styles.footer}>
      <SearchButton label="Дальше" testID="trip-next" onPress={() => choose({ kind: 'countries', countries: selected })} />
    </View>}
  </>;
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  field: { minHeight: 51, marginHorizontal: 16, marginTop: 16, paddingHorizontal: 13, paddingVertical: 11, flexDirection: 'row', alignItems: 'flex-start', gap: 9, borderRadius: 17, borderWidth: 1.5, borderColor: searchSurfaces.blue, backgroundColor: colors.surface },
  searchIcon: { width: 22, height: 22, marginTop: 2 },
  chips: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 6, rowGap: 5 },
  chip: { flexDirection: 'row', alignItems: 'center', minHeight: 28, gap: 5, paddingHorizontal: 5, borderRadius: 15, maxWidth: '100%', backgroundColor: colors.selectedTab },
  chipLabel: { color: colors.text, fontSize: 14, lineHeight: 20, flexShrink: 1 },
  input: { flexGrow: 1, flexBasis: 88, width: 88, minWidth: 60, height: 26, color: colors.text, fontSize: 16, lineHeight: 22, padding: 0, outlineWidth: 0 },
  emptyInput: { flexBasis: 0, width: 0, minWidth: 0 },
  clear: { width: 22, height: 22, marginTop: 2, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: '#4E4E51' },
  closeIcon: { width: 14, height: 14 },
  rail: { paddingHorizontal: 16, gap: 8, marginTop: 12 },
  tile: { minWidth: 120, height: 76, borderRadius: 16, paddingHorizontal: 12, paddingTop: 12, gap: 2, overflow: 'hidden', backgroundColor: searchSurfaces.panel },
  worldTile: { width: 132 },
  tileTitle: { color: colors.text, fontSize: 16, lineHeight: 22, fontWeight: '600' },
  tileCaption: { color: colors.mutedText, fontSize: 12, lineHeight: 16 },
  tileArtwork: { position: 'absolute', right: -12, top: 32, width: 70, height: 54 },
  worldArtwork: { position: 'absolute', left: 78, top: 30, width: 75, height: 70 },
  globeArtwork: { position: 'absolute', left: 84, top: 30, width: 58, height: 58 },
  panel: { marginTop: 12, marginHorizontal: 16, paddingVertical: 4, backgroundColor: searchSurfaces.panel, borderRadius: 24, cornerSmoothing: 1, overflow: 'hidden' },
  panelLabel: { paddingHorizontal: 16, marginTop: 8, fontSize: 14, lineHeight: 20, color: colors.mutedText },
  row: { minHeight: 62, paddingHorizontal: 16, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 12 },
  separator: { borderTopWidth: 1, borderTopColor: searchSurfaces.divider },
  regionIcon: { width: 41, height: 36, borderRadius: 12, backgroundColor: colors.selectedTab },
  rowCopy: { flex: 1, gap: 1 },
  rowTitle: { fontSize: 16, lineHeight: 22, fontWeight: '500', color: colors.text },
  match: { color: colors.accent },
  caption: { fontSize: 14, lineHeight: 20, color: colors.mutedText },
  arrow: { width: 16, height: 16 },
  toggle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#343437', alignItems: 'center', justifyContent: 'center' },
  activeToggle: { backgroundColor: searchSurfaces.blue },
  toggleIcon: { width: 18, height: 18 },
  message: { margin: 16, color: colors.mutedText, fontSize: 14, lineHeight: 20 },
  catalogError: { gap: 12, margin: 16, alignItems: 'flex-start' },
  footer: { marginHorizontal: 16, marginTop: 8, paddingBottom: 12 },
  pressed: { opacity: 0.7 },
});
