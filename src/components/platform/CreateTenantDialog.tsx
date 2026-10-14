import { edgeFunctionError } from '@/lib/edge-function-error';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

interface Props {
  trigger?: React.ReactNode;
}

/**
 * Platform-admin form to create a new restaurant tenant in one shot:
 * creates the auth user, the restaurant, and the owner link.
 */
export default function CreateTenantDialog({ trigger }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [ownerDisplayName, setOwnerDisplayName] = useState('');

  const reset = () => {
    setName('');
    setSlug('');
    setSlugTouched(false);
    setOwnerEmail('');
    setOwnerPassword('');
    setOwnerDisplayName('');
  };

  const handleNameChange = (v: string) => {
    setName(v);
    if (!slugTouched) setSlug(slugify(v));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim() || !ownerEmail.trim() || ownerPassword.length < 8) {
      toast.error('Fill all fields (password ≥ 8 chars)');
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke<{ error?: string; ownerCreated?: boolean }>('platform-create-tenant', {
        body: {
          restaurantName: name.trim(),
          slug: slug.trim(),
          ownerEmail: ownerEmail.trim(),
          ownerPassword,
          ownerDisplayName: ownerDisplayName.trim() || undefined,
        },
      });
      if (error) throw await edgeFunctionError(error);
      if (data?.error) throw new Error(data.error);

      toast.success(`Tenant "${name}" created`, {
        description: data?.ownerCreated
          ? `Owner login: ${ownerEmail}`
          : `Linked existing user ${ownerEmail} as owner`,
      });
      qc.invalidateQueries({ queryKey: ['platform-tenants'] });
      qc.invalidateQueries({ queryKey: ['platform-overview'] });
      reset();
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create tenant');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="h-4 w-4 mr-1.5" /> New tenant
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add restaurant</DialogTitle>
          <DialogDescription>
            Create the restaurant and its owner login in one step.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="t-name">Restaurant name</Label>
            <Input
              id="t-name"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Bella Cucina"
              maxLength={80}
              required
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="t-slug">URL slug</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">/r/</span>
              <Input
                id="t-slug"
                value={slug}
                onChange={(e) => { setSlug(slugify(e.target.value)); setSlugTouched(true); }}
                placeholder="bella-cucina"
                maxLength={60}
                required
              />
            </div>
          </div>

          <div className="border-t border-border pt-4 space-y-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Owner account
            </p>

            <div className="space-y-1.5">
              <Label htmlFor="t-owner-name">Display name (optional)</Label>
              <Input
                id="t-owner-name"
                value={ownerDisplayName}
                onChange={(e) => setOwnerDisplayName(e.target.value)}
                placeholder="Maria Rossi"
                maxLength={80}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="t-email">Owner email</Label>
              <Input
                id="t-email"
                type="email"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                placeholder="owner@bellacucina.com"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="t-password">Temporary password</Label>
              <Input
                id="t-password"
                type="text"
                value={ownerPassword}
                onChange={(e) => setOwnerPassword(e.target.value)}
                placeholder="Min 8 characters"
                minLength={8}
                required
              />
              <p className="text-xs text-muted-foreground">
                Owner can change this after first login.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create restaurant'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
