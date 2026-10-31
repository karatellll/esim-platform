import { useState } from 'react';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { ScrollView } from '../ui/ScrollView';
import { Pressable, View } from '../ui/Surface';
import { StyleSheet } from '../ui/design';
import { Text, TextInput } from '../ui/Text';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthProvider';
import type { RootStackParamList } from '../navigation/stack';
import { colors } from '../theme';

export function ProfileEditScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'ProfileEdit'>) {
  const auth = useAuth();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(auth.user?.display_name || auth.user?.email.split('@')[0] || '');
  const [avatar, setAvatar] = useState(auth.user?.avatar ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const choosePhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
      if (result.canceled) return;
      const resized = await manipulateAsync(result.assets[0].uri, [{ resize: { width: 320 } }], { compress: 0.65, format: SaveFormat.JPEG, base64: true });
      if (!resized.base64 || resized.base64.length > 266000) throw new Error('Выберите фотографию меньшего размера');
      setAvatar('data:image/jpeg;base64,' + resized.base64);
    } catch { setError('Не удалось выбрать фотографию. Попробуйте другую.'); }
  };
  const save = async () => {
    if (busy || !name.trim()) return;
    setBusy(true); setError('');
    try { await auth.saveProfile(name.trim(), avatar); navigation.goBack(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Не удалось сохранить профиль'); }
    finally { setBusy(false); }
  };
  return <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[s.content, { paddingTop: (Platform.OS === 'web' ? 48 : insets.top) + 8 }]}>
      <View style={s.nav}><Pressable accessibilityLabel="Назад" onPress={() => navigation.goBack()} style={s.back}><Image source={require('../../assets/mvp/caa7b.svg')} style={s.icon} /></Pressable><Text style={s.title}>Профиль</Text><Pressable disabled={busy || !name.trim()} onPress={save}><Text style={s.link}>{busy ? 'Сохраняем…' : 'Сохранить'}</Text></Pressable></View>
      <Pressable onPress={choosePhoto} disabled={busy} accessibilityLabel="Выбрать фото" style={s.avatar}>{avatar ? <Image source={{ uri: avatar }} style={s.avatarImage} /> : <Image source={require('../../assets/mvp/107dc.svg')} style={{ width: 40, height: 40 }} />}</Pressable>
      <Pressable onPress={choosePhoto} disabled={busy}><Text style={[s.link, s.center]}>{avatar ? 'Изменить фото' : 'Добавить фото'}</Text></Pressable>
      {avatar && <Pressable onPress={() => setAvatar(null)} disabled={busy}><Text style={[s.label, s.center]}>Удалить фото</Text></Pressable>}
      <Text style={s.label}>Имя</Text><TextInput testID="profile-name-input" accessibilityLabel="Имя" value={name} onChangeText={setName} maxLength={80} editable={!busy} style={s.input} selectionColor={colors.accent} />
      <Text style={s.label}>Почта</Text><View style={s.email}><Text style={s.emailText}>{auth.user?.email}</Text><Image source={require('../../assets/mvp/3efc7.svg')} style={s.icon} /></View><Text style={s.hint}>Почта — вход в аккаунт, изменить её нельзя</Text>
      {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    </ScrollView>
  </KeyboardAvoidingView>;
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, content: { width: '100%', padding: 12, paddingBottom: 40 },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, paddingHorizontal: 12 }, back: { width: 40, height: 40, borderRadius: 20, borderCurve: 'continuous', backgroundColor: colors.selectedTab, alignItems: 'center', justifyContent: 'center' }, icon: { width: 20, height: 20 },
  title: { fontSize: 20, fontWeight: '800', color: colors.text }, link: { color: colors.accent, fontSize: 16, fontWeight: '700' }, center: { textAlign: 'center', marginBottom: 16 },
  avatar: { alignSelf: 'center', width: 96, height: 96, borderRadius: 48, borderCurve: 'continuous', backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 16 }, avatarImage: { width: 96, height: 96 },
  label: { color: colors.mutedText, fontSize: 14, fontWeight: '600', marginTop: 20, marginBottom: 12 }, input: { height: 56, borderRadius: 16, borderCurve: 'continuous', borderWidth: 2, borderColor: colors.tariffAccent, backgroundColor: colors.surface, color: colors.text, fontSize: 18, paddingHorizontal: 16 }, email: { height: 56, borderRadius: 16, borderCurve: 'continuous', backgroundColor: colors.surface, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, emailText: { color: colors.mutedText, fontSize: 18 }, hint: { color: colors.mutedText, fontSize: 13, marginTop: 12 }, error: { color: '#ff9999', marginTop: 16 },
});
