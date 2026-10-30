import { ActionSheetIOS, Clipboard, Linking, Platform, Share } from 'react-native';

export async function copyInstallationValue(value: string): Promise<void> {
  if (!value) throw new Error('Данные ещё готовятся. Обновите заказ.');
  if (Platform.OS === 'web') {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(value); return; }
    const input = document.createElement('textarea');
    input.value = value;
    input.style.position = 'fixed'; input.style.opacity = '0';
    document.body.appendChild(input); input.select();
    try { if (!document.execCommand('copy')) throw new Error('Выделите реквизиты и скопируйте их вручную.'); }
    finally { input.remove(); }
    return;
  }
  // Supported by the project's pinned RN 0.86 on iOS and Android.
  Clipboard.setString(value);
}

async function dataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Не удалось прочитать QR-код.'));
    reader.onerror = () => reject(new Error('Не удалось прочитать QR-код.'));
    reader.readAsDataURL(blob);
  });
}

export async function exportInstallationQr(blob: Blob, intent: 'share' | 'save', fallbackUrl: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    const extension = blob.type === 'image/jpeg' ? 'jpg' : blob.type === 'image/webp' ? 'webp' : 'png';
    const file = new File([blob], `esim-qr.${extension}`, { type: blob.type });
    if (intent === 'share' && navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'QR-код eSIM' }); } catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) throw error; }
      return null;
    }
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = file.name; document.body.appendChild(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return intent === 'share' ? 'QR-код скачан. Его можно отправить как изображение.' : 'QR-код передан браузеру для сохранения.';
  }
  if (Platform.OS === 'ios') {
    const uri = await dataUri(blob);
    await new Promise<void>((resolve, reject) => ActionSheetIOS.showShareActionSheetWithOptions({ url: uri, subject: 'QR-код eSIM' }, reject, () => resolve()));
    return null;
  }
  if (intent === 'share') {
    await Share.share({ message: fallbackUrl, title: 'QR-код eSIM' });
    return null;
  }
  await Linking.openURL(fallbackUrl);
  return 'Сохраните изображение QR-кода в открывшемся браузере.';
}
