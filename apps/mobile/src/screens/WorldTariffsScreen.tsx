import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { getGlobalBundle } from '../catalog/global';
import { WorldTariffsPanel } from '../components/WorldTariffsPanel';
import { useCatalogCategories } from '../hooks/useCatalogCategories';
import type { RootStackParamList } from '../navigation/stack';
import { View } from '../ui/Surface';

export function WorldTariffsScreen({ route, navigation }: NativeStackScreenProps<RootStackParamList, 'WorldTariffs'>) {
  const catalog = useCatalogCategories();
  const bundle = route.params.bundle ?? (catalog.state.status === 'ready' ? getGlobalBundle(catalog.state.categories) : null);

  return <View style={{ flex: 1 }} testID="screen-world">
    <WorldTariffsPanel {...route.params} bundle={bundle} catalogState={catalog.state} onReloadCatalog={catalog.reload} onBack={() => navigation.goBack()} />
  </View>;
}
