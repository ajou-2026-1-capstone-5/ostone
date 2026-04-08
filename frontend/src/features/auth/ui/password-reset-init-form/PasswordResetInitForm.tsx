import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { passwordResetInitApi } from '../../api/authApi';
import styles from './password-reset-init-form.module.css';

export const PasswordResetInitForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    try {
      setLoading(true);
      setError(null);
      setSuccessMessage(null);

      const response = await passwordResetInitApi(email);
      setSuccessMessage(response.message);
    } catch (err: any) {
      setError(err.message || '요청 처리 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.formWrapper}>
      <h1 className={styles.title}>비밀번호 찾기</h1>
      <p className={styles.subtitle}>
        가입하신 이메일 주소를 입력하면<br/>
        비밀번호 재설정 메일을 보내드립니다.
      </p>

      {successMessage ? (
        <>
          <div className={styles.successMessage}>
            {successMessage}
            {import.meta.env.MODE !== 'production' && (
              <>
                <br/><br/>
                (※ 개발 모드 테스트: API가 정상 처리되었습니다. 로컬 환경이므로 메일 발송은 생략됩니다.)
              </>
            )}
          </div>
          <div className={styles.backLink}>
            <Link to="/login" className={styles.link}>로그인 화면으로 돌아가기</Link>
          </div>
        </>
      ) : (
        <form onSubmit={handleSubmit} className={styles.formWrapper}>
          <div className={styles.inputGroup}>
            <label htmlFor="email" className={styles.label}>이메일</label>
            <input
              id="email"
              type="email"
              required
              className={styles.input}
              placeholder="example@ostone.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>

          {error && <div className={styles.errorMessage}>{error}</div>}

          <button type="submit" className={styles.submitButton} disabled={loading || !email}>
            {loading ? '전송 중...' : '재설정 메일 받기'}
          </button>

          <div className={styles.backLink}>
            <Link to="/login" className={styles.link}>로그인 화면으로 돌아가기</Link>
          </div>
        </form>
      )}
    </div>
  );
};