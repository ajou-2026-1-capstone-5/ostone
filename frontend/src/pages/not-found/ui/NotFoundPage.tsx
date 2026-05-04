import React from 'react';
import { useNavigate } from 'react-router-dom';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center gap-4" style={{background:'var(--paper)'}}>
      <div className="text-[120px] leading-none italic text-[var(--ink-2)]" style={{fontFamily:'var(--serif)'}}>404</div>
      <div className="text-sm text-[var(--ink-3)]">요청하신 페이지를 찾을 수 없습니다</div>
      <button
        onClick={() => navigate('/workspaces')}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium cursor-pointer transition-opacity hover:opacity-90"
        style={{background:'var(--ink)', color:'var(--paper)'}}
      >
        ← 홈으로
      </button>
    </div>
  );
};
