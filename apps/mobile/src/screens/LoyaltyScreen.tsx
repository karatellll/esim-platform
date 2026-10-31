import { Image } from 'expo-image';
import { Platform } from 'react-native';
import { ScrollView } from '../ui/ScrollView';
import { Pressable, View } from '../ui/Surface';
import { StyleSheet } from '../ui/design';
import { Text } from '../ui/Text';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../navigation/stack';
import { colors } from '../theme';
export function LoyaltyScreen({ route, navigation }: NativeStackScreenProps<RootStackParamList, 'Loyalty'>) {
  const insets = useSafeAreaInsets(); const invite = route.params.mode === 'invite';
  return <View style={s.screen}><ScrollView contentContainerStyle={[s.content, { paddingTop: (Platform.OS === 'web' ? 48 : insets.top) + 8, paddingBottom: Math.max(insets.bottom, 24) }]}>
    <Pressable accessibilityLabel="Назад" onPress={() => navigation.goBack()} style={s.back}><Image source={require('../../assets/mvp/caa7b.svg')} style={{ width: 20, height: 20 }} /></Pressable>
    <Text style={s.heading}>{invite ? 'Зовите друзей —' : 'Меняем копилку'}</Text><View style={s.sticker}><Text style={s.stickerText}>{invite ? 'путешествуйте вместе' : 'на eSIM'}</Text></View>
    <View style={s.ticket}><Text style={s.big}>{invite ? 'Вам и другу' : 'Бесплатная eSIM'}</Text><Text style={s.ticketText}>{invite ? 'Здесь появится ваш код приглашения и условия бонуса для друзей.' : 'Здесь появятся пакеты, которые можно получить за накопления.'}</Text><Image source={require('../../assets/savings/mascot.svg')} style={s.mascot} contentFit="contain" /></View>
    <View style={s.card}><Text style={s.label}>{invite ? 'Ваш код' : 'Доступно для обмена'}</Text><Text style={s.big}>—</Text><Text style={s.label}>{invite ? 'Приглашения пока недоступны' : 'Обмен пока недоступен'}</Text></View>
    <View style={s.stats}><View style={[s.card, { flex: 1 }]}><Text style={s.big}>—</Text><Text style={s.label}>{invite ? 'друзья пришли' : 'в копилке'}</Text></View><View style={[s.card, { flex: 1 }]}><Text style={s.big}>—</Text><Text style={s.label}>{invite ? 'уже получено' : 'пакетов доступно'}</Text></View></View>
    <Text style={s.label}>Мы покажем доступные предложения, когда программа накоплений заработает.</Text>
    <Pressable onPress={() => navigation.navigate('Main', { screen: 'Countries' })} style={s.button}><Text style={s.buttonText}>Посмотреть тарифы</Text></Pressable>
  </ScrollView></View>;
}
const s=StyleSheet.create({screen:{flex:1,backgroundColor:colors.background},content:{width:'100%',paddingHorizontal:12,gap:12},back:{width:40,height:40,borderRadius:20, borderCurve: 'continuous',backgroundColor:colors.selectedTab,alignItems:'center',justifyContent:'center',marginLeft:12,marginBottom:8},heading:{fontSize:28,lineHeight:36,fontWeight:'900',color:colors.text,paddingHorizontal:12},sticker:{alignSelf:'flex-start',marginLeft:12,backgroundColor:colors.lime,borderRadius:12, borderCurve: 'continuous',paddingHorizontal:10,paddingVertical:4,transform:[{rotate:'1.5deg'}]},stickerText:{fontSize:24,fontWeight:'900',color:colors.ink},ticket:{backgroundColor:colors.tariffAccent,borderRadius:24, borderCurve: 'continuous',padding:18,marginTop:12,minHeight:240,overflow:'hidden',gap:8},big:{fontSize:30,fontWeight:'900',color:colors.text},ticketText:{fontSize:15,lineHeight:21,color:'#e0e2ff',maxWidth:270},mascot:{position:'absolute',bottom:8,right:24,width:102,height:109},card:{padding:16,borderRadius:24, borderCurve: 'continuous',backgroundColor:colors.surface,gap:8},label:{fontSize:14,lineHeight:20,color:colors.mutedText},stats:{flexDirection:'row',gap:12},button:{backgroundColor:colors.tariffAccent,padding:18,marginTop:24,borderRadius:16, borderCurve: 'continuous',alignItems:'center'},buttonText:{color:colors.text,fontSize:16,fontWeight:'600'}});
