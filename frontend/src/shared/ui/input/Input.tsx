import React, { InputHTMLAttributes } from 'react';
import styles from './input.module.css';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({ 
  label, 
  error, 
  icon,
  className,
  ...props 
}) => {
  return (
    <div className={`${styles.wrapper} ${className || ''}`}>
      {label && <label className={styles.label}>{label}</label>}
      <div className={styles.inputContainer}>
        {icon && <span className={styles.icon}>{icon}</span>}
        <input 
          className={`${styles.input} ${error ? styles.errorInput : ''} ${icon ? styles.hasIcon : ''}`} 
          {...props} 
        />
      </div>
      {error && <span className={styles.errorText}>{error}</span>}
    </div>
  );
};
