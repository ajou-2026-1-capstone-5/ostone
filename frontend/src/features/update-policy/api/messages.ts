export const POLICY_ERROR_MESSAGES = {
  POLICY_NOT_EDITABLE: "검토 중인 버전에서만 응대 기준을 수정할 수 있습니다.",
  POLICY_CODE_REFERENCED_BY_WORKFLOW:
    "이 응대 기준을 참조하는 워크플로우가 있어 비활성화할 수 없습니다.",
  VALIDATION_ERROR: "응대 기준 데이터 검증에 실패했습니다. 입력값을 확인해주세요.",
  NOT_FOUND: "응대 기준을 찾을 수 없습니다.",
  UPDATE_FAILED: "응대 기준 수정에 실패했습니다.",
  STATUS_FAILED: "응대 기준 상태 변경에 실패했습니다.",
  LOAD_FAILED: "응대 기준 정보를 불러오지 못했습니다.",
} as const;
