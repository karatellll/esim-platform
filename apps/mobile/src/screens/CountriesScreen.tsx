import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/stack';
import { useMemo, useRef, useState } from 'react';
import { Keyboard, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getCountrySections } from '../catalog/catalog';
import { getGlobalBundle } from '../catalog/global';
import { formatCatalogPrice, getCatalogPrice } from '../catalog/prices';
import { CatalogCountries } from '../components/CatalogCountries';
import { CatalogRegions } from '../components/CatalogRegions';
import { CatalogStatus } from '../components/CatalogStatus';
import { CountryAlphabet } from '../components/CountryAlphabet';
import { WorldTariffsPanel } from '../components/WorldTariffsPanel';
import { useCatalogCategories } from '../hooks/useCatalogCategories';
import { colors, tabBarLayout } from '../theme';

const categories = [
  { id: 'countries', label: 'Страны', width: 87 },
  { id: 'regions', label: 'Регионы', width: 94 },
  { id: 'world', label: 'Весь мир', width: 99 },
] as const;

type Category = (typeof categories)[number]['id'];

const assets = {
  sticker: require('../../assets/countries/heading-sticker.svg'),
  search: require('../../assets/countries/search.svg'),
  global: require('../../assets/countries/global.svg'),
  chevron: require('../../assets/countries/chevron.svg'),
};

export function CountriesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const listOffset = useRef(0);
  const sectionOffsets = useRef(new Map<string, number>());
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category>('countries');
  const catalog = useCatalogCategories();
  const globalBundle = catalog.state.status === 'ready'
    ? getGlobalBundle(catalog.state.categories)
    : null;
  const globalPrice = globalBundle ? getCatalogPrice(globalBundle) : null;
  const topInset = Platform.OS === 'web' ? 48 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 36 : Math.max(insets.bottom, 12) + 2;
  const isRegions = category === 'regions';
  const isWorld = category === 'world';
  const isCompact = isRegions || isWorld;
  const sections = useMemo(() => catalog.state.status === 'ready'
    ? getCountrySections(catalog.state.categories, query) : [], [catalog.state, query]);
  const letters = sections.map((section) => section.letter);
  const alphabetBottomGap = height < 700 ? 16 : 56;
  const minAlphabetHeight = letters.length * 13 + Math.max(0, letters.length - 1);
  const alphabetTop = Math.max(topInset + 70, Math.min(topInset + 252, height - bottomInset - tabBarLayout.height - alphabetBottomGap - minAlphabetHeight));
  const alphabetHeight = height - bottomInset - tabBarLayout.height - alphabetBottomGap - alphabetTop;

  const scrollToLetter = (letter: string) => {
    const sectionY = sectionOffsets.current.get(letter);
    if (sectionY !== undefined) scrollRef.current?.scrollTo({ y: Math.max(0, listOffset.current + sectionY - topInset - 12), animated: true });
  };

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
          paddingRight: Math.max(insets.right, isCompact ? 12 : 28),
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

      {category === 'countries' && <Pressable
        style={({ pressed }) => [styles.globalCard, pressed && styles.pressed]}
        testID="global-esim-button"
        accessibilityRole="button"
        accessibilityLabel="Одна eSIM на все поездки"
        accessibilityHint="Перейти на вкладку «Весь мир»"
        onPress={() => selectCategory('world')}
      >
        <View style={styles.globalIconCircle}>
          <Image source={assets.global} style={styles.globalIcon} contentFit="contain" accessible={false} />
        </View>
        <View style={styles.globalText}>
          <Text style={styles.globalTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
            Одна eSIM на все поездки
          </Text>
          <Text style={styles.globalSubtitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
            {globalPrice ? `Глобальный пакет · ${formatCatalogPrice(globalPrice)}` : 'Глобальный пакет'}
          </Text>
        </View>
        <Image source={assets.chevron} style={styles.chevron} contentFit="contain" accessible={false} />
      </Pressable>}
      {catalog.state.status !== 'ready' ? <CatalogStatus state={catalog.state} onRetry={catalog.reload} />
          : isWorld ? <WorldTariffsPanel key={globalBundle?.id ?? 'missing'} bundle={globalBundle} onReloadCatalog={catalog.reload} />
          : isRegions ? <CatalogRegions categories={catalog.state.categories} onSelectCategory={(item) => navigation.navigate('RegionTariffs', { category: item })} />
          : <CatalogCountries
              sections={sections}
              query={query}
              onSelectCountry={(country) => { Keyboard.dismiss(); navigation.navigate('CountryTariffs', { country }); }}
              onListLayout={(y) => { listOffset.current = y; }}
              onSectionLayout={(letter, y) => { sectionOffsets.current.set(letter, y); }}
            />}
    </ScrollView>
    {category === 'countries' && catalog.state.status === 'ready' && (
      <CountryAlphabet letters={letters} top={alphabetTop} maxHeight={alphabetHeight} onSelect={scrollToLetter} />
    )}
    </View>
  );
}

const fontFamily = Platform.select({ ios: 'System', android: 'sans-serif', default: 'system-ui' });

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { gap: 16 },
  regionsContent: { gap: 12 },
  worldContent: { width: '100%', maxWidth: 600, alignSelf: 'center' },
  regionsHeading: { paddingHorizontal: 12 },
  regionsCategories: { paddingHorizontal: 8 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headingText: {
    fontFamily: Platform.OS === 'web' ? 'Arial' : fontFamily,
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
    height: 52,
    backgroundColor: colors.selectedTab,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 14,
    paddingRight: 16,
  },
  searchIcon: { width: 20, height: 20 },
  searchInput: {
    flex: 1,
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
    borderRadius: 18,
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
  globalCard: {
    minHeight: 70,
    padding: 14,
    gap: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: colors.lime,
  },
  globalIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  globalIcon: { width: 22, height: 22 },
  globalText: { flex: 1, minWidth: 0 },
  globalTitle: {
    fontFamily,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
    letterSpacing: -0.064,
    color: colors.ink,
    includeFontPadding: false,
  },
  globalSubtitle: {
    fontFamily,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.056,
    color: colors.mutedInk,
    includeFontPadding: false,
  },
  chevron: { width: 20, height: 20 },
});
