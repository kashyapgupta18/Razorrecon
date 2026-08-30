import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RazorRecon AI — Enterprise Reconciliation Platform",
  description: "AI-powered financial reconciliation platform for Razorpay merchants with real-time streaming, 7-layer matching engine, and autonomous exception resolution",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const theme = localStorage.getItem('theme') || 'cyberpunk';
                document.documentElement.setAttribute('data-theme', theme);
              } catch (e) {}
            `,
          }}
        />
        {children}
      </body>
    </html>
  );
}
