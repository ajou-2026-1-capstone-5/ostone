# ADR-114: 클라우드 스토리지 Provider 선정 및 로컬 개발 전략

**Status**: Accepted
**Date**: 2026-04-16
**Context**: spec/114 — [Infra] 1.1.4 상담 데이터 raw 파일 클라우드 스토리지

---

## Context

상담 로그 원본 JSON 파일을 서버 proxy 방식으로 수신하여 클라우드 오브젝트 스토리지에 영구 보관해야 한다.

아키텍처 의도:
- S3는 원본 아카이브 및 감사(audit) 목적으로 사용
- Airflow는 PostgreSQL DB를 주입력으로 사용하며, S3는 재처리·감사용 아카이브
- 운영자가 multipart 업로드 → 서버가 S3에 저장 + 파싱하여 DB 적재 + Airflow 웹훅

로컬 개발 환경에서 실제 클라우드 의존 없이 개발/테스트 가능한 에뮬레이터가 필요하다.

---

## Decision

**Cloud Provider**: AWS S3

**로컬 개발 에뮬레이터**: MinIO (docker-compose 서비스로 추가)

---

## Rationale

### AWS S3 선택 이유

| 기준 | 근거 |
|------|------|
| 스택 일관성 | Airflow를 AWS Fargate에서 구동 예정 → AWS 생태계 일원화 |
| IAM 통합 | Fargate Task Role로 cross-service 자격증명 관리 가능, 별도 Key 관리 불필요 |
| SDK 성숙도 | `software.amazon.awssdk:s3` (v2)는 Spring Boot 3.x + Java 21 호환 |
| 운영 경험 | 팀 AWS 인프라 경험 우선 |

### MinIO 선택 이유 (로컬 개발)

- AWS S3 API **높은 호환성** → 동일 SDK(`software.amazon.awssdk:s3`), 동일 코드로 전환 가능
  - **호환성 주의 사항**:
    - Presigned URL: 헤더/서명 방식 일부 차이 — MinIO는 `x-amz-*` 헤더 처리 방식이 S3와 상이할 수 있음
    - Multipart Upload 제한: `ListMultipartUploads`는 정확한 object name 필요, `AbortIncompleteMultipartUpload` 정책 미지원, `aws-chunked` 인코딩 16 MiB 초과 시 업로드 오류 가능
    - `putObject` 메타데이터/헤더 권한: 커스텀 헤더(`x-amz-meta-*`) 처리 및 권한 모델 일부 차이 있음
  - **이 스펙 범위(단순 `putObject`)는 위 edge case 해당 없음** — 향후 presigned URL·multipart 도입 시 재검토 필요
- docker-compose 단일 서비스로 추가 (공식 이미지: `minio/minio`, 호환성 주의 사항은 위 참조)
- 로컬/CI에서 실제 AWS 자격증명 불필요
- 무료 오픈소스

---

## Alternatives Considered

| Provider | 기각 이유 |
|----------|----------|
| Google Cloud Storage | Fargate(AWS) 사용 시 cross-cloud 복잡도 증가; GCS SDK는 별도 의존성 |
| Azure Blob Storage | 팀 Azure 경험 부재; 스택 불일치 |
| 자가 호스팅 MinIO (전용, 운영) | 고가용성 및 운영 부담 증가; S3 대비 생태계 지원 부족 |
| LocalStack | MinIO 대비 설정 복잡; 유료 기능 필요 가능성 |

---

## Implementation Notes

- `RawFileStoragePort` 인터페이스 → `S3RawFileStorageAdapter` 구현체
- `S3Client` 빌더에서 `endpointOverride` 설정으로 MinIO/AWS 전환:
  ```java
  S3Client.builder()
      .endpointOverride(URI.create(endpoint))  // 비어있으면 AWS 기본값
      .credentialsProvider(...)
      .forcePathStyle(pathStyleAccess)          // MinIO는 true 필수
      .build()
  ```
- 프로파일별 전환: `application-local.yml`에서 MinIO 엔드포인트/자격증명 주입
- 실제 AWS 버킷 생성 및 IAM 설정은 이 스펙의 **out-of-scope** (인프라팀 별도 작업)

---

## Consequences

### 긍정적
- AWS Fargate + S3 동일 생태계로 IAM Role 자격증명 관리 단순화
- MinIO로 로컬 개발/CI에서 실제 AWS 자격증명 없이 완전한 스토리지 테스트 가능
- `EndpointOverride` 패턴으로 프로파일별 전환이 코드 변경 없이 설정만으로 가능

### 부정적 / 주의
- `software.amazon.awssdk:s3` 의존성 추가 필요 (build.gradle)
- 실제 AWS 버킷 생성/IAM Role 설정은 별도 인프라 작업 필요
- MinIO와 AWS S3 간 edge case 차이 (복합 업로드, presigned URL 등) 주의 필요
  (이 스펙은 단순 `putObject` 사용으로 해당 없음)
