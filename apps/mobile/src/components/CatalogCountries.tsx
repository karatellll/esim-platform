import { Image } from 'expo-image';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { CatalogEsim } from '../../../../packages/shared/contracts/catalog';

import type { CountrySection } from '../catalog/catalog';
import { formatCatalogPrice, getCatalogPrice } from '../catalog/prices';
import { colors } from '../theme';
import { CountryFlag } from './CountryFlag';

type Props = {
  sections: CountrySection[];
  query: string;
  onListLayout: (y: number) => void;
  onSectionLayout: (letter: string, y: number) => void;
  onSelectCountry: (country: CatalogEsim) => void;
};

export function CatalogCountries({ sections, query, onListLayout, onSectionLayout, onSelectCountry }: Props) {
  if (sections.length === 0) {
    return <Text style={styles.empty} testID="catalog-empty">{query.trim() ? 'По запросу ничего не найдено.' : 'Направления пока недоступны.'}</Text>;
  }

  return (
    <View style={styles.sections} testID="catalog-countries" onLayout={(event) => onListLayout(event.nativeEvent.layout.y)}>
      {sections.map((section) => (
        <View key={section.letter} style={styles.section} onLayout={(event) => onSectionLayout(section.letter, event.nativeEvent.layout.y)}>
          <Text style={styles.letter} testID={`country-section-${section.letter}`}>{section.letter}</Text>
          <View style={styles.card}>
            {section.countries.map((country, index) => (
              <Pressable key={country.id} onPress={() => onSelectCountry(country)} accessibilityRole="button" accessibilityLabel={`Тарифы: ${country.display_name}`} style={({ pressed }) => [styles.row, index < section.countries.length - 1 && styles.divider, pressed && { opacity: 0.7 }]} testID={`catalog-esim-${country.id}`}>
                <CountryFlag key={`${country.id}-${country.image_url}`} country={country} />
                <Text style={styles.name} numberOfLines={1}>{country.display_name}</Text>
                <Text style={styles.price} testID={`catalog-price-${country.id}`}>
                  {formatCatalogPrice(getCatalogPrice(country))}
                </Text>
                <Image source={require('../../assets/countries/row-chevron.svg')} style={styles.chevron} contentFit="contain" accessible={false} />
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const fontFamily = Platform.select({ ios: 'System', android: 'sans-serif', default: 'system-ui' });
const styles = StyleSheet.create({
  sections: { gap: 16 },
  section: { gap: 16 },
  letter: { fontFamily, fontSize: 16, lineHeight: 22, fontWeight: '700', color: colors.mutedText, letterSpacing: -0.064 },
  card: { backgroundColor: colors.surface, borderRadius: 20, paddingVertical: 2, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  divider: { borderBottomWidth: 1, borderBottomColor: 'rgba(255, 255, 255, 0.07)' },
  name: { fontFamily, flex: 1, fontSize: 16, lineHeight: 22, fontWeight: '500', letterSpacing: -0.064, color: colors.text },
  price: { fontFamily, minWidth: 58, flexShrink: 0, fontSize: 14, lineHeight: 20, letterSpacing: -0.056, color: colors.mutedText, textAlign: 'right' },
  chevron: { width: 18, height: 18 },
  empty: { fontFamily, fontSize: 14, lineHeight: 20, color: colors.mutedText, textAlign: 'center', paddingVertical: 20 },
});
