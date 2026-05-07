import { getIntent, getListIntentsQueryKey, listIntents, useGetIntent, useListIntents } from "@/shared/api/generated/endpoints/intent-definition-controller/intent-definition-controller";

export const intentApi = {
  list: listIntents,
  detail: getIntent,
};

export { getListIntentsQueryKey, useListIntents, useGetIntent };