import { useState, useEffect } from 'react';
import { useImageUpload } from '@/hooks/useImageUpload';
import UploadProgress from '@/components/upload/UploadProgress';
import { compressImage, COMPRESS_PRESETS } from '@/lib/image-compress';
import { validateImageFile, ACCEPT_IMAGE_ATTR } from '@/lib/upload-limits';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  User, Camera, Save, Loader2, KeyRound, ArrowLeft, Star, Gift,
} from 'lucide-react';
import { useLoyaltySettings, useLoyaltyBalance, useLoyaltyTransactions } from '@/hooks/useLoyalty';
import { useCurrency } from '@/lib/currency';
import { format as fmtDate } from 'date-fns';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

export default function ProfilePage() {
  const { user, getDashboardPath } = useAuth();
  const { data: loyaltySettings } = useLoyaltySettings();
  const { data: loyaltyBalance = 0 } = useLoyaltyBalance(user?.id);
  const { data: loyaltyTxns = [] } = useLoyaltyTransactions(user?.id);
  const { format: fmtCurrency } = useCurrency();
  const qc = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  

  // Password change
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? '');
      setAvatarUrl(profile.avatar_url ?? '');
    }
  }, [profile]);

  const saveProfile = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: displayName.trim() || null,
          avatar_url: avatarUrl.trim() || null,
        })
        .eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile', user?.id] });
      toast.success('Profile updated');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const changePassword = useMutation({
    mutationFn: async () => {
      if (newPassword !== confirmPassword) throw new Error('Passwords do not match');
      if (newPassword.length < 6) throw new Error('Password must be at least 6 characters');
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Password changed successfully');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const {
    upload: uploadAvatar, retry: retryAvatar, cancel: cancelAvatar,
    uploading, progress: avatarProgress, error: avatarError, fileName: avatarFileName,
  } = useImageUpload({
    bucket: 'website-images',
    buildPath: (f) => `avatars/${user?.id}.${f.name.split('.').pop()}`,
    upsert: true,
    limit: 'logo',
    compress: COMPRESS_PRESETS.avatar,
    successMessage: 'Avatar uploaded',
    onUploaded: (url) => setAvatarUrl(url),
  });

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user) return;
    await uploadAvatar(file);
  };

  const hasProfileChanges = profile && (
    (displayName || '') !== (profile.display_name || '') ||
    (avatarUrl || '') !== (profile.avatar_url || '')
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 lg:p-8">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link
            to={getDashboardPath()}
            className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
          </Link>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-foreground">My Profile</h1>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
        </div>

        {/* Avatar & Display Name */}
        <section className="bg-card card-shadow ring-subtle rounded-lg p-5 space-y-5">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
            <h2 className="text-sm font-semibold text-card-foreground">Profile Info</h2>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative group">
              {avatarUrl ? (
                <div className="h-16 w-16 rounded-full overflow-hidden bg-secondary ring-subtle">
                  <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                </div>
              ) : (
                <div className="h-16 w-16 rounded-full bg-secondary flex items-center justify-center ring-subtle">
                  <User className="h-6 w-6 text-muted-foreground" strokeWidth={1} />
                </div>
              )}
              <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                <input
                  type="file"
                  accept={ACCEPT_IMAGE_ATTR}
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
                {uploading ? (
                  <Loader2 className="h-5 w-5 text-white animate-spin" />
                ) : (
                  <Camera className="h-5 w-5 text-white" strokeWidth={1.5} />
                )}
              </label>
            </div>
            <div className="flex-1 space-y-2">
              <Label htmlFor="displayName" className="text-sm text-muted-foreground">Display Name</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                maxLength={100}
              />
            </div>
          </div>

          <UploadProgress
            uploading={uploading}
            progress={avatarProgress}
            error={avatarError}
            fileName={avatarFileName}
            onRetry={retryAvatar}
            onCancel={cancelAvatar}
          />

          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={!hasProfileChanges || saveProfile.isPending}
              onClick={() => saveProfile.mutate()}
              className="gap-1.5"
            >
              {saveProfile.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" strokeWidth={1.5} />
              )}
              Save Profile
            </Button>
          </div>
        </section>

        {/* Loyalty Points */}
        {loyaltySettings?.is_enabled && (
          <section className="bg-card card-shadow ring-subtle rounded-lg p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-primary" fill="currentColor" strokeWidth={1.5} />
              <h2 className="text-sm font-semibold text-card-foreground">Loyalty Points</h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="bg-primary/10 rounded-xl px-5 py-3 text-center">
                <p className="text-2xl font-bold text-primary tabular-nums">{loyaltyBalance}</p>
                <p className="text-xs text-muted-foreground">Available Points</p>
              </div>
              {loyaltySettings.redemption_type === 'flexible' && loyaltyBalance > 0 && (
                <div className="text-sm text-muted-foreground">
                  <Gift className="h-3.5 w-3.5 inline mr-1" />
                  Worth {fmtCurrency(loyaltyBalance * loyaltySettings.point_value)}
                </div>
              )}
            </div>
            {loyaltyTxns.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recent Activity</p>
                <div className="space-y-1.5 max-h-40 overflow-auto">
                  {loyaltyTxns.slice(0, 10).map(txn => (
                    <div key={txn.id} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className={txn.points > 0 ? 'text-primary font-semibold' : 'text-destructive font-semibold'}>
                          {txn.points > 0 ? '+' : ''}{txn.points}
                        </span>
                        <span className="text-muted-foreground">{txn.description}</span>
                      </div>
                      <span className="text-muted-foreground tabular-nums">{fmtDate(new Date(txn.created_at), 'MMM d')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Change Password */}
        <section className="bg-card card-shadow ring-subtle rounded-lg p-5 space-y-5">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
            <h2 className="text-sm font-semibold text-card-foreground">Change Password</h2>
          </div>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="newPassword" className="text-sm text-muted-foreground">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm text-muted-foreground">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                minLength={6}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              size="sm"
              variant="outline"
              disabled={!newPassword || !confirmPassword || changePassword.isPending}
              onClick={() => changePassword.mutate()}
              className="gap-1.5"
            >
              {changePassword.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <KeyRound className="h-4 w-4" strokeWidth={1.5} />
              )}
              Update Password
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
