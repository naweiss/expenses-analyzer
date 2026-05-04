import React from 'react';
import styles from './StatusCard.module.css';

interface StatusCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  iconColor: string;
}

const StatusCard: React.FC<StatusCardProps> = ({ title, value, icon, iconColor }) => {
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.title}>{title}</span>
        <div className={styles.iconContainer} style={{ color: iconColor }}>
          {icon}
        </div>
      </div>
      <div className={styles.value}>{value}</div>
    </div>
  );
};

export default StatusCard;
