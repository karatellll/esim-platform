import type { ImageSource } from 'expo-image';

export type RootTabParamList = {
  Search: undefined;
  Countries: { section?: 'countries' | 'regions' | 'world' } | undefined;
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
    icon: require('../../assets/mvp/5dbbc.svg'),
    activeIcon: require('../../assets/mvp/9706f.svg'),
  },
  {
    name: 'Countries',
    label: 'Страны',
    testId: 'countries',
    icon: require('../../assets/mvp/ced92.svg'),
    activeIcon: require('../../assets/tab-bar/countries-active.svg'),
  },
  {
    name: 'MyEsims',
    label: 'Мои eSIM',
    testId: 'esims',
    icon: require('../../assets/mvp/96aa4.svg'),
    activeIcon: require('../../assets/mvp/3c6eb.svg'),
  },
  {
    name: 'Savings',
    label: 'Копилка',
    testId: 'savings',
    icon: require('../../assets/mvp/56de7.svg'),
    activeIcon: require('../../assets/mvp/af298.svg'),
  },
  {
    name: 'Profile',
    label: 'Профиль',
    testId: 'profile',
    icon: require('../../assets/mvp/d26d0.svg'),
    activeIcon: require('../../assets/mvp/17f46.svg'),
  },
];
