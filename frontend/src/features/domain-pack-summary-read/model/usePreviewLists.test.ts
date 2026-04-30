import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useQuery } from '@tanstack/react-query';
import { intentApi, intentKeys } from '@/entities/intent';
import { slotApi, slotKeys } from '@/entities/slot';
import { policyApi, policyKeys } from '@/entities/policy';
import { riskApi, riskKeys } from '@/entities/risk';
import { fetchWorkflowList, workflowQueryKeys } from '@/entities/workflow';
import {
  useIntentPreview,
  useSlotPreview,
  usePolicyPreview,
  useRiskPreview,
  useWorkflowPreview,
} from './usePreviewLists';

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn().mockReturnValue({}),
}));

vi.mock('@/entities/intent', () => ({
  intentApi: { list: vi.fn() },
  intentKeys: {
    list: (wsId: number, packId: number, versionId: number) =>
      ['intents', 'list', wsId, packId, versionId],
  },
}));

vi.mock('@/entities/slot', () => ({
  slotApi: { list: vi.fn() },
  slotKeys: {
    list: (workspaceId: number, packId: number, versionId: number) =>
      ['slots', 'list', workspaceId, packId, versionId],
  },
}));

vi.mock('@/entities/policy', () => ({
  policyApi: { list: vi.fn() },
  policyKeys: {
    list: (workspaceId: number, packId: number, versionId: number) =>
      ['policies', 'list', workspaceId, packId, versionId],
  },
}));

vi.mock('@/entities/risk', () => ({
  riskApi: { list: vi.fn() },
  riskKeys: {
    list: (workspaceId: number, packId: number, versionId: number) =>
      ['risks', 'list', workspaceId, packId, versionId],
  },
}));

vi.mock('@/entities/workflow', () => ({
  fetchWorkflowList: vi.fn(),
  workflowQueryKeys: {
    list: (workspaceId: number, packId: number, versionId: number) =>
      ['workflows', 'list', workspaceId, packId, versionId],
  },
}));

const mockedUseQuery = vi.mocked(useQuery);

describe('useIntentPreview', () => {
  beforeEach(() => mockedUseQuery.mockClear());

  it('versionId가 null이면 enabled:false로 useQuery를 호출한다', () => {
    useIntentPreview(1, 2, null);
    const [opts] = mockedUseQuery.mock.calls[0] as unknown as [{ enabled: boolean }];
    expect(opts.enabled).toBe(false);
  });

  it('versionId가 있으면 enabled:true로 useQuery를 호출한다', () => {
    useIntentPreview(1, 2, 3);
    const [opts] = mockedUseQuery.mock.calls[0] as unknown as [{ enabled: boolean }];
    expect(opts.enabled).toBe(true);
  });

  it('올바른 queryKey로 useQuery를 호출한다', () => {
    useIntentPreview(1, 2, 3);
    const [opts] = mockedUseQuery.mock.calls[0] as [{ queryKey: unknown }];
    expect(opts.queryKey).toEqual(intentKeys.list(1, 2, 3));
  });

  it('queryFn이 intentApi.list를 호출한다', () => {
    useIntentPreview(1, 2, 3);
    const [opts] = mockedUseQuery.mock.calls[0] as unknown as [{ queryFn: () => void }];
    opts.queryFn();
    expect(intentApi.list).toHaveBeenCalledWith(1, 2, 3);
  });
});

describe('useSlotPreview', () => {
  beforeEach(() => mockedUseQuery.mockClear());

  it('versionId가 null이면 enabled:false로 useQuery를 호출한다', () => {
    useSlotPreview(1, 2, null);
    const [opts] = mockedUseQuery.mock.calls[0] as unknown as [{ enabled: boolean }];
    expect(opts.enabled).toBe(false);
  });

  it('versionId가 있으면 enabled:true로 useQuery를 호출한다', () => {
    useSlotPreview(1, 2, 3);
    const [opts] = mockedUseQuery.mock.calls[0] as unknown as [{ enabled: boolean }];
    expect(opts.enabled).toBe(true);
  });

  it('올바른 queryKey로 useQuery를 호출한다', () => {
    useSlotPreview(1, 2, 3);
    const [opts] = mockedUseQuery.mock.calls[0] as [{ queryKey: unknown }];
    expect(opts.queryKey).toEqual(slotKeys.list(1, 2, 3));
  });

  it('queryFn이 slotApi.list를 호출한다', () => {
    useSlotPreview(1, 2, 3);
    const [opts] = mockedUseQuery.mock.calls[0] as unknown as [{ queryFn: () => void }];
    opts.queryFn();
    expect(slotApi.list).toHaveBeenCalledWith(1, 2, 3);
  });
});

describe('usePolicyPreview', () => {
  beforeEach(() => mockedUseQuery.mockClear());

  it('versionId가 null이면 enabled:false로 useQuery를 호출한다', () => {
    usePolicyPreview(1, 2, null);
    const [opts] = mockedUseQuery.mock.calls[0] as unknown as [{ enabled: boolean }];
    expect(opts.enabled).toBe(false);
  });

  it('versionId가 있으면 enabled:true로 useQuery를 호출한다', () => {
    usePolicyPreview(1, 2, 3);
    const [opts] = mockedUseQuery.mock.calls[0] as unknown as [{ enabled: boolean }];
    expect(opts.enabled).toBe(true);
  });

  it('올바른 queryKey로 useQuery를 호출한다', () => {
    usePolicyPreview(1, 2, 3);
    const [opts] = mockedUseQuery.mock.calls[0] as [{ queryKey: unknown }];
    expect(opts.queryKey).toEqual(policyKeys.list(1, 2, 3));
  });

  it('queryFn이 policyApi.list를 호출한다', () => {
    usePolicyPreview(1, 2, 3);
    const [opts] = mockedUseQuery.mock.calls[0] as unknown as [{ queryFn: () => void }];
    opts.queryFn();
    expect(policyApi.list).toHaveBeenCalledWith(1, 2, 3);
  });
});

describe('useRiskPreview', () => {
  beforeEach(() => mockedUseQuery.mockClear());

  it('versionId가 null이면 enabled:false로 useQuery를 호출한다', () => {
    useRiskPreview(1, 2, null);
    const [opts] = mockedUseQuery.mock.calls[0] as unknown as [{ enabled: boolean }];
    expect(opts.enabled).toBe(false);
  });

  it('versionId가 있으면 enabled:true로 useQuery를 호출한다', () => {
    useRiskPreview(1, 2, 3);
    const [opts] = mockedUseQuery.mock.calls[0] as unknown as [{ enabled: boolean }];
    expect(opts.enabled).toBe(true);
  });

  it('올바른 queryKey로 useQuery를 호출한다', () => {
    useRiskPreview(1, 2, 3);
    const [opts] = mockedUseQuery.mock.calls[0] as [{ queryKey: unknown }];
    expect(opts.queryKey).toEqual(riskKeys.list(1, 2, 3));
  });

  it('queryFn이 riskApi.list를 호출한다', () => {
    useRiskPreview(1, 2, 3);
    const [opts] = mockedUseQuery.mock.calls[0] as unknown as [{ queryFn: () => void }];
    opts.queryFn();
    expect(riskApi.list).toHaveBeenCalledWith(1, 2, 3);
  });
});

describe('useWorkflowPreview', () => {
  beforeEach(() => mockedUseQuery.mockClear());

  it('versionId가 null이면 enabled:false로 useQuery를 호출한다', () => {
    useWorkflowPreview(1, 2, null);
    const [opts] = mockedUseQuery.mock.calls[0] as unknown as [{ enabled: boolean }];
    expect(opts.enabled).toBe(false);
  });

  it('versionId가 있으면 enabled:true로 useQuery를 호출한다', () => {
    useWorkflowPreview(1, 2, 3);
    const [opts] = mockedUseQuery.mock.calls[0] as unknown as [{ enabled: boolean }];
    expect(opts.enabled).toBe(true);
  });

  it('올바른 queryKey로 useQuery를 호출한다', () => {
    useWorkflowPreview(1, 2, 3);
    const [opts] = mockedUseQuery.mock.calls[0] as [{ queryKey: unknown }];
    expect(opts.queryKey).toEqual(workflowQueryKeys.list(1, 2, 3));
  });

  it('queryFn이 fetchWorkflowList를 호출한다', () => {
    useWorkflowPreview(1, 2, 3);
    const [opts] = mockedUseQuery.mock.calls[0] as unknown as [{ queryFn: () => void }];
    opts.queryFn();
    expect(fetchWorkflowList).toHaveBeenCalledWith(1, 2, 3);
  });
});
