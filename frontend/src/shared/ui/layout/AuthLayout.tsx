import React from 'react';

interface AuthLayoutProps {
  children: React.ReactNode;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  return (
    <div className="flex h-screen w-screen" style={{background:'var(--paper)'}}>
      <div className="hidden md:flex w-1/2 items-center justify-center flex-col gap-4" style={{background:'var(--paper-2)'}}>
        <div className="text-5xl italic text-[var(--signal-ink)]" style={{fontFamily:'var(--serif)'}}>ostone</div>
        <p className="text-sm text-[var(--ink-3)] max-w-[280px] text-center">
          상담 로그 기반 CS 워크플로우 생성 시스템
        </p>
        <div className="mt-8 text-xs text-[var(--ink-3)]">운영자 전용</div>
      </div>
      <div className="w-full md:w-1/2 flex items-center justify-center p-8">
        {children}
      </div>
    </div>
  );
};
