'use client';

import { ButtonHTMLAttributes } from 'react';
import Icon from './Icon';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'quiet';
  icon?: string;
};

export default function Button({ variant = 'primary', icon, children, className = '', ...rest }: Props) {
  return (
    <button className={`nb-btn nb-btn-${variant} ${className}`} {...rest}>
      {icon && <Icon name={icon} size={16} />}
      {children}
    </button>
  );
}
