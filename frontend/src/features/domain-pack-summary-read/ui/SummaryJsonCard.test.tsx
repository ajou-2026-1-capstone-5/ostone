import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SummaryJsonCard } from './SummaryJsonCard';

describe('SummaryJsonCard', () => {
  it('유효한 JSON 객체를 카드 모드로 렌더링한다', () => {
    render(<SummaryJsonCard summaryJson='{"name":"test"}' />);
    expect(screen.getByText('name')).toBeInTheDocument();
    expect(screen.getByText('test')).toBeInTheDocument();
  });

  it('중첩 객체 값을 JSON.stringify로 렌더링한다', () => {
    render(<SummaryJsonCard summaryJson='{"nested":{"a":1}}' />);
    expect(screen.getByText('nested')).toBeInTheDocument();
    expect(screen.getByText('{"a":1}')).toBeInTheDocument();
  });

  it('null 값을 "null" 문자열로 렌더링한다', () => {
    render(<SummaryJsonCard summaryJson='{"k":null}' />);
    expect(screen.getByText('null')).toBeInTheDocument();
  });

  it('빈 객체 시 "내용 없음"을 표시한다', () => {
    render(<SummaryJsonCard summaryJson='{}' />);
    expect(screen.getByText('내용 없음')).toBeInTheDocument();
  });

  it('파싱 실패 시 경고 메시지를 alert role로 표시한다', () => {
    render(<SummaryJsonCard summaryJson='{bad json}' />);
    expect(screen.getByRole('alert')).toHaveTextContent('JSON 파싱 실패');
  });

  it('"Raw JSON" 버튼 클릭 시 원문 JSON을 표시한다', () => {
    const json = '{"key":"val"}';
    render(<SummaryJsonCard summaryJson={json} />);
    fireEvent.click(screen.getByRole('button', { name: 'Raw JSON' }));
    expect(screen.getByText(json)).toBeInTheDocument();
  });

  it('Raw 모드에서 "카드" 버튼 클릭 시 카드 모드로 전환한다', () => {
    render(<SummaryJsonCard summaryJson='{"k":"v"}' />);
    fireEvent.click(screen.getByRole('button', { name: 'Raw JSON' }));
    fireEvent.click(screen.getByRole('button', { name: '카드' }));
    expect(screen.getByText('k')).toBeInTheDocument();
  });

  it('초기 상태에서 "카드" 버튼이 aria-pressed=true, "Raw JSON" 버튼이 aria-pressed=false다', () => {
    render(<SummaryJsonCard summaryJson='{}' />);
    expect(screen.getByRole('button', { name: '카드' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Raw JSON' })).toHaveAttribute('aria-pressed', 'false');
  });
});
