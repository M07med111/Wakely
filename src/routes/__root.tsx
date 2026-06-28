import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
  useRouterState,
} from "@tanstack/react-router";
import { Component, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { PageError } from "@/components/page-feedback";
import appCss from "../styles.css?url";

class GlobalErrorBoundary extends Component<
  { children: ReactNode; routeKey?: string },
  { hasError: boolean; routeKey?: string }
> {
  state = { hasError: false, routeKey: undefined as string | undefined };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  // Reset the error boundary when the route changes
  static getDerivedStateFromProps(
    props: { routeKey?: string },
    state: { hasError: boolean; routeKey?: string },
  ) {
    if (state.hasError && props.routeKey !== state.routeKey) {
      return { hasError: false, routeKey: props.routeKey };
    }
    if (props.routeKey !== state.routeKey) {
      return { routeKey: props.routeKey };
    }
    return null;
  }

  componentDidCatch(error: unknown) {
    console.error("[GlobalErrorBoundary]", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <PageError
          title="حدث خطأ غير متوقع"
          description="تم إيقاف تحميل هذه الصفحة لحماية التطبيق. جرّب التحديث للعودة للعمل."
        />
      );
    }
    return this.props.children;
  }
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="glass-card p-10 text-center max-w-md">
        <h1 className="text-7xl font-bold gold-text">٤٠٤</h1>
        <p className="mt-4 text-muted-foreground">الصفحة غير موجودة</p>
        <Link to="/" className="mt-6 inline-block btn-gold px-5 py-2 rounded-md font-semibold">
          العودة للرئيسية
        </Link>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#1a1611" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "المكتب القانوني" },
      { title: "منصة المكتب القانوني — إدارة القضايا" },
      {
        name: "description",
        content:
          "نظام إدارة القضايا والمكاتب القانونية — متابعة الموكلين، القضايا، الجلسات والمدفوعات.",
      },
      { property: "og:title", content: "منصة المكتب القانوني — إدارة القضايا" },
      { name: "twitter:title", content: "منصة المكتب القانوني — إدارة القضايا" },
      {
        property: "og:description",
        content:
          "نظام إدارة القضايا والمكاتب القانونية — متابعة الموكلين، القضايا، الجلسات والمدفوعات.",
      },
      {
        name: "twitter:description",
        content:
          "نظام إدارة القضايا والمكاتب القانونية — متابعة الموكلين، القضايا، الجلسات والمدفوعات.",
      },
      {
        property: "og:image",
        content:
          "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/83b1086e-0187-4312-87aa-bb143edbbc8a",
      },
      {
        name: "twitter:image",
        content:
          "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/83b1086e-0187-4312-87aa-bb143edbbc8a",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "icon",
        href: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%231a1611'/%3E%3Ctext x='50%25' y='58%25' text-anchor='middle' font-size='38' font-family='serif' font-weight='700' fill='%23c9a24a'%3E%D9%82%3C/text%3E%3C/svg%3E",
      },
      { rel: "manifest", href: `${import.meta.env.BASE_URL}manifest.webmanifest` },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&family=Playfair+Display:wght@600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <GlobalErrorBoundary routeKey={pathname}>
      <QueryClientProvider client={queryClient}>
        <Outlet />
        <Toaster richColors position="top-center" />
      </QueryClientProvider>
    </GlobalErrorBoundary>
  );
}
