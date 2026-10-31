import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useNavigation, type CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { ScrollView } from '../ui/ScrollView';
import { Pressable, View } from '../ui/Surface';
import { fonts, StyleSheet } from '../ui/design';
import { Text } from '../ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { CatalogEsim } from '../../../../packages/shared/contracts/catalog';
import { getCountries } from '../catalog/catalog';
import { formatCatalogPrice, getCatalogPrice } from '../catalog/prices';
import { CountryFlag } from '../components/CountryFlag';
import { HomeSearchSheet, type HomeSearchStep } from '../components/HomeSearchSheet';
import { SkeletonBlock, SkeletonGroup } from '../components/Skeleton';
import { PopularCountriesSkeleton } from '../components/SkeletonLayouts';
import { homeAssets, popularDestinations } from '../home/assets';
import { toggleTripCountry } from '../home/smartSearch';
import { getPricePerGigabyte, getTripPreferences, type TripPreferences } from '../home/recommendation';
import { useCatalogCategories } from '../hooks/useCatalogCategories';
import { useCatalogTariffs } from '../hooks/useCatalogTariffs';
import { useSkeletonGate } from '../hooks/useSkeletonGate';
import type { RootStackParamList } from '../navigation/stack';
import type { RootTabParamList } from '../navigation/tabs';
import { colors, getTabBarBottom, tabBarLayout } from '../theme';

type Navigation = CompositeNavigationProp<BottomTabNavigationProp<RootTabParamList>, NativeStackNavigationProp<RootStackParamList>>;

function PopularCountry({ destination, country, loading, onPress }: {
  destination: (typeof popularDestinations)[number]; country?: CatalogEsim; loading: boolean; onPress: () => void;
}) {
  const tariffs = useCatalogTariffs(country?.id ?? null);
  const pricePerGb = tariffs.state.status === 'ready' ? getPricePerGigabyte(tariffs.state.data.tariffs) : null;
  const price = pricePerGb ? `${formatCatalogPrice(pricePerGb)} за ГБ`
    : country ? formatCatalogPrice(getCatalogPrice(country)) : loading ? '…' : '—';
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.countryCard, pressed && styles.pressed]}
    accessibilityRole="button" accessibilityLabel={`${destination.name}, ${price}`} testID={`home-country-${destination.code}`}>
    {destination.flag
      ? <Image source={destination.flag} style={styles.flag} contentFit="contain" accessible={false} />
      : country ? <CountryFlag country={country} size={32} /> : <View style={[styles.flag, styles.flagFallback]}><Text style={styles.price}>{destination.code}</Text></View>}
    <View>
      <Text style={styles.countryName} numberOfLines={1}>{country?.display_name ?? destination.name}</Text>
      <Text style={styles.price} numberOfLines={1} testID={`home-price-${destination.code}`}>{price}</Text>
    </View>
  </Pressable>;
}

export function HomeScreen() {
  const navigation = useNavigation<Navigation>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const catalog = useCatalogCategories();
  const catalogSkeleton = useSkeletonGate(catalog.state.status === 'loading');
  const countries = useMemo(() => catalog.state.status === 'ready' ? getCountries(catalog.state.categories) : [], [catalog.state]);
  const [countrySelection, setCountrySelection] = useState<CatalogEsim | null>(null);
  const [selectedCountries, setSelectedCountries] = useState<CatalogEsim[]>([]);
  const toggleCountry = (country: CatalogEsim) => {
    const next = toggleTripCountry(selectedCountries, country);
    setSelectedCountries(next); setCountrySelection(next[0] ?? null);
  };
  const [days, setDays] = useState<number | null>(null);
  const [usage, setUsage] = useState<number | null>(null);
  const [step, setStep] = useState<HomeSearchStep | null>(null);
  const selectedCountry = countries.find((country) => country.id === countrySelection?.id) ?? null;
  const top = Platform.OS === 'web' ? 48 : insets.top;
  const bottom = getTabBarBottom(insets.bottom, Platform.OS === 'web');
  const contentWidth = width - insets.left - insets.right;
  const bannerScale = Math.max(0.7, (contentWidth - 24) / 351);
  const durationLabel = days === 7 ? 'До недели' : days === 15 ? 'Две недели' : days === 30 ? 'Месяц' : days === 31 ? 'Больше месяца' : 'Срок поездки';
  const usageLabel = usage ? `Около ${usage} ГБ в неделю` : 'Для чего интернет';

  const openTariffs = (country: CatalogEsim, preferences: TripPreferences = getTripPreferences(days, usage)) => {
    setStep(null);
    navigation.navigate('CountryTariffs', {
      country,
      ...preferences,
    });
  };

  return <View style={styles.screen} testID="screen-home">
    <ScrollView style={styles.screen} showsVerticalScrollIndicator={false} contentInsetAdjustmentBehavior="never" testID="home-scroll"
      contentContainerStyle={[styles.content, { paddingTop: top + 24, paddingBottom: bottom + tabBarLayout.height + 19, paddingLeft: insets.left, paddingRight: insets.right }]}>
      <View style={styles.hero} accessibilityRole="header" accessibilityLabel="Тут берут интернет в любую страну" testID="home-hero">
        <Image source={homeAssets.signal} style={styles.signal} contentFit="contain" accessible={false} />
        <View style={styles.heroHeading}>
          <Image source={homeAssets.heroTitle} style={styles.heroTitle} contentFit="contain" accessible={false} />
          <Image source={homeAssets.heroPrefix} style={styles.heroPrefix} contentFit="contain" accessible={false} />
          <Image source={homeAssets.sticker} style={styles.sticker} contentFit="contain" accessible={false} />
          <Image source={homeAssets.heroCountry} style={styles.heroCountry} contentFit="contain" accessible={false} />
        </View>
      </View>

      <View style={styles.form} testID="home-search-form">
        <Pressable style={({ pressed }) => [styles.field, pressed && styles.pressed]} onPress={() => setStep('country')}
          accessibilityRole="button" accessibilityLabel={selectedCountry ? `Куда летите? ${selectedCountry.display_name}` : 'Куда летите?'} testID="home-destination">
          <Image source={homeAssets.search} style={styles.icon} contentFit="contain" accessible={false} />
          {!selectedCountry && <View style={styles.cursor} />}
          <Text style={[styles.fieldText, !!selectedCountry && styles.fieldSelected]} numberOfLines={1}>{selectedCountries.length > 1 ? `${selectedCountries.length} страны` : selectedCountry?.display_name ?? selectedCountries[0]?.display_name ?? 'Куда летите?'}</Text>
        </Pressable>
        <Pressable style={({ pressed }) => [styles.field, pressed && styles.pressed]} onPress={() => setStep('duration')}
          accessibilityRole="button" accessibilityLabel={`Срок поездки${days ? `: ${durationLabel}` : ''}`} testID="home-duration">
          <Image source={homeAssets.calendar} style={styles.icon} contentFit="contain" accessible={false} />
          <Text style={[styles.fieldText, !!days && styles.fieldSelected]}>{durationLabel}</Text>
        </Pressable>
        <Pressable style={({ pressed }) => [styles.field, pressed && styles.pressed]} onPress={() => setStep('usage')}
          accessibilityRole="button" accessibilityLabel={`Для чего интернет${usage ? `: ${usageLabel}` : ''}`} testID="home-usage">
          <Image source={homeAssets.wifi} style={styles.icon} contentFit="contain" accessible={false} />
          <Text style={[styles.fieldText, !!usage && styles.fieldSelected]} numberOfLines={1}>{usageLabel}</Text>
        </Pressable>
        <Pressable style={({ pressed }) => [styles.submit, pressed && styles.pressed]} onPress={() => setStep(selectedCountries.length ? 'route' : 'country')}
          accessibilityRole="button" testID="home-find-esim"><Text style={styles.submitText}>Подобрать eSIM</Text></Pressable>
      </View>

      <View style={styles.popular} testID="home-popular">
        <View style={[styles.popularHeader, contentWidth < 350 && styles.compactHeader]}>
          <View accessibilityRole="header" accessibilityLabel="Куда летят сейчас" style={styles.popularTitleSlot}>
            <Image source={homeAssets.popularTitle} style={styles.popularTitle} contentFit="contain" accessible={false} />
          </View>
          <Pressable onPress={() => navigation.navigate('Countries')} style={({ pressed }) => [styles.allCountries, pressed && styles.pressed]}
            accessibilityRole="button" testID="home-all-countries"><Text style={styles.allCountriesText}>Все страны</Text><Image source={homeAssets.chevron} style={styles.chevron} contentFit="contain" accessible={false} /></Pressable>
        </View>
        {catalog.state.status === 'loading' ? catalogSkeleton.visible ? <PopularCountriesSkeleton /> : null : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.countryRail} testID="home-country-rail">
          {popularDestinations.map((destination) => {
            const country = countries.find((item) => item.country_iso2?.toUpperCase() === destination.code);
            return <PopularCountry key={destination.code} destination={destination} country={country} loading={catalog.state.status === 'loading'} onPress={() => country ? openTariffs(country) : setStep('country')} />;
          })}
        </ScrollView>}
      </View>
      {catalog.state.status === 'error' && <Pressable onPress={catalog.reload} accessibilityRole="button" testID="home-catalog-retry" style={styles.error}>
        <Text style={styles.errorText}>{catalog.state.message}</Text><Text style={styles.retry}>Повторить</Text>
      </Pressable>}

      {catalog.state.status === 'loading' ? catalogSkeleton.visible ? <SkeletonGroup style={[styles.banner, { height: 168 * bannerScale, backgroundColor: colors.surface }]}><View style={{ padding: 20, gap: 10 }}><SkeletonBlock style={{ width: '63%', height: 20 }} /><SkeletonBlock style={{ width: '45%', height: 12 }} /></View></SkeletonGroup> : null : <Pressable onPress={() => navigation.navigate('Savings')} accessibilityRole="button" accessibilityLabel="Копите на интернет. 5% с каждой eSIM — рублями в копилку"
        testID="home-savings-banner" style={({ pressed }) => [styles.banner, { height: 168 * bannerScale }, pressed && styles.pressed]}>
        <View pointerEvents="none" style={[styles.bannerArtwork, { transform: [{ scale: bannerScale }], transformOrigin: 'top left' }]}>
          <Image source={homeAssets.savingsTitle} style={styles.savingsTitle} contentFit="contain" accessible={false} />
          <Text style={styles.savingsSubtitle}>{'5% с каждой eSIM —\nрублями в копилку'}</Text>
          <View style={styles.coinScene}>
            {[ [34, 155.56], [38, 142.56], [31, 129.56], [39, 116.56], [33, 103.56], [37, 90.56] ].map(([left, top], index) =>
              <Image key={index} source={homeAssets.coinStack} style={[styles.stackCoin, { left, top }]} contentFit="contain" accessible={false} />)}
            <Image source={homeAssets.coinFloatingLarge} style={styles.floatingLarge} contentFit="contain" accessible={false} />
            <Image source={homeAssets.coinFloatingSmall} style={styles.floatingSmall} contentFit="contain" accessible={false} />
            <View style={styles.bonusSticker}><Text style={styles.bonusText}>+5%</Text></View>
          </View>
        </View>
      </Pressable>}
    </ScrollView>
    <HomeSearchSheet step={step} onStepChange={setStep} onClose={() => setStep(null)} catalog={catalog} countries={countries}
      selectedCountry={selectedCountry} days={days} onSelectDays={setDays} usage={usage} onSelectUsage={setUsage}
      onFind={(country, category, preferences) => {
        if (category) { setStep(null); navigation.navigate('RegionTariffs', { category, ...preferences }); }
        else if (country?.country_iso2 === 'XG') { setStep(null); navigation.navigate('WorldTariffs', { bundle: country, ...preferences }); }
        else if (country) openTariffs(country, preferences);
        else if (selectedCountry) openTariffs(selectedCountry);
        else setStep('country');
      }} selectedCountries={selectedCountries} onToggleCountry={toggleCountry} onSignIn={() => { setStep(null); navigation.navigate('EmailSignIn'); }} onExisting={id => { setStep(null); navigation.navigate('OrderStatus', { orderId: id, details: true }); }} onBrowse={section => { setStep(null); navigation.navigate('Countries', { section }); }} onClearCountries={() => { setSelectedCountries([]); setCountrySelection(null); }} />
  </View>;
}

const fontFamily = fonts.text;
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%' },
  hero: { width: 280, height: 125.283218, alignSelf: 'center', alignItems: 'center' },
  signal: { width: 32, height: 32 },
  heroHeading: { width: 280, height: 87.283218, marginTop: 6 },
  // Native exports trim transparent text margins. Positions use the original
  // layer's render bounds, preserving the Figma letterforms on every platform.
  heroTitle: { position: 'absolute', left: 0.8203125, top: 7.792969, width: 279, height: 29 },
  heroPrefix: { position: 'absolute', left: 11.336914, top: 52.43457, width: 123, height: 29 },
  sticker: { position: 'absolute', left: 142.944894, top: 40, width: 128, height: 48 },
  heroCountry: { position: 'absolute', left: 155.967773, top: 56.99881, width: 102, height: 25 },
  form: { marginTop: 39.716782, marginHorizontal: 12, padding: 12, gap: 8, borderRadius: 24, borderCurve: 'continuous', backgroundColor: colors.surface },
  field: { height: 52, flexDirection: 'row', alignItems: 'center', paddingLeft: 14, paddingRight: 16, gap: 10, borderRadius: 16, borderCurve: 'continuous', backgroundColor: colors.selectedTab },
  icon: { width: 20, height: 20 },
  cursor: { width: 2, height: 20, backgroundColor: colors.tariffAccent },
  fieldText: { flexShrink: 1, fontFamily, fontSize: 16, lineHeight: 22, letterSpacing: -0.064, color: colors.mutedText, includeFontPadding: false },
  fieldSelected: { color: colors.text },
  submit: { height: 52, borderRadius: 16, borderCurve: 'continuous', backgroundColor: colors.tariffAccent, alignItems: 'center', justifyContent: 'center' },
  submitText: { fontFamily, fontSize: 16, lineHeight: 22, fontWeight: '600', letterSpacing: -0.064, color: colors.text, includeFontPadding: false },
  popular: { marginTop: 28, gap: 12 },
  popularHeader: { height: 32, paddingLeft: 20, paddingRight: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  compactHeader: { height: 'auto', minHeight: 32, flexWrap: 'wrap', rowGap: 8 },
  popularTitleSlot: { width: 184, height: 26, justifyContent: 'center' },
  popularTitle: { width: 182, height: 20 },
  allCountries: { height: 32, paddingLeft: 14, paddingRight: 10, gap: 4, flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderCurve: 'continuous', backgroundColor: colors.surface },
  allCountriesText: { fontFamily, fontSize: 14, lineHeight: 20, fontWeight: '600', letterSpacing: -0.056, color: colors.text, includeFontPadding: false },
  chevron: { width: 16, height: 16 },
  countryRail: { paddingHorizontal: 12, gap: 8 },
  countryCard: { width: 124, height: 112, padding: 14, gap: 12, backgroundColor: colors.surface, borderRadius: 20 },
  flag: { width: 32, height: 32 },
  flagFallback: { borderRadius: 16, borderCurve: 'continuous', backgroundColor: colors.selectedTab, alignItems: 'center', justifyContent: 'center' },
  countryName: { fontFamily, fontSize: 16, lineHeight: 22, fontWeight: '600', letterSpacing: -0.064, color: colors.text, includeFontPadding: false },
  price: { fontFamily, fontSize: 12, lineHeight: 18, letterSpacing: -0.048, color: colors.mutedText, includeFontPadding: false },
  banner: { marginHorizontal: 12, marginTop: 24, borderRadius: 24, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: colors.lime },
  bannerArtwork: { width: 351, height: 168 },
  savingsTitle: { position: 'absolute', left: 19.40625, top: 27.898438, width: 224, height: 78 },
  savingsSubtitle: { position: 'absolute', left: 18, top: 110, fontFamily, fontSize: 14, lineHeight: 20, fontWeight: '600', letterSpacing: -0.056, color: colors.ink, opacity: 0.8, includeFontPadding: false },
  coinScene: { position: 'absolute', left: 199, top: 0, width: 160, height: 200 },
  stackCoin: { position: 'absolute', width: 104, height: 50.44 },
  floatingLarge: { position: 'absolute', left: 31, top: -6, width: 62, height: 29.32, transform: [{ rotate: '-24deg' }] },
  floatingSmall: { position: 'absolute', left: 97, top: 39, width: 44, height: 20.84, transform: [{ rotate: '28deg' }] },
  bonusSticker: { position: 'absolute', left: 96, top: 78, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderCurve: 'continuous', backgroundColor: '#121214', transform: [{ rotate: '8deg' }] },
  bonusText: { color: colors.lime, fontSize: 16, fontWeight: '900' },
  coin45: { position: 'absolute', left: 248.516602, top: 82, width: 78, height: 78 },
  coin5: { position: 'absolute', left: 276, top: 0, width: 75, height: 75 },
  error: { marginHorizontal: 20, marginTop: 16, gap: 8 },
  errorText: { fontFamily, fontSize: 12, lineHeight: 18, color: colors.mutedText },
  retry: { fontFamily, fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.accent },
  pressed: { opacity: 0.75 },
});
