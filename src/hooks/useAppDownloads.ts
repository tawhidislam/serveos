import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { APP_DOWNLOADS_KEY, appDownloadsSchema, type AppDownloadsConfig, type AppDownloadsRecord } from '@/lib/app-downloads';

export function useAppDownloads() {
  return useQuery<AppDownloadsRecord>({
    queryKey: APP_DOWNLOADS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('platform_app_downloads').select('content,updated_at').eq('id', true).single();
      if (error) throw error;
      return { config: appDownloadsSchema.parse(data.content), updated_at: data.updated_at };
    },
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
}

export function useSaveAppDownloads() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ config, updated_at }: AppDownloadsRecord): Promise<AppDownloadsRecord> => {
      const clean: AppDownloadsConfig = appDownloadsSchema.parse(config);
      const { data, error } = await supabase.from('platform_app_downloads')
        .update({ content: clean as unknown as Json }).eq('id', true).eq('updated_at', updated_at).select('content,updated_at').maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('These settings changed in another tab. Reload saved settings before saving again.');
      return { config: appDownloadsSchema.parse(data.content), updated_at: data.updated_at };
    },
    onSuccess: data => {
      qc.setQueryData(APP_DOWNLOADS_KEY, data);
      qc.invalidateQueries({ queryKey: APP_DOWNLOADS_KEY });
    },
  });
}
