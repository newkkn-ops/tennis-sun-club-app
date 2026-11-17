import React from 'react';
import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '☀️ 썬 테니스 클럽 (SUN TENNIS CLUB) | 공식 운영 시스템',
  description: '태양처럼 뜨거운 열정! 썬(SUN) 테니스 클럽 실시간 코트 현황판, KDK 파트너 로테이션 대진표, 토너먼트 및 마이페이지 전적 관리 시스템',
  manifest: '/manifest.json',
  icons: {
    icon: '/icon-192.png',
    shortcut: '/icon-192.png',
    apple: '/icon-192.png',
  },
  openGraph: {
    title: '☀️ 썬 테니스 클럽 (SUN TENNIS CLUB)',
    description: '🎾 실시간 코트 현황판 & 스코어보드 라이브 · KDK 파트너 순환 대진표 · 토너먼트 · 마이페이지 전적',
    url: 'https://tennis-sun-club-app.vercel.app',
    siteName: '썬 테니스 클럽 (SUN TENNIS CLUB)',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: '썬 테니스 클럽 공식 운영 시스템',
      },
    ],
    locale: 'ko_KR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '☀️ 썬 테니스 클럽 (SUN TENNIS CLUB)',
    description: '🎾 실시간 코트 현황판 · KDK 복식 대진표 자동 생성 · 내 차례 스마트폰 PWA 실시간 알림',
    images: ['/og-image.png'],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: '썬테니스클럽',
  },
};

export const viewport: Viewport = {
  themeColor: '#059669',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="dark">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/icon-192.png" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="theme-color" content="#059669" />
        <meta property="og:title" content="☀️ 썬 테니스 클럽 (SUN TENNIS CLUB)" />
        <meta property="og:description" content="🎾 실시간 코트 현황판 · KDK 복식 대진표 · 토너먼트 브래킷 · 마이페이지 랭킹" />
        <meta property="og:image" content="/og-image.png" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content="/og-image.png" />
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
        />
      </head>
      <body className="bg-slate-950 text-slate-100 antialiased min-h-screen selection:bg-amber-400 selection:text-slate-900">
        {children}
      </body>
    </html>
  );
}
