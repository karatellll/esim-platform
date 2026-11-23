import type { ImageSource } from 'expo-image';

export type RootTabParamList = {
  Search: undefined;
  Countries: { section?: 'countries' | 'regions' } | undefined;
  MyEsims: undefined;
  Savings: undefined;
  Profile: undefined;
};

export type TabName = keyof RootTabParamList;

type TabDefinition = {
  name: TabName;
  label: string;
  testId: string;
  icon: ImageSource;
  activeIcon: ImageSource;
  iconWidth: number;
  iconHeight: number;
};

export const tabs: readonly TabDefinition[] = [
  {
    name: 'Search',
    label: 'Поиск',
    testId: 'search',
    icon: require('../../assets/tab-bar-v3/search-inactive.svg'),
    activeIcon: require('../../assets/home-v3/tab-search.svg'),
    iconWidth: 20.434,
    iconHeight: 19.9997,
  },
  {
    name: 'Countries',
    label: 'Страны',
    testId: 'countries',
    icon: require('../../assets/home-v3/tab-countries.svg'),
    activeIcon: require('../../assets/tab-bar-v3/countries-active.svg'),
    iconWidth: 19.9996,
    iconHeight: 19.9996,
  },
  {
    name: 'MyEsims',
    label: 'Мои eSIM',
    testId: 'esims',
    icon: require('../../assets/home-v3/tab-esims.svg'),
    activeIcon: require('../../assets/tab-bar-v3/esims-active.svg'),
    iconWidth: 19.0663,
    iconHeight: 20,
  },
  {
    name: 'Savings',
    label: 'Копилка',
    testId: 'savings',
    icon: require('../../assets/home-v3/tab-savings.svg'),
    activeIcon: require('../../assets/tab-bar-v3/savings-active.svg'),
    iconWidth: 20.3073,
    iconHeight: 19.9999,
  },
  {
    name: 'Profile',
    label: 'Профиль',
    testId: 'profile',
    icon: require('../../assets/home-v3/tab-profile.svg'),
    activeIcon: require('../../assets/tab-bar-v3/profile-active.svg'),
    iconWidth: 19.7228,
    iconHeight: 19.9999,
  },
];
