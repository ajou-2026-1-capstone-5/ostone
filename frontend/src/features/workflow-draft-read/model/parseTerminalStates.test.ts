import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test';
import { parseTerminalStates } from './parseTerminalStates';

describe('parseTerminalStates', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('유효한 JSON 배열을 string[]로 반환한다', () => {
    // given
    const json = '["resolved", "escalated"]';
    // when
    const result = parseTerminalStates(json);
    // then
    expect(result).toEqual(['resolved', 'escalated']);
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('빈 배열 JSON을 빈 string[]로 반환한다', () => {
    // given
    const json = '[]';
    // when
    const result = parseTerminalStates(json);
    // then
    expect(result).toEqual([]);
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('배열이 아닌 유효한 JSON은 raw 문자열을 반환하고 console.warn을 호출한다', () => {
    // given
    const json = '{"key": "value"}';
    // when
    const result = parseTerminalStates(json);
    // then
    expect(result).toBe(json);
    expect(consoleSpy).toHaveBeenCalledOnce();
  });

  it('손상된 JSON은 raw 문자열을 반환하고 console.warn을 호출한다', () => {
    // given
    const json = 'invalid-json';
    // when
    const result = parseTerminalStates(json);
    // then
    expect(result).toBe(json);
    expect(consoleSpy).toHaveBeenCalledOnce();
  });
});
