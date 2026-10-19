// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { MAX_INSTALLER_BYTES, validateInstallerFile, type InstallerPlatform } from '@/lib/app-downloads';

describe('installer uploads', () => {
  it.each<{ platform: InstallerPlatform; extension: string; signature: number[]; size?: number }>([
    { platform: 'android', extension: 'apk', signature: [80, 75, 3, 4] },
    { platform: 'windows', extension: 'exe', signature: [77, 90] },
    { platform: 'windows', extension: 'msi', signature: [208, 207, 17, 224, 161, 177, 26, 225] },
    { platform: 'windows', extension: 'zip', signature: [80, 75, 3, 4] },
    { platform: 'macos', extension: 'pkg', signature: [120, 97, 114, 33] },
    { platform: 'macos', extension: 'zip', signature: [80, 75, 3, 4] },
    { platform: 'macos', extension: 'dmg', signature: [107, 111, 108, 121], size: 512 },
  ])('accepts a $platform .$extension container', async ({ platform, extension, signature, size = 8 }) => {
    const bytes = new Uint8Array(size);
    bytes.set(signature);
    const file = new File([bytes], `ServeOS.${extension.toUpperCase()}`);
    await expect(validateInstallerFile(file, platform)).resolves.toMatchObject({ extension });
  });

  it('rejects renamed files, mismatched platforms, empty files and oversized uploads', async () => {
    await expect(validateInstallerFile(new File(['not an installer'], 'app.exe'), 'windows')).rejects.toThrow('does not match');
    await expect(validateInstallerFile(new File(['MZ'], 'app.exe'), 'macos')).rejects.toThrow('Choose a macOS installer');
    await expect(validateInstallerFile(new File([], 'app.pkg'), 'macos')).rejects.toThrow('between 1 byte and 50 MB');
    const large = new File(['MZ'], 'app.exe');
    Object.defineProperty(large, 'size', { value: MAX_INSTALLER_BYTES + 1 });
    await expect(validateInstallerFile(large, 'windows')).rejects.toThrow('external HTTPS link');
    await expect(validateInstallerFile(new File(['koly'], 'app.dmg'), 'macos')).rejects.toThrow('does not match');
  });
});
