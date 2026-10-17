import type { ImageSource } from 'expo-image';

export type RootTabParamList = {
  Search: undefined;
  Countries: undefined;
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
};

export const tabs: readonly TabDefinition[] = [
  {
    name: 'Search',
    label: 'Поиск',
    testId: 'search',
    icon: require('../../assets/tab-bar/search.svg'),
    activeIcon: require('../../assets/tab-bar/search-active.svg'),
  },
  {
    name: 'Countries',
    label: 'Страны',
    testId: 'countries',
    icon: require('../../assets/tab-bar/countries.svg'),
    activeIcon: require('../../assets/tab-bar/countries-active.svg'),
  },
  {
    name: 'MyEsims',
    label: 'Мои eSIM',
    testId: 'esims',
    icon: require('../../assets/tab-bar/esims.svg'),
    activeIcon: require('../../assets/tab-bar/esims-active.svg'),
  },
  {
    name: 'Savings',
    label: 'Копилка',
    testId: 'savings',
    icon: require('../../assets/tab-bar/savings.svg'),
    activeIcon: require('../../assets/tab-bar/savings-active.svg'),
  },
  {
    name: 'Profile',
    label: 'Профиль',
    testId: 'profile',
    icon: require('../../assets/tab-bar/profile.svg'),
    activeIcon: require('../../assets/tab-bar/profile-active.svg'),
  },
];
