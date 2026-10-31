import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Modal, Platform, useWindowDimensions } from 'react-native';
import { ScrollView } from '../ui/ScrollView';
import { Pressable, View } from '../ui/Surface';
import { fonts, StyleSheet } from '../ui/design';
import { Text, TextInput } from '../ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { CatalogCategory, CatalogEsim } from '../../../../packages/shared/contracts/catalog';
import { countLabel, getCountries } from '../catalog/catalog';
import { formatCatalogPrice, getCatalogPrice } from '../catalog/prices';
import { getRegionBundle } from '../catalog/regions';
import { popularDestinations } from '../home/assets';
import { getTripPreferences, recommendTariff, type TripPreferences } from '../home/recommendation';
import type { useCatalogCategories } from '../hooks/useCatalogCategories';
import { useTripTariffs } from '../hooks/useTripTariffs';
import { useAuth } from '../auth/AuthProvider';
import { useUserOrders } from '../hooks/useUserOrders';
import { coverageSubscription } from '../api/coverage';
import { MAX_TRIP_COUNTRIES, categoryBundle, findRegions, isCountry, planTrip, searchableCountries, searchCountries, totalPrice, tripCountries, type RouteOption } from '../home/smartSearch';
import { TripFlags, TripRoutePanel } from './TripRoutePanel';
import { colors } from '../theme';
import { formatDataAmount, formatDuration, formatTariffPrice } from '../tariffs/tariffs';
import { CatalogStatus } from './CatalogStatus';
import { CountryFlag } from './CountryFlag';

export type HomeSearchStep = 'country' | 'route' | 'duration' | 'usage';
const assets = {
  search: require('../../assets/search/search.svg'),
  calendar: require('../../assets/search/calendar.svg'),
  wifi: require('../../assets/search/wifi.svg'),
  wifiActive: require('../../assets/search/wifi-active.svg'),
  close: require('../../assets/search/close.svg'),
  remove: require('../../assets/search/remove.svg'),
  check: require('../../assets/search/check.svg'),
  plus: require('../../assets/search/plus.svg'),
  chipCheck: require('../../assets/search/chip-check.svg'),
  eyes: require('../../assets/search/eyes.svg'),
};
const durations = [
  { days: 7, label: 'До недели', description: 'пакеты на 7 дней' },
  { days: 15, label: '2 недели', description: 'пакеты на 15 дней' },
  { days: 30, label: 'Месяц', description: 'пакеты на 30 дней' },
  { days: 31, label: 'Больше месяца', description: 'сначала пакет на 30 дней' },
  { days: null, label: 'Пока не знаю', description: 'покажем все варианты' },
] as const;
const usageOptions = [
  { label: 'Карты и такси', summary: 'Карты', gb: 0.5 },
  { label: 'Мессенджеры', summary: 'мессенджеры', gb: 0.5 },
  { label: 'Соцсети', summary: 'соцсети', gb: 2 },
  { label: 'Видео и сериалы', summary: 'видео', gb: 5 },
  { label: 'Созвоны', summary: 'созвоны', gb: 2 },
  { label: 'Раздача на ноутбук', summary: 'раздача', gb: 5 },
];
type Props = {
  step: HomeSearchStep | null;
  onStepChange: (step: HomeSearchStep) => void;
  onClose: () => void;
  catalog: ReturnType<typeof useCatalogCategories>;
  countries: CatalogEsim[];
  selectedCountry: CatalogEsim | null;
  days: number | null;
  onSelectDays: (days: number | null) => void;
  usage: number | null;
  onSelectUsage: (usage: number | null) => void;
  onFind: (country?: CatalogEsim, category?: CatalogCategory, preferences?: TripPreferences) => void;
  selectedCountries: CatalogEsim[];
  onToggleCountry: (country: CatalogEsim) => void;
  onClearCountries: () => void;
  onSignIn: () => void;
  onExisting: (id: string) => void;
  onBrowse: (section: 'regions' | 'world') => void;
};

export function HomeSearchSheet({ step, onStepChange, onClose, catalog, countries, selectedCountry, days, onSelectDays, usage, onSelectUsage, onFind, selectedCountries, onToggleCountry, onClearCountries, onSignIn, onExisting, onBrowse }: Props) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const input = useRef<TextInput>(null);
  const [query, setQuery] = useState('');
  const [selectedUsage, setSelectedUsage] = useState<number[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [directRegion, setDirectRegion] = useState<CatalogCategory | null>(null);
  const [notice, setNotice] = useState('');
  const [subscribed, setSubscribed] = useState<string[]>([]);
  const pendingNotification = useRef<CatalogEsim | null>(null);
  const [notifyBusy, setNotifyBusy] = useState<string | null>(null);
  const auth = useAuth();
  const orders = useUserOrders();
  useEffect(() => { if (step === 'country') setQuery(''); else Keyboard.dismiss(); }, [step]);
  const selectionKey = selectedCountries.map(country => country.id).join(',');
  useEffect(() => { if (selectedCountries.length >= MAX_TRIP_COUNTRIES) Keyboard.dismiss(); }, [selectedCountries.length]);
  useEffect(() => { setExpanded(false); setDirectRegion(null); }, [selectionKey]);
  useEffect(() => {
    setSubscribed([]);
    if (!auth.accessToken) return;
    let active = true;
    coverageSubscription(auth.accessToken).then(result => { if (active && 'data' in result) setSubscribed(result.data.filter(item => item.status === 'pending' || item.status === 'sending').map(item => item.country_iso2)); }).catch(() => {});
    return () => { active = false; };
  }, [auth.accessToken]);
  const notify = async (country: CatalogEsim) => {
    if (!auth.accessToken) { pendingNotification.current = country; onSignIn(); return; }
    if (!country.country_iso2 || notifyBusy) return;
    const code = country.country_iso2;
    setNotifyBusy(code); setNotice('');
    try {
      const cancel = subscribed.includes(code);
      await coverageSubscription(auth.accessToken, code, cancel);
      setSubscribed(previous => cancel ? previous.filter(item => item !== code) : [...previous, code]);
      setNotice(cancel ? 'Уведомление отменено.' : `Заявка на ${country.display_name} сохранена. Сообщим на ${auth.user?.email}, когда появятся тарифы.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Не удалось сохранить заявку. Повторите попытку.'); }
    finally { setNotifyBusy(null); }
  };
  useEffect(() => {
    if (auth.accessToken && pendingNotification.current) {
      const country = pendingNotification.current;
      pendingNotification.current = null;
      onStepChange('country');
      void notify(country);
    }
  }, [auth.accessToken]);
  const normalizedQuery = query.trim().toLocaleLowerCase('ru');
  const categories = catalog.state.status === 'ready' ? catalog.state.categories : [];
  const selected = tripCountries(selectedCountries);
  const preliminary = planTrip(selectedCountries, categories);
  const regionOptions = categories.flatMap(category => { const bundle = categoryBundle(category); return bundle ? [bundle] : []; });
  const globalBundle = categories.flatMap(category => category.esims).find(item => item.country_iso2 === 'XG');
  const tripTariffs = useTripTariffs([...selected, ...regionOptions, ...(globalBundle ? [globalBundle] : [])], step !== null && (selected.length > 0 || !!directRegion));
  const preferences: TripPreferences = { ...getTripPreferences(days, usage), ...(getTripPreferences(days, usage).preferredDataGb! > 25 ? { preferUnlimited: true } : {}) };
  const cheapest = (tariffs: import('../../../../packages/shared/contracts/catalog').CatalogTariff[]) => {
    if (preferences.preferredDataGb || preferences.preferredDurationDays) return recommendTariff(tariffs, preferences);
    if (!tariffs.length || tariffs.some(item => item.price_currency !== tariffs[0].price_currency)) return null;
    return [...tariffs].sort((a, b) => a.price_amount_minor - b.price_amount_minor)[0];
  };
  const priced = (item: CatalogEsim): CatalogEsim => {
    const value = tripTariffs.data[item.id];
    const tariff = value?.status === 'ready' ? cheapest(value.tariffs) : null;
    return { ...item, min_price_amount: tariff?.price_amount_minor ?? null, min_price_currency: tariff?.price_currency ?? null };
  };
  const pricedCategories = categories.map(category => ({ ...category, esims: category.esims.map(priced) }));
  let route = planTrip(selectedCountries.map(item => item.id.startsWith('unavailable:') ? item : priced(item)), pricedCategories);
  if (directRegion) {
    const esim = categoryBundle(directRegion);
    if (esim) route = { primary: { esim: priced(esim), category: directRegion, countries: getCountries([directRegion]) }, alternative: null, separateMoreExpensive: false, ignored: [] };
  }
  // A country with no standalone tariffs may still offer the global package.
  const standalone = selected.length === 1 ? tripTariffs.data[selected[0].id] : null;
  if (!directRegion && standalone?.status === 'ready' && !standalone.tariffs.length && globalBundle) route = { ...route, primary: { esim: priced(globalBundle), countries: selected } };
  const target = route.primary?.esim;
  const routeCategory = route.primary?.category;
  const useRegion = !!routeCategory;
  const routeSummary = directRegion ? directRegion.title : target?.country_iso2 === 'XG' ? `Весь мир · ${countLabel(selected.length)}` : useRegion ? `${routeCategory!.title} · ${countLabel(selected.length)}` : selectedCountries.map(country => country.display_name).join(', ');
  const targetState = target ? tripTariffs.data[target.id] : null;
  const tariffData = targetState?.status === 'ready' ? targetState : null;
  const recommendation = tariffData ? cheapest(tariffData.tariffs) : null;
  const routeLoading = !!target && !targetState;
  const routeError = targetState?.status === 'error';
  const routeReady = !!target && !!tariffData?.tariffs.length && !!totalPrice([route.primary!]);
  const withoutTariffs = selected.filter(country => { const state = tripTariffs.data[country.id]; return state?.status === 'ready' && !state.tariffs.length; });
  const unavailable = selectedCountries.filter(country => country.country_iso2 !== 'RU' && country.id.startsWith('unavailable:'));
  useEffect(() => {
    if (step !== null && selected.length === 1 && orders.state.status === 'ready' && orders.state.response.meta.has_more && !orders.state.loadingMore && !orders.state.error) void orders.loadMore();
  }, [step, selected.length, orders.state]);
  const existing = selected.length === 1 && orders.state.status === 'ready' ? orders.state.response.data.find(order => order.esim.id === selected[0].id && ['active', 'installed'].includes(order.esim_status?.toLowerCase() ?? '')) : null;
  const usageSummary = selectedUsage.length ? selectedUsage.map(index => usageOptions[index].summary).join(', ').replace(/^./, char => char.toUpperCase()) : 'Для чего интернет';
  const suggestions = popularDestinations.flatMap(destination => countries.filter(country => country.country_iso2?.toUpperCase() === destination.code));
  const matches = searchCountries(searchableCountries(countries), query);
  const regionResults = findRegions(categories, query);
  const visibleResults = normalizedQuery ? matches.map(match => match.country) : [...selectedCountries, ...suggestions.filter(country => !selectedCountries.some(item => item.id === country.id))].slice(0, 5);
  const atLimit = selectedCountries.length >= MAX_TRIP_COUNTRIES;
  const openOption = (option: RouteOption) => option.category ? onFind(undefined, categories.find(category => category.title === option.category!.title) ?? option.category, preferences) : onFind(option.esim, undefined, preferences);
  const find = () => {
    if (!routeReady || !route.primary) return;
    if (expanded) { setNotice('Общая оплата комплекта пока недоступна. Выберите отдельную eSIM в списке.'); return; }
    openOption(route.primary);
  };
  const chooseRegion = (category: CatalogCategory) => { setDirectRegion(category); setQuery(''); Keyboard.dismiss(); onStepChange('route'); };
  const searchHint = atLimit ? 'Можно выбрать до 5 стран. Едете дальше — возьмите тариф региона или «Весь мир»'
    : selected.length >= 4 && preliminary.primary?.category ? `${countLabel(selected.length)} из региона «${preliminary.primary.category.title}» — удобнее одна eSIM на поездку`
    : regionResults.length ? 'Регион — одна eSIM на все его страны' : 'Можно выбрать несколько стран — подберём одну eSIM на всю поездку';
  const chip = (country: CatalogEsim) => <Pressable key={country.id} onPress={event => { event.stopPropagation(); onToggleCountry(country); }} style={[styles.chip, (country.country_iso2 === 'RU' || country.id.startsWith('unavailable:')) && styles.disabled]} accessibilityRole="button" accessibilityLabel={`Убрать ${country.display_name}`}>
    <CountryFlag country={country} size={18} /><Text onPress={event => { event.stopPropagation(); onStepChange(step === 'country' ? 'route' : 'country'); }} style={styles.chipText}>{country.display_name}</Text><Image source={assets.remove} style={styles.removeIcon} contentFit="contain" accessible={false} />
  </Pressable>;

  return <Modal visible={step !== null} transparent animationType="slide" onRequestClose={onClose} onShow={() => { if (step === 'country') input.current?.focus(); }}>
    <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Закрыть подбор" testID="home-sheet-backdrop" />
      <View style={[styles.sheet, { maxHeight: height - Math.max(insets.top + 6, 54), paddingBottom: Platform.OS === 'web' ? 40 : Math.max(insets.bottom + 6, 20) }]} accessibilityViewIsModal testID="home-search-sheet">
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Закрыть подбор" hitSlop={12} style={styles.handle} testID="home-sheet-close" />
        <ScrollView style={styles.scroll} keyboardShouldPersistTaps="always" keyboardDismissMode="none" showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
          {step === 'country' && <Text style={styles.stepCaption}>Шаг 1 из 3 — куда летите</Text>}
          <View style={styles.fields}>
            <Pressable onPress={() => { if (step !== 'country') { onStepChange('country'); input.current?.focus(); } }} accessibilityRole="button" accessibilityLabel="Куда летите?" testID="home-sheet-country"
              style={[styles.field, (step === 'country' || step === 'route') && styles.activeField, (step === 'country' || step === 'route') && styles.countryField, styles.separator]}>
              {step === 'usage' || step === 'duration'
                ? <TripFlags countries={directRegion ? getCountries([directRegion]) : selectedCountries} />
                : <Image source={assets.search} style={styles.fieldIcon} contentFit="contain" accessible={false} />}
              {step === 'country' ? <View style={styles.searchQueryRow}>{selectedCountries.map(chip)}<TextInput ref={input} onSubmitEditing={() => { if (selectedCountries.length) { Keyboard.dismiss(); onStepChange('route'); } }} editable={!atLimit} style={styles.input} value={query} onChangeText={setQuery} placeholder={selectedCountries.length ? 'Ещё страна?' : 'Куда летите?'} placeholderTextColor="rgba(255,255,255,0.4)" selectionColor={colors.tariffAccent} accessibilityLabel="Поиск страны" testID="home-country-input" autoCorrect={false} autoCapitalize="none" returnKeyType="search" /></View>
                : step === 'route' ? directRegion ? <Text style={[styles.fieldText, styles.selectedText]}>{directRegion.title}</Text> : <View style={styles.routeChips}>{selectedCountries.map(chip)}</View>
                : <Text style={[styles.fieldText, styles.selectedText]} numberOfLines={1}>{routeSummary || 'Куда летите?'}</Text>}
              {(step === 'country' || step === 'route') && <Pressable onPress={event => { event.stopPropagation(); setQuery(''); setDirectRegion(null); onClearCountries(); input.current?.focus(); }} accessibilityRole="button" accessibilityLabel="Очистить страны" style={styles.clear} testID="home-country-clear"><Image source={assets.close} style={styles.closeIcon} contentFit="contain" accessible={false} /></Pressable>}
            </Pressable>
            {step === 'country' ? <View style={styles.searchHelper}><Text style={[styles.searchHelperText, !atLimit && selected.length >= 4 && preliminary.primary?.category && { color: colors.lime }]}>{searchHint}</Text>
              {atLimit ? <View style={styles.usageOptions}><Pressable style={styles.usageChip} onPress={() => onBrowse('regions')} accessibilityRole="button"><Text style={styles.chipText}>Регионы</Text></Pressable><Pressable style={styles.usageChip} onPress={() => onBrowse('world')} accessibilityRole="button"><Text style={styles.chipText}>Весь мир</Text></Pressable></View> : selected.length >= 4 && preliminary.primary?.category ? <Pressable style={styles.hintAction} onPress={() => chooseRegion(preliminary.primary!.category!)} accessibilityRole="button"><Text style={styles.hintActionText}>Смотреть «{preliminary.primary.category.title}»</Text></Pressable> : null}</View> : <>
              <Pressable onPress={() => onStepChange('duration')} accessibilityRole="button" accessibilityLabel="Срок поездки" testID="home-sheet-duration" style={[styles.field, styles.separator, step === 'duration' && styles.activeField]}>
                <Image source={assets.calendar} style={styles.fieldIcon} contentFit="contain" accessible={false} /><Text style={[styles.fieldText, !!days && styles.selectedText]}>{durations.find(item => item.days === days && days !== null)?.label ?? 'Срок поездки'}</Text>
                {!days && <View style={styles.optional}><Text style={styles.optionalText}>необязательно</Text></View>}
              </Pressable>
              <Pressable onPress={() => onStepChange('usage')} accessibilityRole="button" accessibilityLabel="Для чего интернет" testID="home-sheet-usage" style={[styles.field, step === 'usage' && styles.activeField]}>
                <Image source={step === 'usage' ? assets.wifiActive : assets.wifi} style={styles.fieldIcon} contentFit="contain" accessible={false} /><Text style={[styles.fieldText, !!usage && styles.selectedText, step === 'usage' && !!usage && styles.semibold]} numberOfLines={1}>{usageSummary}</Text>
                {!usage && <View style={styles.optional}><Text style={styles.optionalText}>необязательно</Text></View>}
              </Pressable>
            </>}
          </View>
          {step === 'country' && !!regionResults.length && <View style={styles.panel}><Text style={styles.panelTitle}>Регион</Text>{regionResults.map(category => <Pressable key={category.title} style={styles.result} onPress={() => chooseRegion(category)} accessibilityRole="button"><TripFlags countries={getCountries([category])} size={32} /><View style={styles.resultCopy}><Text style={styles.resultName}>{category.title}</Text><Text style={styles.resultDescription}>{countLabel(getCountries([category]).length)} в категории · одна eSIM</Text></View><Image source={assets.plus} style={styles.selectionIcon} contentFit="contain" /></Pressable>)}</View>}
          {step === 'country' && <View style={styles.panel}>
            <Text style={styles.panelTitle} accessibilityRole="header">{normalizedQuery ? 'Нашлось' : 'Популярные'}</Text>
            {catalog.state.status !== 'ready' ? <CatalogStatus state={catalog.state} onRetry={catalog.reload} /> : !visibleResults.length ? <View><Text style={styles.empty}>Ничего не нашли по «{query}». Попробуйте название страны или выберите популярное направление.</Text>{suggestions.slice(0, 3).map(country => <Pressable key={country.id} style={styles.result} onPress={() => { if (!atLimit) onToggleCountry(country); setQuery(''); }}><CountryFlag country={country} size={32} /><Text style={styles.resultName}>{country.display_name}</Text></Pressable>)}</View>
              : visibleResults.map((country, index) => <Pressable key={country.id} disabled={atLimit && !selectedCountries.some(item => item.id === country.id)} onPress={() => { onToggleCountry(country); setQuery(''); input.current?.focus(); }} accessibilityRole="checkbox" accessibilityState={{ checked: selectedCountries.some(c => c.id === country.id) }} accessibilityLabel={`Выбрать ${country.display_name}`} testID={`home-result-${country.country_iso2}`} style={({ pressed }) => [styles.result, atLimit && !selectedCountries.some(item => item.id === country.id) && styles.disabled, index < visibleResults.length - 1 && styles.separator, pressed && styles.pressed]}>
                <CountryFlag country={country} size={32} /><View style={styles.resultCopy}><Text style={styles.resultName}>{country.display_name}</Text><Text style={styles.resultDescription}>{matches.find(match => match.country.id === country.id)?.reason ?? (country.country_iso2 === 'RU' ? 'Дома работает своя SIM — не включаем в подбор' : country.id.startsWith('unavailable:') ? 'Пока нет в каталоге · можно запросить уведомление' : formatCatalogPrice(getCatalogPrice(country)))}</Text></View>
                <View style={[styles.selectCircle, selectedCountries.some(c => c.id === country.id) && styles.selectCircleActive]}><Image source={selectedCountries.some(c => c.id === country.id) ? assets.check : assets.plus} style={styles.selectionIcon} contentFit="contain" accessible={false} /></View>
              </Pressable>)}
          </View>}
          {step === 'route' && <>
            {existing && <View style={styles.routePanel}><Text style={styles.optionTitle}>У вас уже есть eSIM «{selected[0].display_name}»</Text><Text style={styles.optionDescription}>Пополнение того же профиля пока недоступно. Можно открыть действующую eSIM или купить новую.</Text><Pressable style={styles.hintAction} onPress={() => onExisting(existing.id)} accessibilityRole="button"><Text style={styles.hintActionText}>Открыть мою eSIM</Text></Pressable></View>}
            <TripRoutePanel route={route} expanded={expanded} onExpand={setExpanded} onOpen={openOption} loading={routeLoading} error={!!routeError} onRetry={tripTariffs.reload} />
          </>}
          {selectedCountries.some(country => country.country_iso2 === 'RU') && <Text style={styles.empty}>Россию не включаем в подбор: дома работает своя SIM-карта.</Text>}
          {(unavailable.length > 0 || withoutTariffs.length > 0) && <View style={styles.routePanel}>{[...unavailable, ...withoutTariffs].map(country => <View key={country.id} style={styles.result}><View style={styles.resultCopy}><Text style={styles.resultName}>{country.display_name}</Text><Text style={styles.resultDescription}>Пока нет отдельных тарифов</Text></View><Pressable disabled={notifyBusy !== null} onPress={() => void notify(country)} accessibilityRole="button"><Text style={styles.retry}>{notifyBusy === country.country_iso2 ? 'Сохраняем…' : subscribed.includes(country.country_iso2 ?? '') ? 'Отменить' : 'Уведомить'}</Text></Pressable></View>)}</View>}
          {step === 'country' && normalizedQuery && matches.some(match => match.country.country_iso2 !== 'RU' && match.country.id.startsWith('unavailable:')) && <View style={styles.routePanel}>{matches.filter(match => match.country.country_iso2 !== 'RU' && match.country.id.startsWith('unavailable:')).slice(0, 2).map(({country}) => <View key={country.id}><Text style={styles.optionTitle}>Пока нет тарифов: {country.display_name}</Text><Pressable style={styles.option} onPress={() => void notify(country)} accessibilityRole="button"><Text style={styles.retry}>{subscribed.includes(country.country_iso2 ?? '') ? 'Отменить уведомление' : 'Уведомить меня'}</Text></Pressable></View>)}</View>}
          {!!notice && <Text style={styles.empty} accessibilityLiveRegion="polite">{notice}</Text>}
          {step === 'duration' && <View style={styles.panel}>
            <View style={styles.panelHeader}><Text style={styles.optionTitle}>На сколько едете?</Text><Text style={styles.skipHint}>можно пропустить</Text></View>
            {durations.map((item, index) => <Pressable key={item.days ?? 'any'} onPress={() => onSelectDays(item.days)} accessibilityRole="radio" accessibilityState={{ checked: days === item.days }} testID={`home-days-${item.days ?? 'any'}`} style={({ pressed }) => [styles.option, index < durations.length - 1 && styles.separator, pressed && styles.pressed]}>
              <View style={styles.resultCopy}><Text style={styles.resultName}>{item.label}</Text><Text style={styles.optionDescription}>{item.description}</Text></View><View style={[styles.radio, days === item.days && styles.radioSelected]}>{days === item.days && <Image source={assets.chipCheck} style={styles.chipCheck} contentFit="contain" accessible={false} />}</View>
            </Pressable>)}
          </View>}
          {step === 'duration' && routeError && <Pressable style={styles.routePanel} onPress={tripTariffs.reload} accessibilityRole="button"><Text style={styles.retry}>Не получилось загрузить цены. Страны сохранили — повторить</Text></Pressable>}
          {days === 31 && <View style={styles.routePanel}><Text style={styles.optionDescription}>Подберём пакет на 30 дней. Продление того же профиля и автоматические напоминания пока недоступны.</Text></View>}
          {step === 'usage' && <>
            <View style={styles.usagePanel}><View style={styles.usageHeader}><Text style={styles.optionTitle}>Для чего нужен интернет?</Text><Text style={styles.optionDescription}>Можно выбрать несколько — гигабайты посчитаем сами</Text></View>
              <View style={styles.usageOptions}>{usageOptions.map((item, index) => <Pressable key={item.label} accessibilityRole="checkbox" accessibilityState={{ checked: selectedUsage.includes(index) }} testID={`home-usage-${index}`} onPress={() => {
                const next = selectedUsage.includes(index) ? selectedUsage.filter(i => i !== index) : [...selectedUsage, index]; setSelectedUsage(next); onSelectUsage(next.length ? next.reduce((sum, i) => sum + usageOptions[i].gb, 0) : null);
              }} style={[styles.usageChip, selectedUsage.includes(index) && styles.usageChipActive]}>{selectedUsage.includes(index) && <Image source={assets.chipCheck} style={styles.chipCheck} contentFit="contain" accessible={false} />}<Text style={styles.chipText}>{item.label}</Text></Pressable>)}</View>
            </View>
            {route.primary && <View style={styles.recommendation} testID="search-recommendation"><View style={styles.recommendationHeading}><Image source={assets.eyes} style={styles.eyes} contentFit="contain" accessible={false} /><Text style={styles.recommendationEyebrow}>Подобрали под вас</Text></View>
              <View style={styles.recommendationValues}><View style={styles.recommendationCopy}><Text style={styles.recommendationTitle}>{recommendation ? `${formatDataAmount(recommendation)} на ${formatDuration(recommendation.duration)}` : preferences.preferredDataGb ? `${preferences.preferredDataGb} ГБ на ${days === 31 ? 30 : days ?? 15} дней` : 'Выберите доступный тариф'}</Text><Text style={styles.recommendationCaption}>{useRegion ? routeCategory!.title : target?.display_name ?? 'Выберите страну'}{usage ? ` · ≈ ${usage} ГБ в неделю + 1 ГБ запаса` : ''}</Text></View><Text style={styles.recommendationPrice}>{recommendation ? formatTariffPrice(recommendation) : routeLoading ? '…' : '—'}</Text></View>
              {routeError && <Pressable onPress={tripTariffs.reload} accessibilityRole="button"><Text style={styles.retry}>Не удалось загрузить тарифы. Повторить</Text></Pressable>}
              {tariffData && !recommendation && <Text style={styles.recommendationCaption}>Точного пакета пока нет. Измените срок или расход.</Text>}
            </View>}
            {expanded && <TripRoutePanel route={route} expanded onExpand={setExpanded} onOpen={openOption} loading={routeLoading} error={!!routeError} onRetry={tripTariffs.reload} />}
          </>}
        </ScrollView>
        <Pressable disabled={step !== 'country' && !routeReady} accessibilityState={{ disabled: step !== 'country' && !routeReady }} style={({ pressed }) => [styles.submit, step !== 'country' && !routeReady && styles.disabled, pressed && styles.pressed]} onPress={() => {
          if (!selectedCountries.length && !directRegion) onStepChange('country');
          else if (step === 'country') { Keyboard.dismiss(); onStepChange('route'); }
          else if (step === 'route') onStepChange('duration');
          else if (step === 'duration') onStepChange('usage');
          else find();
        }} accessibilityRole="button" testID="home-sheet-find"><Text style={styles.submitText}>{step === 'usage' ? expanded ? 'Выберите eSIM из комплекта' : 'Перейти к тарифу' : step === 'duration' ? 'Дальше — для чего интернет' : step === 'route' ? 'Дальше — срок поездки' : selectedCountries.length === 1 ? `Дальше · ${selectedCountries[0].display_name}` : selectedCountries.length > 1 ? `Дальше · ${countLabel(selectedCountries.length)}` : 'Выберите страну'}</Text></Pressable>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}

const fontFamily = fonts.text;
const styles = StyleSheet.create({
  disabled: { opacity: 0.4 },
  hintAction: { alignSelf: 'flex-start', marginTop: 10, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 18, backgroundColor: colors.lime },
  hintActionText: { fontSize: 14, lineHeight: 18, fontWeight: '600', color: colors.ink },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { width: '100%', height: '100%', backgroundColor: '#121213', borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingTop: 28, paddingHorizontal: 16, gap: 12, overflow: 'hidden' },
  handle: { position: 'absolute', top: 8, left: '50%', marginLeft: -18, width: 36, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)' },
  scroll: { flex: 1 },
  sheetContent: { gap: 12, paddingBottom: 12 },
  stepCaption: { textAlign: 'center', fontFamily, fontSize: 14, lineHeight: 17, color: colors.mutedText },
  fields: { backgroundColor: '#242426', borderRadius: 20, overflow: 'hidden', flexShrink: 0 },
  field: { flexDirection: 'row', minHeight: 56, alignItems: 'center', gap: 12, paddingLeft: 16, paddingRight: 14 },
  countryField: { paddingVertical: 12, minHeight: 52 },
  activeField: { backgroundColor: 'rgba(77,92,255,0.12)' },
  fieldIcon: { width: 22, height: 22, flexShrink: 0 },
  fieldText: { flex: 1, minWidth: 0, fontFamily, fontSize: 16, lineHeight: 22, letterSpacing: -0.064, color: 'rgba(255,255,255,0.4)' },
  selectedText: { color: colors.text },
  semibold: { fontWeight: '600' },
  searchQueryRow: { flex: 1, minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  input: { flexGrow: 1, flexShrink: 1, minWidth: 100, fontFamily, fontSize: 16, lineHeight: 22, fontWeight: '600', color: colors.text, padding: 0, outlineWidth: 0 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 14, paddingLeft: 6, paddingRight: 8, paddingVertical: 5 },
  chipText: { fontFamily, color: colors.text, fontSize: 14, lineHeight: 17, fontWeight: '500' },
  removeIcon: { width: 12, height: 12 },
  clear: { width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  closeIcon: { width: 14, height: 14 },
  searchHelper: { backgroundColor: 'rgba(77,92,255,0.12)', paddingLeft: 50, paddingRight: 16, paddingTop: 12, paddingBottom: 14 },
  searchHelperText: { fontFamily, fontSize: 14, lineHeight: 17, color: 'rgba(255,255,255,0.6)' },
  optional: { backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  optionalText: { fontFamily, fontSize: 12, lineHeight: 16, color: 'rgba(255,255,255,0.4)' },
  separator: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  miniFlags: { flexDirection: 'row', paddingRight: 4 },
  miniFlag: { marginRight: -6, padding: 2, borderRadius: 11, backgroundColor: '#242426' },
  routeChips: { flex: 1, minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  panel: { backgroundColor: '#242426', borderRadius: 20, paddingTop: 16, paddingBottom: 4, overflow: 'hidden', flexShrink: 0 },
  panelTitle: { fontFamily, fontSize: 20, lineHeight: 26, fontWeight: '800', letterSpacing: -0.3, color: colors.text, paddingHorizontal: 16, paddingBottom: 8 },
  result: { paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  resultCopy: { flex: 1, minWidth: 0 },
  resultName: { fontFamily, fontSize: 16, lineHeight: 22, fontWeight: '500', letterSpacing: -0.064, color: colors.text },
  resultDescription: { fontFamily, fontSize: 14, lineHeight: 20, color: 'rgba(255,255,255,0.45)' },
  selectCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  selectCircleActive: { backgroundColor: colors.tariffAccent },
  selectionIcon: { width: 18, height: 18 },
  empty: { padding: 16, fontFamily, fontSize: 14, lineHeight: 20, color: colors.mutedText },
  routePanel: { backgroundColor: '#242426', borderRadius: 20, paddingHorizontal: 12, paddingTop: 16, paddingBottom: 12, gap: 10 },
  routePanelHeader: { paddingHorizontal: 4, paddingBottom: 4, gap: 4 },
  optionTitle: { fontFamily, fontSize: 20, lineHeight: 24, fontWeight: '800', letterSpacing: -0.3, color: colors.text },
  routeSubtitle: { fontFamily, fontSize: 14, lineHeight: 17, color: 'rgba(255,255,255,0.55)' },
  routeCard: { padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1.5, borderColor: 'transparent', backgroundColor: 'rgba(255,255,255,0.05)' },
  routeCardSelected: { borderColor: colors.tariffAccent, backgroundColor: 'rgba(77,92,255,0.14)' },
  routeCardCopy: { flex: 1, minWidth: 0, gap: 4 },
  routeHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  routeName: { fontFamily, fontSize: 16, lineHeight: 19, fontWeight: '600', color: colors.text },
  deal: { overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, backgroundColor: '#D4F55A', color: '#111111', fontFamily, fontSize: 12, lineHeight: 15, fontWeight: '600' },
  routeDescription: { fontFamily, fontSize: 14, lineHeight: 17, color: 'rgba(255,255,255,0.55)' },
  routePrice: { fontFamily, fontSize: 16, lineHeight: 19, fontWeight: '600', color: colors.text },
  routeNote: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8 },
  eyes: { width: 32, height: 20, flexShrink: 0 },
  routeNoteText: { flex: 1, fontFamily, fontSize: 14, lineHeight: 17, color: 'rgba(255,255,255,0.55)' },
  panelHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8, gap: 4 },
  skipHint: { fontFamily, fontSize: 12, lineHeight: 18, color: 'rgba(255,255,255,0.4)' },
  option: { paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  optionDescription: { fontFamily, fontSize: 14, lineHeight: 17, color: 'rgba(255,255,255,0.55)' },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  radioSelected: { backgroundColor: colors.tariffAccent, borderColor: colors.tariffAccent },
  chipCheck: { width: 16, height: 16 },
  usagePanel: { backgroundColor: '#242426', borderRadius: 20, padding: 16, gap: 14 },
  usageHeader: { gap: 4 },
  usageOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  usageChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1.5, borderColor: 'transparent' },
  usageChipActive: { borderColor: colors.tariffAccent, backgroundColor: 'rgba(77,92,255,0.2)' },
  recommendation: { padding: 16, gap: 10, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(77,92,255,0.6)', backgroundColor: 'rgba(77,92,255,0.16)' },
  recommendationHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  recommendationEyebrow: { fontFamily, fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.lime },
  recommendationValues: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  recommendationCopy: { flex: 1, minWidth: 0, gap: 2 },
  recommendationTitle: { fontFamily, fontSize: 20, lineHeight: 26, fontWeight: '700', letterSpacing: -0.24, color: colors.text },
  recommendationCaption: { fontFamily, fontSize: 12, lineHeight: 18, color: 'rgba(255,255,255,0.6)' },
  recommendationPrice: { fontFamily, fontSize: 20, lineHeight: 26, fontWeight: '700', letterSpacing: -0.24, color: colors.text },
  retry: { fontFamily, fontSize: 14, lineHeight: 20, color: colors.accent },
  submit: { minHeight: 52, flexShrink: 0, paddingHorizontal: 12, borderRadius: 16, backgroundColor: colors.tariffAccent, alignItems: 'center', justifyContent: 'center' },
  submitText: { fontFamily, fontSize: 16, lineHeight: 22, fontWeight: '600', letterSpacing: -0.064, color: colors.text },
  pressed: { opacity: 0.75 },
});
