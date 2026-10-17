import type { NavigatorScreenParams } from '@react-navigation/native';

import type { CatalogCategory, CatalogEsim } from '../../../../packages/shared/contracts/catalog';
import type { RootTabParamList } from './tabs';

export type RootStackParamList = {
  Main: NavigatorScreenParams<RootTabParamList> | undefined;
  CountryTariffs: { country: CatalogEsim };
  RegionTariffs: { category: CatalogCategory };
};
