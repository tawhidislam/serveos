import { Link } from 'react-router-dom';
import { ArrowRight, Check, ChefHat, ClipboardList, Globe, LayoutDashboard, Loader2, RefreshCw, Smartphone, Users } from 'lucide-react';
import MarketingLayout from '@/components/marketing/MarketingLayout';
import AppDownloadCards from '@/components/marketing/AppDownloadCards';
import { Button } from '@/components/ui/button';
import { useAppDownloads } from '@/hooks/useAppDownloads';
import { DEFAULT_APP_DOWNLOADS } from '@/lib/app-downloads';

const features = [
  { icon: LayoutDashboard, title: 'A clear view of service', text: 'Check orders, manage your menu, and keep your restaurant organized.' },
  { icon: ChefHat, title: 'A kitchen that stays in sync', text: 'Read preparation notes and move tickets from preparing to ready.' },
  { icon: ClipboardList, title: 'A smoother floor', text: 'Take table orders, handle service calls, and keep guests moving.' },
  { icon: Users, title: 'The right tools for every role', text: 'Your restaurant account brings the access and branches assigned to you.' },
];

export default function MarketingDownload() {
  const { data, isPending, isError, refetch } = useAppDownloads();
  const config = data?.config ?? DEFAULT_APP_DOWNLOADS;
  return (
    <MarketingLayout title={`Download ${config.app_name}`} description={config.description.slice(0, 155)} canonical="/download">
      <section className="relative overflow-hidden border-b">
        <div className="pointer-events-none absolute -right-32 -top-28 h-[35rem] w-[35rem] rounded-full bg-primary/5 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground"><Smartphone className="h-3.5 w-3.5 text-primary" />ServeOS for your team</span>
            <h1 className="mt-6 max-w-2xl text-4xl font-semibold leading-[1.12] tracking-tight sm:text-5xl lg:text-6xl">{config.title}</h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">{config.description}</p>
            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-3 text-sm">{['Owners & admins', 'Kitchen teams', 'Waiters & servers'].map(label => <span key={label} className="inline-flex items-center gap-1.5"><Check className="h-4 w-4 text-primary" />{label}</span>)}</div>
            <p className="mt-6 text-xs font-medium tracking-wide text-muted-foreground">Android · iOS · Windows · macOS</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild size="lg" className="gap-2 rounded-full"><a href="#downloads">Choose your device<ArrowRight className="h-4 w-4" /></a></Button>
              <Button asChild variant="outline" size="lg" className="gap-2 rounded-full"><Link to="/login"><Globe className="h-4 w-4" />Open web dashboard</Link></Button>
            </div>
          </div>
          <div className="mx-auto w-full max-w-[300px] lg:rotate-3">
            <div className="rounded-[2.8rem] border-[7px] border-foreground bg-card p-3 shadow-2xl shadow-primary/10">
              <div className="mx-auto mb-6 h-5 w-24 rounded-full bg-foreground" />
              <div className="px-2 pb-5">
                <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-muted-foreground">Your team workspace</p>
                <p className="mt-2 text-xl font-semibold">{config.app_name}</p>
                <div className="mt-5 rounded-xl bg-primary p-4 text-primary-foreground"><ChefHat className="mb-3 h-6 w-6" /><p className="font-medium">Good service starts here.</p><p className="mt-1 text-xs opacity-80">One place for every member of your team.</p></div>
                <div className="mt-4 space-y-2.5">{[{ label: 'Orders & tables', icon: ClipboardList }, { label: 'Kitchen tickets', icon: ChefHat }, { label: 'Your restaurant team', icon: Users }].map(({ label, icon: Icon }) => <div key={label} className="flex items-center gap-3 rounded-xl border p-3"><Icon className="h-4 w-4 text-primary" /><span className="text-xs font-medium">{label}</span><ArrowRight className="ml-auto h-3 w-3 text-muted-foreground" /></div>)}</div>
                <p className="mt-5 text-center text-[10px] text-muted-foreground">Interface preview</p>
              </div>
              <div className="mx-auto mb-1 h-1 w-20 rounded-full bg-foreground/20" />
            </div>
          </div>
        </div>
      </section>

      <section id="downloads" className="mx-auto max-w-5xl scroll-mt-24 px-5 py-16 sm:px-8 sm:py-20">
        <div className="mb-8 text-center"><p className="text-xs font-semibold uppercase tracking-widest text-primary">For your phone, tablet & desktop</p><h2 className="mt-3 text-3xl font-semibold tracking-tight">Choose your device</h2><p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">{config.support_note}</p></div>
        {isPending ? <div role="status" className="flex items-center justify-center gap-2 rounded-2xl border p-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Loading downloads…</div> : isError ? <div role="alert" className="rounded-2xl border p-8 text-center"><p>Download links are temporarily unavailable.</p><Button variant="outline" className="mt-4 gap-2" onClick={() => refetch()}><RefreshCw className="h-4 w-4" />Try again</Button></div> : <AppDownloadCards config={config} />}
      </section>

      <section className="border-y bg-secondary/30"><div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 sm:grid-cols-2 sm:px-8 lg:grid-cols-4">{features.map(({ icon: Icon, title, text }) => <div key={title}><Icon className="mb-4 h-5 w-5 text-primary" /><h2 className="text-sm font-semibold">{title}</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p></div>)}</div></section>

      <section className="mx-auto max-w-5xl px-5 py-16 sm:px-8 sm:py-20">
        <div className="grid gap-8 md:grid-cols-[1fr_1.3fr] md:gap-16"><div><h2 className="text-3xl font-semibold tracking-tight">Same restaurant.<br />Same account.</h2><p className="mt-4 text-sm leading-relaxed text-muted-foreground">Your team does not need to start over. Sign in with the account your restaurant already uses.</p><Button asChild variant="link" className="mt-3 gap-2 px-0"><Link to="/contact">Need a hand?<ArrowRight className="h-4 w-4" /></Link></Button></div><div className="space-y-5">{[
          ['01', 'Choose a published release', 'Choose your device above and use its store link or direct installer. Coming-soon releases will become available here when published.'],
          ['02', 'Sign in to your restaurant', 'Use your restaurant email and password. Owners can add staff accounts from their dashboard.'],
          ['03', 'Get straight to work', 'Select your restaurant and branch. Your role and current subscription determine the tools you can use.'],
        ].map(([number, title, description]) => <div key={number} className="flex gap-4"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-xs font-medium text-primary">{number}</span><div><h3 className="text-sm font-semibold">{title}</h3><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p></div></div>)}</div></div>
      </section>
    </MarketingLayout>
  );
}
