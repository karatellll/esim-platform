// Grammar for the heading only; names and destinations still come from the SDK.
import type { CatalogEsim } from '../../../../packages/shared/contracts/catalog';
const exceptions: Record<string, string> = {
  'Фарерские острова': 'Фарерских островах', 'Нидерландские Антильские острова': 'Нидерландских Антильских островах',
  'Каймановы острова': 'Каймановых островах', 'Британские Виргинские острова': 'Британских Виргинских островах',
  'Сент-Китс и Невис': 'Сент-Китсе и Невисе', 'Тёркс и Кайкос': 'Тёрксе и Кайкосе',
  'Сент-Винсент и Гренадины': 'Сент-Винсенте и Гренадинах', 'Беларусь': 'Беларуси',
  'Маврикий': 'Маврикии',
};
const indeclinable = new Set(['Перу', 'Чили', 'Мали', 'Малави', 'Фиджи', 'Косово', 'Марокко', 'Макао', 'Конго', 'Кабо-Верде', 'Гаити', 'Никарагуа', 'Пуэрто-Рико', 'Антигуа', 'Бангладеш', 'и']);

export function getTariffHeading(esim: Pick<CatalogEsim, 'country_iso2' | 'display_name'>): { prefix: string; label: string } {
  if (esim.country_iso2?.toUpperCase() === 'XG') return { prefix: 'Интернет во', label: 'всём мире' };
  return { prefix: `Интернет ${countryPreposition(esim.country_iso2)}`, label: countryLocative(esim.display_name) };
}

export function countryPreposition(code: string | null): string {
  if (code === 'FR' || code === 'VN') return 'во';
  const onIslands = new Set(['CY', 'MV', 'MT', 'LK', 'PH', 'FO', 'BB', 'BS', 'JM', 'VG', 'KN', 'KY', 'TC', 'VC', 'RE', 'MU', 'FJ', 'GU', 'GP', 'LC', 'AG', 'GD', 'DM', 'AI', 'MS', 'TW', 'MG']);
  return code && onIslands.has(code) ? 'на' : 'в';
}

export function countryLocative(name: string): string {
  if (exceptions[name]) return exceptions[name];
  return name.split(' ').map((word) => {
    if (indeclinable.has(word) || /^[А-ЯЁA-Z]{2,}$/.test(word)) return word;
    if (word.endsWith('ая')) return `${word.slice(0, -2)}ой`;
    if (word.endsWith('ия')) return `${word.slice(0, -2)}ии`;
    if (word.endsWith('а') || word.endsWith('я') || word.endsWith('й')) return `${word.slice(0, -1)}е`;
    if (word.endsWith('ы')) return `${word.slice(0, -1)}ах`;
    if (word.endsWith('ь')) return `${word.slice(0, -1)}и`;
    if (/[бвгджзклмнпрстфхцчшщ]$/i.test(word)) return `${word}е`;
    return word;
  }).join(' ');
}
