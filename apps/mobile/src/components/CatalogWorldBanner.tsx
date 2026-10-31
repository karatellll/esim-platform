import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import type { CatalogPrice } from '../catalog/prices';
import { formatCatalogPrice } from '../catalog/prices';
import { colors } from '../theme';
import { fonts, StyleSheet } from '../ui/design';
import { Pressable, View } from '../ui/Surface';
import { Text } from '../ui/Text';

// Figma 115:49950, inside Все страны 91:4913. The globe SVG is an exact
// match to the existing export; flags/counts are the design's presentation copy.
const flags = [
  require('../../assets/world/flag-fr.png'),
  require('../../assets/world/flag-it.png'),
  require('../../assets/world/flag-de.png'),
  require('../../assets/world/flag-es.png'),
  require('../../assets/world/flag-jp.svg'),
  require('../../assets/world/flag-th.png'),
];
export function CatalogWorldBanner({ price, onPress }: { price: CatalogPrice | null; onPress: () => void }) {
  return <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]} onPress={onPress}
    accessibilityRole="button" accessibilityLabel="Весь мир" accessibilityHint="Перейти на вкладку «Весь мир»" testID="global-esim-button">
    <LinearGradient colors={['#2B2B3D', '#17171F']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
    <Text style={styles.title}>Весь мир</Text>
    <Text style={styles.subtitle} numberOfLines={1}>{`120+ стран · одна eSIM${price ? ` · ${formatCatalogPrice(price)}` : ''}`}</Text>
    <View style={styles.flags} testID="catalog-world-flags" pointerEvents="none">
      {flags.map((source, index) => <View key={index} style={[styles.flag, { zIndex: flags.length + 1 - index }]}><Image source={source} style={styles.flagImage} contentFit="contain" accessible={false} /></View>)}
      <View style={styles.more}><Text style={styles.moreText}>+114</Text></View>
    </View>
    <Image source={require('../../assets/mvp/21390.svg')} style={styles.globe} contentFit="contain" accessible={false} />
    <Image source={require('../../assets/countries/world-chevron.svg')} style={styles.chevron} contentFit="contain" accessible={false} />
  </Pressable>;
}
const styles = StyleSheet.create({
  card: { width: '100%', height: 120, borderRadius: 24, overflow: 'hidden', backgroundColor: '#17171F', flexShrink: 0 },
  // At the reference width 343: x=186, y=-44.63916. Keep its intrinsic 210×210.
  globe: { position: 'absolute', width: 210, height: 210, right: -53, top: -44.63916 },
  title: { position: 'absolute', left: 16, top: 16, fontFamily: fonts.display, fontSize: 22, lineHeight: 28, fontWeight: '800', letterSpacing: -0.44, color: colors.text },
  subtitle: { position: 'absolute', left: 16, right: 16, top: 46, fontFamily: fonts.text, fontSize: 13, lineHeight: 19, letterSpacing: -0.052, color: colors.text, opacity: 0.75 },
  flags: { position: 'absolute', left: 16, top: 80, flexDirection: 'row', alignItems: 'center', isolation: 'isolate' },
  flag: { width: 26, height: 26, marginRight: -8, borderRadius: 13, overflow: 'hidden', flexShrink: 0 },
  flagImage: { width: 26, height: 26 },
  more: { height: 26, paddingHorizontal: 12, borderRadius: 16, backgroundColor: colors.tariffAccent, justifyContent: 'center', flexShrink: 0, zIndex: 1 },
  moreText: { fontFamily: fonts.text, fontSize: 13, lineHeight: 19, fontWeight: '600', letterSpacing: -0.052, color: colors.text },
  chevron: { position: 'absolute', right: 28, top: 48, width: 24, height: 24 },
  pressed: { opacity: 0.8 },
});
