import { describe, expect, it } from 'vite-plus/test';
import { parseSummaryJson } from './parseSummaryJson';

describe('parseSummaryJson', () => {
  it('정상 JSON 객체를 파싱하면 ok:true와 data를 반환한다', () => {
    const result = parseSummaryJson('{"intent": "greeting"}');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual({ intent: 'greeting' });
  });

  it('빈 객체는 ok:true를 반환한다', () => {
    const result = parseSummaryJson('{}');
    expect(result.ok).toBe(true);
  });

  it('JSON 배열은 ok:false와 raw 원문을 반환한다', () => {
    const result = parseSummaryJson('[1,2]');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.raw).toBe('[1,2]');
  });

  it('null JSON은 ok:false를 반환한다', () => {
    const result = parseSummaryJson('null');
    expect(result.ok).toBe(false);
  });

  it('손상된 JSON은 ok:false와 raw 원문을 반환한다', () => {
    const bad = '{bad}';
    const result = parseSummaryJson(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.raw).toBe(bad);
  });

  it('빈 문자열은 ok:false를 반환한다', () => {
    expect(parseSummaryJson('').ok).toBe(false);
  });
});
