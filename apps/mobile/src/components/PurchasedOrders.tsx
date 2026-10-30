import type { OrderListItem } from '../../../../packages/shared/contracts/checkout';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CountryFlag } from './CountryFlag';
import { orderCountry, orderDataLabel, orderPrice, orderStateLabel } from '../orders/display';
import { colors } from '../theme';

export function PurchasedOrders({ orders, onSelect }: { orders: OrderListItem[]; onSelect: (id: string) => void }) {
  return <View style={styles.list} testID="my-esims-orders">
    {orders.map((order) => <Pressable key={order.id} onPress={() => onSelect(order.id)} accessibilityRole="button"
      accessibilityLabel={`${order.esim.name}, ${orderDataLabel(order)}, ${orderStateLabel(order)}`} testID={`my-esims-order-${order.id}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.row}>
        <CountryFlag country={orderCountry(order)} size={40} />
        <View style={styles.copy}><Text style={styles.title}>{order.esim.name} · {orderDataLabel(order)}</Text>
          <Text style={[styles.state, order.state === 'delivered' && styles.delivered]}>{orderStateLabel(order)}</Text></View>
      </View>
      <View style={styles.details}>
        <Text style={styles.muted}>№ {order.order_number}</Text><Text style={styles.price}>{orderPrice(order)}</Text>
      </View>
      {order.state === 'delivered' && <Text style={styles.usage}>{order.remaining
        ? `Осталось ${new Intl.NumberFormat('ru-RU').format(order.remaining.amount)} ${order.remaining.unit === 'GB' ? 'ГБ' : order.remaining.unit === 'MB' ? 'МБ' : order.remaining.unit}`
        : 'Данные об остатке ещё обновляются'}</Text>}
      <View style={styles.button}><Text style={styles.buttonText}>{order.state === 'pending_payment' ? 'Продолжить оплату' : order.state === 'delivered' ? 'Детали и установка' : 'Проверить заказ'}</Text></View>
    </Pressable>)}
  </View>;
}

const styles = StyleSheet.create({
  list: { gap: 12, width: '100%' },
  card: { padding: 18, gap: 18, borderRadius: 28, backgroundColor: colors.surface },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  copy: { flex: 1 },
  title: { fontSize: 18, lineHeight: 26, fontWeight: '700', color: colors.text },
  state: { fontSize: 13, lineHeight: 19, color: colors.mutedText },
  delivered: { color: colors.lime },
  details: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  muted: { fontSize: 12, lineHeight: 18, color: colors.mutedText },
  price: { fontSize: 16, lineHeight: 22, fontWeight: '600', color: colors.text },
  usage: { fontSize: 14, lineHeight: 20, color: colors.mutedText },
  button: { height: 48, borderRadius: 16, backgroundColor: colors.selectedTab, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 16, lineHeight: 22, fontWeight: '600', color: colors.text },
  pressed: { opacity: 0.7 },
});
