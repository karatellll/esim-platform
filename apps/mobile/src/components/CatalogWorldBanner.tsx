import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme';
import { fonts, StyleSheet } from '../ui/design';
import { Pressable, View } from '../ui/Surface';
import { Text } from '../ui/Text';

// The All Countries banner uses the same image assets as the home tile.
const world = require('../../assets/home-v3/world.png');
const worldOverlay = require('../../assets/home-v3/world-overlay.png');
const flags = [
  require('../../assets/world/flag-fr.png'),
  require('../../assets/world/flag-it.png'),
  require('../../assets/world/flag-de.png'),
  require('../../assets/world/flag-es.png'),
  require('../../assets/world/flag-jp.svg'),
  require('../../assets/world/flag-th.png'),
];
export function CatalogWorldBanner({ onPress }: { onPress: () => void }) {
  return <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]} onPress={onPress}
    accessibilityRole="button" accessibilityLabel="Весь мир" accessibilityHint="Открыть глобальные тарифы" testID="global-esim-button">
    <LinearGradient colors={['#2B2B3D', '#17171F']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
    <Image source={world} style={styles.world} contentFit="contain" accessible={false} />
    <Image source={worldOverlay} style={styles.worldOverlay} contentFit="cover" accessible={false} />
    <Text style={styles.title}>Весь мир</Text>
    <Text style={styles.subtitle} numberOfLines={1}>120+ стран, одна eSIM</Text>
    <View style={styles.flags} testID="catalog-world-flags" pointerEvents="none">
      {flags.map((source, index) => <View key={index} style={[styles.flag, { zIndex: flags.length + 1 - index }]}><Image source={source} style={styles.flagImage} contentFit="contain" accessible={false} /></View>)}
      <View style={styles.more}><Text style={styles.moreText}>+114</Text></View>
    </View>
  </Pressable>;
}
const styles = StyleSheet.create({
  card: { width: '100%', height: 120, borderRadius: 24, overflow: 'hidden', backgroundColor: '#17171F', flexShrink: 0 },
  world: { position: 'absolute', width: 206, height: 192, right: -38, top: 6, opacity: 0.7 },
  worldOverlay: { position: 'absolute', width: 172.891, height: 158, right: -17.891, top: 9, opacity: 0.7 },
  title: { position: 'absolute', left: 16, top: 16, fontFamily: fonts.display, fontSize: 22, lineHeight: 28, fontWeight: '800', letterSpacing: -0.44, color: colors.text },
  subtitle: { position: 'absolute', left: 16, right: 16, top: 46, fontFamily: fonts.text, fontSize: 13, lineHeight: 19, letterSpacing: -0.052, color: colors.text, opacity: 0.75 },
  flags: { position: 'absolute', left: 16, top: 80, flexDirection: 'row', alignItems: 'center', isolation: 'isolate' },
  flag: { width: 26, height: 26, marginRight: -8, borderRadius: 13, overflow: 'hidden', flexShrink: 0 },
  flagImage: { width: 26, height: 26 },
  more: { height: 26, paddingHorizontal: 12, borderRadius: 16, backgroundColor: colors.tariffAccent, justifyContent: 'center', flexShrink: 0, zIndex: 1 },
  moreText: { fontFamily: fonts.text, fontSize: 13, lineHeight: 19, fontWeight: '600', letterSpacing: -0.052, color: colors.text },
  pressed: { opacity: 0.8 },
});
