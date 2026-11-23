import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect } from 'react';

import { LoadFailure, ServiceState } from '../components/ServiceState';
import { useCatalogTariffs } from '../hooks/useCatalogTariffs';
import type { RootStackParamList } from '../navigation/stack';
import { useOnline } from '../service/connectivity';
import { useSkeletonGate } from '../hooks/useSkeletonGate';
import { TariffSkeleton } from '../components/SkeletonLayouts';

type MissingProps = NativeStackScreenProps<RootStackParamList, 'NotFound'>;
export function NotFoundScreen({ navigation }: MissingProps) {
  return <ServiceState kind="not-found" primary={{ label: 'На главную', onPress: () => navigation.reset({ index: 0, routes: [{ name: 'Main', params: { screen: 'Search' } }] }) }} />;
}

export function SessionExpiredScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'SessionExpired'>) {
  const online = useOnline();
  return <ServiceState kind="session" primary={{ label: 'Войти по почте', disabled: !online, onPress: () => navigation.replace('EmailSignIn') }} />;
}

export function TariffLinkScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'TariffLink'>) {
  const id = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(route.params.esimId) ? route.params.esimId.toLowerCase() : null;
  const { state, reload } = useCatalogTariffs(id);
  const gate = useSkeletonGate(state.status === 'loading');
  useEffect(() => {
    if (!id || (state.status === 'error' && state.httpStatus === 404)) navigation.replace('NotFound');
    else if (state.status === 'ready') {
      if (state.data.esim.country_iso2 === 'XG') navigation.replace('WorldTariffs', { bundle: state.data.esim });
      else navigation.replace('CountryTariffs', { country: state.data.esim });
    }
  }, [id, navigation, state]);
  if (state.status === 'error' || gate.timedOut) return <LoadFailure title="Тарифы не загрузились" onRetry={() => { gate.restart(); reload(); }} top={80} />;
  return gate.visible ? <TariffSkeleton /> : null;
}
