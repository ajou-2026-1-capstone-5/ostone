import React, { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { passwordResetCompleteApi } from '../../api/authApi';
import styles from './password-reset-complete-form.module.css';

export const PasswordResetCompleteForm: React.FC = () => {
  const [searchParams] = useSearchParams();
  const resetToken = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // 토큰이 없는 상태로 접근한 경우 방어 로직
  if (!resetToken) {
    return (
      <div className={styles.formWrapper}>
        <div className={styles.errorMessage}>
          잘못된 접근입니다. 비밀번호 재설정 링크가 유효하지 않습니다.
        </div>
        <div className={styles.backLink}>
          <Link to="/login" className={styles.link}>로그인 화면으로 돌아가기</Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await passwordResetCompleteApi({ resetToken, newPassword: password });
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.message || '비밀번호 재설정에 실패했습니다. 링크가 만료되었을 수 있습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className={styles.formWrapper}>
        <h1 className={styles.title}>완료!</h1>
        <div className={styles.successMessage}>
          비밀번호가 성공적으로 변경되었습니다.<br/>
          이제 새로운 비밀번호로 로그인해 주세요.
        </div>
        <div className={styles.backLink}>
          <Link to="/login" className={styles.link}>로그인 하러 가기</Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.formWrapper}>
      <h1 className={styles.title}>새 비밀번호 설정</h1>
      <p className={styles.subtitle}>
        계정에 사용할 새로운 비밀번호를 입력해 주세요.
      </p>

      <form onSubmit={handleSubmit} className={styles.formWrapper}>
        <div className={styles.inputGroup}>
          <label htmlFor="password" className={styles.label}>새 비밀번호</label>
          <input
            id="password"
            type="password"
            required
            className={styles.input}
            placeholder="비밀번호 (8자 이상, 특수문자 포함)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className={styles.inputGroup}>
          <label htmlFor="confirmPassword" className={styles.label}>새 비밀번호 확인</label>
          <input
            id="confirmPassword"
            type="password"
            required
            className={styles.input}
            placeholder="비밀번호 다시 입력"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={loading}
          />
        </div>

        {error && <div className={styles.errorMessage}>{error}</div>}

        <button type="submit" className={styles.submitButton} disabled={loading || !password || !confirmPassword}>
          {loading ? '변경 중...' : '비밀번호 변경하기'}
        </button>
      </form>
    </div>
  );
};
