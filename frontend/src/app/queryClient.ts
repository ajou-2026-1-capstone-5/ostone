import { QueryClient, type QueryClientConfig } from "@tanstack/react-query";

// 도메인 팩/워크플로우/intent 변경은 pipeline·review 등 다른 화면에서도 발생하므로
// 현재 화면이 명시적 새로고침 없이 최신 상태를 반영하도록 자동 refetch를 활성화한다.
// staleTime(60초)으로 빠른 재진입·포커스 전환 시의 호출 폭증은 방지한다.
export const queryClientConfig: QueryClientConfig = {
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: 0,
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 0,
    },
  },
};

export const queryClient = new QueryClient(queryClientConfig);
