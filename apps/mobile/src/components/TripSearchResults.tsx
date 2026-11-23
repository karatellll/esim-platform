import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import type { CatalogEsim, CatalogTariff } from '../../../../packages/shared/contracts/catalog';
import { tariffGigabytes } from '../home/recommendation';
import type { TripOffer } from '../home/tripSearch';
import { formatDataAmount, formatDuration, formatTariffPrice } from '../tariffs/tariffs';
import { colors } from '../theme';
import { StyleSheet } from '../ui/design';
import { ScrollView } from '../ui/ScrollView';
import { Pressable, View } from '../ui/Surface';
import { Text } from '../ui/Text';
import { CountryFlag } from './CountryFlag';
import { SearchButton, SearchFlags, searchArtwork, searchSurfaces } from './TripSearchUI';

const packageLabel = (tariff: CatalogTariff) => `${formatDataAmount(tariff)} на ${formatDuration(tariff.duration)}`;

type ResultsProps = {
  tripCountries: readonly CatalogEsim[];
  loading: boolean;
  failed: boolean;
  emptyDestination: boolean;
  offers: readonly TripOffer[];
  bestBundle: TripOffer | null;
  recommended: TripOffer | null;
  durationChoices: readonly number[];
  currentDays: number;
  onDays: (days: number) => void;
  onRetry: () => void;
  onEditDays: () => void;
  onEditWhere: () => void;
  onCheckout: (offer: TripOffer) => void;
};

function OfferLabel({ offer, title, caption, compact = false }: {
  offer: TripOffer; title: string; caption?: string | null; compact?: boolean;
}) {
  return <View style={styles.offerLine}>
    <View style={styles.offerCopy}>
      <Text style={[styles.offerTitle, compact && styles.compactTitle]}>{title}</Text>
      {!!caption && <Text style={styles.caption}>{caption}</Text>}
    </View>
    <Text style={[styles.price, compact && styles.compactPrice]}>{formatTariffPrice(offer.tariff)}</Text>
  </View>;
}

function OfferBadge({ bestFit = false }: { bestFit?: boolean }) {
  return <View style={styles.badge} testID={bestFit ? 'trip-recommended-badge' : 'trip-best-price'}>
    {bestFit && <Image source={require('../../assets/search/eyes.svg')} style={styles.eyes} accessible={false} />}
    <Text style={styles.badgeText}>{bestFit ? 'Подходит лучше всего' : 'Выгоднее всего'}</Text>
  </View>;
}

function OfferCard({ offer, onCheckout, children }: {
  offer: TripOffer; onCheckout: (offer: TripOffer) => void; children: ReactNode;
}) {
  return <Pressable accessibilityRole="button" onPress={() => onCheckout(offer)} testID={`trip-offer-${offer.tariff.id}`}
    style={({ pressed }) => [styles.offerCard, pressed && styles.pressed]}>
    {children}
  </Pressable>;
}

function durationLabel(days: number) {
  return days < 1 ? formatDuration({ amount: Math.round(days * 24), unit: 'hour' }) : formatDuration({ amount: days, unit: 'day' });
}

export function TripSearchResults({
  tripCountries, loading, failed, emptyDestination, offers, bestBundle, recommended, durationChoices, currentDays,
  onDays, onRetry, onEditDays, onEditWhere, onCheckout,
}: ResultsProps) {
  if (loading) return <View style={styles.stack} testID="trip-results-loading" accessibilityState={{ busy: true }}>
    {[0, 1, 2].map(index => <View key={index} style={[styles.skeleton, index === 0 && styles.firstSkeleton]}>
      <View style={[styles.skeletonLine, styles.skeletonTitle]} />
      <View style={[styles.skeletonLine, { width: '35%' }]} />
      <View style={[styles.skeletonLine, { width: '71%' }]} />
    </View>)}
  </View>;

  const empty = failed
    ? { title: 'Не получилось подобрать eSIM', message: 'Проверьте интернет и попробуйте ещё раз', action: 'Повторить', onPress: onRetry, id: 'trip-results-retry' }
    : emptyDestination
      ? { title: 'Тарифы пока недоступны', message: 'Попробуйте выбрать другое направление', action: 'Изменить направление', onPress: onEditWhere, id: 'trip-empty-edit-where' }
      : { title: 'На этот срок нет тарифов', message: 'Попробуйте выбрать другой срок поездки', action: 'Изменить срок', onPress: onEditDays, id: 'trip-empty-edit-duration' };
  if (!offers.length) return <View style={styles.error} testID={failed ? 'trip-results-error' : 'trip-results-empty'}>
    <View style={styles.errorArt}>
      <Image source={searchArtwork.error} style={styles.errorImage} contentFit="contain" accessible={false} />
    </View>
    <Text style={[styles.offerTitle, styles.center]}>{empty.title}</Text>
    <Text style={[styles.detail, styles.center]}>{empty.message}</Text>
    <SearchButton label={empty.action} onPress={empty.onPress} testID={empty.id} />
  </View>;

  const multi = tripCountries.length > 1;
  const bundles = multi ? offers.filter(({ target }) => target.kind !== 'country') : [];
  const individuals = multi ? offers.filter(({ target }) => target.kind === 'country') : [];
  return <View style={styles.stack}>
    {durationChoices.length > 0 && (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.segmentsContainer}
        contentContainerStyle={styles.segments} testID="trip-duration-options">
        {durationChoices.map(days => (
          <Pressable key={days} onPress={() => onDays(days)} accessibilityRole="button" accessibilityState={{ selected: days === currentDays }}
            testID={`trip-filter-${days}`} style={[styles.segment, days === currentDays && styles.activeSegment]}>
            <Text style={[styles.segmentText, days === currentDays && styles.activeSegmentText]}>{durationLabel(days)}</Text>
          </Pressable>
        ))}
      </ScrollView>
    )}

    {multi ? <>
      {bundles.map(offer => {
        const name = offer.target.kind === 'region' ? offer.target.category.title : 'Весь мир';
        const regional = offer.target.kind === 'region';
        return <OfferCard key={offer.target.esim.id} offer={offer} onCheckout={onCheckout}>
          {offer === bestBundle && <OfferBadge />}
          <OfferLabel offer={offer} title={`Одна eSIM «${name}»`} caption={packageLabel(offer.tariff)} />
          <View style={styles.offerFooter}>
            {regional ? <SearchFlags countries={tripCountries} size={20} /> : (
              <Image source={searchArtwork.globe} style={styles.globe} accessible={false} />
            )}
            <Text style={styles.detail}>{regional ? 'Страны маршрута входят в регион' : 'Глобальная eSIM для поездки'}</Text>
          </View>
        </OfferCard>;
      })}
      {individuals.length > 0 && <View style={styles.countryPanel}>
        <Text style={styles.countryPanelTitle}>Только одна страна</Text>
        {individuals.map(offer => (
          <Pressable key={offer.target.esim.id} accessibilityRole="button" onPress={() => onCheckout(offer)}
            testID={`trip-offer-${offer.tariff.id}`} style={({ pressed }) => [styles.countryRow, pressed && styles.pressed]}>
            <CountryFlag country={offer.target.esim} shape="rectangle" />
            <OfferLabel offer={offer} title={offer.target.esim.display_name} caption={packageLabel(offer.tariff)} compact />
          </Pressable>
        ))}
      </View>}
    </> : offers.map(offer => {
      const fit = offer === recommended;
      const bestVolume = tariffGigabytes(offers[0].tariff);
      const moreData = (tariffGigabytes(offer.tariff) ?? 0) > (bestVolume ?? 0);
      const caption = offer.tariff.is_unlimited ? 'Без ограничений по трафику'
        : fit ? offer.target.esim.network : moreData ? 'С запасом' : offers.length > 1 && offer !== offers[0] ? 'Меньше трафика' : null;
      return <OfferCard key={offer.tariff.id} offer={offer} onCheckout={onCheckout}>
        {fit && <OfferBadge bestFit />}
        <OfferLabel offer={offer} title={packageLabel(offer.tariff)} caption={caption} />
        {fit && <View style={styles.offerFooter}>
          {offer.target.kind === 'country' && <CountryFlag country={offer.target.esim} size={20} shape="rectangle" />}
          <Text style={styles.detail}>Под ваш сценарий использования</Text>
        </View>}
      </OfferCard>;
    })}

    {failed && <View style={styles.partialError} testID="trip-results-partial-error">
      <Text style={styles.caption}>Часть тарифов не загрузилась</Text>
      <SearchButton label="Повторить" onPress={onRetry} testID="trip-results-retry" />
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  offerCard: { padding: 16, gap: 12, backgroundColor: searchSurfaces.panel, borderRadius: 24, cornerSmoothing: 1 },
  offerLine: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  offerCopy: { flex: 1, gap: 2 },
  offerTitle: { fontSize: 18, lineHeight: 24, fontWeight: '600', color: colors.text },
  compactTitle: { fontSize: 16, lineHeight: 22, fontWeight: '500' },
  price: { fontSize: 20, lineHeight: 26, fontWeight: '800', color: colors.text },
  compactPrice: { fontSize: 16, lineHeight: 22, fontWeight: '500', alignSelf: 'center' },
  caption: { fontSize: 14, lineHeight: 20, color: colors.mutedText },
  offerFooter: { minHeight: 34, paddingTop: 11, borderTopWidth: 1, borderColor: searchSurfaces.divider, flexDirection: 'row', alignItems: 'center', gap: 8 },
  detail: { flexShrink: 1, fontSize: 14, lineHeight: 20, color: 'rgba(255,255,255,0.6)' },
  globe: { width: 22, height: 22 },
  eyes: { width: 18, height: 14 },
  badge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: colors.lime, borderRadius: 8 },
  badgeText: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.ink },
  countryPanel: { paddingVertical: 8, backgroundColor: searchSurfaces.panel, borderRadius: 24, cornerSmoothing: 1 },
  countryPanelTitle: { fontSize: 14, lineHeight: 20, color: colors.mutedText, paddingHorizontal: 16, marginTop: 4, marginBottom: 4 },
  countryRow: { minHeight: 62, paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 12 },
  segmentsContainer: { borderRadius: 16, backgroundColor: searchSurfaces.panel },
  segments: { minWidth: '100%', padding: 4, flexGrow: 1 },
  segment: { flexGrow: 1, minWidth: 90, paddingHorizontal: 10, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  activeSegment: { backgroundColor: colors.text },
  segmentText: { fontSize: 14, lineHeight: 20, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  activeSegmentText: { color: colors.ink },
  skeleton: { height: 104, borderRadius: 24, cornerSmoothing: 1, backgroundColor: searchSurfaces.panel, padding: 16, gap: 10 },
  firstSkeleton: { height: 132 },
  skeletonLine: { height: 10, borderRadius: 5, backgroundColor: '#303032' },
  skeletonTitle: { width: '58%', height: 14, borderRadius: 7 },
  error: { padding: 16, gap: 12, alignItems: 'center', backgroundColor: searchSurfaces.panel, borderRadius: 24, cornerSmoothing: 1 },
  errorArt: { width: 168, height: 132, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  errorImage: { width: 158.5, height: 85.5, transform: [{ translateY: 6 }, { rotate: '-12deg' }] },
  center: { textAlign: 'center' },
  partialError: { alignItems: 'flex-start', gap: 8, padding: 16 },
  pressed: { opacity: 0.72 },
});
