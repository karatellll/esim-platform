// Original assets from Figma PWdKnO2WHAIS0NE18vlgL4, screen 475:11924.
export const homeDesignAssets = {
  heroTitle: require('../../assets/home-v3/hero-title.svg'),
  heroPrefix: require('../../assets/home-v3/hero-prefix.svg'),
  heroBest: require('../../assets/home-v3/hero-best.svg'),
  heroPrices: require('../../assets/home-v3/hero-prices.svg'),
  popularTitle: require('../../assets/home-v3/popular-title.svg'),
  sticker: require('../../assets/home-v3/sticker.svg'),
  search: require('../../assets/home-v3/search.svg'),
  world: require('../../assets/home-v3/world.png'),
  worldOverlay: require('../../assets/home-v3/world-overlay.png'),
  coinStack: require('../../assets/home-v3/coin-stack.svg'),
  coinLarge: require('../../assets/home-v3/coin-large.svg'),
  coinSmall: require('../../assets/home-v3/coin-small.svg'),
};

export const homeRegions = [
  { key: 'europe', title: 'Европа', image: require('../../assets/home-v3/europe.png') },
  { key: 'asia', title: 'Азия', image: require('../../assets/home-v3/asia.png') },
  { key: 'africa', title: 'Африка', image: require('../../assets/home-v3/africa.png') },
] as const;

export const homeDestinations = [
  { code: 'TR', name: 'Турция', flag: require('../../assets/home-v3/flag-tr.svg') },
  { code: 'AE', name: 'ОАЭ', flag: require('../../assets/home-v3/flag-ae.png') },
  { code: 'TH', name: 'Таиланд', flag: require('../../assets/home-v3/flag-th.png') },
  { code: 'GE', name: 'Грузия', flag: require('../../assets/home-v3/flag-ge.svg') },
  { code: 'JP', name: 'Япония', flag: null },
] as const;
