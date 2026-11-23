import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useNavigation, type CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { useMemo, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { ScrollView } from '../ui/ScrollView';
import { Pressable, View } from '../ui/Surface';
import { fonts, StyleSheet } from '../ui/design';
import { Text } from '../ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LoadFailure } from '../components/ServiceState';
import { useOnline } from '../service/connectivity';
import { useAuth } from '../auth/AuthProvider';
import type { RootStackParamList } from '../navigation/stack';
import type { RootTabParamList } from '../navigation/tabs';
import { colors, getTabBarBottom, tabBarLayout } from '../theme';
import { useUserOrders } from '../hooks/useUserOrders';
import { PurchasedOrders, type OrderAction } from '../components/PurchasedOrders';
import { MyEsimsSkeleton } from '../components/SkeletonLayouts';
import { useSkeletonGate } from '../hooks/useSkeletonGate';
import { useCatalogCategories } from '../hooks/useCatalogCategories';
import type { CatalogEsim } from '../../../../packages/shared/contracts/catalog';

type Navigation = CompositeNavigationProp<BottomTabNavigationProp<RootTabParamList>, NativeStackNavigationProp<RootStackParamList>>;

const assets = {
  heading: require('../../assets/my-esims/heading.svg'),
  mascot: require('../../assets/my-esims/sleeping-esim.svg'),
  emptyTitle: require('../../assets/my-esims/empty-title.svg'),
  sticker: require('../../assets/my-esims/empty-sticker.svg'),
  emptyWord: require('../../assets/my-esims/empty-word.svg'),
};

// Figma: populated screen 433:12704, empty screen 91:5500.
export function MyEsimsLayout({ populated, children }: {
  populated: boolean;
  children: (insets: { leftInset: number; rightInset: number }) => ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'web' ? 48 : insets.top;
  const bottomInset = getTabBarBottom(insets.bottom, Platform.OS === 'web');
  const leftInset = Math.max(insets.left, 12);
  const rightInset = Math.max(insets.right, 12);

  return <View style={styles.screen} testID="screen-esims">
    <ScrollView style={styles.screen} testID="my-esims-scroll" showsVerticalScrollIndicator={false}
      contentInsetAdjustmentBehavior="never" contentContainerStyle={[
        styles.content,
        { paddingTop: topInset + (populated ? 12 : 16), paddingBottom: Math.max(120, bottomInset + tabBarLayout.height + 20),
          paddingLeft: leftInset, paddingRight: rightInset },
      ]}>
      <View style={[styles.header, populated && styles.populatedHeader]} testID="my-esims-heading">
        <View style={styles.headingSlot} accessibilityRole="header" accessibilityLabel="Мои eSIM" accessible>
          <Image source={assets.heading} style={styles.heading} contentFit="contain" accessible={false} />
        </View>
      </View>
      {children({ leftInset, rightInset })}
    </ScrollView>
  </View>;
}

function CatalogPurchasedOrders(props: Omit<Parameters<typeof PurchasedOrders>[0], 'countries'>) {
  const { state } = useCatalogCategories();
  const countries = useMemo(() => {
    const byId = new Map<string, CatalogEsim>();
    if (state.status === 'ready') {
      for (const category of state.categories) {
        for (const country of category.esims) byId.set(country.id, country);
      }
    }
    return byId;
  }, [state]);
  return <PurchasedOrders {...props} countries={countries} />;
}

export function MyEsimsScreen() {
  const navigation = useNavigation<Navigation>();
  const auth = useAuth();
  const online = useOnline();
  const hasAccount = !!(auth.user || (!online && auth.offlineUserId));
  const orders = useUserOrders();
  const loading = (auth.loading || hasAccount) && orders.state.status === 'loading';
  const skeleton = useSkeletonGate(loading);
  const failed = hasAccount && (orders.state.status === 'error' || skeleton.timedOut);
  const state = hasAccount && orders.state.status === 'ready' && orders.state.response.data.length ? orders.state : null;
  const select = (orderId: string, action: OrderAction) => navigation.push('OrderStatus', {
    orderId, details: true,
    ...(action === 'install' ? { openInstallation: true } : action === 'top-up' ? { openTopUp: true } : {}),
  });

  return <MyEsimsLayout populated={!!state}>
    {insets => failed ? <LoadFailure title="eSIM не загрузились" card testID="my-esims-load-error"
        onRetry={() => { skeleton.restart(); orders.reload(); }} />
        : loading ? skeleton.visible ? <MyEsimsSkeleton /> : null
        : state ? <>
          <CatalogPurchasedOrders {...insets} orders={state.response.data.map(order => ({ ...order, ...state.dates[order.id] }))} onSelect={select} />
          {state.error && <>
            <Text style={styles.description}>{state.error}</Text>
            {!state.response.meta.has_more && <Pressable onPress={orders.reload} accessibilityRole="button"
              style={[styles.button, styles.signIn]}><Text style={styles.buttonText}>Повторить</Text></Pressable>}
          </>}
          {state.response.meta.has_more && state.response.meta.next_cursor && <Pressable onPress={() => void orders.loadMore()} disabled={state.loadingMore} accessibilityRole="button" testID="my-esims-load-more" style={[styles.button, styles.signIn]}><Text style={styles.buttonText}>{state.loadingMore ? 'Загружаем…' : 'Ещё заказы'}</Text></Pressable>}
        </> : <View style={styles.emptyCard} testID="my-esims-empty">
        <Image source={assets.mascot} style={styles.mascot} contentFit="contain" accessible={false} testID="my-esims-mascot" />
        <View style={styles.emptyHeading} accessibilityRole="header" accessibilityLabel="Тут пока пусто">
          <View style={styles.emptyTitleSlot}>
            <Image source={assets.emptyTitle} style={styles.emptyTitle} contentFit="contain" accessible={false} />
          </View>
          <View style={styles.stickerSlot}>
            <Image source={assets.sticker} style={styles.sticker} contentFit="contain" accessible={false} />
            <Image source={assets.emptyWord} style={styles.emptyWord} contentFit="contain" accessible={false} />
          </View>
        </View>

        <Text style={styles.description} numberOfLines={hasAccount ? 1 : 2} adjustsFontSizeToFit minimumFontScale={0.8} testID="my-esims-description">
          {hasAccount ? 'Купите eSIM — она появится здесь.' : 'Купите eSIM — она появится здесь.\nУже покупали? Войдите по почте'}
        </Text>

        <View style={styles.actions}>
          <Pressable onPress={() => navigation.navigate('Countries')} accessibilityRole="button" testID="my-esims-choose-country"
            style={({ pressed }) => [styles.button, styles.chooseCountry, pressed && styles.pressed]}>
            <Text style={styles.buttonText}>Выбрать страну</Text>
          </Pressable>
          {!hasAccount && <Pressable onPress={() => navigation.navigate('EmailSignIn')} disabled={auth.loading || !online}
            accessibilityRole="button" accessibilityState={{ disabled: auth.loading }} testID="my-esims-sign-in"
            style={({ pressed }) => [styles.button, styles.signIn, (pressed || auth.loading) && styles.pressed]}>
            <Text style={styles.buttonText}>Войти</Text>
          </Pressable>}
        </View>
      </View>}
  </MyEsimsLayout>;
}

const fontFamily = fonts.text;
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', gap: 12 },
  header: { height: 42, paddingHorizontal: 12, paddingBottom: 4, justifyContent: 'center' },
  populatedHeader: { height: 44 },
  headingSlot: { width: 137, height: 38 },
  // Text SVGs retain Figma's original glyphs. Export crops are positioned using
  // their render bounds inside the original text slots, without scaling.
  heading: { position: 'absolute', left: 1.743164, top: 8.496094, width: 134, height: 22 },
  emptyCard: { width: '100%', paddingTop: 28, paddingBottom: 20, paddingHorizontal: 20, gap: 14,
    alignItems: 'center', backgroundColor: colors.surface, borderRadius: 28 },
  mascot: { width: 118, height: 126 },
  emptyHeading: { alignItems: 'center', gap: 2 },
  emptyTitleSlot: { width: 99, height: 30 },
  emptyTitle: { position: 'absolute', left: 0.65625, top: 7.089844, width: 98, height: 22 },
  stickerSlot: { width: 86.886685, height: 37.239459 },
  sticker: { position: 'absolute', left: 0, top: 0, width: 87, height: 38 },
  emptyWord: { position: 'absolute', left: 11.1953, top: 14.219727, width: 66, height: 20 },
  description: { width: '100%', fontFamily, fontSize: 15, lineHeight: 21, letterSpacing: -0.06,
    color: 'rgba(255,255,255,0.6)', textAlign: 'center', includeFontPadding: false },
  actions: { width: '100%', gap: 8 },
  button: { height: 56, borderRadius: 16, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  chooseCountry: { backgroundColor: colors.tariffAccent },
  signIn: { backgroundColor: colors.selectedTab },
  buttonText: { fontFamily, fontSize: 16, lineHeight: 22, fontWeight: '600', letterSpacing: -0.064,
    color: colors.text, includeFontPadding: false },
  pressed: { opacity: 0.7 },
});
