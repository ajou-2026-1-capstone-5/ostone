import React, { ButtonHTMLAttributes } from 'react';
import styles from './button.module.css';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  isLoading?: boolean;
  fullWidth?: boolean;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  isLoading = false,
  fullWidth = false,
  className,
  children,
  disabled,
  ...props
}) => {
  const baseClass = styles.button;
  const variantClass = styles[variant];
  const widthClass = fullWidth ? styles.fullWidth : '';
  const loadingClass = isLoading ? styles.loading : '';

  return (
    <button
      className={`${baseClass} ${variantClass} ${widthClass} ${loadingClass} ${className || ''}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && <Loader2 className={styles.spinner} size={18} />}
      <span className={styles.content}>{children}</span>
    </button>
  );
};
