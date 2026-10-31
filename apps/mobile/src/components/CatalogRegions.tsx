import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, View } from '../ui/Surface';
import { fonts, StyleSheet } from '../ui/design';
import { Text } from '../ui/Text';

import type { CatalogCategory } from '../../../../packages/shared/contracts/catalog';
import { countLabel, getCountries } from '../catalog/catalog';
import { formatCatalogPrice, getCatalogPrice, getMinimumCatalogPrice } from '../catalog/prices';
import { getRegionBundle } from '../catalog/regions';
import { colors } from '../theme';
import { CountryFlag } from './CountryFlag';

import { regionPhoto } from '../catalog/photos';
const preferredFlags: Record<string, string[]> = { 'европа': ['FR', 'IT', 'DE', 'ES'], 'азия': ['JP', 'TH', 'TR'] };
const designOrder = ['европа', 'азия', 'ближний восток', 'кавказ'];

export function CatalogRegions({ categories, onSelectCategory }: {
  categories: readonly CatalogCategory[];
  onSelectCategory: (category: CatalogCategory) => void;
}) {
  if (categories.length === 0) return <Text style={styles.empty} testID="catalog-empty">Регионы пока недоступны.</Text>;
  const ordered = categories.filter(category => category.title.trim().toLocaleLowerCase('ru') !== 'популярное').sort((a, b) => {
    const aIndex = designOrder.indexOf(a.title.trim().toLocaleLowerCase('ru'));
    const bIndex = designOrder.indexOf(b.title.trim().toLocaleLowerCase('ru'));
    return (aIndex < 0 ? designOrder.length : aIndex) - (bIndex < 0 ? designOrder.length : bIndex);
  });
  if (ordered.length === 0) return <Text style={styles.empty} testID="catalog-empty">Регионы пока недоступны.</Text>;

  return (
    <View style={styles.regions} testID="catalog-regions">
      {ordered.map((category, index) => {
        const key = category.title.trim().toLocaleLowerCase('ru');
        const countries = getCountries([category]);
        const bundle = getRegionBundle(category);
        const image = bundle?.photo_url?.trim() ? { uri: bundle.photo_url.trim() } : key === 'европа' ? require('../../assets/regions/europe.png') : key === 'азия' ? require('../../assets/regions/asia.png') : regionPhoto(category.title);
        const preferred = (preferredFlags[key] ?? []).flatMap((code) => countries.filter((country) => country.country_iso2?.toUpperCase() === code));
        const flags = [...preferred, ...countries.filter((country) => !preferred.some((flag) => flag.id === country.id))].slice(0, key === 'азия' ? 3 : 4);
        return (
          <Pressable key={`${category.title}-${index}`} onPress={() => onSelectCategory(category)} accessibilityRole="button" accessibilityLabel={`Открыть категорию: ${category.title}`} style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]} testID={`region-${category.title}`}>
            {image && <>
              <Image source={image} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} />
              <LinearGradient colors={['rgba(0,0,0,0.85)', 'rgba(0,0,0,0.2)']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
            </>}
            <Text style={styles.title} numberOfLines={1}>{category.title}</Text>
            <Text style={styles.subtitle}>{countLabel(countries.length)}</Text>
            <View style={styles.flags}>
              {flags.map((country, flagIndex) => (
                <View key={country.id} style={{ marginRight: flagIndex < flags.length - 1 ? -8 : 0, zIndex: flags.length - flagIndex }}>
                  <CountryFlag key={`${country.id}-${country.image_url}`} country={country} size={26} borderWidth={2} />
                </View>
              ))}
            </View>
            <View style={styles.price}><Text style={styles.priceText} testID={`region-price-${category.title}`}>
              {formatCatalogPrice(bundle ? getCatalogPrice(bundle) : getMinimumCatalogPrice(category.esims))}
            </Text></View>
          </Pressable>
        );
      })}
    </View>
  );
}

const fontFamily = fonts.text;
const styles = StyleSheet.create({
  regions: { gap: 12 },
  card: { height: 120, borderRadius: 24, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: colors.surface },
  title: { position: 'absolute', top: 16, left: 16, right: 16, fontFamily, fontSize: 22, lineHeight: 28, fontWeight: '900', letterSpacing: -0.44, color: colors.text },
  subtitle: { position: 'absolute', top: 46, left: 16, fontFamily, fontSize: 13, lineHeight: 19, letterSpacing: -0.052, color: colors.text, opacity: 0.75 },
  flags: { position: 'absolute', top: 80, left: 16, flexDirection: 'row', isolation: 'isolate' },
  price: { position: 'absolute', top: 82, right: 16, minWidth: 77, height: 24, paddingHorizontal: 10, borderRadius: 12, borderCurve: 'continuous', backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center' },
  priceText: { fontFamily, fontSize: 13, lineHeight: 16, fontWeight: '700', letterSpacing: -0.052, color: colors.ink },
  empty: { fontSize: 14, lineHeight: 20, color: colors.mutedText, textAlign: 'center', paddingVertical: 20 },
});
