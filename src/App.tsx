import { Suspense } from "react";
import { lazyWithRetry as lazy } from "@/lib/lazyWithRetry";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ImpersonationProvider } from "@/hooks/useImpersonation";
import { PlatformCurrencyProvider } from "@/hooks/usePlatformCurrency";
import ImpersonationBanner from "@/components/ImpersonationBanner";
import ErrorBoundary from "@/components/ErrorBoundary";
import AuthErrorBoundary from "@/components/AuthErrorBoundary";
import AnimatedRoutes from "@/components/website/AnimatedRoutes";
import ProtectedRoute from "@/components/ProtectedRoute";
import BrandingInjector from "@/components/BrandingInjector";
import CustomDomainGate from "@/components/CustomDomainGate";
import FeatureGate from "./components/FeatureGate";
import PlatformRoute from "./components/PlatformRoute";

// Eager: only the marketing landing — by far the most likely first paint on
// the platform host. The tenant `HomePage` is lazy so marketing visitors don't
// download the website templates, theme machinery, or homepage-content hooks
// that they will never use.
import MarketingHome from "./pages/marketing/MarketingHome";
const HomePage = lazy(() => import("./pages/HomePage"));

// Everything else is code-split — keeps the initial bundle small so the
// landing page paints fast.
const AboutPage = lazy(() => import("./pages/AboutPage"));
const GalleryPage = lazy(() => import("./pages/GalleryPage"));
const ContactPage = lazy(() => import("./pages/ContactPage"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const StaffLoginPage = lazy(() => import("./pages/StaffLoginPage"));
const SignupPage = lazy(() => import("./pages/SignupPage"));
const RestaurantSignupPage = lazy(() => import("./pages/RestaurantSignupPage"));
const MarketingFeatures = lazy(() => import("./pages/marketing/MarketingFeatures"));
const MarketingPricing = lazy(() => import("./pages/marketing/MarketingPricing"));
const MarketingDemo = lazy(() => import("./pages/marketing/MarketingDemo"));
const MarketingAbout = lazy(() => import("./pages/marketing/MarketingAbout"));
const MarketingContact = lazy(() => import("./pages/marketing/MarketingContact"));
const MarketingLogin = lazy(() => import("./pages/marketing/MarketingLogin"));
const MarketingSignup = lazy(() => import("./pages/marketing/MarketingSignup"));
const MarketingTerms = lazy(() => import("./pages/marketing/MarketingTerms"));
const MarketingRefund = lazy(() => import("./pages/marketing/MarketingRefund"));
const MarketingPrivacy = lazy(() => import("./pages/marketing/MarketingPrivacy"));
const OwnerDashboard = lazy(() => import("./pages/owner/OwnerDashboard"));
const OwnerAnalytics = lazy(() => import("./pages/owner/OwnerAnalytics"));
const OwnerStaff = lazy(() => import("./pages/owner/OwnerStaff"));
const OwnerBranding = lazy(() => import("./pages/owner/OwnerBranding"));
const OwnerTheme = lazy(() => import("./pages/owner/OwnerTheme"));
const OwnerDomain = lazy(() => import("./pages/owner/OwnerDomain"));
const OwnerOnboarding = lazy(() => import("./pages/owner/OwnerOnboarding"));
const MarketingDownload = lazy(() => import("./pages/marketing/MarketingDownload"));
const PlatformAppDownloads = lazy(() => import("./pages/platform/PlatformAppDownloads"));
const PlatformOverview = lazy(() => import("./pages/platform/PlatformOverview"));
const PlatformLogin = lazy(() => import("./pages/platform/PlatformLogin"));
const PlatformTenants = lazy(() => import("./pages/platform/PlatformTenants"));
const PlatformBilling = lazy(() => import("./pages/platform/PlatformBilling"));
const PlatformAudit = lazy(() => import("./pages/platform/PlatformAudit"));
const PlatformUsers = lazy(() => import("./pages/platform/PlatformUsers"));
const PlatformOrders = lazy(() => import("./pages/platform/PlatformOrders"));
const PlatformDemoEditor = lazy(() => import("./pages/platform/PlatformDemoEditor"));
const PlatformMarketingHome = lazy(() => import("./pages/platform/PlatformMarketingHome"));
const PlatformFooterEditor = lazy(() => import("./pages/platform/PlatformFooterEditor"));
const PlatformContactEditor = lazy(() => import("./pages/platform/PlatformContactEditor"));
const PlatformAboutEditor = lazy(() => import("./pages/platform/PlatformAboutEditor"));
const PlatformPackages = lazy(() => import("./pages/platform/PlatformPackages"));
const PlatformAddons = lazy(() => import("./pages/platform/PlatformAddons"));
const PlatformThemes = lazy(() => import("./pages/platform/PlatformThemes"));
const PlatformSettings = lazy(() => import("./pages/platform/PlatformSettings"));
const PlatformDomains = lazy(() => import("./pages/platform/PlatformDomains"));
const PlatformSubdomains = lazy(() => import("./pages/platform/PlatformSubdomains"));
const PlatformSupport = lazy(() => import("./pages/platform/PlatformSupport"));
const SupportPage = lazy(() => import("./pages/admin/SupportPage"));
const PublicMenuRedirect = lazy(() => import("./pages/PublicMenuRedirect"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const MenuPage = lazy(() => import("./pages/MenuPage"));
const KitchenPage = lazy(() => import("./pages/KitchenPage"));
const OrderStatusPage = lazy(() => import("./pages/OrderStatusPage"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const MenuManagement = lazy(() => import("./pages/MenuManagement"));
const TableManagement = lazy(() => import("./pages/TableManagement"));
const AdminOrders = lazy(() => import("./pages/AdminOrders"));
const BillingPage = lazy(() => import("./pages/BillingPage"));
const SubscriptionBillingPage = lazy(() => import("./pages/SubscriptionBillingPage"));
const SubscriptionExpiredPage = lazy(() => import("./pages/SubscriptionExpiredPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const SitemapGeneratorPage = lazy(() => import("./pages/SitemapGeneratorPage"));
const PageSlugRouter = lazy(() => import("./components/PageSlugRouter"));
const BranchManagement = lazy(() => import("./pages/BranchManagement"));
const StaffManagement = lazy(() => import("./pages/StaffManagement"));
const OrderHistory = lazy(() => import("./pages/OrderHistory"));
const CustomerDashboard = lazy(() => import("./pages/CustomerDashboard"));
const WaiterDashboard = lazy(() => import("./pages/WaiterDashboard"));
const WaiterHistory = lazy(() => import("./pages/WaiterHistory"));
const POSPage = lazy(() => import("./pages/POSPage"));
const HomepageEditor = lazy(() => import("./pages/HomepageEditor"));
const PromotionsManagement = lazy(() => import("./pages/PromotionsManagement"));
const CustomizationTagsManagement = lazy(() => import("./pages/CustomizationTagsManagement"));
const LoyaltyManagement = lazy(() => import("./pages/LoyaltyManagement"));
const ReservationsManagement = lazy(() => import("./pages/ReservationsManagement"));
const TableOrderPage = lazy(() => import("./pages/TableOrderPage"));
const ShortLinkPage = lazy(() => import("./pages/ShortLinkPage"));
const DineInPage = lazy(() => import("./pages/DineInPage"));
const MenuItemDetailPage = lazy(() => import("./pages/MenuItemDetailPage"));
const AdminMenuItemDetail = lazy(() => import("./pages/AdminMenuItemDetail"));
const AccountingOverviewPage = lazy(() => import("./pages/accounting/AccountingOverviewPage"));
const SalesRevenuePage = lazy(() => import("./pages/accounting/SalesRevenuePage"));
const ExpenseManagementPage = lazy(() => import("./pages/accounting/ExpenseManagementPage"));
const ProfitLossPage = lazy(() => import("./pages/accounting/ProfitLossPage"));
const InventoryManagementPage = lazy(() => import("./pages/accounting/InventoryManagementPage"));
const InventoryAdjustmentsPage = lazy(() => import("./pages/accounting/InventoryAdjustmentsPage"));
const PayrollManagementPage = lazy(() => import("./pages/accounting/PayrollManagementPage"));
const FinancialForecastingPage = lazy(() => import("./pages/accounting/FinancialForecastingPage"));
const TaxReportingPage = lazy(() => import("./pages/accounting/TaxReportingPage"));
const AuditTrailPage = lazy(() => import("./pages/accounting/AuditTrailPage"));
const MonthlyReportPage = lazy(() => import("./pages/accounting/MonthlyReportPage"));
const FloorPlanPage = lazy(() => import("./pages/FloorPlanPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Tuned defaults:
//   • staleTime keeps cached data fresh for 1 min so route changes don't refetch.
//   • gcTime keeps data in memory for 10 min after unmount.
//   • refetchOnWindowFocus disabled to avoid spurious requests while users tab back & forth.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Lightweight fallback shown while a route chunk is being fetched. Keeping it
// minimal avoids competing with the destination page's own paint.
const RouteFallback = () => (
  <div className="min-h-[40vh] flex items-center justify-center">
    <div className="h-6 w-6 rounded-full border-2 border-foreground/40 border-t-transparent animate-spin" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" forcedTheme="light" enableSystem={false}>
    <AuthProvider>
      <ImpersonationProvider>
      <TooltipProvider>
        <PlatformCurrencyProvider>
        <ErrorBoundary>
        <Toaster />
        <Sonner />
        <BrandingInjector />
        <BrowserRouter>
          <ImpersonationBanner />
          <AnimatedRoutes>
            <Suspense fallback={<RouteFallback />}>
            <Routes>
              {/* Root: marketing site OR tenant homepage when accessed via custom domain */}
              <Route path="/" element={<CustomDomainGate tenant={<HomePage />} platform={<MarketingHome />} />} />
              <Route path="/features" element={<MarketingFeatures />} />
              <Route path="/pricing" element={<MarketingPricing />} />
              <Route path="/demo" element={<MarketingDemo />} />
              <Route path="/download" element={<MarketingDownload />} />
              <Route path="/apps" element={<Navigate to="/download" replace />} />
              <Route path="/about" element={<CustomDomainGate tenant={<AboutPage />} platform={<MarketingAbout />} />} />
              <Route path="/contact" element={<CustomDomainGate tenant={<ContactPage />} platform={<MarketingContact />} />} />
              <Route path="/gallery" element={<CustomDomainGate tenant={<GalleryPage />} platform={<MarketingHome />} />} />
              <Route path="/terms" element={<MarketingTerms />} />
              <Route path="/refund-policy" element={<MarketingRefund />} />
              <Route path="/refunds" element={<Navigate to="/refund-policy" replace />} />
              <Route path="/privacy" element={<MarketingPrivacy />} />
              <Route path="/privacy-policy" element={<Navigate to="/privacy" replace />} />
              <Route path="/login" element={<CustomDomainGate tenant={<AuthErrorBoundary><AuthPage /></AuthErrorBoundary>} platform={<MarketingLogin />} />} />
              <Route path="/signup" element={<CustomDomainGate tenant={<AuthErrorBoundary><AuthPage /></AuthErrorBoundary>} platform={<MarketingSignup />} />} />

              {/* Legacy tenant website routes (kept reachable for QR codes & staff) */}
              <Route path="/r/:slug" element={<HomePage />} />
              <Route path="/r/:slug/about" element={<AboutPage />} />
              <Route path="/r/:slug/gallery" element={<GalleryPage />} />
              <Route path="/r/:slug/contact" element={<ContactPage />} />
              <Route path="/tenant-about" element={<AboutPage />} />
              <Route path="/tenant-gallery" element={<GalleryPage />} />
              <Route path="/tenant-contact" element={<ContactPage />} />
              <Route
                path="/auth"
                element={
                  <AuthErrorBoundary>
                    <AuthPage />
                  </AuthErrorBoundary>
                }
              />
              <Route path="/staff-login" element={<StaffLoginPage />} />
              <Route path="/signup-restaurant" element={<RestaurantSignupPage />} />
              <Route path="/signup-legacy" element={<SignupPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/menu" element={<MenuPage />} />
              <Route path="/menu/:itemId" element={<MenuItemDetailPage />} />
              <Route path="/table/:tableId" element={<TableOrderPage />} />
              <Route path="/t/:code" element={<ShortLinkPage />} />
              <Route path="/dine-in" element={<DineInPage />} />
              <Route path="/r/:slug/dine-in" element={<DineInPage />} />

              {/* Public slug-based routes (multi-tenant) */}
              <Route path="/r/:slug/menu" element={<PublicMenuRedirect />} />
              <Route path="/r/:slug/menu/:itemId" element={<MenuItemDetailPage />} />
              <Route
                path="/r/:slug/login"
                element={
                  <AuthErrorBoundary>
                    <AuthPage />
                  </AuthErrorBoundary>
                }
              />
              <Route
                path="/r/:slug/signup"
                element={
                  <AuthErrorBoundary>
                    <AuthPage />
                  </AuthErrorBoundary>
                }
              />
              <Route path="/r/:slug/staff-login" element={<StaffLoginPage />} />
              <Route path="/r/:slug/admin-login" element={<StaffLoginPage />} />

              {/* Owner dashboard */}
              <Route path="/owner" element={
                <ProtectedRoute allowedRoles={['owner']}>
                  <OwnerDashboard />
                </ProtectedRoute>
              } />
              <Route path="/owner/analytics" element={
                <ProtectedRoute allowedRoles={['owner']}>
                  <OwnerAnalytics />
                </ProtectedRoute>
              } />
              <Route path="/owner/staff" element={
                <ProtectedRoute allowedRoles={['owner']}>
                  <OwnerStaff />
                </ProtectedRoute>
              } />
              <Route path="/owner/branding" element={
                <ProtectedRoute allowedRoles={['owner']}>
                  <OwnerBranding />
                </ProtectedRoute>
              } />
              <Route path="/owner/theme" element={
                <ProtectedRoute allowedRoles={['owner']}>
                  <OwnerTheme />
                </ProtectedRoute>
              } />
              <Route path="/owner/domain" element={
                <ProtectedRoute allowedRoles={['owner']}>
                  <OwnerDomain />
                </ProtectedRoute>
              } />
              <Route path="/owner/onboarding" element={
                <ProtectedRoute allowedRoles={['owner']}>
                  <OwnerOnboarding />
                </ProtectedRoute>
              } />

              {/* Platform super-admin */}
              <Route path="/platform/login" element={<PlatformLogin />} />
              <Route path="/platform" element={<PlatformRoute><PlatformOverview /></PlatformRoute>} />
              <Route path="/platform/tenants" element={<PlatformRoute><PlatformTenants /></PlatformRoute>} />
              <Route path="/platform/billing" element={<PlatformRoute><PlatformBilling /></PlatformRoute>} />
              <Route path="/platform/audit" element={<PlatformRoute><PlatformAudit /></PlatformRoute>} />
              <Route path="/platform/users" element={<PlatformRoute><PlatformUsers /></PlatformRoute>} />
              <Route path="/platform/orders" element={<PlatformRoute><PlatformOrders /></PlatformRoute>} />
              <Route path="/platform/apps" element={<PlatformRoute><PlatformAppDownloads /></PlatformRoute>} />
              <Route path="/platform/demo-editor" element={<PlatformRoute><PlatformDemoEditor /></PlatformRoute>} />
              <Route path="/platform/marketing-home" element={<PlatformRoute><PlatformMarketingHome /></PlatformRoute>} />
              <Route path="/platform/footer" element={<PlatformRoute><PlatformFooterEditor /></PlatformRoute>} />
              <Route path="/platform/contact" element={<PlatformRoute><PlatformContactEditor /></PlatformRoute>} />
              <Route path="/platform/about" element={<PlatformRoute><PlatformAboutEditor /></PlatformRoute>} />
              <Route path="/platform/packages" element={<PlatformRoute><PlatformPackages /></PlatformRoute>} />
              <Route path="/platform/addons" element={<PlatformRoute><PlatformAddons /></PlatformRoute>} />
              <Route path="/platform/themes" element={<PlatformRoute><PlatformThemes /></PlatformRoute>} />
              <Route path="/platform/settings" element={<PlatformRoute><PlatformSettings /></PlatformRoute>} />
              <Route path="/platform/domains" element={<PlatformRoute><PlatformDomains /></PlatformRoute>} />
              <Route path="/platform/subdomains" element={<PlatformRoute><PlatformSubdomains /></PlatformRoute>} />
              <Route path="/platform/support" element={<PlatformRoute><PlatformSupport /></PlatformRoute>} />

              {/* Common typo redirect */}
              <Route path="/platfrom" element={<Navigate to="/platform" replace />} />
              <Route path="/platfrom/*" element={<Navigate to="/platform" replace />} />

              {/* Profile — any authenticated user */}
              <Route path="/profile" element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              } />

              {/* Customer dashboard — restaurant-scoped */}
              <Route path="/account" element={
                <ProtectedRoute>
                  <CustomerDashboard />
                </ProtectedRoute>
              } />
              <Route path="/r/:slug/account" element={
                <ProtectedRoute>
                  <CustomerDashboard />
                </ProtectedRoute>
              } />

              {/* Customer order history */}
              <Route path="/orders" element={
                <ProtectedRoute>
                  <OrderHistory />
                </ProtectedRoute>
              } />

              {/* Order status — accessible to everyone (guest ordering) */}
              <Route path="/order/:orderId" element={<OrderStatusPage />} />

              {/* Kitchen — kitchen staff & admin */}
              <Route path="/kitchen" element={
                <ProtectedRoute allowedRoles={['owner', 'kitchen', 'admin', 'manager']}>
                  <FeatureGate feature="operations" featureName="Kitchen">
                    <KitchenPage />
                  </FeatureGate>
                </ProtectedRoute>
              } />

              {/* Waiter dashboard */}
              <Route path="/waiter" element={
                <ProtectedRoute allowedRoles={['owner', 'waiter', 'server', 'admin', 'manager']}>
                  <WaiterDashboard />
                </ProtectedRoute>
              } />
              <Route path="/waiter/history" element={
                <ProtectedRoute allowedRoles={['owner', 'waiter', 'server', 'admin', 'manager']}>
                  <WaiterHistory />
                </ProtectedRoute>
              } />

              {/* Admin routes */}
              <Route path="/admin" element={
                <ProtectedRoute allowedRoles={['owner', 'admin', 'manager']}>
                  <AdminDashboard />
                </ProtectedRoute>
              } />
              <Route path="/admin/menu" element={
                <ProtectedRoute allowedRoles={['owner', 'admin', 'manager']}>
                  <MenuManagement />
                </ProtectedRoute>
              } />
              <Route path="/admin/menu/:itemId" element={
                <ProtectedRoute allowedRoles={['owner', 'admin', 'manager']}>
                  <AdminMenuItemDetail />
                </ProtectedRoute>
              } />
              <Route path="/admin/tables" element={
                <ProtectedRoute allowedRoles={['owner', 'admin', 'manager']}>
                  <FeatureGate feature="operations" featureName="Tables">
                    <TableManagement />
                  </FeatureGate>
                </ProtectedRoute>
              } />
              <Route path="/admin/floor-plans" element={
                <ProtectedRoute allowedRoles={['owner', 'admin', 'manager']}>
                  <FeatureGate feature="floorPlans" featureName="Floor Plans">
                    <FloorPlanPage />
                  </FeatureGate>
                </ProtectedRoute>
              } />
              <Route path="/admin/support" element={
                <ProtectedRoute allowedRoles={['owner', 'admin', 'manager', 'kitchen', 'waiter', 'server']}>
                  <SupportPage />
                </ProtectedRoute>
              } />
              <Route path="/admin/orders" element={
                <ProtectedRoute allowedRoles={['owner', 'admin', 'manager']}>
                  <FeatureGate feature="operations" featureName="Orders">
                    <AdminOrders />
                  </FeatureGate>
                </ProtectedRoute>
              } />
              <Route path="/admin/billing" element={
                <ProtectedRoute allowedRoles={['owner', 'admin', 'manager']}>
                  <FeatureGate feature="operations" featureName="Billing">
                    <BillingPage />
                  </FeatureGate>
                </ProtectedRoute>
              } />
              <Route path="/admin/subscription" element={
                <ProtectedRoute allowedRoles={['owner', 'admin', 'manager']}>
                  <SubscriptionBillingPage />
                </ProtectedRoute>
              } />
              <Route path="/admin/subscription/expired" element={
                <ProtectedRoute allowedRoles={['owner', 'admin', 'manager']}>
                  <SubscriptionExpiredPage />
                </ProtectedRoute>
              } />
              <Route path="/admin/addons" element={<Navigate to="/admin/subscription" replace />} />
              <Route path="/admin/settings" element={
                <ProtectedRoute allowedRoles={['owner', 'admin', 'manager']}>
                  <SettingsPage />
                </ProtectedRoute>
              } />
              <Route path="/admin/sitemap" element={
                <ProtectedRoute allowedRoles={['owner']}>
                  <SitemapGeneratorPage />
                </ProtectedRoute>
              } />
              <Route path="/admin/branches" element={
                <ProtectedRoute allowedRoles={['owner', 'admin', 'manager']}>
                  <BranchManagement />
                </ProtectedRoute>
              } />
              <Route path="/admin/staff" element={
                <ProtectedRoute allowedRoles={['owner', 'admin', 'manager']}>
                  <StaffManagement />
                </ProtectedRoute>
              } />
              <Route path="/admin/pos" element={
                <ProtectedRoute allowedRoles={['owner', 'admin', 'manager', 'waiter']}>
                  <FeatureGate feature="operations" featureName="POS">
                    <POSPage />
                  </FeatureGate>
                </ProtectedRoute>
              } />
              <Route path="/admin/homepage" element={
                <ProtectedRoute allowedRoles={['owner', 'admin', 'manager']}>
                  <HomepageEditor />
                </ProtectedRoute>
              } />
              <Route path="/admin/promotions" element={
                <ProtectedRoute allowedRoles={['owner', 'admin', 'manager']}>
                  <FeatureGate feature="promotions" featureName="Promotions">
                    <PromotionsManagement />
                  </FeatureGate>
                </ProtectedRoute>
              } />
              <Route path="/admin/customizations" element={
                <ProtectedRoute allowedRoles={['owner', 'admin', 'manager']}>
                  <CustomizationTagsManagement />
                </ProtectedRoute>
              } />
              <Route path="/admin/loyalty" element={
                <ProtectedRoute allowedRoles={['owner', 'admin', 'manager']}>
                  <FeatureGate feature="loyalty" featureName="Loyalty">
                    <LoyaltyManagement />
                  </FeatureGate>
                </ProtectedRoute>
              } />
              <Route path="/admin/reservations" element={
                <ProtectedRoute allowedRoles={['owner', 'admin', 'manager']}>
                  <FeatureGate feature="operations" featureName="Reservations">
                    <ReservationsManagement />
                  </FeatureGate>
                </ProtectedRoute>
              } />
              <Route path="/admin/accounting" element={
                <ProtectedRoute allowedRoles={['owner', 'admin', 'manager']}>
                  <FeatureGate feature="accounting" featureName="Accounting">
                    <AccountingOverviewPage />
                  </FeatureGate>
                </ProtectedRoute>
              } />
              <Route path="/admin/accounting/sales" element={
                <ProtectedRoute allowedRoles={['owner', 'admin', 'manager']}>
                  <FeatureGate feature="accounting" featureName="Accounting">
                    <SalesRevenuePage />
                  </FeatureGate>
                </ProtectedRoute>
              } />
              <Route path="/admin/accounting/expenses" element={
                <ProtectedRoute allowedRoles={['owner', 'admin', 'manager']}>
                  <FeatureGate feature="accounting" featureName="Accounting">
                    <ExpenseManagementPage />
                  </FeatureGate>
                </ProtectedRoute>
              } />
              <Route path="/admin/accounting/inventory" element={
                <ProtectedRoute allowedRoles={['owner', 'admin', 'manager']}>
                  <FeatureGate feature="accounting" featureName="Accounting">
                    <InventoryManagementPage />
                  </FeatureGate>
                </ProtectedRoute>
              } />
              <Route path="/admin/accounting/inventory/adjustments" element={
                <ProtectedRoute allowedRoles={['owner', 'admin', 'manager']}>
                  <FeatureGate feature="accounting" featureName="Accounting">
                    <InventoryAdjustmentsPage />
                  </FeatureGate>
                </ProtectedRoute>
              } />
              <Route path="/admin/accounting/payroll" element={
                <ProtectedRoute allowedRoles={['owner', 'admin', 'manager']}>
                  <FeatureGate feature="accounting" featureName="Accounting">
                    <PayrollManagementPage />
                  </FeatureGate>
                </ProtectedRoute>
              } />
              <Route path="/admin/accounting/forecasting" element={
                <ProtectedRoute allowedRoles={['owner', 'admin', 'manager']}>
                  <FeatureGate feature="accounting" featureName="Accounting">
                    <FinancialForecastingPage />
                  </FeatureGate>
                </ProtectedRoute>
              } />
              <Route path="/admin/accounting/tax" element={
                <ProtectedRoute allowedRoles={['owner', 'admin', 'manager']}>
                  <FeatureGate feature="accounting" featureName="Accounting">
                    <TaxReportingPage />
                  </FeatureGate>
                </ProtectedRoute>
              } />
              <Route path="/admin/accounting/pnl" element={
                <ProtectedRoute allowedRoles={['owner', 'admin', 'manager']}>
                  <FeatureGate feature="accounting" featureName="Accounting">
                    <ProfitLossPage />
                  </FeatureGate>
                </ProtectedRoute>
              } />
              <Route path="/admin/accounting/audit" element={
                <ProtectedRoute allowedRoles={['owner', 'admin', 'manager']}>
                  <FeatureGate feature="accounting" featureName="Accounting">
                    <AuditTrailPage />
                  </FeatureGate>
                </ProtectedRoute>
              } />
              <Route path="/admin/accounting/report" element={
                <ProtectedRoute allowedRoles={['owner', 'admin', 'manager']}>
                  <FeatureGate feature="accounting" featureName="Accounting">
                    <MonthlyReportPage />
                  </FeatureGate>
                </ProtectedRoute>
              } />

              {/* Tenant custom static-page slug aliases — only resolves on a verified
                  custom domain so admins can publish e.g. /our-food → /menu. */}
              <Route path="/:pageSlug" element={<CustomDomainGate tenant={<PageSlugRouter />} platform={<NotFound />} />} />

              {/* Catch-all 404 */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
          </AnimatedRoutes>
        </BrowserRouter>
        </ErrorBoundary>
        </PlatformCurrencyProvider>
      </TooltipProvider>
      </ImpersonationProvider>
    </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
