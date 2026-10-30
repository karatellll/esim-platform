// Original Figma exports: Главная, node 64:3349. Preserve intrinsic SVG sizes.
export const homeAssets = {
  signal: require('../../assets/home/signal.svg'),
  search: require('../../assets/home/search.svg'),
  calendar: require('../../assets/home/calendar.svg'),
  wifi: require('../../assets/home/wifi.svg'),
  chevron: require('../../assets/home/chevron.svg'),
  heroTitle: require('../../assets/home/hero-title.svg'),
  heroPrefix: require('../../assets/home/hero-prefix.svg'),
  heroCountry: require('../../assets/home/hero-country.svg'),
  sticker: require('../../assets/home/sticker.svg'),
  savingsTitle: require('../../assets/home/savings-title.svg'),
  coin45: require('../../assets/home/coin-45.svg'),
  coin5: require('../../assets/home/coin-5.svg'),
  popularTitle: require('../../assets/home/popular-title.svg'),
  close: require('../../assets/home/close.svg'),
  check: require('../../assets/home/check.svg'),
  globe: require('../../assets/home/usage-globe.svg'),
  play: require('../../assets/home/usage-play.svg'),
};

export const popularDestinations = [
  { code: 'TR', name: 'Турция', flag: require('../../assets/home/flag-tr.svg') },
  { code: 'AE', name: 'ОАЭ', flag: require('../../assets/home/flag-ae.svg') },
  { code: 'TH', name: 'Таиланд', flag: require('../../assets/home/flag-th.svg') },
  { code: 'GE', name: 'Грузия', flag: null },
  { code: 'JP', name: 'Япония', flag: require('../../assets/world/flag-jp.svg') },
] as const;
