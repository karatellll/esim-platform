import type { SendCodeResponse } from '../../../../packages/shared/contracts/auth';

import type { NavigatorScreenParams } from '@react-navigation/native';

import type { CatalogCategory, CatalogEsim, CatalogTariff } from '../../../../packages/shared/contracts/catalog';
import type { RootTabParamList } from './tabs';

export type RootStackParamList = {
  NotFound: undefined;
  SessionExpired: undefined;
  TariffLink: { esimId: string };
  Main: NavigatorScreenParams<RootTabParamList> | undefined;
  TripSearch: undefined;
  Help: { installation?: boolean } | undefined;
  Loyalty: { mode: 'invite' | 'exchange' };
  ProfileEdit: undefined;
  EmailSignIn: undefined;
  EmailCode: { challenge: SendCodeResponse; receivedAt: number; returnToCheckout?: boolean };
  Checkout: { country: CatalogEsim; tariff: CatalogTariff };
  OrderStatus: { orderId: string; openPayment?: boolean; details?: boolean; openInstallation?: boolean; openTopUp?: boolean };
  WorldTariffs: { bundle: CatalogEsim | null; preferredDurationDays?: number; preferredDataGb?: number; preferUnlimited?: boolean };
  CountryTariffs: { country: CatalogEsim; preferredDurationDays?: number; preferredDataGb?: number; preferUnlimited?: boolean };
  RegionTariffs: { category: CatalogCategory; preferredDurationDays?: number; preferredDataGb?: number; preferUnlimited?: boolean };
};
