import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { CatalogEsim } from '../../../../packages/shared/contracts/catalog';
import { colors } from '../theme';

export function CountryFlag({ country, size = 36, borderWidth = 0 }: { country: CatalogEsim; size?: number; borderWidth?: number }) {
  const [failed, setFailed] = useState(false);
  const imageUrl = country.image_url && /^https?:\/\//i.test(country.image_url) ? country.image_url : null;
  const imageSize = size - borderWidth * 2;
  return (
    <View style={[styles.flag, { width: size, height: size, borderRadius: size / 2, borderWidth, borderColor: colors.ink }]}>
      {imageUrl && !failed ? (
        <Image source={{ uri: imageUrl }} style={{ width: imageSize, height: imageSize }} contentFit="cover" onError={() => setFailed(true)} accessible={false} />
      ) : <Text style={styles.fallback}>{country.country_iso2}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  flag: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.selectedTab },
  fallback: { fontSize: 10, color: colors.text },
});
