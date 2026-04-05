import React, { useState } from 'react';
import { Mail, Lock, User, KeyRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Input } from '../../../../shared/ui/input/Input';
import { Button } from '../../../../shared/ui/button/Button';
import styles from './signup-form.module.css';

export const SignupForm: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!name || !email || !password || !confirmPassword) {
      setError('모든 필드를 입력해주세요.');
      return;
    }

    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    setIsLoading(true);
    // Mock API call
    setTimeout(() => {
      setIsLoading(false);
      // alert('가입 성공! 관리자 승인 대기중입니다.');
    }, 1500);
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.header}>
        <h2 className={styles.title}>Create Account</h2>
        <p className={styles.subtitle}>운영자(Admin) 권한 신청하기</p>
      </div>

      <div className={styles.fields}>
        <Input
          type="text"
          placeholder="홍길동"
          label="이름"
          icon={<User size={18} />}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          type="email"
          placeholder="admin@ostone.com"
          label="이메일 주소"
          icon={<Mail size={18} />}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          type="password"
          placeholder="••••••••"
          label="비밀번호"
          icon={<Lock size={18} />}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Input
          type="password"
          placeholder="••••••••"
          label="비밀번호 확인"
          icon={<KeyRound size={18} />}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
      </div>

      {error && <div className={styles.errorMessage}>{error}</div>}

      <Button type="submit" fullWidth isLoading={isLoading} className={styles.submitBtn}>
        계정 생성 요청
      </Button>

      <div className={styles.footer}>
        이미 계정이 있으신가요? <Link to="/login" className={styles.loginLink}>로그인하기</Link>
      </div>
    </form>
  );
};
