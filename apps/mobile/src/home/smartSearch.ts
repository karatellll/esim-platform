import type { CatalogCategory, CatalogEsim } from '../../../../packages/shared/contracts/catalog';

export const MAX_TRIP_COUNTRIES = 5;
const regionalCodes = new Set(['XS', 'XA', 'XM', 'XC', 'XE', 'XB', 'XN', 'XL']);
export const isCountry = (item: CatalogEsim) => !!item.country_iso2 && !regionalCodes.has(item.country_iso2.toUpperCase()) && item.country_iso2.toUpperCase() !== 'XG';
export const tripCountries = (items: readonly CatalogEsim[]) => items.filter(item => item.country_iso2?.toUpperCase() !== 'RU' && !item.id.startsWith('unavailable:'));
const normalize = (text: string) => text.toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/[^\p{L}\p{N} ]/gu, '').trim();
const keyboardFrom = 'qwertyuiop[]asdfghjkl;\'zxcvbnm,.';
const keyboardTo = 'йцукенгшщзхъфывапролджэячсмитьбю';
const correctKeyboard = (text: string) => [...text.toLowerCase()].map(char => keyboardTo[keyboardFrom.indexOf(char)] ?? char).join('');
const aliases: Record<string, string[]> = {
  TR: ['Турция', 'Turkey', 'Türkiye', 'Анталья', 'Анталия', 'Стамбул', 'Аланья', 'Кемер', 'Бодрум'],
  TH: ['Таиланд', 'Тайланд', 'Thailand', 'Пхукет', 'Бангкок', 'Паттайя', 'Самуи', 'Phuket'],
  GB: ['Великобритания', 'Англия', 'Британия', 'UK', 'United Kingdom', 'England', 'Лондон', 'London'],
  AE: ['ОАЭ', 'Эмираты', 'Арабские Эмираты', 'UAE', 'United Arab Emirates', 'Дубай', 'Dubai', 'Абу-Даби', 'Шарджа'],
  US: ['США', 'Штаты', 'Америка', 'USA', 'United States', 'Нью-Йорк', 'New York', 'Лос-Анджелес', 'Майами'],
  FR: ['Франция', 'France', 'Париж', 'Paris', 'Ницца'], IT: ['Италия', 'Italy', 'Рим', 'Rome', 'Милан', 'Венеция'],
  ES: ['Испания', 'Spain', 'Барселона', 'Мадрид', 'Тенерифе'], DE: ['Германия', 'Germany', 'Берлин', 'Мюнхен'],
  GE: ['Грузия', 'Georgia', 'Тбилиси', 'Батуми'], JP: ['Япония', 'Japan', 'Токио'],
  RU: ['Россия', 'Russia', 'Москва'], KP: ['КНДР', 'Северная Корея', 'North Korea'],
};
// One substitution, insertion, deletion or adjacent transposition. Avoid fuzzy short codes.
function near(a: string, b: string): boolean {
  if (a.length < 4 || Math.abs(a.length - b.length) > 1) return false;
  const rows = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) rows[i][0] = i;
  for (let j = 0; j <= b.length; j++) rows[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + Number(a[i - 1] !== b[j - 1]));
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
  }
  return rows[a.length][b.length] <= 1;
}
export type SearchMatch = { country: CatalogEsim; reason: string | null };
export function searchCountries(countries: readonly CatalogEsim[], query: string): SearchMatch[] {
  const raw = normalize(query), corrected = normalize(correctKeyboard(query));
  if (!raw) return [];
  return countries.flatMap(country => {
    const code = country.country_iso2?.toUpperCase() ?? '';
    const known = countryNames.find(item => item.code === code);
    const names = [country.display_name, code, ...(known ? [known.name, known.english] : []), ...(aliases[code] ?? [])];
    for (const [term, keyboard] of [[raw, false], [corrected, true]] as const) {
      for (const name of names) {
        const normalized = normalize(name);
        if (normalized.startsWith(term) || (term.length >= 3 && normalized.split(' ').some(word => word.startsWith(term))) || near(term, normalized)) {
          const reason = keyboard ? `Ищем «${correctKeyboard(query)}»` : normalized !== normalize(country.display_name) && normalized !== normalize(code) ? `${name} → ${country.display_name}` : raw !== normalized && near(raw, normalized) && !normalized.startsWith(raw) ? `Возможно, вы искали «${country.display_name}»` : null;
          return [{ country, reason }];
        }
      }
    }
    return [];
  });
}
export function toggleTripCountry(selected: readonly CatalogEsim[], country: CatalogEsim): CatalogEsim[] {
  if (selected.some(item => item.id === country.id)) return selected.filter(item => item.id !== country.id);
  return selected.length >= MAX_TRIP_COUNTRIES ? [...selected] : [...selected, country];
}
export function categoryBundle(category: CatalogCategory): CatalogEsim | null {
  const items = category.esims.filter(item => regionalCodes.has(item.country_iso2?.toUpperCase() ?? ''));
  const normalizeTitle = (name: string) => normalize(name.replace(/\(регион\)/gi, ''));
  return items.find(item => normalizeTitle(item.display_name) === normalizeTitle(category.title)) ?? (items.length === 1 ? items[0] : null);
}
export type RouteOption = { esim: CatalogEsim; category?: CatalogCategory; countries: CatalogEsim[] };
export type TripRoute = { primary: RouteOption | null; alternative: RouteOption[] | null; separateMoreExpensive: boolean; ignored: CatalogEsim[] };
export function totalPrice(options: readonly RouteOption[]): { amount: number; currency: string } | null {
  const first = options[0]?.esim;
  if (!first?.min_price_currency || !options.length || options.some(({ esim }) => esim.min_price_amount === null || !Number.isFinite(esim.min_price_amount) || esim.min_price_amount < 0 || esim.min_price_currency !== first.min_price_currency)) return null;
  return { amount: options.reduce((sum, item) => sum + item.esim.min_price_amount!, 0), currency: first.min_price_currency };
}
export function planTrip(selected: readonly CatalogEsim[], categories: readonly CatalogCategory[]): TripRoute {
  const countries = tripCountries(selected);
  const ignored = selected.filter(item => !countries.includes(item));
  const empty = { primary: null, alternative: null, separateMoreExpensive: false, ignored };
  if (!countries.length) return empty;
  const regions: RouteOption[] = categories.flatMap(category => {
    const esim = categoryBundle(category);
    const codes = new Set(category.esims.filter(isCountry).map(item => item.country_iso2?.toUpperCase()));
    const covered = countries.filter(item => codes.has(item.country_iso2?.toUpperCase()));
    return esim && covered.length >= 2 ? [{ esim, category, countries: covered }] : [];
  });
  const byConvenience = (a: RouteOption, b: RouteOption) => b.countries.length - a.countries.length || (a.esim.min_price_currency === b.esim.min_price_currency ? (a.esim.min_price_amount ?? Infinity) - (b.esim.min_price_amount ?? Infinity) : 0);
  regions.sort(byConvenience);
  const global = categories.flatMap(category => category.esims).find(item => item.country_iso2?.toUpperCase() === 'XG');
  const primary = countries.length === 1 ? { esim: countries[0], countries }
    : regions.find(region => region.countries.length === countries.length) ?? (global ? { esim: global, countries } : null);
  if (!primary) return empty;
  if (countries.length === 1) return { ...empty, primary };
  const candidates = [...regions.filter(item => item.esim.id !== primary.esim.id), ...countries.map(esim => ({ esim, countries: [esim] }))];
  let best: RouteOption[] | null = null;
  let bestAmount = Infinity;
  const primaryPrice = totalPrice([primary]);
  // At most five countries: exhaustively compare partitions, including region + singles.
  const visit = (remaining: CatalogEsim[], chosen: RouteOption[]) => {
    if (!remaining.length) {
      const price = totalPrice(chosen);
      if (price && primaryPrice && price.currency === primaryPrice.currency && price.amount < bestAmount) { best = chosen; bestAmount = price.amount; }
      return;
    }
    for (const option of candidates) {
      if (!option.countries.some(country => country.id === remaining[0].id) || !option.countries.every(country => remaining.some(item => item.id === country.id))) continue;
      visit(remaining.filter(country => !option.countries.some(item => item.id === country.id)), [...chosen, option]);
    }
  };
  visit(countries, []);
  return { primary, alternative: primaryPrice && bestAmount < primaryPrice.amount ? best : null, separateMoreExpensive: !!primaryPrice && Number.isFinite(bestAmount) && bestAmount >= primaryPrice.amount, ignored };
}
export function findRegions(categories: readonly CatalogCategory[], query: string) {
  const term = normalize(query);
  const english: Record<string, string> = { europe: 'европа', asia: 'азия', africa: 'африка', 'north america': 'северная америка', 'south america': 'южная америка', oceania: 'океания', world: 'весь мир' };
  return term.length < 2 ? [] : categories.filter(category => categoryBundle(category) && normalize(category.title).startsWith(english[term] ?? term));
}

export function searchableCountries(available: readonly CatalogEsim[]): CatalogEsim[] {
  const codes = new Set(available.map(item => item.country_iso2?.toUpperCase()));
  return [...available, ...countryNames.filter(item => !codes.has(item.code)).map(item => ({
    id: `unavailable:${item.code}`, country_iso2: item.code, display_name: item.name,
    image_url: null, min_price_amount: null, min_price_currency: null,
  }))];
}

// ISO 3166-1 country names, local iso-codes/CLDR data. Availability always comes from the API.
const countryNames = [
  {
    "code": "AW",
    "name": "Аруба",
    "english": "Aruba"
  },
  {
    "code": "AF",
    "name": "Афганистан",
    "english": "Afghanistan"
  },
  {
    "code": "AO",
    "name": "Ангола",
    "english": "Angola"
  },
  {
    "code": "AI",
    "name": "Ангвилла",
    "english": "Anguilla"
  },
  {
    "code": "AX",
    "name": "Аландские острова",
    "english": "Åland Islands"
  },
  {
    "code": "AL",
    "name": "Албания",
    "english": "Albania"
  },
  {
    "code": "AD",
    "name": "Андорра",
    "english": "Andorra"
  },
  {
    "code": "AE",
    "name": "Объединённые Арабские Эмираты",
    "english": "United Arab Emirates"
  },
  {
    "code": "AR",
    "name": "Аргентина",
    "english": "Argentina"
  },
  {
    "code": "AM",
    "name": "Армения",
    "english": "Armenia"
  },
  {
    "code": "AS",
    "name": "Американские Самоа",
    "english": "American Samoa"
  },
  {
    "code": "AQ",
    "name": "Антарктика",
    "english": "Antarctica"
  },
  {
    "code": "TF",
    "name": "Французские южные территории",
    "english": "French Southern Territories"
  },
  {
    "code": "AG",
    "name": "Антигуа и Барбуда",
    "english": "Antigua and Barbuda"
  },
  {
    "code": "AU",
    "name": "Австралия",
    "english": "Australia"
  },
  {
    "code": "AT",
    "name": "Австрия",
    "english": "Austria"
  },
  {
    "code": "AZ",
    "name": "Азербайджан",
    "english": "Azerbaijan"
  },
  {
    "code": "BI",
    "name": "Бурунди",
    "english": "Burundi"
  },
  {
    "code": "BE",
    "name": "Бельгия",
    "english": "Belgium"
  },
  {
    "code": "BJ",
    "name": "Бенин",
    "english": "Benin"
  },
  {
    "code": "BQ",
    "name": "Бонайре, Синт-Эстатиус и Саба",
    "english": "Bonaire, Sint Eustatius and Saba"
  },
  {
    "code": "BF",
    "name": "Буркина-Фасо",
    "english": "Burkina Faso"
  },
  {
    "code": "BD",
    "name": "Бангладеш",
    "english": "Bangladesh"
  },
  {
    "code": "BG",
    "name": "Болгария",
    "english": "Bulgaria"
  },
  {
    "code": "BH",
    "name": "Бахрейн",
    "english": "Bahrain"
  },
  {
    "code": "BS",
    "name": "Багамы",
    "english": "Bahamas"
  },
  {
    "code": "BA",
    "name": "Босния и Герцеговина",
    "english": "Bosnia and Herzegovina"
  },
  {
    "code": "BL",
    "name": "Сен-Бартельми",
    "english": "Saint Barthélemy"
  },
  {
    "code": "BY",
    "name": "Беларусь",
    "english": "Belarus"
  },
  {
    "code": "BZ",
    "name": "Белиз",
    "english": "Belize"
  },
  {
    "code": "BM",
    "name": "Бермуды",
    "english": "Bermuda"
  },
  {
    "code": "BO",
    "name": "Боливия",
    "english": "Bolivia"
  },
  {
    "code": "BR",
    "name": "Бразилия",
    "english": "Brazil"
  },
  {
    "code": "BB",
    "name": "Барбадос",
    "english": "Barbados"
  },
  {
    "code": "BN",
    "name": "Бруней Даруссалам",
    "english": "Brunei Darussalam"
  },
  {
    "code": "BT",
    "name": "Бутан",
    "english": "Bhutan"
  },
  {
    "code": "BV",
    "name": "Остров Буве",
    "english": "Bouvet Island"
  },
  {
    "code": "BW",
    "name": "Ботсвана",
    "english": "Botswana"
  },
  {
    "code": "CF",
    "name": "Центрально-африканская республика",
    "english": "Central African Republic"
  },
  {
    "code": "CA",
    "name": "Канада",
    "english": "Canada"
  },
  {
    "code": "CC",
    "name": "Кокосовые острова",
    "english": "Cocos (Keeling) Islands"
  },
  {
    "code": "CH",
    "name": "Швейцария",
    "english": "Switzerland"
  },
  {
    "code": "CL",
    "name": "Чили",
    "english": "Chile"
  },
  {
    "code": "CN",
    "name": "Китай",
    "english": "China"
  },
  {
    "code": "CI",
    "name": "Кот-д'Ивуар",
    "english": "Côte d'Ivoire"
  },
  {
    "code": "CM",
    "name": "Камерун",
    "english": "Cameroon"
  },
  {
    "code": "CD",
    "name": "Демократическая Республика Конго",
    "english": "Congo, The Democratic Republic of the"
  },
  {
    "code": "CG",
    "name": "Конго",
    "english": "Congo"
  },
  {
    "code": "CK",
    "name": "Острова Кука",
    "english": "Cook Islands"
  },
  {
    "code": "CO",
    "name": "Колумбия",
    "english": "Colombia"
  },
  {
    "code": "KM",
    "name": "Коморы",
    "english": "Comoros"
  },
  {
    "code": "CV",
    "name": "Кабо-Верде",
    "english": "Cabo Verde"
  },
  {
    "code": "CR",
    "name": "Коста-Рика",
    "english": "Costa Rica"
  },
  {
    "code": "CU",
    "name": "Куба",
    "english": "Cuba"
  },
  {
    "code": "CW",
    "name": "Кюрасао",
    "english": "Curaçao"
  },
  {
    "code": "CX",
    "name": "Остров Рождества",
    "english": "Christmas Island"
  },
  {
    "code": "KY",
    "name": "Каймановы острова",
    "english": "Cayman Islands"
  },
  {
    "code": "CY",
    "name": "Кипр",
    "english": "Cyprus"
  },
  {
    "code": "CZ",
    "name": "Чехия",
    "english": "Czechia"
  },
  {
    "code": "DE",
    "name": "Германия",
    "english": "Germany"
  },
  {
    "code": "DJ",
    "name": "Джибути",
    "english": "Djibouti"
  },
  {
    "code": "DM",
    "name": "Доминика",
    "english": "Dominica"
  },
  {
    "code": "DK",
    "name": "Дания",
    "english": "Denmark"
  },
  {
    "code": "DO",
    "name": "Доминиканская республика",
    "english": "Dominican Republic"
  },
  {
    "code": "DZ",
    "name": "Алжир",
    "english": "Algeria"
  },
  {
    "code": "EC",
    "name": "Эквадор",
    "english": "Ecuador"
  },
  {
    "code": "EG",
    "name": "Египет",
    "english": "Egypt"
  },
  {
    "code": "ER",
    "name": "Эритрея",
    "english": "Eritrea"
  },
  {
    "code": "EH",
    "name": "Западная Сахара",
    "english": "Western Sahara"
  },
  {
    "code": "ES",
    "name": "Испания",
    "english": "Spain"
  },
  {
    "code": "EE",
    "name": "Эстония",
    "english": "Estonia"
  },
  {
    "code": "ET",
    "name": "Эфиопия",
    "english": "Ethiopia"
  },
  {
    "code": "FI",
    "name": "Финляндия",
    "english": "Finland"
  },
  {
    "code": "FJ",
    "name": "Фиджи",
    "english": "Fiji"
  },
  {
    "code": "FK",
    "name": "Фолклендские (Мальвинские) острова",
    "english": "Falkland Islands (Malvinas)"
  },
  {
    "code": "FR",
    "name": "Франция",
    "english": "France"
  },
  {
    "code": "FO",
    "name": "Фарерские острова",
    "english": "Faroe Islands"
  },
  {
    "code": "FM",
    "name": "Федеративные Штаты Микронезии",
    "english": "Micronesia, Federated States of"
  },
  {
    "code": "GA",
    "name": "Габон",
    "english": "Gabon"
  },
  {
    "code": "GB",
    "name": "Соединённое Королевство",
    "english": "United Kingdom"
  },
  {
    "code": "GE",
    "name": "Грузия",
    "english": "Georgia"
  },
  {
    "code": "GG",
    "name": "Гернси",
    "english": "Guernsey"
  },
  {
    "code": "GH",
    "name": "Гана",
    "english": "Ghana"
  },
  {
    "code": "GI",
    "name": "Гибралтар",
    "english": "Gibraltar"
  },
  {
    "code": "GN",
    "name": "Гвинея",
    "english": "Guinea"
  },
  {
    "code": "GP",
    "name": "Гваделупа",
    "english": "Guadeloupe"
  },
  {
    "code": "GM",
    "name": "Гамбия",
    "english": "Gambia"
  },
  {
    "code": "GW",
    "name": "Гвинея-Бисау",
    "english": "Guinea-Bissau"
  },
  {
    "code": "GQ",
    "name": "Экваториальная Гвинея",
    "english": "Equatorial Guinea"
  },
  {
    "code": "GR",
    "name": "Греция",
    "english": "Greece"
  },
  {
    "code": "GD",
    "name": "Гренада",
    "english": "Grenada"
  },
  {
    "code": "GL",
    "name": "Гренландия",
    "english": "Greenland"
  },
  {
    "code": "GT",
    "name": "Гватемала",
    "english": "Guatemala"
  },
  {
    "code": "GF",
    "name": "Французская Гвиана",
    "english": "French Guiana"
  },
  {
    "code": "GU",
    "name": "Гуам",
    "english": "Guam"
  },
  {
    "code": "GY",
    "name": "Гайана",
    "english": "Guyana"
  },
  {
    "code": "HK",
    "name": "Гонконг",
    "english": "Hong Kong"
  },
  {
    "code": "HM",
    "name": "Остров Херд и острова МакДональд",
    "english": "Heard Island and McDonald Islands"
  },
  {
    "code": "HN",
    "name": "Гондурас",
    "english": "Honduras"
  },
  {
    "code": "HR",
    "name": "Хорватия",
    "english": "Croatia"
  },
  {
    "code": "HT",
    "name": "Гаити",
    "english": "Haiti"
  },
  {
    "code": "HU",
    "name": "Венгрия",
    "english": "Hungary"
  },
  {
    "code": "ID",
    "name": "Индонезия",
    "english": "Indonesia"
  },
  {
    "code": "IM",
    "name": "Остров Мэн",
    "english": "Isle of Man"
  },
  {
    "code": "IN",
    "name": "Индия",
    "english": "India"
  },
  {
    "code": "IO",
    "name": "Британская территория Индийского океана",
    "english": "British Indian Ocean Territory"
  },
  {
    "code": "IE",
    "name": "Ирландия",
    "english": "Ireland"
  },
  {
    "code": "IR",
    "name": "Иран",
    "english": "Iran"
  },
  {
    "code": "IQ",
    "name": "Ирак",
    "english": "Iraq"
  },
  {
    "code": "IS",
    "name": "Исландия",
    "english": "Iceland"
  },
  {
    "code": "IL",
    "name": "Израиль",
    "english": "Israel"
  },
  {
    "code": "IT",
    "name": "Италия",
    "english": "Italy"
  },
  {
    "code": "JM",
    "name": "Ямайка",
    "english": "Jamaica"
  },
  {
    "code": "JE",
    "name": "Джерси",
    "english": "Jersey"
  },
  {
    "code": "JO",
    "name": "Иордания",
    "english": "Jordan"
  },
  {
    "code": "JP",
    "name": "Япония",
    "english": "Japan"
  },
  {
    "code": "KZ",
    "name": "Казахстан",
    "english": "Kazakhstan"
  },
  {
    "code": "KE",
    "name": "Кения",
    "english": "Kenya"
  },
  {
    "code": "KG",
    "name": "Киргизия",
    "english": "Kyrgyzstan"
  },
  {
    "code": "KH",
    "name": "Камбоджа",
    "english": "Cambodia"
  },
  {
    "code": "KI",
    "name": "Кирибати",
    "english": "Kiribati"
  },
  {
    "code": "KN",
    "name": "Сент-Китс и Невис",
    "english": "Saint Kitts and Nevis"
  },
  {
    "code": "KR",
    "name": "Южная Корея",
    "english": "South Korea"
  },
  {
    "code": "KW",
    "name": "Кувейт",
    "english": "Kuwait"
  },
  {
    "code": "LA",
    "name": "Лаос",
    "english": "Laos"
  },
  {
    "code": "LB",
    "name": "Ливан",
    "english": "Lebanon"
  },
  {
    "code": "LR",
    "name": "Либерия",
    "english": "Liberia"
  },
  {
    "code": "LY",
    "name": "Ливия",
    "english": "Libya"
  },
  {
    "code": "LC",
    "name": "Сент-Люсия",
    "english": "Saint Lucia"
  },
  {
    "code": "LI",
    "name": "Лихтенштейн",
    "english": "Liechtenstein"
  },
  {
    "code": "LK",
    "name": "Шри-Ланка",
    "english": "Sri Lanka"
  },
  {
    "code": "LS",
    "name": "Лесото",
    "english": "Lesotho"
  },
  {
    "code": "LT",
    "name": "Литва",
    "english": "Lithuania"
  },
  {
    "code": "LU",
    "name": "Люксембург",
    "english": "Luxembourg"
  },
  {
    "code": "LV",
    "name": "Латвия",
    "english": "Latvia"
  },
  {
    "code": "MO",
    "name": "Макао",
    "english": "Macao"
  },
  {
    "code": "MF",
    "name": "Сен-Мартен (Франция)",
    "english": "Saint Martin (French part)"
  },
  {
    "code": "MA",
    "name": "Марокко",
    "english": "Morocco"
  },
  {
    "code": "MC",
    "name": "Монако",
    "english": "Monaco"
  },
  {
    "code": "MD",
    "name": "Молдавия",
    "english": "Moldova"
  },
  {
    "code": "MG",
    "name": "Мадагаскар",
    "english": "Madagascar"
  },
  {
    "code": "MV",
    "name": "Мальдивы",
    "english": "Maldives"
  },
  {
    "code": "MX",
    "name": "Мексика",
    "english": "Mexico"
  },
  {
    "code": "MH",
    "name": "Маршалловы острова",
    "english": "Marshall Islands"
  },
  {
    "code": "MK",
    "name": "Северная Македония",
    "english": "North Macedonia"
  },
  {
    "code": "ML",
    "name": "Мали",
    "english": "Mali"
  },
  {
    "code": "MT",
    "name": "Мальта",
    "english": "Malta"
  },
  {
    "code": "MM",
    "name": "Мьянма",
    "english": "Myanmar"
  },
  {
    "code": "ME",
    "name": "Черногория",
    "english": "Montenegro"
  },
  {
    "code": "MN",
    "name": "Монголия",
    "english": "Mongolia"
  },
  {
    "code": "MP",
    "name": "Острова северной Марианы",
    "english": "Northern Mariana Islands"
  },
  {
    "code": "MZ",
    "name": "Мозамбик",
    "english": "Mozambique"
  },
  {
    "code": "MR",
    "name": "Мавритания",
    "english": "Mauritania"
  },
  {
    "code": "MS",
    "name": "Монтсеррат",
    "english": "Montserrat"
  },
  {
    "code": "MQ",
    "name": "Мартиника",
    "english": "Martinique"
  },
  {
    "code": "MU",
    "name": "Маврикий",
    "english": "Mauritius"
  },
  {
    "code": "MW",
    "name": "Малави",
    "english": "Malawi"
  },
  {
    "code": "MY",
    "name": "Малайзия",
    "english": "Malaysia"
  },
  {
    "code": "YT",
    "name": "Майот",
    "english": "Mayotte"
  },
  {
    "code": "NA",
    "name": "Намибия",
    "english": "Namibia"
  },
  {
    "code": "NC",
    "name": "Новая Каледония",
    "english": "New Caledonia"
  },
  {
    "code": "NE",
    "name": "Нигер",
    "english": "Niger"
  },
  {
    "code": "NF",
    "name": "Остров Норфолк",
    "english": "Norfolk Island"
  },
  {
    "code": "NG",
    "name": "Нигерия",
    "english": "Nigeria"
  },
  {
    "code": "NI",
    "name": "Никарагуа",
    "english": "Nicaragua"
  },
  {
    "code": "NU",
    "name": "Ниуэ",
    "english": "Niue"
  },
  {
    "code": "NL",
    "name": "Нидерланды",
    "english": "Netherlands"
  },
  {
    "code": "NO",
    "name": "Норвегия",
    "english": "Norway"
  },
  {
    "code": "NP",
    "name": "Непал",
    "english": "Nepal"
  },
  {
    "code": "NR",
    "name": "Науру",
    "english": "Nauru"
  },
  {
    "code": "NZ",
    "name": "Новая Зеландия",
    "english": "New Zealand"
  },
  {
    "code": "OM",
    "name": "Оман",
    "english": "Oman"
  },
  {
    "code": "PK",
    "name": "Пакистан",
    "english": "Pakistan"
  },
  {
    "code": "PA",
    "name": "Панама",
    "english": "Panama"
  },
  {
    "code": "PN",
    "name": "Питкэрн",
    "english": "Pitcairn"
  },
  {
    "code": "PE",
    "name": "Перу",
    "english": "Peru"
  },
  {
    "code": "PH",
    "name": "Филиппины",
    "english": "Philippines"
  },
  {
    "code": "PW",
    "name": "Палау",
    "english": "Palau"
  },
  {
    "code": "PG",
    "name": "Папуа — Новая Гвинея",
    "english": "Papua New Guinea"
  },
  {
    "code": "PL",
    "name": "Польша",
    "english": "Poland"
  },
  {
    "code": "PR",
    "name": "Пуэрто-Рико",
    "english": "Puerto Rico"
  },
  {
    "code": "KP",
    "name": "Северная Корея",
    "english": "North Korea"
  },
  {
    "code": "PT",
    "name": "Португалия",
    "english": "Portugal"
  },
  {
    "code": "PY",
    "name": "Парагвай",
    "english": "Paraguay"
  },
  {
    "code": "PS",
    "name": "Палестина",
    "english": "Palestine, State of"
  },
  {
    "code": "PF",
    "name": "Французская Полинезия",
    "english": "French Polynesia"
  },
  {
    "code": "QA",
    "name": "Катар",
    "english": "Qatar"
  },
  {
    "code": "RE",
    "name": "Реюньон",
    "english": "Réunion"
  },
  {
    "code": "RO",
    "name": "Румыния",
    "english": "Romania"
  },
  {
    "code": "RU",
    "name": "Российская Федерация",
    "english": "Russian Federation"
  },
  {
    "code": "RW",
    "name": "Руанда",
    "english": "Rwanda"
  },
  {
    "code": "SA",
    "name": "Саудовская Аравия",
    "english": "Saudi Arabia"
  },
  {
    "code": "SD",
    "name": "Судан",
    "english": "Sudan"
  },
  {
    "code": "SN",
    "name": "Сенегал",
    "english": "Senegal"
  },
  {
    "code": "SG",
    "name": "Сингапур",
    "english": "Singapore"
  },
  {
    "code": "GS",
    "name": "Южная Джорджия и Южные Сандвичевы острова",
    "english": "South Georgia and the South Sandwich Islands"
  },
  {
    "code": "SH",
    "name": "Остров Святой Елены, Остров Вознесения и Тристан-да-Кунья",
    "english": "Saint Helena, Ascension and Tristan da Cunha"
  },
  {
    "code": "SJ",
    "name": "Шпицберген и Ян-Майен",
    "english": "Svalbard and Jan Mayen"
  },
  {
    "code": "SB",
    "name": "Соломоновы Острова",
    "english": "Solomon Islands"
  },
  {
    "code": "SL",
    "name": "Сьерра-Леоне",
    "english": "Sierra Leone"
  },
  {
    "code": "SV",
    "name": "Сальвадор",
    "english": "El Salvador"
  },
  {
    "code": "SM",
    "name": "Сан-Марино",
    "english": "San Marino"
  },
  {
    "code": "SO",
    "name": "Сомали",
    "english": "Somalia"
  },
  {
    "code": "PM",
    "name": "Сен-Пьер и Микелон",
    "english": "Saint Pierre and Miquelon"
  },
  {
    "code": "RS",
    "name": "Сербия",
    "english": "Serbia"
  },
  {
    "code": "SS",
    "name": "Южный Судан",
    "english": "South Sudan"
  },
  {
    "code": "ST",
    "name": "Сан-Томе и Принсипи",
    "english": "Sao Tome and Principe"
  },
  {
    "code": "SR",
    "name": "Суринам",
    "english": "Suriname"
  },
  {
    "code": "SK",
    "name": "Словакия",
    "english": "Slovakia"
  },
  {
    "code": "SI",
    "name": "Словения",
    "english": "Slovenia"
  },
  {
    "code": "SE",
    "name": "Швеция",
    "english": "Sweden"
  },
  {
    "code": "SZ",
    "name": "Эсватини",
    "english": "Eswatini"
  },
  {
    "code": "SX",
    "name": "Синт-Мартен (голландская часть)",
    "english": "Sint Maarten (Dutch part)"
  },
  {
    "code": "SC",
    "name": "Сейшелы",
    "english": "Seychelles"
  },
  {
    "code": "SY",
    "name": "Сирия",
    "english": "Syria"
  },
  {
    "code": "TC",
    "name": "Острова Туркс и Каикос",
    "english": "Turks and Caicos Islands"
  },
  {
    "code": "TD",
    "name": "Чад",
    "english": "Chad"
  },
  {
    "code": "TG",
    "name": "Того",
    "english": "Togo"
  },
  {
    "code": "TH",
    "name": "Таиланд",
    "english": "Thailand"
  },
  {
    "code": "TJ",
    "name": "Таджикистан",
    "english": "Tajikistan"
  },
  {
    "code": "TK",
    "name": "Токелау",
    "english": "Tokelau"
  },
  {
    "code": "TM",
    "name": "Туркменистан",
    "english": "Turkmenistan"
  },
  {
    "code": "TL",
    "name": "Восточный Тимор",
    "english": "Timor-Leste"
  },
  {
    "code": "TO",
    "name": "Тонга",
    "english": "Tonga"
  },
  {
    "code": "TT",
    "name": "Тринидад и Тобаго",
    "english": "Trinidad and Tobago"
  },
  {
    "code": "TN",
    "name": "Тунис",
    "english": "Tunisia"
  },
  {
    "code": "TR",
    "name": "Турция",
    "english": "Türkiye"
  },
  {
    "code": "TV",
    "name": "Тувалу",
    "english": "Tuvalu"
  },
  {
    "code": "TW",
    "name": "Тайвань",
    "english": "Taiwan"
  },
  {
    "code": "TZ",
    "name": "Танзания",
    "english": "Tanzania"
  },
  {
    "code": "UG",
    "name": "Уганда",
    "english": "Uganda"
  },
  {
    "code": "UA",
    "name": "Украина",
    "english": "Ukraine"
  },
  {
    "code": "UM",
    "name": "Соединенные штаты Малых Удаленных островов",
    "english": "United States Minor Outlying Islands"
  },
  {
    "code": "UY",
    "name": "Уругвай",
    "english": "Uruguay"
  },
  {
    "code": "US",
    "name": "Соединённые штаты",
    "english": "United States"
  },
  {
    "code": "UZ",
    "name": "Узбекистан",
    "english": "Uzbekistan"
  },
  {
    "code": "VA",
    "name": "Государство-город Ватикан",
    "english": "Holy See (Vatican City State)"
  },
  {
    "code": "VC",
    "name": "Сент-Винсент и Гренадины",
    "english": "Saint Vincent and the Grenadines"
  },
  {
    "code": "VE",
    "name": "Венесуэла",
    "english": "Venezuela"
  },
  {
    "code": "VG",
    "name": "Виргинские острова (Британия)",
    "english": "Virgin Islands, British"
  },
  {
    "code": "VI",
    "name": "Виргинские острова (США)",
    "english": "Virgin Islands, U.S."
  },
  {
    "code": "VN",
    "name": "Вьетнам",
    "english": "Vietnam"
  },
  {
    "code": "VU",
    "name": "Вануату",
    "english": "Vanuatu"
  },
  {
    "code": "WF",
    "name": "Уоллес и Футана",
    "english": "Wallis and Futuna"
  },
  {
    "code": "WS",
    "name": "Самоа",
    "english": "Samoa"
  },
  {
    "code": "YE",
    "name": "Йемен",
    "english": "Yemen"
  },
  {
    "code": "ZA",
    "name": "Южная Африка",
    "english": "South Africa"
  },
  {
    "code": "ZM",
    "name": "Замбия",
    "english": "Zambia"
  },
  {
    "code": "ZW",
    "name": "Зимбабве",
    "english": "Zimbabwe"
  }
] as const;
