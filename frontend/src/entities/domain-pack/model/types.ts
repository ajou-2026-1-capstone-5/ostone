export type DomainPackLifecycleStatus = 'DRAFT' | 'PUBLISHED';

export type {
  DomainPackDraftEntryResponse,
  DomainPackDetailResult as DomainPackDetail,
  DomainPackVersionDetailResult as DomainPackVersionDetail,
  DomainPackVersionSummaryEntry as DomainPackVersionSummary,
} from "@/shared/api/generated/zod";
