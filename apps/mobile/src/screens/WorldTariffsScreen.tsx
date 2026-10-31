import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Platform } from 'react-native';
import { ScrollView } from '../ui/ScrollView';
import { Pressable, View } from '../ui/Surface';
import { Text } from '../ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WorldTariffsPanel } from '../components/WorldTariffsPanel';
import { useCatalogCategories } from '../hooks/useCatalogCategories';
import type { RootStackParamList } from '../navigation/stack';
import { colors } from '../theme';
export function WorldTariffsScreen({ route, navigation }: NativeStackScreenProps<RootStackParamList, 'WorldTariffs'>) {
  const insets = useSafeAreaInsets();
  const catalog = useCatalogCategories();
  return <View style={{ flex: 1, backgroundColor: colors.background }}><ScrollView contentContainerStyle={{ paddingTop: Platform.OS === 'web' ? 56 : insets.top + 8, paddingHorizontal: 12, paddingBottom: Math.max(insets.bottom, 24), gap: 12 }}><Pressable onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Назад к поиску" style={{ padding: 16 }}><Text style={{ color: colors.accent }}>Назад</Text></Pressable><WorldTariffsPanel {...route.params} catalogState={catalog.state} onReloadCatalog={catalog.reload} /></ScrollView></View>;
}
