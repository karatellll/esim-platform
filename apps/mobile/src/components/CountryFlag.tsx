import { Image } from 'expo-image';
import { useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from '../ui/design';
import { Text } from '../ui/Text';

import type { CatalogEsim } from '../../../../packages/shared/contracts/catalog';
import { flagImages } from '../catalog/flagImages';
import { isCountry } from '../home/smartSearch';
import { colors } from '../theme';

export function CountryFlag({ country, shape = 'circle', size = shape === 'rectangle' ? 32 : 36, borderWidth = 0 }: {
  country: CatalogEsim;
  size?: number;
  borderWidth?: number;
  shape?: 'circle' | 'rectangle';
}) {
  const [failedImage, setFailedImage] = useState<number>();
  const [failedUrl, setFailedUrl] = useState<string>();
  const imageUrl = country.image_url && /^https?:\/\//i.test(country.image_url) ? country.image_url : null;
  const rectangular = shape === 'rectangle';
  const code = country.country_iso2?.trim().toUpperCase();
  const artwork = code && isCountry(country) ? flagImages[code] : undefined;
  const localImage = artwork !== failedImage ? artwork : undefined;
  const remoteUrl = imageUrl !== failedUrl ? imageUrl : null;
  const source = localImage ?? (remoteUrl ? { uri: remoteUrl } : null);
  const width = rectangular ? Math.round(size * 41 / 32) : size;
  const borderRadius = rectangular ? size * 12 / 32 : size / 2;
  const imageSize = { width: width - borderWidth * 2, height: size - borderWidth * 2 };
  return (
    <View style={[styles.flag, { width, height: size, borderRadius, borderWidth, borderColor: colors.ink }]}>
      {source !== null ? (
        <Image
          source={source}
          style={imageSize}
          contentFit={localImage !== undefined && rectangular ? 'fill' : 'cover'}
          onError={() => {
            if (localImage !== undefined) setFailedImage(localImage);
            else if (remoteUrl) setFailedUrl(remoteUrl);
          }}
          accessible={false}
        />
      ) : <Text style={styles.fallback}>{country.country_iso2}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  flag: { overflow: 'hidden', flexShrink: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.selectedTab },
  fallback: { fontSize: 10, color: colors.text },
});
