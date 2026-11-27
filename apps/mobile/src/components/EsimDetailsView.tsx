import { GlassActionButton } from './GlassActionButton';
import { Image } from 'expo-image';
import { useState, type PropsWithChildren } from 'react';
import { Modal, Share } from 'react-native';
import { ScrollView } from '../ui/ScrollView';
import { AnimatedView, Pressable, View } from '../ui/Surface';
import { StyleSheet } from '../ui/design';
import { Text } from '../ui/Text';
import type { OrderData } from '../../../../packages/shared/contracts/checkout';
import type { CatalogEsim } from '../../../../packages/shared/contracts/catalog';
import { orderCountry, orderDataLabel, orderStateLabel } from '../orders/display';
import { trafficDisplay } from '../orders/myEsims';
import { formatDuration } from '../tariffs/tariffs';
import { CountryFlag } from './CountryFlag';
import { AllowanceRing } from './PurchasedEsimView';
import { colors } from '../theme';
import { modalDragStyle, useModalSwipe } from '../hooks/useModalSwipe';
export function EsimDetailsView({ order, country, initialTopUp = false, topInset, bottomInset, onBack, onInstall, onCatalog }: {
  order: OrderData; country?: CatalogEsim; initialTopUp?: boolean; topInset: number; bottomInset: number;
  onBack: () => void; onInstall: () => void; onCatalog: () => void;
}) {
  const [topUp, setTopUp] = useState(initialTopUp); const [error, setError] = useState('');
  const traffic = trafficDisplay(order);
  const date = (value: string | null | undefined) => value ? new Date(value).toLocaleDateString('ru', { day: 'numeric', month: 'long' }) : 'Пока нет данных';
  const share = async () => { try { await Share.share({ message: `${order.esim.name} · ${orderDataLabel(order)} · ${formatDuration(order.tariff.duration)}` }); } catch { setError('Не удалось поделиться'); } };
  return <View style={s.screen}><ScrollView contentContainerStyle={[s.content, { paddingTop: topInset + 8, paddingBottom: bottomInset + 20 }]}>
    <View style={s.nav}><GlassActionButton action="back" onPress={onBack} /><Text style={s.title}>Моя eSIM</Text><GlassActionButton action="share" onPress={share} /></View>
    <View style={s.card}><View style={s.row}><CountryFlag country={country ?? orderCountry(order)} size={40} /><Text style={[s.title, { flex: 1 }]}>{order.esim.name}</Text><Text style={s.badge}>{orderStateLabel(order)}</Text></View>
      <View style={s.row}><AllowanceRing ratio={traffic.ratio} amount={traffic.amount} caption={traffic.observed ? `${traffic.unit} осталось` : 'остаток уточняется'} /><View style={{ flex: 1, gap: 12 }}><Text style={s.muted}>Трафик</Text><Text style={s.body}>{traffic.legend}</Text><Text style={s.muted}>Срок</Text><Text style={s.body}>{formatDuration(order.tariff.duration)}</Text></View></View>
    </View>
    <View style={s.actions}><Pressable onPress={() => setTopUp(true)} style={[s.action, { backgroundColor: colors.lime }]}><Text style={[s.title, { color: colors.ink }]}>+</Text><Text style={{ color: colors.ink }}>Докупить</Text></Pressable><Pressable onPress={onInstall} style={s.action}><Image source={require('../../assets/installation/qr.svg')} style={s.icon} /><Text style={s.body}>Установка</Text></Pressable><GlassActionButton action="share" onPress={share} style={s.action} caption={<Text style={s.body}>Поделиться</Text>} /></View>
    <View style={s.card}><Text style={s.title}>Пакет</Text>{[['Длительность', formatDuration(order.tariff.duration)], ['Активирована', date(order.activated_at)], ['Истекает', date(order.expires_at)]].map(([label, value]) => <View key={label} style={s.detail}><Text style={s.muted}>{label}</Text><Text style={s.body}>{value}</Text></View>)}</View>
    {!!error && <Text style={s.muted}>{error}</Text>}
  </ScrollView>
    {topUp && <TopUpSheet onClose={() => setTopUp(false)}>
      <Text style={s.muted}>Пополнение и смена страны на этой eSIM пока недоступны.</Text>
      <View style={s.card}>
        <Text style={s.body}>Новая поездка</Text>
        <Text style={s.muted}>Можно приобрести отдельную eSIM для другой страны. Её потребуется установить.</Text>
      </View>
      <Pressable onPress={() => { setTopUp(false); onCatalog(); }} style={s.button}><Text style={s.body}>Выбрать новую eSIM</Text></Pressable>
    </TopUpSheet>}
  </View>;
}

function TopUpSheet({ children, onClose }: PropsWithChildren<{ onClose: () => void }>) {
  const swipe = useModalSwipe(onClose, { waitForShow: true });
  return <Modal visible transparent animationType="none" onRequestClose={onClose} onShow={swipe.onShow}>
    <View style={s.overlay}>
      <AnimatedView pointerEvents="none" style={[StyleSheet.absoluteFill, s.backdrop, swipe.backdropStyle]} />
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Закрыть" />
      <AnimatedView {...swipe.panHandlers} onLayout={swipe.onLayout} style={[s.sheet, swipe.panelStyle, modalDragStyle]} accessibilityViewIsModal>
        <View style={s.sheetHeader}>
          <Text style={[s.title, s.sheetTitle]} accessibilityRole="header">Докупить</Text>
          <GlassActionButton action="close" onPress={onClose} accessibilityLabel="Закрыть пополнение" testID="top-up-close" />
        </View>
        {children}
      </AnimatedView>
    </View>
  </Modal>;
}

const s=StyleSheet.create({screen:{flex:1,backgroundColor:colors.background},content:{width:'100%',paddingHorizontal:12,gap:12},nav:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:12},icon:{width:20,height:20},title:{fontSize:22,lineHeight:28,fontWeight:'800',color:colors.text},body:{fontSize:14,lineHeight:20,color:colors.text},muted:{fontSize:14,lineHeight:20,color:colors.mutedText},card:{padding:18,borderRadius:24, borderCurve: 'continuous',backgroundColor:colors.surface,gap:16},row:{flexDirection:'row',alignItems:'center',gap:12},badge:{color:colors.lime,fontSize:11,maxWidth:90},actions:{flexDirection:'row',gap:8},action:{flex:1,minHeight:72,borderRadius:20, borderCurve: 'continuous',backgroundColor:colors.surface,alignItems:'center',justifyContent:'center',gap:8},detail:{flexDirection:'row',justifyContent:'space-between',gap:8,paddingVertical:8,borderBottomWidth:1,borderBottomColor:'#38383c'},overlay:{flex:1,justifyContent:'flex-end'},backdrop:{backgroundColor:'rgba(0,0,0,0.65)'},sheet:{padding:24,paddingBottom:40,borderTopLeftRadius:32,borderTopRightRadius:32,backgroundColor:'#1d1d20',gap:16,width:'100%'},button:{backgroundColor:colors.tariffAccent,padding:18,borderRadius:16, borderCurve: 'continuous',alignItems:'center'},sheetHeader:{flexDirection:'row',alignItems:'center',gap:12},sheetTitle:{flex:1}});
