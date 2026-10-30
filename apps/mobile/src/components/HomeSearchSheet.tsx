import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { CatalogEsim } from '../../../../packages/shared/contracts/catalog';
import { formatCatalogPrice, getCatalogPrice } from '../catalog/prices';
import { homeAssets } from '../home/assets';
import type { useCatalogCategories } from '../hooks/useCatalogCategories';
import { colors } from '../theme';
import { CatalogStatus } from './CatalogStatus';
import { CountryFlag } from './CountryFlag';

export type HomeSearchStep = 'country' | 'duration' | 'usage';

const durations = [
  { days: 7, label: 'До недели', description: 'пакеты на 7 дней' },
  { days: 15, label: 'Две недели', description: 'пакеты на 15 дней' },
  { days: 30, label: 'Месяц', description: 'пакеты на 30 дней' },
  { days: null, label: 'Пока не знаю', description: 'покажем все варианты' },
] as const;
const usages = [
  { value: 1, label: 'Карты и мессенджеры', description: '≈ 1 ГБ в неделю', icon: homeAssets.globe },
  { value: 2, label: 'Соцсети и видео', description: '≈ 2 ГБ в неделю', icon: homeAssets.play },
  { value: 5, label: 'Работа и раздача', description: '≈ 5 ГБ в неделю', icon: homeAssets.wifi },
] as const;

type Props = {
  step: HomeSearchStep | null;
  onStepChange: (step: HomeSearchStep) => void;
  onClose: () => void;
  catalog: ReturnType<typeof useCatalogCategories>;
  countries: CatalogEsim[];
  selectedCountry: CatalogEsim | null;
  onSelectCountry: (country: CatalogEsim | null) => void;
  days: number | null;
  onSelectDays: (days: number | null) => void;
  usage: number | null;
  onSelectUsage: (usage: number | null) => void;
  onFind: () => void;
};

export function HomeSearchSheet({ step, onStepChange, onClose, catalog, countries, selectedCountry, onSelectCountry, days, onSelectDays, usage, onSelectUsage, onFind }: Props) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const input = useRef<TextInput>(null);
  const [query, setQuery] = useState('');
  useEffect(() => {
    if (step === 'country') setQuery(selectedCountry?.display_name ?? '');
    else Keyboard.dismiss();
  }, [step, selectedCountry]);
  const normalizedQuery = query.trim().toLocaleLowerCase('ru');
  const results = countries.filter((country) => !normalizedQuery || `${country.display_name} ${country.country_iso2}`.toLocaleLowerCase('ru').includes(normalizedQuery));
  const fields = [
    { key: 'country' as const, label: selectedCountry?.display_name ?? 'Куда летите?', icon: homeAssets.search },
    { key: 'duration' as const, label: durations.find((item) => item.days === days && days !== null)?.label ?? 'Срок поездки', icon: homeAssets.calendar },
    { key: 'usage' as const, label: usages.find((item) => item.value === usage)?.label ?? 'Сколько интернета', icon: homeAssets.wifi },
  ];

  return <Modal visible={step !== null} transparent animationType="slide" onRequestClose={onClose}
    onShow={() => { if (step === 'country') input.current?.focus(); }}>
    <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Закрыть подбор" testID="home-sheet-backdrop" />
      <View style={[styles.sheet, { maxHeight: height - Math.max(insets.top + 6, 54), paddingBottom: Math.max(insets.bottom, 20) }]}
        accessibilityViewIsModal testID="home-search-sheet">
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Закрыть подбор" hitSlop={12} style={styles.handle} testID="home-sheet-close" />
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
          <View style={styles.fields}>
            {fields.map((field, index) => <Pressable key={field.key} onPress={() => { onStepChange(field.key); if (field.key === 'country') input.current?.focus(); }}
              accessibilityRole="button" accessibilityLabel={field.key === 'country' ? 'Куда летите?' : field.key === 'duration' ? 'Срок поездки' : 'Сколько интернета'}
              style={[styles.field, index < 2 && styles.separator, step === field.key && styles.activeField]} testID={`home-sheet-${field.key}`}>
              <Image source={field.icon} style={styles.fieldIcon} contentFit="contain" accessible={false} />
              {field.key === 'country' && step === 'country'
                ? <TextInput ref={input} style={styles.input} value={query} onChangeText={setQuery} placeholder="Куда летите?" placeholderTextColor={colors.mutedText}
                    selectionColor={colors.tariffAccent} accessibilityLabel="Поиск страны" testID="home-country-input" autoCorrect={false} autoCapitalize="none" returnKeyType="search" />
                : <Text style={[styles.fieldText, ((field.key === 'country' && !!selectedCountry) || (field.key === 'duration' && !!days) || (field.key === 'usage' && !!usage)) && styles.selectedText]} numberOfLines={1}>{field.label}</Text>}
              {field.key === 'country' && step === 'country' && !!query && <Pressable onPress={() => { setQuery(''); onSelectCountry(null); input.current?.focus(); }}
                accessibilityRole="button" accessibilityLabel="Очистить поиск" hitSlop={8} style={styles.clear} testID="home-country-clear">
                <Image source={homeAssets.close} style={styles.closeIcon} contentFit="contain" accessible={false} />
              </Pressable>}
              {field.key !== 'country' && !(field.key === 'duration' ? days : usage) && <View style={styles.optional}><Text style={styles.optionalText}>необязательно</Text></View>}
            </Pressable>)}
          </View>

          {step === 'country' && <View style={styles.panel}>
            <Text style={styles.panelTitle} accessibilityRole="header">{normalizedQuery ? 'Нашлось' : 'Куда летите?'}</Text>
            {catalog.state.status !== 'ready' ? <CatalogStatus state={catalog.state} onRetry={catalog.reload} />
              : results.length === 0 ? <Text style={styles.empty}>Ничего не найдено. Попробуйте другое название.</Text>
              : results.map((country, index) => <Pressable key={country.id} onPress={() => { onSelectCountry(country); onStepChange('duration'); }}
                  accessibilityRole="button" accessibilityLabel={`Выбрать ${country.display_name}`} testID={`home-result-${country.country_iso2}`}
                  style={({ pressed }) => [styles.result, index < results.length - 1 && styles.separator, pressed && styles.pressed]}>
                  <CountryFlag country={country} size={32} />
                  <Text style={styles.resultName}>{country.display_name}</Text>
                  <Text style={styles.resultPrice}>{formatCatalogPrice(getCatalogPrice(country))}</Text>
                </Pressable>)}
          </View>}

          {step === 'duration' && <View style={styles.panel}>
            <View style={styles.panelHeader}><Text style={styles.optionTitle} accessibilityRole="header">На сколько едете?</Text><Text style={styles.skipHint}>можно пропустить</Text></View>
            {durations.map((item, index) => <Pressable key={item.days ?? 'any'} onPress={() => { onSelectDays(item.days); onStepChange('usage'); }}
              accessibilityRole="radio" accessibilityState={{ checked: days === item.days }} testID={`home-days-${item.days ?? 'any'}`}
              style={({ pressed }) => [styles.option, index < durations.length - 1 && styles.separator, pressed && styles.pressed]}>
              <View style={styles.optionCopy}><Text style={styles.optionLabel}>{item.label}</Text><Text style={styles.optionDescription}>{item.description}</Text></View>
              <View style={[styles.radio, days === item.days && styles.radioSelected]}>{days === item.days && <Image source={homeAssets.check} style={styles.check} contentFit="contain" accessible={false} />}</View>
            </Pressable>)}
          </View>}

          {step === 'usage' && <View style={styles.panel}>
            <Text style={styles.panelTitle} accessibilityRole="header">Как будете пользоваться?</Text>
            {usages.map((item, index) => <Pressable key={item.value} onPress={() => onSelectUsage(item.value)}
              accessibilityRole="radio" accessibilityState={{ checked: usage === item.value }} testID={`home-data-${item.value}`}
              style={({ pressed }) => [styles.usageOption, index < usages.length - 1 && styles.separator, pressed && styles.pressed]}>
              <View style={[styles.usageIconContainer, usage === item.value && styles.radioSelected]}><Image source={item.icon} style={styles.fieldIcon} contentFit="contain" accessible={false} /></View>
              <View style={styles.optionCopy}><Text style={styles.optionLabel}>{item.label}</Text><Text style={[styles.optionDescription, usage === item.value && styles.usageSelectedDescription]}>{item.description}</Text></View>
              <View style={[styles.radio, usage === item.value && styles.radioSelected]}>{usage === item.value && <Image source={homeAssets.check} style={styles.check} contentFit="contain" accessible={false} />}</View>
            </Pressable>)}
            <Pressable accessibilityRole="button" testID="home-data-any" onPress={() => onSelectUsage(null)} style={styles.skip}><Text style={styles.skipText}>Показать все объёмы</Text></Pressable>
          </View>}
        </ScrollView>
        <Pressable style={({ pressed }) => [styles.submit, pressed && styles.pressed]} onPress={onFind} accessibilityRole="button" testID="home-sheet-find">
          <Text style={styles.submitText}>Подобрать eSIM</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}

const fontFamily = Platform.select({ ios: 'System', android: 'sans-serif', default: 'system-ui' });
const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: { width: '100%', maxWidth: 375, height: '100%', alignSelf: 'center', backgroundColor: '#121213', borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingTop: 28, paddingHorizontal: 16, gap: 12, overflow: 'hidden' },
  handle: { position: 'absolute', top: 8, left: '50%', marginLeft: -18, width: 36, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)' },
  sheetContent: { gap: 12, paddingBottom: 12 },
  fields: { backgroundColor: '#242426', borderRadius: 20, overflow: 'hidden' },
  field: { flexDirection: 'row', height: 56, alignItems: 'center', gap: 12, paddingLeft: 16, paddingRight: 14 },
  activeField: { backgroundColor: 'rgba(77,92,255,0.12)' },
  fieldIcon: { width: 20, height: 20 },
  fieldText: { flex: 1, fontFamily, fontSize: 16, lineHeight: 22, letterSpacing: -0.064, color: 'rgba(255,255,255,0.4)' },
  selectedText: { color: colors.text },
  input: { flex: 1, minWidth: 0, fontFamily, fontSize: 16, lineHeight: 22, fontWeight: '600', letterSpacing: -0.064, color: colors.text, padding: 0, outlineWidth: 0 },
  clear: { width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  closeIcon: { width: 14, height: 14 },
  optional: { backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  optionalText: { fontFamily, fontSize: 12, lineHeight: 16, letterSpacing: -0.048, color: 'rgba(255,255,255,0.4)' },
  separator: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  panel: { backgroundColor: '#242426', borderRadius: 20, paddingTop: 16, paddingBottom: 4, overflow: 'hidden' },
  panelHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8, gap: 4 },
  panelTitle: { fontFamily, fontSize: 20, lineHeight: 26, fontWeight: '800', letterSpacing: -0.3, color: colors.text, paddingHorizontal: 16, paddingBottom: 8 },
  optionTitle: { fontFamily, fontSize: 20, lineHeight: 26, fontWeight: '800', letterSpacing: -0.3, color: colors.text },
  skipHint: { fontFamily, fontSize: 12, lineHeight: 18, color: 'rgba(255,255,255,0.4)' },
  result: { paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  resultName: { flex: 1, fontFamily, fontSize: 16, lineHeight: 22, fontWeight: '500', letterSpacing: -0.064, color: colors.text },
  resultPrice: { fontFamily, fontSize: 14, lineHeight: 20, fontWeight: '600', letterSpacing: -0.056, color: colors.text },
  empty: { padding: 16, fontFamily, fontSize: 14, lineHeight: 20, color: colors.mutedText },
  option: { paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  optionCopy: { flex: 1 },
  optionLabel: { fontFamily, fontSize: 16, lineHeight: 22, fontWeight: '500', letterSpacing: -0.064, color: colors.text },
  optionDescription: { fontFamily, fontSize: 14, lineHeight: 20, letterSpacing: -0.056, color: 'rgba(255,255,255,0.45)' },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  radioSelected: { backgroundColor: colors.tariffAccent, borderColor: colors.tariffAccent },
  check: { width: 16, height: 16 },
  usageOption: { paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  usageIconContainer: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  usageSelectedDescription: { color: colors.lime },
  skip: { alignItems: 'center', padding: 12 },
  skipText: { fontFamily, fontSize: 14, lineHeight: 20, color: colors.accent },
  submit: { minHeight: 52, flexShrink: 0, borderRadius: 16, backgroundColor: colors.tariffAccent, alignItems: 'center', justifyContent: 'center' },
  submitText: { fontFamily, fontSize: 16, lineHeight: 22, fontWeight: '600', letterSpacing: -0.064, color: colors.text },
  pressed: { opacity: 0.75 },
});
