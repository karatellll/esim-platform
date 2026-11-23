import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import type { OrderData, OrdersEnvelope } from '../../../../packages/shared/contracts/checkout';
import { getOrder, getOrderQr } from '../api/checkout';

const webLists = new Map<string, OrdersEnvelope>();
const webOrders = new Map<string, OrderData>();
const safelyNamed = (value: string) => /^[a-z\d-]{1,80}$/i.test(value);
const folder = (userId: string) => {
  if (!safelyNamed(userId)) throw new Error('Invalid local account ID');
  return new Directory(Paths.cache, 'tursim-offline', userId);
};
const orderFile = (userId: string, orderId: string, suffix: string) => {
  if (!safelyNamed(orderId)) throw new Error('Invalid local order ID');
  return new File(folder(userId), `${orderId}.${suffix}`);
};

async function read<T>(file: File): Promise<T | null> {
  return file.exists ? JSON.parse(await file.text()) as T : null;
}

function write(file: File, value: string, encoding: 'utf8' | 'base64' = 'utf8') {
  file.create({ intermediates: true, overwrite: true });
  file.write(value, { encoding });
}

function encodeQr(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => typeof reader.result === 'string'
      ? resolve(reader.result.split(',')[1] ?? '') : reject(new Error('Invalid QR image'));
    reader.readAsDataURL(blob);
  });
}

export async function readOfflineOrders(userId: string): Promise<OrdersEnvelope | null> {
  try {
    return Platform.OS === 'web' ? webLists.get(userId) ?? null : await read(new File(folder(userId), 'orders.json'));
  } catch { return null; }
}

export function saveOfflineOrders(userId: string, response: OrdersEnvelope) {
  const saved = { data: response.data.filter(order => order.state === 'delivered'), meta: { has_more: false, next_cursor: null } };
  try {
    if (Platform.OS === 'web') webLists.set(userId, saved);
    else write(new File(folder(userId), 'orders.json'), JSON.stringify(saved));
  } catch { /* Device storage may be full or restricted. */ }
}

export async function readOfflineOrder(userId: string, orderId: string): Promise<OrderData | null> {
  try {
    const data = Platform.OS === 'web' ? webOrders.get(`${userId}:${orderId}`) ?? null
      : await read<OrderData>(orderFile(userId, orderId, 'json'));
    const uri = data?.provision?.qr_code_url;
    if (data?.provision && uri?.startsWith('file:') && !new File(uri).exists) data.provision.qr_code_url = '';
    return data;
  } catch { return null; }
}

const pendingQrs = new Set<string>();

export async function saveOfflineOrder(userId: string, order: OrderData, token: string, signal: AbortSignal) {
  if (signal.aborted || order.state !== 'delivered' || order.payment.state !== 'captured' || !order.provision) return;
  try {
    const { provision } = order;
    const previous = await readOfflineOrder(userId, order.id);
    if (signal.aborted) return;
    const sameProfile = previous?.provision?.activation_code === provision.activation_code;
    const saved: OrderData = {
      ...order, payment: { ...order.payment, url: null },
      provision: {
        ...provision, qr_code_url: sameProfile ? previous?.provision?.qr_code_url ?? '' : '', qr_code_url_expires: null,
      },
    };
    if (Platform.OS === 'web') {
      webOrders.set(`${userId}:${order.id}`, saved);
      return;
    }
    const metadata = orderFile(userId, order.id, 'json');
    write(metadata, JSON.stringify(saved));
    const key = `${userId}:${order.id}`;
    if (saved.provision?.qr_code_url || !provision.qr_code_url || pendingQrs.has(key)) return;
    pendingQrs.add(key);
    try {
      const blob = await getOrderQr(order.id, token, signal);
      const data = await encodeQr(blob);
      if (!data || signal.aborted || !saved.provision) return;
      const ext = blob.type === 'image/jpeg' ? 'jpg' : blob.type === 'image/webp' ? 'webp' : 'png';
      const qr = orderFile(userId, order.id, ext);
      write(qr, data, 'base64');
      saved.provision.qr_code_url = qr.uri;
      write(metadata, JSON.stringify(saved));
    } finally { pendingQrs.delete(key); }
  } catch { /* Keep the installation fields already written if QR download fails. */ }
}

export async function prefetchOfflineOrders(userId: string, response: OrdersEnvelope, token: string, signal: AbortSignal, onDetails?: (order: OrderData) => void) {
  const delivered = response.data.filter(order => order.state === 'delivered').reverse();
  async function worker() {
    for (let item = delivered.pop(); item && !signal.aborted; item = delivered.pop()) {
      const saved = await readOfflineOrder(userId, item.id);
      if (signal.aborted) return;
      if (saved) onDetails?.(saved);
      const expectsActivation = ['activated', 'active', 'depleted', 'expired'].includes(item.esim_status ?? '');
      const hasOfflineInstallation = saved?.provision?.activation_code && (saved.provision.qr_code_url || Platform.OS === 'web');
      if (hasOfflineInstallation && (!onDetails || !expectsActivation || saved?.activated_at)) continue;
      const orderId = item.id;
      try {
        const order = await getOrder(orderId, token, signal);
        if (!signal.aborted) onDetails?.(order.data);
        await saveOfflineOrder(userId, order.data, token, signal);
      } catch { /* Offline caching must not affect the live list. */ }
    }
  }
  await Promise.all(Array.from({ length: Math.min(3, delivered.length) }, worker));
}

export function eraseOfflineOrders(userId: string | null) {
  if (!userId) return;
  try {
    if (Platform.OS === 'web') {
      webLists.delete(userId);
      for (const key of webOrders.keys()) if (key.startsWith(`${userId}:`)) webOrders.delete(key);
    } else {
      const directory = folder(userId);
      if (directory.exists) directory.delete();
    }
  } catch { /* The signed-out account is no longer allowed to read the cache. */ }
}
