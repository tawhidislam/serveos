import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import AppDownloadCards from '@/components/marketing/AppDownloadCards';
import { appDownloadsSchema, DEFAULT_APP_DOWNLOADS, safeAppDownloadUrl, safeAppStoreUrl } from '@/lib/app-downloads';

describe('app release publishing', () => {
  it('starts with coming-soon cards and no invented downloads', () => {
    render(<AppDownloadCards config={DEFAULT_APP_DOWNLOADS} />);
    expect(screen.getAllByRole('button', { name: 'Coming soon' })).toHaveLength(4);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('rejects unsafe links and available releases without a download', () => {
    expect(safeAppDownloadUrl('javascript:alert(1)')).toBeNull();
    expect(safeAppDownloadUrl('https://user:password@example.com/app.apk')).toBeNull();
    expect(safeAppDownloadUrl('http://example.com/app.apk')).toBeNull();
    expect(safeAppStoreUrl('https://play.google.com.evil.example/app', 'android')).toBeNull();
    expect(safeAppStoreUrl('https://testflight.apple.com/join/abc', 'ios')).toBeTruthy();
    expect(safeAppStoreUrl('https://apps.microsoft.com.evil.example/detail/app', 'windows')).toBeNull();
    expect(safeAppStoreUrl('https://apps.microsoft.com/detail/app', 'windows')).toBeTruthy();
    expect(safeAppStoreUrl('https://testflight.apple.com/join/abc', 'macos')).toBeNull();
    expect(appDownloadsSchema.safeParse({ ...DEFAULT_APP_DOWNLOADS, android: { ...DEFAULT_APP_DOWNLOADS.android, status: 'available' } }).success).toBe(false);
  });

  it('renders an actual APK link and omits platforms switched off by the admin', () => {
    render(<AppDownloadCards config={{ ...DEFAULT_APP_DOWNLOADS, android: { ...DEFAULT_APP_DOWNLOADS.android, status: 'available', apk_url: 'https://downloads.example.com/app.apk', version: '1.2.0' }, ios: { ...DEFAULT_APP_DOWNLOADS.ios, enabled: false } }} />);
    expect(screen.getByRole('link', { name: 'Download Android APK' })).toHaveAttribute('href', 'https://downloads.example.com/app.apk');
    expect(screen.getByText('Version 1.2.0')).toBeInTheDocument();
    expect(screen.queryByText('iPhone & iPad')).not.toBeInTheDocument();
  });

  it('labels TestFlight beta releases correctly', () => {
    render(<AppDownloadCards config={{ ...DEFAULT_APP_DOWNLOADS, ios: { ...DEFAULT_APP_DOWNLOADS.ios, status: 'available', store_url: 'https://testflight.apple.com/join/abc' } }} />);
    expect(screen.getByRole('link', { name: 'Join the iOS beta' })).toHaveAttribute('href', 'https://testflight.apple.com/join/abc');
  });

  it('preserves older mobile configuration and supplies desktop defaults', () => {
    const { windows: _windows, macos: _macos, ...legacy } = DEFAULT_APP_DOWNLOADS;
    const result = appDownloadsSchema.parse(legacy);
    expect(result.android).toEqual(legacy.android);
    expect(result.ios).toEqual(legacy.ios);
    expect(result.windows.status).toBe('coming_soon');
    expect(result.macos.installer_url).toBe('');
  });

  it('publishes desktop installers independently and validates their links', () => {
    for (const platform of ['windows', 'macos'] as const) {
      expect(appDownloadsSchema.safeParse({ ...DEFAULT_APP_DOWNLOADS, [platform]: { ...DEFAULT_APP_DOWNLOADS[platform], status: 'available' } }).success).toBe(false);
      expect(appDownloadsSchema.safeParse({ ...DEFAULT_APP_DOWNLOADS, [platform]: { ...DEFAULT_APP_DOWNLOADS[platform], installer_url: 'javascript:alert(1)' } }).success).toBe(false);
    }
    render(<AppDownloadCards config={{
      ...DEFAULT_APP_DOWNLOADS,
      windows: { ...DEFAULT_APP_DOWNLOADS.windows, status: 'available', installer_url: 'https://downloads.example.com/app.msi', file_size_bytes: 5 * 1024 * 1024 },
      macos: { ...DEFAULT_APP_DOWNLOADS.macos, status: 'available', installer_url: 'https://downloads.example.com/app.dmg' },
    }} />);
    expect(screen.getByRole('link', { name: 'Download for Windows' })).toHaveAttribute('href', 'https://downloads.example.com/app.msi');
    expect(screen.getByRole('link', { name: 'Download for macOS' })).toHaveAttribute('href', 'https://downloads.example.com/app.dmg');
    expect(screen.getByText('5.0 MB')).toBeInTheDocument();
  });

  it('uses the correct desktop store labels', () => {
    render(<AppDownloadCards config={{
      ...DEFAULT_APP_DOWNLOADS,
      windows: { ...DEFAULT_APP_DOWNLOADS.windows, status: 'available', store_url: 'https://apps.microsoft.com/detail/example' },
      macos: { ...DEFAULT_APP_DOWNLOADS.macos, status: 'available', store_url: 'https://apps.apple.com/app/example' },
    }} />);
    expect(screen.getByRole('link', { name: 'Get it from Microsoft Store' })).toHaveAttribute('href', 'https://apps.microsoft.com/detail/example');
    expect(screen.getByRole('link', { name: 'Download on the Mac App Store' })).toHaveAttribute('href', 'https://apps.apple.com/app/example');
  });
});
