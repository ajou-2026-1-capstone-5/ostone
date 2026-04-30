import { useState, useEffect, useRef } from 'react';
import { ApiRequestError } from '@/shared/api';
import type { CreateDomainPackDraftRequest } from '@/entities/domain-pack';
import { useCreateDraft } from '../model/useCreateDraft';
import styles from './CreateDraftModal.module.css';

interface CreateDraftModalProps {
  wsId: number;
  packId: number;
  onClose: () => void;
  onSuccess: (newVersionId: number) => void;
}

type InputTab = 'paste' | 'pipeline';

export function CreateDraftModal({ wsId, packId, onClose, onSuccess }: CreateDraftModalProps) {
  const mutation = useCreateDraft();
  const [activeTab, setActiveTab] = useState<InputTab>('paste');
  const [jsonText, setJsonText] = useState('');
  const [inlineError, setInlineError] = useState<string | null>(null);
  const firstInputRef = useRef<HTMLTextAreaElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
    firstInputRef.current?.focus();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setJsonText((ev.target?.result as string) ?? '');
    };
    reader.readAsText(file);
  };

  const handleSubmit = () => {
    setInlineError(null);

    let payload: CreateDomainPackDraftRequest;
    try {
      const parsed = JSON.parse(jsonText || '{}') as CreateDomainPackDraftRequest;
      payload = parsed;
    } catch {
      setInlineError('유효하지 않은 JSON입니다. 내용을 확인해 주세요.');
      return;
    }

    mutation.mutate(
      { wsId, packId, payload },
      {
        onSuccess: (data) => {
          onSuccess(data.versionId);
        },
        onError: (error: unknown) => {
          if (error instanceof ApiRequestError) {
            if (error.status === 409) {
              setInlineError('동일 Pack 묶기 충돌. 잠시 후 재시도하세요.');
            } else if (error.status === 400) {
              setInlineError(error.message || '요청 검증 실패. 입력을 확인해 주세요.');
            }
          }
        },
      },
    );
  };

  return (
    <div
      className={styles.overlay}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <dialog
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-draft-title"
        onCancel={(e) => { e.preventDefault(); onClose(); }}
      >
        <div className={styles.header}>
          <span id="create-draft-title" className={styles.title}>새 DRAFT 묶기</span>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>

        <div className={styles.tabBar} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'paste'}
            className={`${styles.tab} ${activeTab === 'paste' ? styles.active : ''}`}
            onClick={() => setActiveTab('paste')}
          >
            직접 입력
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'pipeline'}
            className={`${styles.tab} ${activeTab === 'pipeline' ? styles.active : ''}`}
            onClick={() => setActiveTab('pipeline')}
            title="파이프라인 import 기능 준비 중"
          >
            파이프라인 import
          </button>
        </div>

        <div className={styles.body}>
          {activeTab === 'paste' ? (
            <>
              <div>
                <label className={styles.label} htmlFor="draft-json-input">
                  페이로드 JSON
                </label>
                <textarea
                  id="draft-json-input"
                  ref={firstInputRef}
                  className={styles.textarea}
                  value={jsonText}
                  onChange={(e) => setJsonText(e.target.value)}
                  placeholder={'{\n  "summaryJson": "{}",\n  "intents": [],\n  ...\n}'}
                  spellCheck={false}
                />
              </div>
              <div>
                <label className={styles.fileLabel}>
                  JSON 파일 업로드
                  <input
                    type="file"
                    accept=".json"
                    className={styles.fileInput}
                    onChange={handleFileChange}
                  />
                </label>
                <span className={styles.fileUploadHint}> — 파일 내용이 위 입력란에 채워집니다.</span>
              </div>
            </>
          ) : (
            <div className={styles.disabledTab} role="tabpanel">
              파이프라인 import 기능은 준비 중입니다.<br />
              Backend 엔드포인트 추가 후 활성화됩니다.
            </div>
          )}

          {inlineError && (
            <p className={styles.inlineError} role="alert">{inlineError}</p>
          )}
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>
            취소
          </button>
          <button
            type="button"
            className={styles.submitBtn}
            onClick={handleSubmit}
            disabled={mutation.isPending || activeTab === 'pipeline'}
          >
            {mutation.isPending ? '생성 중...' : '묶기'}
          </button>
        </div>
      </dialog>
    </div>
  );
}
