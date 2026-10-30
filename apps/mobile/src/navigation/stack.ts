import type { SendCodeResponse } from '../../../../packages/shared/contracts/auth';

import type { NavigatorScreenParams } from '@react-navigation/native';

import type { CatalogCategory, CatalogEsim, CatalogTariff } from '../../../../packages/shared/contracts/catalog';
import type { RootTabParamList } from './tabs';

export type RootStackParamList = {
  Main: NavigatorScreenParams<RootTabParamList> | undefined;
  EmailSignIn: undefined;
  EmailCode: { challenge: SendCodeResponse; receivedAt: number; returnToCheckout?: boolean };
  Checkout: { country: CatalogEsim; tariff: CatalogTariff };
  OrderStatus: { orderId: string; openPayment?: boolean };
  CountryTariffs: { country: CatalogEsim; preferredDurationDays?: number; preferredDataGb?: number };
  RegionTariffs: { category: CatalogCategory };
};
