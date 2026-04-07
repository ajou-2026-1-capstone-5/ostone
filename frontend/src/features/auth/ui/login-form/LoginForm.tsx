import React, { useState } from 'react';
import { Mail, Lock } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Input } from '../../../../shared/ui/input/Input';
import { Button } from '../../../../shared/ui/button/Button';
import { loginApi } from '../../api/authApi';
import { saveAuthSession } from '../../../../shared/lib/auth';
import { ApiRequestError } from '../../../../shared/api';
import styles from './login-form.module.css';

export const LoginForm: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!email || !password) {
      setError('이메일과 비밀번호를 모두 입력해주세요.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await loginApi({ email, password });

      saveAuthSession(
        {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          tokenType: result.tokenType,
          expiresIn: result.expiresIn,
        },
        result.user,
      );

      navigate('/upload');
    } catch (err) {
      if (err instanceof ApiRequestError) {
        if (err.code === 'INVALID_CREDENTIALS') {
          setError('이메일 또는 비밀번호가 올바르지 않습니다.');
        } else if (err.code === 'PASSWORD_RESET_REQUIRED') {
          setError('비밀번호 재설정이 필요합니다.');
        } else if (err.code === 'VALIDATION_ERROR') {
          setError(err.message);
        } else {
          setError(err.message || '로그인에 실패했습니다.');
        }
      } else {
        setError('서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.header}>
        <h2 className={styles.title}>Welcome Back</h2>
        <p className={styles.subtitle}>CS Workflow Generator 운영자 시스템</p>
      </div>

      <div className={styles.fields}>
        <Input
          type="email"
          placeholder="admin@ostone.com"
          label="이메일 주소"
          icon={<Mail size={18} />}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={error && !email ? '이메일을 입력하세요' : undefined}
        />
        <Input
          type="password"
          placeholder="••••••••"
          label="비밀번호"
          icon={<Lock size={18} />}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={error && !password ? '비밀번호를 입력하세요' : undefined}
        />
      </div>

      <div className={styles.options}>
        <label className={styles.checkboxLabel}>
          <input type="checkbox" className={styles.checkbox} />
          <span>아이디 저장</span>
        </label>
        <Link to="/reset-password" className={styles.forgotLink}>
          비밀번호 찾기
        </Link>
      </div>

      {error && <div className={styles.errorMessage}>{error}</div>}

      <Button type="submit" fullWidth isLoading={isLoading} className={styles.submitBtn}>
        시스템 로그인
      </Button>

      <div className={styles.footer}>
        계정이 없으신가요? <Link to="/signup" className={styles.signupLink}>운영자 등록하기</Link>
      </div>
    </form>
  );
};
