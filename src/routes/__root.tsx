import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Component, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { PageError } from "@/components/page-feedback";
import appCss from "../styles.css?url";

class GlobalErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
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
  return (
    <GlobalErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <Outlet />
        <Toaster richColors position="top-center" />
      </QueryClientProvider>
    </GlobalErrorBoundary>
  );
}
