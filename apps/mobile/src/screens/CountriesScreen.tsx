import { Image } from 'expo-image';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootTabParamList } from '../navigation/tabs';
import { useEffect } from 'react';
import type { RootStackParamList } from '../navigation/stack';
import { useMemo, useRef, useState } from 'react';
import { Keyboard, Platform } from 'react-native';
import { ScrollView } from '../ui/ScrollView';
import { Pressable, View } from '../ui/Surface';
import { fonts, StyleSheet } from '../ui/design';
import { Text, TextInput } from '../ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getCountrySections } from '../catalog/catalog';
import { getGlobalBundle } from '../catalog/global';
import { getCatalogPrice } from '../catalog/prices';
import { CatalogWorldBanner } from '../components/CatalogWorldBanner';
import { CatalogCountries } from '../components/CatalogCountries';
import { CatalogRegions } from '../components/CatalogRegions';
import { CatalogStatus } from '../components/CatalogStatus';
import { WorldTariffsPanel } from '../components/WorldTariffsPanel';
import { useCatalogCategories } from '../hooks/useCatalogCategories';
import { colors, getTabBarBottom, tabBarLayout } from '../theme';

const categories = [
  { id: 'countries', label: 'Страны', width: 87 },
  { id: 'regions', label: 'Регионы', width: 94 },
  { id: 'world', label: 'Весь мир', width: 99 },
] as const;

type Category = (typeof categories)[number]['id'];

const assets = {
  sticker: require('../../assets/countries/heading-sticker.svg'),
  search: require('../../assets/countries/search.svg'),
};

export function CountriesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [query, setQuery] = useState('');
  const route = useRoute<RouteProp<RootTabParamList, 'Countries'>>();
  const [category, setCategory] = useState<Category>(route.params?.section ?? 'countries');
  useEffect(() => { if (route.params?.section) setCategory(route.params.section); }, [route.params?.section]);
  const catalog = useCatalogCategories();
  const globalBundle = catalog.state.status === 'ready'
    ? getGlobalBundle(catalog.state.categories)
    : null;
  const globalPrice = globalBundle ? getCatalogPrice(globalBundle) : null;
  const topInset = Platform.OS === 'web' ? 48 : insets.top;
  const bottomInset = getTabBarBottom(insets.bottom, Platform.OS === 'web');
  const isRegions = category === 'regions';
  const isWorld = category === 'world';
  const isCompact = isRegions || isWorld;
  const sections = useMemo(() => catalog.state.status === 'ready'
    ? getCountrySections(catalog.state.categories, query) : [], [catalog.state, query]);
  const selectCategory = (next: Category) => {
    setCategory(next);
    Keyboard.dismiss();
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  return (
    <View style={styles.screen} testID={isWorld ? 'screen-world' : 'screen-countries'}>
    <ScrollView
      ref={scrollRef}
      style={styles.screen}
      testID="directions-scroll"
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentInsetAdjustmentBehavior="never"
      contentContainerStyle={[
        styles.content,
        isCompact && styles.regionsContent,
        isWorld && styles.worldContent,
        {
          paddingTop: topInset + 12,
          paddingBottom: bottomInset + tabBarLayout.height + 16,
          paddingLeft: Math.max(insets.left, isCompact ? 12 : 16),
          paddingRight: Math.max(insets.right, isCompact ? 12 : 16),
        },
      ]}
    >
      <View style={[styles.heading, isCompact && styles.regionsHeading]} accessibilityRole="header" accessibilityLabel="Все направления">
        <Text style={styles.headingText}>Все</Text>
        <View style={styles.stickerFrame}>
          <View style={styles.sticker}>
            <Image source={assets.sticker} style={styles.stickerImage} contentFit="contain" accessible={false} />
            <Text
              testID="directions-heading-text"
              style={[styles.headingText, styles.stickerText]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
            >
              направления
            </Text>
          </View>
        </View>
      </View>

      {category === 'countries' && <View style={styles.search} testID="directions-search">
        <Image source={assets.search} style={styles.searchIcon} contentFit="contain" accessible={false} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Страна или регион"
          placeholderTextColor={colors.mutedText}
          selectionColor={colors.accent}
          accessibilityLabel="Страна или регион"
          testID="directions-search-input"
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          underlineColorAndroid="transparent"
          onSubmitEditing={() => Keyboard.dismiss()}
        />
      </View>}

      <View style={[styles.categories, isCompact && styles.regionsCategories]} testID="directions-categories">
        {categories.map((item) => {
          const selected = item.id === category;

          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              accessibilityState={{ selected }}
              aria-pressed={selected}
              testID={`category-${item.id}`}
              onPress={() => selectCategory(item.id)}
              style={({ pressed }) => [
                styles.category,
                { width: item.width },
                selected && styles.selectedCategory,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.categoryText, selected && styles.selectedCategoryText]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {category === 'countries' && <CatalogWorldBanner price={globalPrice} onPress={() => selectCategory('world')} />}
      {catalog.state.status !== 'ready' ? <CatalogStatus state={catalog.state} onRetry={catalog.reload} />
          : isWorld ? <WorldTariffsPanel key={globalBundle?.id ?? 'missing'} bundle={globalBundle} onReloadCatalog={catalog.reload} catalogState={catalog.state} />
          : isRegions ? <CatalogRegions categories={catalog.state.categories} onSelectCategory={(item) => navigation.navigate('RegionTariffs', { category: item })} />
          : <CatalogCountries
              sections={sections}
              query={query}
              onSelectCountry={(country) => { Keyboard.dismiss(); navigation.navigate('CountryTariffs', { country }); }}
            />}
    </ScrollView>
    </View>
  );
}

const fontFamily = fonts.text;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', gap: 16 },
  regionsContent: { gap: 12 },
  worldContent: { width: '100%' },
  regionsHeading: { paddingHorizontal: 12 },
  regionsCategories: { paddingHorizontal: 8 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headingText: {
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 38,
    fontWeight: '900',
    // Match SF Pro heading metrics when previewing on Linux/Windows.
    letterSpacing: Platform.OS === 'web' ? -0.35 : -0.6,
    color: colors.text,
    includeFontPadding: false,
  },
  stickerFrame: { width: 217.078, height: 49.639, alignItems: 'center', justifyContent: 'center' },
  sticker: { width: 216, height: 44, transform: [{ rotate: '1.5deg' }] },
  stickerImage: { position: 'absolute', width: 216, height: 44 },
  stickerText: { position: 'absolute', left: 12, top: 3, width: 192 },
  search: {
    width: '100%',
    height: 52,
    flexShrink: 0,
    backgroundColor: colors.selectedTab,
    borderRadius: 16, borderCurve: 'continuous',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 14,
    paddingRight: 16,
  },
  searchIcon: { width: 20, height: 20 },
  searchInput: {
    flex: 1,
    height: 22,
    borderWidth: 0,
    outlineWidth: 0,
    backgroundColor: 'transparent',
    textAlignVertical: 'center',
    minWidth: 0,
    padding: 0,
    fontFamily,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.064,
    color: colors.text,
    includeFontPadding: false,
  },
  categories: { flexDirection: 'row', gap: 8 },
  category: {
    height: 36,
    borderRadius: 18, borderCurve: 'continuous',
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 1,
  },
  selectedCategory: { backgroundColor: colors.text },
  categoryText: {
    fontFamily,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    letterSpacing: -0.056,
    color: colors.text,
    includeFontPadding: false,
  },
  selectedCategoryText: { color: colors.ink },
  pressed: { opacity: 0.8 },
});
