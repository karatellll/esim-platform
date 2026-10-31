import type { CatalogEsim } from '../../../../packages/shared/contracts/catalog';
import { Image } from 'expo-image';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Modal, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { countLabel } from '../catalog/catalog';
import { highlightCountryName, searchCountries } from '../catalog/countrySearch';
import { Pressable, View } from '../ui/Surface';
import { ScrollView } from '../ui/ScrollView';
import { fonts, StyleSheet } from '../ui/design';
import { Text, TextInput } from '../ui/Text';
import { colors } from '../theme';
import { CountryFlag } from './CountryFlag';

type Props = {
  countries: readonly CatalogEsim[];
  title: string;
  subtitle: string;
  onClose: () => void;
  onSelectCountry: (country: CatalogEsim) => void;
  onSupport: () => void;
  testID?: string;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
};

// Category membership is catalog data, not evidence of a package's coverage.
export function CatalogCountrySheet({ countries, title, subtitle, onClose, onSelectCountry, onSupport, testID = 'catalog-country-sheet', loading, error, onRetry }: Props) {
  const insets = useSafeAreaInsets();
  const input = useRef<TextInput>(null);
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const filtered = useMemo(() => searchCountries(countries, query), [countries, query]);
  const close = () => { Keyboard.dismiss(); onClose(); };
  const searching = !!query.trim();
  const groups = useMemo(() => {
    const sections = new Map<string, CatalogEsim[]>();
    for (const country of filtered) {
      const letter = searching ? '' : country.display_name.trim()[0]?.toLocaleUpperCase('ru').replace('Ё', 'Е') ?? '';
      const items = sections.get(letter) ?? [];
      items.push(country);
      sections.set(letter, items);
    }
    return [...sections];
  }, [filtered, searching]);

  return <Modal visible transparent animationType="slide" statusBarTranslucent onRequestClose={close}>
    <View style={s.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityRole="button" accessibilityLabel="Закрыть список стран" />
      <View style={[s.sheet, { marginTop: Platform.OS === 'web' ? 96 : Math.max(insets.top + 48, 64), paddingBottom: Math.max(insets.bottom, 24) }]} accessibilityViewIsModal testID={testID}>
        <View style={s.handle} />
        <View style={s.header}>
          <View style={s.heading}><Text style={s.title} accessibilityRole="header">{title}</Text><Text style={s.subtitle}>{subtitle}</Text></View>
          <Pressable onPress={close} style={s.close} accessibilityRole="button" accessibilityLabel="Закрыть список стран" testID={`${testID}-close`}>
            <Image source={require('../../assets/countries/sheet-close.svg')} style={s.icon} accessible={false} />
          </Pressable>
        </View>
        <View style={[s.search, (focused || searching) && s.searchFocused]} testID={`${testID}-search-field`}>
          <Image source={require('../../assets/countries/search.svg')} style={s.icon} accessible={false} />
          <TextInput ref={input} value={query} onChangeText={setQuery} placeholder="Найти страну" placeholderTextColor="rgba(255,255,255,0.4)"
            onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} autoCorrect={false} autoCapitalize="none" returnKeyType="search"
            selectionColor={colors.tariffAccent} underlineColorAndroid="transparent" style={s.input} accessibilityLabel="Найти страну" testID={`${testID}-search`}
            onSubmitEditing={() => Keyboard.dismiss()} />
          {!!query && <Pressable hitSlop={12} onPress={() => { setQuery(''); input.current?.focus(); }} accessibilityRole="button" accessibilityLabel="Очистить поиск" testID={`${testID}-clear`}>
            <Image source={require('../../assets/countries/search-clear.svg')} style={s.clearIcon} accessible={false} />
          </Pressable>}
        </View>
        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}>
          {loading ? <ActivityIndicator color={colors.tariffAccent} accessibilityLabel="Загрузка стран" style={{ marginVertical: 24 }} /> : error ? <View style={s.support}>
            <Text style={s.network} accessibilityRole="alert">{error}</Text>
            {onRetry && <Pressable onPress={onRetry} accessibilityRole="button"><Text style={s.supportLink}>Повторить</Text></Pressable>}
          </View> : null}
          {filtered.length > 0 && <View style={s.list} testID={`${testID}-list`} accessibilityLabel={countLabel(filtered.length)}>
            {groups.map(([letter, items]) => <View key={letter}>
              {!!letter && <Text style={s.letter}>{letter}</Text>}
              {items.map(country => <Pressable key={country.id} onPress={() => { close(); onSelectCountry(country); }} style={({ pressed }) => [s.country, pressed && s.pressed]} accessibilityRole="button" accessibilityLabel={`Тарифы: ${country.display_name}`} testID={`${testID}-country-${country.country_iso2}`}>
                <CountryFlag country={country} size={32} borderWidth={1} />
                <View style={s.copy}>
                  <Text style={s.name}>{highlightCountryName(country.display_name, query).map((part, index) => <Text key={index} style={part.match ? s.highlight : undefined}>{part.text}</Text>)}</Text>
                  {!!country.network?.trim() && <Text style={s.network}>{country.network}</Text>}
                </View>
              </Pressable>)}
            </View>)}
          </View>}
          {!loading && !error && (searching || !filtered.length) && <View style={s.support} testID={`${testID}-support`}>
            <Text style={s.supportTitle}>{filtered.length ? 'Не нашли свою страну?' : searching ? 'По запросу ничего не найдено' : 'Направления пока недоступны'}</Text>
            <Pressable onPress={() => { close(); onSupport(); }} accessibilityRole="button" testID={`${testID}-contact`}><Text style={s.supportLink}>Напишите нам — подберём eSIM отдельно</Text></Pressable>
          </View>}
        </ScrollView>
      </View>
    </View>
  </Modal>;
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { width: '100%', maxWidth: 600, flex: 1, paddingTop: 8, paddingHorizontal: 12, gap: 12, borderTopLeftRadius: 32, borderTopRightRadius: 32, backgroundColor: '#1C1C1F', overflow: 'hidden' },
  handle: { width: 36, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)', alignSelf: 'center' },
  header: { paddingLeft: 12, paddingTop: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  heading: { flex: 1, minWidth: 0, gap: 4 },
  title: { fontFamily: fonts.display, fontSize: 24, lineHeight: 29, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 14, lineHeight: 17, color: colors.mutedText },
  close: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)' },
  icon: { width: 20, height: 20 },
  clearIcon: { width: 16, height: 16 },
  search: { height: 48, flexShrink: 0, paddingHorizontal: 12.5, borderWidth: 1.5, borderColor: 'transparent', borderRadius: 14, backgroundColor: '#2A2A2E', flexDirection: 'row', gap: 10, alignItems: 'center' },
  searchFocused: { borderColor: colors.tariffAccent },
  input: { flex: 1, minWidth: 0, height: 22, padding: 0, outlineWidth: 0, borderWidth: 0, fontSize: 16, lineHeight: 22, color: colors.text },
  scroll: { flex: 1 },
  scrollContent: { gap: 16 },
  list: { backgroundColor: '#2A2A2E', borderRadius: 20, paddingVertical: 6, overflow: 'hidden' },
  letter: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 2, fontSize: 14, lineHeight: 17, fontWeight: '600', color: 'rgba(255,255,255,0.45)' },
  country: { minHeight: 58, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', gap: 12, alignItems: 'center' },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontSize: 16, lineHeight: 19, fontWeight: '600', color: colors.text },
  highlight: { color: colors.tariffAccent },
  network: { fontSize: 14, lineHeight: 17, color: colors.mutedText },
  support: { gap: 4, alignItems: 'center', paddingHorizontal: 8, paddingBottom: 16 },
  supportTitle: { fontSize: 14, lineHeight: 18, fontWeight: '600', color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
  supportLink: { fontSize: 14, lineHeight: 18, color: colors.tariffAccent, textAlign: 'center' },
  pressed: { opacity: 0.7 },
});
