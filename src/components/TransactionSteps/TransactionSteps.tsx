import React from 'react';
import styles from './TransactionSteps.module.css';

export type TransactionStepStatus = 'pending' | 'inProgress' | 'completed' | 'error';

export interface TransactionStepBase {
  id: string | number;
  label: string;
  status: TransactionStepStatus;
  txHash?: `0x${string}`;
}

type StatusLabelOverrides = Partial<Record<TransactionStepStatus, string>>;

interface TransactionStepsProps<TStep extends TransactionStepBase = TransactionStepBase> {
  steps: TStep[];
  title?: string;
  className?: string;
  statusLabels?: StatusLabelOverrides;
  renderStatusIcon?: (status: TransactionStepStatus, step: TStep) => React.ReactNode;
  emptyState?: React.ReactNode;
}

const DEFAULT_STATUS_LABELS: Record<TransactionStepStatus, string> = {
  pending: 'Pending',
  inProgress: 'Processing',
  completed: 'Completed',
  error: 'Failed',
};

const DEFAULT_STATUS_ICONS: Record<TransactionStepStatus, React.ReactNode> = {
  pending: '',
  inProgress: '•',
  completed: '✓',
  error: '!',
};

const TransactionSteps = <TStep extends TransactionStepBase>({
  steps,
  title = 'On-chain transactions',
  className,
  statusLabels,
  renderStatusIcon,
  emptyState,
}: TransactionStepsProps<TStep>) => {
  if (!steps || steps.length === 0) {
    return emptyState ? <>{emptyState}</> : null;
  }

  const containerClassName = [styles.container, className].filter(Boolean).join(' ');
  const statusLabelMap = { ...DEFAULT_STATUS_LABELS, ...statusLabels };

  const resolveIcon = (status: TransactionStepStatus, step: TStep) => {
    if (renderStatusIcon) {
      return renderStatusIcon(status, step);
    }
    return DEFAULT_STATUS_ICONS[status] ?? '';
  };

  return (
    <div className={containerClassName}>
      {title ? <div className={styles.title}>{title}</div> : null}
      <ul className={styles.list}>
        {steps.map((step) => (
          <li key={step.id} className={styles.row}>
            <span className={`${styles.statusIcon} ${styles[`statusIcon--${step.status}`] ?? ''}`}>
              {resolveIcon(step.status, step)}
            </span>
            <span className={styles.label}>{step.label}</span>
            <span className={styles.state}>{statusLabelMap[step.status] ?? ''}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TransactionSteps;
