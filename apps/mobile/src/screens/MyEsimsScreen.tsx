import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useNavigation, type CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthProvider';
import type { RootStackParamList } from '../navigation/stack';
import type { RootTabParamList } from '../navigation/tabs';
import { colors, tabBarLayout } from '../theme';
import { useUserOrders } from '../hooks/useUserOrders';
import { PurchasedOrders } from '../components/PurchasedOrders';

type Navigation = CompositeNavigationProp<BottomTabNavigationProp<RootTabParamList>, NativeStackNavigationProp<RootStackParamList>>;

const assets = {
  heading: require('../../assets/my-esims/heading.svg'),
  mascot: require('../../assets/my-esims/sleeping-esim.svg'),
  emptyTitle: require('../../assets/my-esims/empty-title.svg'),
  sticker: require('../../assets/my-esims/empty-sticker.svg'),
  emptyWord: require('../../assets/my-esims/empty-word.svg'),
};

// Figma: empty state 91:5500; purchased rows follow the surfaces of 64:4276.
export function MyEsimsScreen() {
  const navigation = useNavigation<Navigation>();
  const insets = useSafeAreaInsets();
  const auth = useAuth();
  const orders = useUserOrders();
  const topInset = Platform.OS === 'web' ? 48 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 36 : Math.max(insets.bottom, 12) + 2;

  return <View style={styles.screen} testID="screen-esims">
    <ScrollView style={styles.screen} testID="my-esims-scroll" showsVerticalScrollIndicator={false}
      contentInsetAdjustmentBehavior="never" contentContainerStyle={[
        styles.content,
        { paddingTop: topInset + 16, paddingBottom: Math.max(120, bottomInset + tabBarLayout.height + 20),
          paddingLeft: Math.max(insets.left, 12), paddingRight: Math.max(insets.right, 12) },
      ]}>
      <View style={styles.header} accessibilityRole="header" accessibilityLabel="Мои eSIM" testID="my-esims-heading">
        <View style={styles.headingSlot}>
          <Image source={assets.heading} style={styles.heading} contentFit="contain" accessible={false} />
        </View>
      </View>

      {auth.user && orders.state.status === 'loading' ? <View style={styles.status}><ActivityIndicator color={colors.accent} /><Text style={styles.description}>Загружаем ваши eSIM…</Text></View>
        : auth.user && orders.state.status === 'error' ? <View style={styles.status} testID="my-esims-load-error"><Text style={styles.description}>{orders.state.message}</Text><Pressable onPress={orders.reload} accessibilityRole="button" style={[styles.button, styles.signIn]}><Text style={styles.buttonText}>Повторить</Text></Pressable></View>
        : auth.user && orders.state.status === 'ready' && orders.state.response.data.length > 0 ? <>
          <PurchasedOrders orders={orders.state.response.data} onSelect={(orderId) => navigation.navigate('OrderStatus', { orderId })} />
          {orders.state.error && <Text style={styles.description}>{orders.state.error}</Text>}
          {orders.state.response.meta.has_more && orders.state.response.meta.next_cursor && <Pressable onPress={() => void orders.loadMore()} disabled={orders.state.loadingMore} accessibilityRole="button" testID="my-esims-load-more" style={[styles.button, styles.signIn]}><Text style={styles.buttonText}>{orders.state.loadingMore ? 'Загружаем…' : 'Ещё заказы'}</Text></Pressable>}
          <Pressable onPress={() => navigation.navigate('Countries')} accessibilityRole="button" style={[styles.button, styles.chooseCountry]}><Text style={styles.buttonText}>Выбрать новую eSIM</Text></Pressable>
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

        <Text style={styles.description} numberOfLines={auth.user ? 1 : 2} adjustsFontSizeToFit minimumFontScale={0.8} testID="my-esims-description">
          {auth.user ? 'Купите eSIM — она появится здесь.' : 'Купите eSIM — она появится здесь.\nУже покупали? Войдите по почте'}
        </Text>

        <View style={styles.actions}>
          <Pressable onPress={() => navigation.navigate('Countries')} accessibilityRole="button" testID="my-esims-choose-country"
            style={({ pressed }) => [styles.button, styles.chooseCountry, pressed && styles.pressed]}>
            <Text style={styles.buttonText}>Выбрать страну</Text>
          </Pressable>
          {!auth.user && <Pressable onPress={() => navigation.navigate('EmailSignIn')} disabled={auth.loading}
            accessibilityRole="button" accessibilityState={{ disabled: auth.loading }} testID="my-esims-sign-in"
            style={({ pressed }) => [styles.button, styles.signIn, (pressed || auth.loading) && styles.pressed]}>
            <Text style={styles.buttonText}>Войти</Text>
          </Pressable>}
        </View>
      </View>}
    </ScrollView>
  </View>;
}

const fontFamily = Platform.select({ ios: 'System', android: 'sans-serif', default: 'system-ui' });
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  status: { borderRadius: 28, padding: 24, gap: 16, backgroundColor: colors.surface },
  content: { width: '100%', maxWidth: 375, alignSelf: 'center', gap: 12 },
  header: { height: 42, paddingHorizontal: 12, paddingBottom: 4 },
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
  button: { height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  chooseCountry: { backgroundColor: colors.tariffAccent },
  signIn: { backgroundColor: colors.selectedTab },
  buttonText: { fontFamily, fontSize: 16, lineHeight: 22, fontWeight: '600', letterSpacing: -0.064,
    color: colors.text, includeFontPadding: false },
  pressed: { opacity: 0.7 },
});
