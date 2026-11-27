import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler, Keyboard, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CatalogEsim } from '../../../../packages/shared/contracts/catalog';
import { getCountries } from '../catalog/catalog';
import { GlassActionButton } from '../components/GlassActionButton';
import { TripSearchDestinations } from '../components/TripSearchDestinations';
import { TripSearchResults } from '../components/TripSearchResults';
import { TripSearchCoverage, TripSearchExistingEsim } from '../components/TripSearchExtras';
import { describeDestination, DestinationIcon, searchArtwork, SearchFlags, SearchSummary, searchSurfaces } from '../components/TripSearchUI';
import { toggleTripCountry } from '../home/smartSearch';
import { findBestBundle, getTripDurations, getTripPackages, getTripTargets, type TripDestination, type TripOffer } from '../home/tripSearch';
import { useCatalogCategories } from '../hooks/useCatalogCategories';
import { useTripTariffs } from '../hooks/useTripTariffs';
import type { RootStackParamList, TariffScreenSelection } from '../navigation/stack';
import { useOnline } from '../service/connectivity';
import { plural } from '../tariffs/tariffs';
import { colors } from '../theme';
import { StyleSheet } from '../ui/design';
import { ScrollView } from '../ui/ScrollView';
import { Pressable, View } from '../ui/Surface';
import { Text } from '../ui/Text';

const durationOptions = [
  { id: 'short', label: 'Пара дней', detail: '1–3 дня', days: 3 },
  { id: 'week', label: 'Неделя', detail: 'до 7 дней', days: 7 },
  { id: 'fortnight', label: 'Две недели', detail: 'до 15 дней', days: 15 },
  { id: 'month', label: 'Месяц', detail: 'до 30 дней', days: 30 },
  { id: 'unknown', label: 'Пока не знаю', detail: 'покажем все сроки', days: null },
] as const;

const usageOptions = [
  { id: 'essential', label: 'Только самое нужное', detail: 'карты, такси, мессенджеры', weeklyGb: 1 },
  { id: 'normal', label: 'Как дома', detail: 'соцсети, фото, музыка', weeklyGb: 4 },
  { id: 'heavy', label: 'Много', detail: 'видео, созвоны, раздача на ноутбук', weeklyGb: 8 },
  { id: 'unknown', label: 'Не знаю', detail: 'подберём с запасом', weeklyGb: 6 },
] as const;

type Duration = typeof durationOptions[number];
type Usage = typeof usageOptions[number];
type Step = 'where' | 'duration' | 'usage' | 'results';
const progress = { where: 1, duration: 2, usage: 3, results: 0 };
const previous = { duration: 'where', usage: 'duration', results: 'usage' } as const;

function QuestionChoices<T extends { id: string; label: string; detail: string }>({ options, onChoose, group }: {
  options: readonly T[]; onChoose: (option: T) => void; group: string;
}) {
  return <View style={styles.choices}>
    {options.map((option, index) => (
      <Pressable key={option.id} onPress={() => onChoose(option)} accessibilityRole="button" testID={`trip-${group}-${option.id}`}
        style={({ pressed }) => [styles.choice, index > 0 && styles.divider, pressed && styles.pressed]}>
        <View style={styles.choiceCopy}>
          <Text style={styles.choiceTitle}>{option.label}</Text>
          <Text style={styles.choiceDetail}>{option.detail}</Text>
        </View>
        <Image source={searchArtwork.right} style={styles.arrow} accessible={false} />
      </Pressable>
    ))}
  </View>;
}

export function TripSearchScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'TripSearch'>) {
  const insets = useSafeAreaInsets();
  const online = useOnline();
  const catalog = useCatalogCategories();
  const categories = useMemo(() => catalog.state.status === 'ready' ? catalog.state.categories : [], [catalog.state]);
  const countries = useMemo(() => getCountries(categories), [categories]);

  const [step, setStep] = useState<Step>('where');
  const [returnStep, setReturnStep] = useState<Step | null>(null);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<CatalogEsim[]>([]);
  const [destination, setDestination] = useState<TripDestination | null>(null);
  const [duration, setDuration] = useState<Duration | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [chosenDays, setChosenDays] = useState<number | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [iosTransitionFinished, setIosTransitionFinished] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    return navigation.addListener('transitionEnd', ({ data }) => {
      if (!data.closing && navigation.isFocused()) setIosTransitionFinished(true);
    });
  }, [navigation]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const targets = useMemo(() => getTripTargets(destination, categories), [destination, categories]);
  const targetEsims = useMemo(() => targets.map(target => target.esim), [targets]);
  const tripTariffs = useTripTariffs(targetEsims, step === 'results');
  const tripCountries = destination?.kind === 'countries' ? destination.countries : [];
  const multi = tripCountries.length > 1;
  const waiting = online && targets.some(target => !tripTariffs.data[target.esim.id]);
  const hasTariffs = targets.some(({ esim }) => {
    const state = tripTariffs.data[esim.id];
    return state?.status === 'ready' && state.tariffs.length > 0;
  });
  const failed = !online || targets.some(target => tripTariffs.data[target.esim.id]?.status === 'error');

  const durationChoices = duration?.days === null ? getTripDurations(targets.flatMap(({ esim }) => {
    const state = tripTariffs.data[esim.id];
    return state?.status === 'ready' ? state.tariffs : [];
  })) : [];
  const defaultDays = durationChoices.find(days => days >= 7) ?? durationChoices.at(-1) ?? 7;
  const currentDays = duration?.days ?? (chosenDays !== null && durationChoices.includes(chosenDays) ? chosenDays : defaultDays);
  const offers: TripOffer[] = [];
  if (step === 'results' && !waiting && usage) {
    for (const target of targets) {
      const state = tripTariffs.data[target.esim.id];
      if (state?.status !== 'ready') continue;
      const weeklyGb = multi && target.kind === 'country' ? usage.weeklyGb / tripCountries.length : usage.weeklyGb;
      const { packages, fits } = getTripPackages(state.tariffs, currentDays, weeklyGb, duration?.days === null);
      offers.push(...(multi ? packages.slice(0, 1) : packages).map((tariff, index) => ({ target, tariff, recommended: fits && index === 0 })));
    }
  }
  const bestBundle = multi ? findBestBundle(offers.filter(offer => offer.target.kind !== 'country')) : null;
  const openTariffs = ({ target, tariff }: TripOffer) => {
    const selection: TariffScreenSelection = {
      initialTariffId: tariff.id,
      recommendedTariffId: offers.find(offer => offer.recommended && offer.target.esim.id === target.esim.id)?.tariff.id,
    };
    switch (target.kind) {
      case 'country': navigation.navigate('CountryTariffs', { country: target.esim, ...selection }); break;
      case 'region': navigation.navigate('RegionTariffs', { category: target.category, ...selection }); break;
      case 'world': navigation.navigate('WorldTariffs', { bundle: target.esim, ...selection }); break;
    }
  };
  const to = (next: Step) => {
    setStep(next);
    setReturnStep(null);
  };
  const openWhere = useCallback(() => {
    setQuery('');
    setDraft(destination?.kind === 'countries' ? [...destination.countries] : []);
    setStep('where');
  }, [destination]);

  const back = useCallback(() => {
    if (returnStep) {
      Keyboard.dismiss();
      setStep(returnStep);
      setReturnStep(null);
    } else if (step === 'where') {
      Keyboard.dismiss();
      navigation.goBack();
    } else if (step === 'duration') {
      openWhere();
    } else {
      setStep(previous[step]);
    }
  }, [returnStep, step, navigation, openWhere]);

  useFocusEffect(useCallback(() => {
    if (Platform.OS !== 'android' || (step === 'where' && !returnStep)) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      back();
      return true;
    });
    return () => subscription.remove();
  }, [back, returnStep, step]));

  const signIn = () => {
    Keyboard.dismiss();
    navigation.navigate('EmailSignIn');
  };

  const edit = (question: Exclude<Step, 'results'>) => {
    if (question === 'where') openWhere();
    else setStep(question);
    setReturnStep(returnStep ?? step);
  };
  const chooseDestination = (answer: TripDestination) => {
    setDestination(answer);
    setChosenDays(null);
    to(returnStep ?? 'duration');
  };
  const chooseDuration = (answer: Duration) => {
    setDuration(answer);
    setChosenDays(null);
    to(returnStep ?? 'usage');
  };

  const heading = step === 'where' ? 'Куда летите?' : step === 'duration' ? 'Сколько дней\nв поездке?'
    : step === 'usage' ? 'Для чего нужен\nинтернет?' : waiting || !offers.length ? 'Подбираем eSIM'
      : multi ? 'Подобрали eSIM' : `Нашли ${offers.length} ${plural(offers.length, 'вариант', 'варианта', 'вариантов')}`;
  const bottom = Platform.OS === 'web' ? 12 : keyboardVisible ? 0 : insets.bottom;

  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.screen}>
    <View style={[styles.screen, { paddingTop: Math.max(insets.top, Platform.OS === 'web' ? 20 : 0) + 4,
      paddingLeft: insets.left, paddingRight: insets.right, paddingBottom: bottom }]} testID="screen-trip-search">
      <View style={styles.toolbar}>
        <GlassActionButton action="back" onPress={back} testID="trip-back" />
        {step !== 'results' && <View style={styles.progress} pointerEvents="none" accessible
          accessibilityLabel={`Шаг ${progress[step]} из 3`} testID={`trip-step-${progress[step]}`}>
          {[1, 2, 3].map(index => <View key={index} style={[styles.dash, index <= progress[step] && styles.activeDash]} />)}
        </View>}
      </View>

      {step === 'where' ? <>
        <Text style={[styles.title, styles.whereTitle]} accessibilityRole="header">{heading}</Text>
        <TripSearchDestinations countries={countries} categories={categories} selected={draft} query={query}
          focusAfterTransition={iosTransitionFinished}
          onQuery={setQuery} onClear={() => setDraft([])} onToggle={country => setDraft(selected => toggleTripCountry(selected, country))}
          onChoose={chooseDestination} onOpenRegion={category => navigation.navigate('RegionTariffs', { category })}
          catalogStatus={catalog.state.status} onRetry={catalog.reload}
          onSignIn={signIn} />
      </> : <ScrollView key={step} style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.title} accessibilityRole="header" accessibilityLiveRegion="polite" testID="trip-heading">{heading}</Text>
        {destination && <View style={styles.summaries}>
          <SearchSummary label={describeDestination(destination)}
            icon={destination.kind === 'countries' ? <SearchFlags countries={destination.countries} /> : <DestinationIcon destination={destination} small />}
            arrow={destination.kind !== 'countries'} onPress={() => edit('where')} testID="trip-edit-where" />
          {(step === 'usage' || step === 'results') && duration && (
            <SearchSummary label={duration.label} onPress={() => edit('duration')} testID="trip-edit-duration" />
          )}
          {step === 'results' && usage && <SearchSummary label={usage.label} onPress={() => edit('usage')} testID="trip-edit-usage" />}
        </View>}

        {step === 'duration' && <QuestionChoices group="duration" options={durationOptions} onChoose={chooseDuration} />}
        {step === 'usage' && <QuestionChoices group="usage" options={usageOptions} onChoose={answer => {
          setUsage(answer);
          to('results');
        }} />}
        {step === 'results' && !waiting && tripCountries.length === 1 && (
          <TripSearchExistingEsim country={tripCountries[0]} onOpen={orderId => navigation.navigate('OrderStatus', { orderId, details: true })} />
        )}
        {step === 'results' && <TripSearchResults tripCountries={tripCountries} loading={waiting} failed={failed}
          offers={offers} emptyDestination={!hasTariffs} bestBundle={bestBundle} durationChoices={durationChoices}
          currentDays={currentDays} onDays={setChosenDays} onRetry={tripTariffs.reload} onEditDays={() => edit('duration')}
          onEditWhere={() => edit('where')} onOpenTariffs={openTariffs} />}
        {step === 'results' && !waiting && !failed && !hasTariffs && tripCountries.length === 1 && (
          <TripSearchCoverage country={tripCountries[0]} onSignIn={signIn} />
        )}
      </ScrollView>}
    </View>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  toolbar: { marginHorizontal: 16, height: 40, justifyContent: 'center' },
  progress: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' },
  dash: { width: 24, height: 4, borderRadius: 2, backgroundColor: '#424244' },
  activeDash: { backgroundColor: searchSurfaces.blue },
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16, gap: 12 },
  title: { marginHorizontal: 4, color: colors.text, fontSize: 28, lineHeight: 34, fontWeight: '800' },
  whereTitle: { marginHorizontal: 20, marginTop: 16 },
  summaries: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  choices: { backgroundColor: searchSurfaces.panel, borderRadius: 24, cornerSmoothing: 1, overflow: 'hidden' },
  choice: { minHeight: 71, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  divider: { borderTopWidth: 1, borderTopColor: searchSurfaces.divider },
  choiceCopy: { flex: 1, gap: 1 },
  choiceTitle: { color: colors.text, fontSize: 16, lineHeight: 22, fontWeight: '500' },
  choiceDetail: { color: colors.mutedText, fontSize: 14, lineHeight: 20 },
  arrow: { width: 16, height: 16 },
  pressed: { opacity: 0.72 },
});
