import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useNavigation, type CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { useMemo } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { CatalogCategory, CatalogEsim } from '../../../../packages/shared/contracts/catalog';
import { countLabel, getCountries } from '../catalog/catalog';
import { getGlobalBundle } from '../catalog/global';
import { formatCatalogPrice, getCatalogPrice } from '../catalog/prices';
import { ServiceState } from '../components/ServiceState';
import { SkeletonBlock, SkeletonGroup } from '../components/Skeleton';
import { useOnline } from '../service/connectivity';
import { HomeDesignLabel } from '../components/HomeDesignLabel';
import { homeDesignAssets as assets, homeDestinations, homeRegions } from '../home/designAssets';
import { homeLabels } from '../home/textAssets';
import { getPricePerGigabyte } from '../home/recommendation';
import { useCatalogCategories } from '../hooks/useCatalogCategories';
import { useCatalogTariffs } from '../hooks/useCatalogTariffs';
import type { RootStackParamList } from '../navigation/stack';
import type { RootTabParamList } from '../navigation/tabs';
import { colors, getTabBarBottom, tabBarLayout } from '../theme';
import { ScrollView } from '../ui/ScrollView';
import { Pressable, View } from '../ui/Surface';
import { fonts, StyleSheet } from '../ui/design';
import { Text } from '../ui/Text';

type Navigation = CompositeNavigationProp<BottomTabNavigationProp<RootTabParamList>, NativeStackNavigationProp<RootStackParamList>>;
const popularFlagSize = { width: 41, height: 32 } as const;

function PopularCountry({ destination, country, loading, onPress }: {
  destination: (typeof homeDestinations)[number]; country?: CatalogEsim; loading: boolean; onPress: () => void;
}) {
  const tariffs = useCatalogTariffs(country?.id ?? null, true);
  const pricePerGb = country && tariffs.state.status === 'ready' && tariffs.state.data.esim.id === country.id
    ? getPricePerGigabyte(tariffs.state.data.tariffs) : null;
  const price = pricePerGb ? `${formatCatalogPrice(pricePerGb)} за\u00a0ГБ`
    : loading || (country && tariffs.state.status === 'loading') ? null
      : country ? formatCatalogPrice(getCatalogPrice(country)) : '—';
  const label = { TR: homeLabels['country-tr'], AE: homeLabels['country-ae'], TH: homeLabels['country-th'], GE: null, JP: null }[destination.code];
  return <Pressable onPress={onPress}
    style={({ pressed }) => [styles.countryCard, pressed && styles.pressed]}
    accessibilityRole="button" accessibilityLabel={`${destination.name}, ${price ?? 'цена загружается'}`} testID={`home-country-${destination.code}`}>
    {destination.flag
      ? <Image source={destination.flag} style={popularFlagSize} contentFit="contain" accessible={false} />
      : <View style={styles.popularFlag} accessible={false} testID={`home-flag-${destination.code}`}>
        <View style={styles.japanDot} />
      </View>}
    <View>
      {label ? <HomeDesignLabel artwork={label} /> : <Text style={styles.countryName} numberOfLines={1}>{destination.name}</Text>}
      {price === null ? <SkeletonGroup style={styles.priceSkeletonRow}>
        <SkeletonBlock style={styles.priceSkeleton} />
      </SkeletonGroup> : <Text style={styles.price} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} testID={`home-price-${destination.code}`}>{price}</Text>}
    </View>
  </Pressable>;
}

export function HomeScreen() {
  const navigation = useNavigation<Navigation>();
  const online = useOnline();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const catalog = useCatalogCategories();
  const categories = catalog.state.status === 'ready' ? catalog.state.categories : null;
  const countries = useMemo(() => categories ? getCountries(categories) : [], [categories]);
  const top = insets.top;
  const bottom = getTabBarBottom(insets.bottom, Platform.OS === 'web');
  const contentWidth = width - insets.left - insets.right;
  const bannerScale = Math.max(0.1, (contentWidth - 24) / 351);

  const openSearch = () => navigation.navigate('TripSearch');
  const openTariffs = (country: CatalogEsim) => navigation.navigate('CountryTariffs', { country });
  const openWorld = () => {
    const bundle = categories ? getGlobalBundle(categories) : null;
    navigation.navigate('WorldTariffs', { bundle });
  };
  const openRegion = (category?: CatalogCategory) => {
    if (category) navigation.navigate('RegionTariffs', { category });
    else navigation.navigate('Countries', { section: 'regions' });
  };

  if (online && catalog.state.status === 'error' && (catalog.state.httpStatus === 500 || catalog.state.httpStatus === 502)) {
    return <ServiceState kind="server" primary={{ label: 'Повторить', onPress: catalog.reload }}
      secondary={{ label: 'Написать в поддержку', onPress: () => navigation.navigate('Help') }} />;
  }

  return <View style={styles.screen} testID="screen-home">
    <ScrollView style={styles.screen} showsVerticalScrollIndicator={false} contentInsetAdjustmentBehavior="never" testID="home-scroll"
      contentContainerStyle={[styles.content, { paddingTop: top + 24, paddingBottom: bottom + tabBarLayout.height + 24, paddingLeft: insets.left, paddingRight: insets.right }]}>
      <View style={styles.hero} accessibilityRole="header" accessibilityLabel="Тут берут интернет по лучшим ценам" testID="home-hero">
        <Image source={assets.heroTitle} style={styles.heroTitleArtwork} contentFit="contain" accessible={false} />
        <Image source={assets.heroPrefix} style={styles.heroPrefixArtwork} contentFit="contain" accessible={false} />
          <View style={styles.stickerSlot}>
            <View style={styles.sticker}>
              <Image source={assets.sticker} style={styles.stickerImage} contentFit="contain" accessible={false} />
            </View>
          </View>
        <Image source={assets.heroBest} style={styles.heroBestArtwork} contentFit="contain" accessible={false} />
        <Image source={assets.heroPrices} style={styles.heroPricesArtwork} contentFit="contain" accessible={false} />
      </View>

      <View style={styles.destinations}>
        <Pressable style={({ pressed }) => [styles.search, pressed && styles.pressed]} onPress={openSearch}
          accessibilityRole="button" accessibilityLabel="Страна, город или регион" testID="home-destination">
          <Image source={assets.search} style={styles.searchIcon} contentFit="contain" accessible={false} />
          <HomeDesignLabel artwork={homeLabels['search-placeholder']} style={{ flex: 1, width: 0 }} />
        </Pressable>

        <View style={styles.regionTiles} testID="home-region-tiles">
          <Pressable style={({ pressed }) => [styles.world, pressed && styles.pressed]} onPress={openWorld}
            accessibilityRole="button" accessibilityLabel="Весь мир. 120+ стран, одна eSIM" testID="home-world">
            <Image source={assets.world} style={styles.worldImage} contentFit="contain" accessible={false} />
            <HomeDesignLabel artwork={homeLabels['world-title']} />
            <HomeDesignLabel artwork={homeLabels['world-subtitle']} />
            <Image source={assets.worldOverlay} style={styles.worldOverlay} contentFit="cover" accessible={false} />
          </Pressable>
          <View style={styles.regions}>
            {homeRegions.map(region => {
              const category = categories?.find(item => item.title.trim().toLocaleLowerCase('ru') === region.title.toLocaleLowerCase('ru'));
              const countryCount = category ? countLabel(getCountries([category]).length) : null;
              const isAfrica = region.key === 'africa';
              return <Pressable key={region.key} style={({ pressed }) => [styles.region, pressed && styles.pressed]}
                onPress={() => openRegion(category)} accessibilityRole="button"
                accessibilityLabel={countryCount ? `${region.title}. ${countryCount}` : region.title} testID={`home-region-${region.key}`}>
                <Image source={region.image} style={isAfrica ? styles.africaImage : [styles.regionImage, region.key === 'asia' && styles.asiaImage]}
                  contentFit={isAfrica ? 'contain' : 'cover'} accessible={false} />
                {isAfrica
                  ? <Text style={styles.countryName} numberOfLines={1}>{region.title}</Text>
                  : <HomeDesignLabel artwork={homeLabels[`${region.key}-title`]} />}
                {countryCount && <Text style={styles.regionCount} numberOfLines={1} testID={`home-region-count-${region.key}`}>{countryCount}</Text>}
              </Pressable>;
            })}
          </View>
        </View>
      </View>

      <View style={styles.popular} testID="home-popular">
        <View style={styles.popularHeading} accessibilityRole="header" accessibilityLabel="Куда летят сейчас">
          <Image source={assets.popularTitle} style={styles.popularTitle} contentFit="contain" accessible={false} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.countryRail} testID="home-country-rail">
          {homeDestinations.map(destination => {
            const country = countries.find(item => item.country_iso2?.toUpperCase() === destination.code);
            return <PopularCountry key={destination.code} destination={destination} country={country} loading={catalog.state.status === 'loading'} onPress={() => country ? openTariffs(country) : openSearch()} />;
          })}
        </ScrollView>
      </View>

      <Pressable onPress={() => navigation.navigate('Savings')} accessibilityRole="button" accessibilityLabel="Копите на интернет. 5% с каждой eSIM — рублями в копилку"
        testID="home-savings-banner" style={({ pressed }) => [styles.banner, { height: 168 * bannerScale }, pressed && styles.pressed]}>
        <View pointerEvents="none" style={[styles.bannerArtwork, { transform: [{ scale: bannerScale }], transformOrigin: 'top left' }]}>
          <Text style={styles.savingsTitle}>{'Копите\nна\u00a0интернет'}</Text>
          <Text style={styles.savingsSubtitle}>{'5% с\u00a0каждой eSIM —\nрублями в\u00a0копилку'}</Text>
          <View style={styles.coinScene}>
            {[[34, 155.56], [38, 142.56], [31, 129.56], [39, 116.56], [33, 103.56], [37, 90.56]].map(([left, top], index) =>
              <Image key={index} source={assets.coinStack} style={[styles.stackCoin, { left, top }]} contentFit="contain" accessible={false} />)}
            <View style={styles.largeCoinSlot}><Image source={assets.coinLarge} style={styles.floatingLarge} contentFit="contain" accessible={false} /></View>
            <View style={styles.smallCoinSlot}><Image source={assets.coinSmall} style={styles.floatingSmall} contentFit="contain" accessible={false} /></View>
            <View style={styles.bonusSlot}><View style={styles.bonusSticker}><Text style={styles.bonusText}>+5%</Text></View></View>
          </View>
        </View>
      </Pressable>

      {online && catalog.state.status === 'error' && <Pressable onPress={catalog.reload} accessibilityRole="button" testID="home-catalog-retry" style={styles.error}>
        <Text style={styles.errorText}>{catalog.state.message}</Text><Text style={styles.retry}>Повторить</Text>
      </Pressable>}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%' },
  hero: { alignSelf: 'center', width: 290.102783203125, height: 87.72822570800781 },
  heroTitleArtwork: { position: 'absolute', top: 7.79296875, left: 5.8720703125, width: 279, height: 29 },
  heroPrefixArtwork: { position: 'absolute', top: 58.53111267089844, left: 1.3916015625, width: 34, height: 17 },
  heroBestArtwork: { position: 'absolute', top: 57.36878967285156, left: 56.6123046875, width: 117, height: 25 },
  heroPricesArtwork: { position: 'absolute', top: 58.53111267089844, left: 197.494140625, width: 91, height: 21 },
  stickerSlot: { position: 'absolute', left: 44, top: 40, width: 144.102783203125, height: 47.72822570800781, alignItems: 'center', justifyContent: 'center' },
  sticker: { width: 143, height: 44, transform: [{ rotate: '1.5deg' }] },
  stickerImage: { position: 'absolute', width: 143, height: 44 },
  destinations: { marginHorizontal: 12, marginTop: 16, gap: 24 },
  search: { height: 64, flexDirection: 'row', alignItems: 'center', paddingLeft: 18, paddingRight: 16, gap: 12, borderRadius: 20, cornerSmoothing: 1, backgroundColor: colors.surface },
  searchIcon: { width: 24, height: 24 },
  regionTiles: { gap: 8 },
  world: { height: 120, borderRadius: 20, cornerSmoothing: 1, backgroundColor: 'rgba(38,38,41,0.5)', overflow: 'hidden', padding: 14, gap: 2 },
  worldImage: { position: 'absolute', right: -30, top: 6.27, width: 206, height: 192 },
  worldOverlay: { position: 'absolute', right: -9.901, top: 9.27, width: 172.891, height: 158 },
  regions: { flexDirection: 'row', gap: 8 },
  region: { flex: 1, minWidth: 0, height: 132, borderRadius: 20, cornerSmoothing: 1, backgroundColor: 'rgba(38,38,41,0.5)', overflow: 'hidden', padding: 14, gap: 2 },
  regionImage: { position: 'absolute', right: -24, top: 58.11, width: 120, height: 91.886 },
  asiaImage: { top: 57.93, height: 92.069 },
  africaImage: { position: 'absolute', bottom: -14, left: 0, width: '100%', height: 112 },
  regionCount: { fontSize: 12, lineHeight: 16, color: colors.mutedText },
  popular: { marginTop: 24, gap: 12 },
  popularHeading: { height: 26, paddingLeft: 20 },
  popularTitle: { position: 'absolute', left: 21.162109375, top: 4.453125, width: 182, height: 20 },
  countryRail: { paddingHorizontal: 12, gap: 8 },
  countryCard: { width: 124, height: 112, padding: 14, gap: 12, backgroundColor: 'rgba(38,38,41,0.5)', borderRadius: 20, cornerSmoothing: 1 },
  popularFlag: { ...popularFlagSize, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, overflow: 'hidden' },
  japanDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#BC002D' },
  countryName: { fontSize: 16, lineHeight: 22, fontWeight: '600', letterSpacing: -0.064, color: colors.text },
  price: { fontSize: 12, lineHeight: 18, letterSpacing: -0.048, color: colors.mutedText },
  priceSkeletonRow: { height: 18, justifyContent: 'center' },
  priceSkeleton: { width: 72, height: 10 },
  banner: { marginHorizontal: 12, marginTop: 24, borderRadius: 24, overflow: 'hidden', backgroundColor: colors.lime },
  bannerArtwork: { width: 351, height: 168 },
  savingsTitle: { position: 'absolute', left: 18, top: 22, fontFamily: fonts.accent, fontSize: 40, lineHeight: 40, letterSpacing: -1.2, color: colors.ink },
  savingsSubtitle: { position: 'absolute', left: 18, top: 110, fontSize: 14, lineHeight: 20, fontWeight: '600', letterSpacing: -0.056, color: colors.ink, opacity: 0.8 },
  coinScene: { position: 'absolute', left: 199, top: 0, width: 160, height: 200 },
  stackCoin: { position: 'absolute', width: 104, height: 50.44 },
  largeCoinSlot: { position: 'absolute', left: 28, top: -17.22, width: 68.565, height: 52.003, alignItems: 'center', justifyContent: 'center' },
  floatingLarge: { width: 62, height: 29.32, transform: [{ rotate: '-24deg' }] },
  smallCoinSlot: { position: 'absolute', left: 94.22, top: 30, width: 48.633, height: 39.057, alignItems: 'center', justifyContent: 'center' },
  floatingSmall: { width: 44, height: 20.84, transform: [{ rotate: '28deg' }] },
  bonusSlot: { position: 'absolute', left: 91.96, top: 78, width: 59.491, height: 36.511, alignItems: 'center', justifyContent: 'center' },
  bonusSticker: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: '#121214', transform: [{ rotate: '8deg' }] },
  bonusText: { fontFamily: fonts.accent, fontSize: 16, color: colors.lime },
  error: { marginHorizontal: 20, marginTop: 16, gap: 8 },
  errorText: { fontSize: 12, lineHeight: 18, color: colors.mutedText },
  retry: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.accent },
  pressed: { opacity: 0.75 },
});
