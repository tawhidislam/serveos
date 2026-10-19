import { z } from 'zod';

export const APP_DOWNLOADS_KEY = ['platform-app-downloads'] as const;
export const APP_INSTALLER_BUCKET = 'platform-apps';
export const MAX_INSTALLER_BYTES = 50 * 1024 * 1024;
export const APP_PLATFORMS = ['android', 'ios', 'windows', 'macos'] as const;
export type AppPlatform = typeof APP_PLATFORMS[number];
export type InstallerPlatform = Exclude<AppPlatform, 'ios'>;

export const APP_PLATFORM_DETAILS = {
  android: {
    name: 'Android', title: 'Android',
    description: 'Keep your restaurant and team close, wherever service takes you.',
    storeLabel: 'Google Play URL', storePlaceholder: 'https://play.google.com/store/apps/details?id=…',
    storeError: 'Enter a Google Play URL (play.google.com).', minOsPlaceholder: 'e.g. Android 8.0+',
  },
  ios: {
    name: 'iOS', title: 'iPhone & iPad',
    description: 'A familiar workspace for your restaurant, ready to go with you.',
    storeLabel: 'App Store or TestFlight URL', storePlaceholder: 'https://apps.apple.com/…',
    storeError: 'Enter an App Store or TestFlight URL.', minOsPlaceholder: 'e.g. iOS 15.0+',
  },
  windows: {
    name: 'Windows', title: 'Windows',
    description: 'Run service from your desktop, with room for every detail.',
    storeLabel: 'Microsoft Store URL', storePlaceholder: 'https://apps.microsoft.com/detail/…',
    storeError: 'Enter a Microsoft Store URL (apps.microsoft.com).', minOsPlaceholder: 'e.g. Windows 10 or later',
  },
  macos: {
    name: 'macOS', title: 'macOS',
    description: 'Bring your restaurant workspace to your Mac and keep your team in sync.',
    storeLabel: 'Mac App Store URL', storePlaceholder: 'https://apps.apple.com/…',
    storeError: 'Enter a Mac App Store URL (apps.apple.com).', minOsPlaceholder: 'e.g. macOS 12 or later',
  },
} as const;

export const INSTALLER_EXTENSIONS = {
  android: ['apk'], windows: ['exe', 'msi', 'zip'], macos: ['dmg', 'pkg', 'zip'],
} as const;

export function safeAppDownloadUrl(value: string): string | null {
  try {
    const url = new URL(value);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.username || url.password || (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))) return null;
    return url.href;
  } catch { return null; }
}

export function safeAppStoreUrl(value: string, platform: AppPlatform): string | null {
  const safe = safeAppDownloadUrl(value);
  if (!safe) return null;
  const url = new URL(safe);
  const hosts: Record<AppPlatform, readonly string[]> = {
    android: ['play.google.com'], ios: ['apps.apple.com', 'testflight.apple.com'],
    windows: ['apps.microsoft.com'], macos: ['apps.apple.com'],
  };
  return url.protocol === 'https:' && hosts[platform].includes(url.hostname) ? safe : null;
}

const release = z.object({
  enabled: z.boolean(),
  status: z.enum(['coming_soon', 'available']),
  store_url: z.string().trim().max(2000),
  version: z.string().trim().max(40),
  min_os: z.string().trim().max(80),
  released_at: z.union([z.literal(''), z.string().date()]),
  release_notes: z.string().trim().max(4000),
}).strict();

export type AppRelease = z.infer<typeof release>;
const emptyRelease: AppRelease = { enabled: true, status: 'coming_soon', store_url: '', version: '', min_os: '', released_at: '', release_notes: '' };
const desktopRelease = release.extend({
  installer_url: z.string().trim().max(2000).refine(value => !value || !!safeAppDownloadUrl(value), 'Use an HTTPS installer link, or upload an installer.'),
  file_size_bytes: z.number().int().positive().nullable(),
});
const emptyDesktopRelease = { ...emptyRelease, installer_url: '', file_size_bytes: null };

export const appDownloadsSchema = z.object({
  app_name: z.string().trim().min(1, 'Enter an app name.').max(100),
  title: z.string().trim().min(1, 'Enter a page heading.').max(140),
  description: z.string().trim().min(1, 'Enter a page description.').max(700),
  support_note: z.string().trim().max(500),
  android: release.extend({
    apk_url: z.string().trim().max(2000).refine(value => !value || !!safeAppDownloadUrl(value), 'Use an HTTPS APK link, or upload an APK.'),
    file_size_bytes: z.number().int().positive().nullable(),
  }),
  ios: release,
  // Older saved pages remain readable while the desktop migration is deployed.
  windows: desktopRelease.default(emptyDesktopRelease),
  macos: desktopRelease.default(emptyDesktopRelease),
}).strict().superRefine((config, ctx) => {
  for (const platform of APP_PLATFORMS) {
    const item = config[platform];
    if (item.store_url && !safeAppStoreUrl(item.store_url, platform)) {
      ctx.addIssue({ code: 'custom', path: [platform, 'store_url'], message: APP_PLATFORM_DETAILS[platform].storeError });
    }
    const installer = platform === 'android' ? config.android.apk_url : platform === 'ios' ? '' : config[platform].installer_url;
    if (item.enabled && item.status === 'available' && !item.store_url && !installer) {
      const required = platform === 'ios' ? 'a store link' : platform === 'android' ? 'a Google Play link or APK' : 'a store link or installer';
      ctx.addIssue({ code: 'custom', path: [platform, 'status'], message: `Add ${required} before making ${APP_PLATFORM_DETAILS[platform].name} available.` });
    }
  }
});

export type AppDownloadsConfig = z.infer<typeof appDownloadsSchema>;
export interface AppDownloadsRecord { config: AppDownloadsConfig; updated_at: string }

export const DEFAULT_APP_DOWNLOADS: AppDownloadsConfig = {
  app_name: 'ServeOS Restaurant',
  title: 'Your restaurant. On every screen.',
  description: 'One app for the people behind every great service. Manage your restaurant, keep the kitchen moving, and give your team the tools to serve with confidence.',
  support_note: 'Use your existing restaurant account. Your role, branch access, and subscription carry over to the app.',
  android: { ...emptyRelease, apk_url: '', file_size_bytes: null },
  ios: { ...emptyRelease },
  windows: { ...emptyDesktopRelease },
  macos: { ...emptyDesktopRelease },
};

export function appInstaller(config: AppDownloadsConfig, platform: AppPlatform) {
  if (platform === 'ios') return { url: '', file_size_bytes: null };
  return { url: platform === 'android' ? config.android.apk_url : config[platform].installer_url, file_size_bytes: config[platform].file_size_bytes };
}

export function appReleaseAvailable(config: AppDownloadsConfig, platform: AppPlatform) {
  return config[platform].enabled && config[platform].status === 'available' && !!(safeAppStoreUrl(config[platform].store_url, platform) || safeAppDownloadUrl(appInstaller(config, platform).url));
}

export function formatAppFileSize(bytes: number | null) {
  return bytes ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : '';
}

export async function validateInstallerFile(file: File, platform: InstallerPlatform) {
  const extension = file.name.toLowerCase().split('.').pop() ?? '';
  const extensions: readonly string[] = INSTALLER_EXTENSIONS[platform];
  if (!extensions.includes(extension)) throw new Error(`Choose a ${APP_PLATFORM_DETAILS[platform].name} installer (${extensions.map(ext => `.${ext}`).join(', ')}).`);
  if (!file.size || file.size > MAX_INSTALLER_BYTES) throw new Error('Installers must be between 1 byte and 50 MB. Use an external HTTPS link for larger files.');
  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const begins = (signature: number[]) => signature.every((byte, index) => bytes[index] === byte);
  let valid = false;
  switch (extension) {
    case 'apk': case 'zip': valid = begins([80, 75, 3, 4]); break;
    case 'exe': valid = begins([77, 90]); break;
    case 'msi': valid = begins([208, 207, 17, 224, 161, 177, 26, 225]); break;
    case 'pkg': valid = begins([120, 97, 114, 33]); break;
    case 'dmg': {
      const footer = new Uint8Array(await file.slice(-512).arrayBuffer());
      valid = file.size >= 512 && [107, 111, 108, 121].every((byte, index) => footer[index] === byte);
      break;
    }
  }
  if (!valid) throw new Error(`This file does not match the .${extension} installer format.`);
  const contentType = extension === 'apk' ? 'application/vnd.android.package-archive' : extension === 'zip' ? 'application/zip' : extension === 'dmg' ? 'application/x-apple-diskimage' : 'application/octet-stream';
  return { extension, contentType };
}
