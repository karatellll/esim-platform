import { Image } from 'expo-image';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootTabParamList } from '../navigation/tabs';
import type { RootStackParamList } from '../navigation/stack';
import { useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { ScrollView } from '../ui/ScrollView';
import { Pressable, View } from '../ui/Surface';
import { fonts, StyleSheet } from '../ui/design';
import { Text } from '../ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getCountrySections } from '../catalog/catalog';
import { getGlobalBundle } from '../catalog/global';
import { CatalogWorldBanner } from '../components/CatalogWorldBanner';
import { CatalogCountries } from '../components/CatalogCountries';
import { CatalogRegions } from '../components/CatalogRegions';
import { CatalogStatus } from '../components/CatalogStatus';
import { useCatalogCategories } from '../hooks/useCatalogCategories';
import { colors, getTabBarBottom, tabBarLayout } from '../theme';

const categories = [
  { id: 'countries', label: 'Страны', width: 87 },
  { id: 'regions', label: 'Регионы', width: 94 },
] as const;

type Category = (typeof categories)[number]['id'];

const searchIcon = require('../../assets/home-v3/search.svg');
const searchLabel = 'Страна, город или регион';

export function CountriesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const route = useRoute<RouteProp<RootTabParamList, 'Countries'>>();
  const [category, setCategory] = useState<Category>(route.params?.section ?? 'countries');
  useEffect(() => { if (route.params?.section) setCategory(route.params.section); }, [route.params?.section]);
  const catalog = useCatalogCategories();
  const globalBundle = catalog.state.status === 'ready'
    ? getGlobalBundle(catalog.state.categories)
    : null;
  const topInset = Platform.OS === 'web' ? 48 : insets.top;
  const bottomInset = getTabBarBottom(insets.bottom, Platform.OS === 'web');
  const isRegions = category === 'regions';
  const sections = useMemo(() => catalog.state.status === 'ready'
    ? getCountrySections(catalog.state.categories) : [], [catalog.state]);

  return (
    <View style={styles.screen} testID="screen-countries">
    <ScrollView
      style={styles.screen}
      testID="directions-scroll"
      contentInsetAdjustmentBehavior="never"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: topInset + 12,
          paddingBottom: bottomInset + tabBarLayout.height + 16,
          paddingLeft: Math.max(insets.left, 12),
          paddingRight: Math.max(insets.right, 12),
        },
      ]}
    >
      <Pressable style={({ pressed }) => [styles.search, pressed && styles.pressed]}
        onPress={() => navigation.navigate('TripSearch')} accessibilityRole="button" accessibilityLabel={searchLabel} testID="directions-search">
        <Image source={searchIcon} style={styles.searchIcon} contentFit="contain" accessible={false} />
        <Text style={styles.searchText} numberOfLines={1}>{searchLabel}</Text>
      </Pressable>

      <View style={styles.categories} testID="directions-categories">
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
              onPress={() => setCategory(item.id)}
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

      <CatalogWorldBanner onPress={() => navigation.navigate('WorldTariffs', { bundle: globalBundle })} />
      {catalog.state.status !== 'ready' ? <CatalogStatus state={catalog.state} onRetry={catalog.reload} title={isRegions ? 'Регионы не загрузились' : undefined} />
          : isRegions ? <CatalogRegions categories={catalog.state.categories} onSelectCategory={(item) => navigation.navigate('RegionTariffs', { category: item })} />
          : <CatalogCountries sections={sections} onSelectCountry={(country) => navigation.navigate('CountryTariffs', { country })} />}
    </ScrollView>
    </View>
  );
}

const fontFamily = fonts.text;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', gap: 12 },
  search: {
    height: 52,
    flexShrink: 0,
    backgroundColor: colors.surface,
    borderRadius: 16, borderCurve: 'continuous',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 14,
    paddingRight: 16,
  },
  searchIcon: { width: 24, height: 24 },
  searchText: {
    flex: 1,
    minWidth: 0,
    fontFamily,
    fontSize: 16,
    lineHeight: 24,
    color: 'rgba(255,255,255,0.4)',
    includeFontPadding: false,
  },
  categories: { flexDirection: 'row', gap: 8 },
  category: {
    height: 36,
    borderRadius: 18, borderCurve: 'continuous',
    backgroundColor: 'rgba(38,38,41,0.5)',
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
    color: 'rgba(255,255,255,0.4)',
    includeFontPadding: false,
  },
  selectedCategoryText: { color: colors.ink },
  pressed: { opacity: 0.8 },
});
