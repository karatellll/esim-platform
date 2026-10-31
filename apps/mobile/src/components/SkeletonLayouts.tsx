import { View } from '../ui/Surface';
import { StyleSheet } from '../ui/design';
import { colors } from '../theme';
import { SkeletonBlock, SkeletonGroup } from './Skeleton';

export function CountryRowsSkeleton({ count = 5 }: { count?: number }) {
  return <SkeletonGroup style={styles.rows}>{Array.from({ length: count }, (_, index) => <View key={index} style={styles.countryRow}>
    <SkeletonBlock circle style={{ width: 36, height: 36 }} />
    <View style={styles.countryCopy}><SkeletonBlock style={{ width: '52%', height: 14 }} /><SkeletonBlock style={{ width: '34%', height: 10 }} /></View>
    <SkeletonBlock circle style={{ width: 20, height: 20 }} />
  </View>)}</SkeletonGroup>;
}

export function PopularCountriesSkeleton() {
  return <SkeletonGroup style={styles.rail}>{[0, 1, 2].map(i => <View key={i} style={styles.tile}>
    <SkeletonBlock circle style={{ width: 32, height: 32 }} /><View style={{ gap: 7 }}><SkeletonBlock style={{ width: 62, height: 10 }} /><SkeletonBlock style={{ width: 82, height: 8 }} /></View>
  </View>)}</SkeletonGroup>;
}

export function TariffSkeleton() {
  return <SkeletonGroup style={styles.tariffs}>
    <View style={styles.dataHeader}><SkeletonBlock circle style={{ width: 48, height: 48 }} /><View style={{ gap: 8, alignItems: 'center' }}><SkeletonBlock style={{ width: 146, height: 20 }} /><SkeletonBlock style={{ width: 184, height: 10 }} /></View></View>
    <View style={styles.pills}>{[0, 1, 2].map(i => <SkeletonBlock key={i} style={{ flex: 1, height: 36, borderRadius: 12 }} />)}</View>
    {[0, 1, 2, 3].map(i => <View key={i} style={styles.tariffRow}><View style={{ flex: 1, gap: 7 }}><SkeletonBlock style={{ width: i % 2 ? 72 : 54, height: 16 }} /><SkeletonBlock style={{ width: 98, height: 9 }} /></View><SkeletonBlock style={{ width: 44, height: 12 }} /></View>)}
    <View style={styles.hint}><SkeletonBlock circle style={{ width: 24, height: 16 }} /><SkeletonBlock style={{ width: 174, height: 10 }} /></View>
  </SkeletonGroup>;
}

export function MyEsimsSkeleton() {
  return <SkeletonGroup style={styles.myEsims}>
    <View style={styles.orderCard}><View style={styles.orderTop}><SkeletonBlock circle style={{ width: 42, height: 42 }} /><View style={{ flex: 1, gap: 8 }}><SkeletonBlock style={{ width: '62%', height: 14 }} /><SkeletonBlock style={{ width: '42%', height: 9 }} /></View><SkeletonBlock circle style={{ width: 34, height: 34 }} /></View><SkeletonBlock style={{ width: '80%', height: 10 }} /><SkeletonBlock style={{ width: '55%', height: 10 }} /></View>
    <SkeletonBlock style={{ width: 120, height: 14 }} />
    <View style={styles.countryRow}><SkeletonBlock circle style={{ width: 32, height: 32 }} /><SkeletonBlock style={{ width: '45%', height: 12 }} /><SkeletonBlock style={{ width: 42, height: 10 }} /></View>
    <SkeletonBlock style={{ width: 116, height: 14, marginTop: 6 }} />
    <View style={styles.pastCards}>{[0, 1].map(i => <View key={i} style={styles.pastCard}><SkeletonBlock circle style={{ width: 30, height: 30 }} /><SkeletonBlock style={{ width: '70%', height: 10 }} /><SkeletonBlock style={{ width: '45%', height: 8 }} /></View>)}</View>
  </SkeletonGroup>;
}

const styles = StyleSheet.create({
  rows: { gap: 8 }, countryRow: { minHeight: 58, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: 18 }, countryCopy: { flex: 1, gap: 6 },
  rail: { flexDirection: 'row', gap: 8, paddingHorizontal: 12 }, tile: { width: 124, height: 112, padding: 14, justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: 20 },
  tariffs: { gap: 8 }, dataHeader: { gap: 8, alignItems: 'center', paddingVertical: 8 }, pills: { flexDirection: 'row', gap: 6, padding: 4, borderRadius: 16, backgroundColor: colors.surface }, tariffRow: { height: 74, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, backgroundColor: colors.surface, borderRadius: 20 }, hint: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8 },
  myEsims: { gap: 12 }, orderCard: { padding: 16, gap: 12, backgroundColor: colors.surface, borderRadius: 24 }, orderTop: { flexDirection: 'row', alignItems: 'center', gap: 12 }, pastCards: { flexDirection: 'row', gap: 8 }, pastCard: { flex: 1, minHeight: 92, padding: 12, gap: 8, backgroundColor: colors.surface, borderRadius: 18 },
});
