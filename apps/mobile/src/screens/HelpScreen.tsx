import { useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { Platform, KeyboardAvoidingView } from 'react-native';
import { ScrollView } from '../ui/ScrollView';
import { Pressable, View } from '../ui/Surface';
import { StyleSheet } from '../ui/design';
import { Text, TextInput } from '../ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/stack';
import type { SupportMessage, SupportResponse } from '../../../../packages/shared/contracts/support';
import { authRequest } from '../api/auth';
import { useAuth } from '../auth/AuthProvider';
import { colors } from '../theme';
const answers = {
  'Нет интернета': 'В настройках телефона выберите туристическую eSIM для мобильных данных и включите для неё роуминг данных. Проверьте, что вы находитесь в стране действия пакета. Затем включите и выключите авиарежим.',
  'Как установить eSIM': 'Подключитесь к Wi-Fi. Откройте «Мои eSIM», выберите оплаченный заказ и нажмите «Установка». Выберите быструю установку, QR-код или ручной ввод. Сохраните основную SIM для звонков.',
  'Вернуть деньги': 'Откройте заказ в «Мои eSIM» и сохраните его номер. Условия возврата зависят от состояния пакета. Автоматический возврат сейчас недоступен.',
  'Не пришёл код': 'Проверьте папку «Спам» и адрес почты. Дождитесь окончания таймера и запросите новый код. Вводите последний полученный код.',
};
export function HelpScreen({ route, navigation }: NativeStackScreenProps<RootStackParamList, 'Help'>) {
  const auth = useAuth(); const insets = useSafeAreaInsets();
  const [topic, setTopic] = useState<keyof typeof answers>(route.params?.installation ? 'Как установить eSIM' : 'Нет интернета');
  const [messages, setMessages] = useState<SupportMessage[]>([]); const [draft, setDraft] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { let active = true; if (auth.accessToken) authRequest<SupportResponse>('/api/support/messages', undefined, auth.accessToken).then(r => { if (active) setMessages(r.messages); }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, [auth.accessToken]);
  const send = async () => {
    if (!auth.accessToken) { navigation.navigate('EmailSignIn'); return; }
    if (!draft.trim() || busy) return;
    setBusy(true); setError('');
    try { const m = await authRequest<SupportMessage>('/api/support/messages', { text: draft.trim() }, auth.accessToken); setMessages(prev => [...prev, m]); setDraft(''); }
    catch(e) { setError(e instanceof Error ? e.message : 'Не удалось сохранить сообщение'); }
    finally { setBusy(false); }
  };
  return <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><View style={[s.content, { paddingTop: (Platform.OS === 'web' ? 48 : insets.top) + 8, paddingBottom: Math.max(insets.bottom, 24) }]}>
    <View style={s.nav}><Pressable onPress={() => navigation.goBack()} accessibilityLabel="Назад" style={s.back}><Image source={require('../../assets/mvp/caa7b.svg')} style={s.icon} /></Pressable><Text style={s.title}>Поддержка</Text><View style={s.backSpacer} /></View>
    <ScrollView contentContainerStyle={{ gap: 12, paddingVertical: 16 }} keyboardShouldPersistTaps="handled">
      <Text style={s.muted}>Справка и ваши обращения</Text><View style={s.answer}><Text style={s.title}>{topic}</Text><Text style={s.body}>{answers[topic]}</Text></View>
      <View style={s.chips}>{(Object.keys(answers) as (keyof typeof answers)[]).map(key => <Pressable key={key} onPress={() => setTopic(key)} style={s.chip}><Text style={s.body}>{key}</Text></Pressable>)}</View>
      <Text style={s.muted}>Оператор пока не подключён. Сообщения сохраняются в аккаунте, но не передаются оператору.</Text>
      {messages.map(m => <View key={m.id} style={s.bubble}><Text style={s.body}>{m.text}</Text><Text style={s.timestamp}>Сохранено · {new Date(m.created_at).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}</Text></View>)}
      {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    </ScrollView>
    <View style={s.composer}><TextInput accessibilityLabel="Сообщение" value={draft} onChangeText={setDraft} placeholder="Сообщение" placeholderTextColor={colors.mutedText} maxLength={2000} style={s.input} multiline /><Pressable onPress={send} disabled={busy || (!!auth.user && !draft.trim())} accessibilityLabel="Сохранить сообщение" style={s.send}><Image source={require('../../assets/mvp/65127.svg')} style={s.icon} /></Pressable></View>
  </View></KeyboardAvoidingView>;
}
const s = StyleSheet.create({screen:{flex:1,backgroundColor:colors.background},content:{flex:1,width:'100%',paddingHorizontal:12},nav:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:12},back:{width:40,height:40,borderRadius:20, borderCurve: 'continuous',backgroundColor:colors.selectedTab,alignItems:'center',justifyContent:'center'},backSpacer:{width:40},icon:{width:20,height:20},title:{fontSize:20,fontWeight:'800',color:colors.text},muted:{color:colors.mutedText,fontSize:13,lineHeight:19,paddingHorizontal:12},body:{color:colors.text,fontSize:15,lineHeight:22},answer:{backgroundColor:colors.surface,padding:16,borderRadius:24, borderCurve: 'continuous',gap:12},chips:{flexDirection:'row',flexWrap:'wrap',gap:8},chip:{paddingHorizontal:12,paddingVertical:8,borderRadius:16, borderCurve: 'continuous',backgroundColor:colors.selectedTab},bubble:{alignSelf:'flex-end',maxWidth:'85%',padding:14,borderRadius:20, borderCurve: 'continuous',backgroundColor:colors.tariffAccent,gap:8},timestamp:{color:'rgba(255,255,255,0.6)',fontSize:11,textAlign:'right'},composer:{flexDirection:'row',alignItems:'center',gap:8,padding:6,paddingLeft:16,borderRadius:24, borderCurve: 'continuous',backgroundColor:colors.surface},input:{flex:1,color:colors.text,fontSize:16,maxHeight:120,paddingVertical:8},send:{width:36,height:36,borderRadius:18, borderCurve: 'continuous',backgroundColor:colors.tariffAccent,alignItems:'center',justifyContent:'center'},error:{color:'#ff9999'}});
