'use client';
import React from 'react';

interface SafeBoundaryProps {
  title?: string;
  children?: React.ReactNode;
}

interface SafeBoundaryState {
  error: Error | null;
}

/**
 * 하위 컴포넌트에서 런타임 에러가 발생해도 앱 전체가
 * "Application error: a client-side exception has occurred"로 멈추지 않도록 격리하는 에러 경계
 */
export default class SafeBoundary extends React.Component<SafeBoundaryProps, SafeBoundaryState> {
  state: SafeBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): SafeBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[SafeBoundary:${this.props.title || 'section'}]`, error, info?.componentStack);
  }

  handleReset = () => {
    try {
      // 손상된 로컬 캐시(KDK 코트 설정 등)로 인한 반복 오류 방지
      localStorage.removeItem('sun_tennis_kdk_courts_v3');
    } catch {}
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <div className="my-3 p-4 rounded-2xl border border-red-500/40 bg-red-950/40 text-red-200 text-xs">
          <div className="font-black text-sm mb-1">
            ⚠️ {this.props.title || '이 영역'}을(를) 불러오는 중 오류가 발생했습니다.
          </div>
          <div className="opacity-80 break-all mb-3">{String(this.state.error?.message || '')}</div>
          <button
            type="button"
            onClick={this.handleReset}
            className="px-3 py-1.5 rounded-lg bg-red-800 hover:bg-red-700 text-white font-black cursor-pointer"
          >
            🔄 다시 시도
          </button>
        </div>
      );
    }
    return this.props.children ?? null;
  }
}
