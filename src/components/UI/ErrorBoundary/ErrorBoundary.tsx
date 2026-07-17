import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext';
import { TranslationSchema } from '../../../utils/translations';
import styles from './ErrorBoundary.module.css';

interface Props {
  children: ReactNode;
}

interface InnerProps extends Props {
  translation: TranslationSchema;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundaryInner extends Component<InnerProps, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    const { translation } = this.props;

    if (this.state.hasError) {
      return (
        <div className={styles.container}>
          <div className={styles.content}>
            <AlertCircle size={48} className={styles.icon} />
            <h1>{translation.errorBoundary.title}</h1>
            <p>{translation.errorBoundary.description}</p>
            {this.state.error && <pre className={styles.errorLog}>{this.state.error.message}</pre>}
            <button onClick={this.handleReset} className={styles.resetBtn}>
              <RefreshCw size={18} />
              {translation.errorBoundary.refresh}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function ErrorBoundary(props: Props) {
  const { translation } = useLanguage();
  return <ErrorBoundaryInner {...props} translation={translation} />;
}
