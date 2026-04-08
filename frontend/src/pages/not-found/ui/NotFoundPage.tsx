import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../../shared/ui/button/Button';
import styles from './not-found-page.module.css';

/**
 * 존재하지 않는 경로로 접근했을 때 표시되는 404 페이지 컴포넌트입니다.
 */
export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>404</h1>
      <p className={styles.message}>요청하신 페이지를 찾을 수 없습니다.</p>
      <p className={styles.description}>
        주소가 올바른지 확인하시거나, 아래 버튼을 클릭하여 홈으로 이동해 주세요.
      </p>
      <div className={styles.actions}>
        <Button onClick={() => navigate('/')} variant="primary">
          홈으로 돌아가기
        </Button>
        <Button onClick={() => navigate(-1)} variant="secondary">
          이전 페이지
        </Button>
      </div>
    </div>
  );
};
