import React from 'react';

export const metadata = {
  title: '테니스 클럽 운영 앱',
  description: '테니스 월례회, KDK 대진표, 실시간 코트 스코어보드 및 전적 관리',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: '테니스클럽',
  },
};

export const viewport = {
  themeColor: '#16a34a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#16a34a" />
      </head>
      <body className="bg-slate-100 antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
