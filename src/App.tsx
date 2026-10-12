import React, { Suspense, lazy, useState } from 'react';
import { ListRestart, Globe, Sparkles } from 'lucide-react';
import { LanguageProvider } from './context/LanguageProvider';
import { useLanguage } from './context/LanguageContext';
import { ExpenseDataProvider } from './context/DataProvider';
import { useExpenseData } from './context/DataContext';
import { DashboardUIProvider } from './context/UIProvider';
import { useDashboardUI } from './context/UIContext';
import DragDropUpload from './components/DragDropUpload/DragDropUpload';
import FileNavigator from './components/FileNavigator/FileNavigator';
import ErrorBoundary from './components/UI/ErrorBoundary/ErrorBoundary';
import styles from './App.module.css';

const Dashboard = lazy(() => import('./components/Dashboard/Dashboard'));
const PdfPlayground = lazy(() => import('./components/Playground/PdfPlayground'));

const AppContent: React.FC = () => {
  const { files } = useExpenseData();
  const { resetView } = useDashboardUI();
  const { currentLanguage, setLanguage, translation } = useLanguage();
  const [isPlayground, setIsPlayground] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return (
        window.location.hash === '#playground' ||
        new URLSearchParams(window.location.search).has('playground')
      );
    }
    return false;
  });

  const isPlaygroundAvailable =
    import.meta.env.DEV ||
    (typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).has('playground'));

  const togglePlayground = () => {
    const next = !isPlayground;
    setIsPlayground(next);
    if (typeof window !== 'undefined') {
      window.location.hash = next ? '#playground' : '';
    }
  };

  if (isPlayground) {
    return (
      <ErrorBoundary>
        <Suspense fallback={<div className={styles.loading}>Loading Playground...</div>}>
          <PdfPlayground
            onBack={() => {
              setIsPlayground(false);
              if (typeof window !== 'undefined') {
                window.location.hash = '';
              }
            }}
          />
        </Suspense>
      </ErrorBoundary>
    );
  }

  return (
    <div className={styles.appContainer}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.logo}>
            <h1>{translation.title}</h1>
          </div>
          <button
            type="button"
            className={styles.langToggle}
            onClick={() => setLanguage(currentLanguage === 'en' ? 'he' : 'en')}
          >
            <Globe size={18} />
            <span>{currentLanguage === 'en' ? 'עברית' : 'English'}</span>
          </button>
          {isPlaygroundAvailable && (
            <button type="button" className={styles.playgroundToggle} onClick={togglePlayground}>
              <Sparkles size={16} />
              <span>PDF Playground</span>
            </button>
          )}
        </div>
        {files.length > 0 && (
          <button type="button" className={styles.resetButton} onClick={resetView}>
            <ListRestart size={18} />
            <span>{translation.reset}</span>
          </button>
        )}
      </header>

      <main className={styles.main}>
        <ErrorBoundary>
          {files.length === 0 ? (
            <div className={styles.welcome}>
              <h2>{translation.welcome}</h2>
              <p>{translation.welcomeSub}</p>
              <DragDropUpload />
            </div>
          ) : (
            <>
              <FileNavigator />
              <div className={styles.dashboardWrapper}>
                <Suspense fallback={<div className={styles.loading}>Loading Dashboard...</div>}>
                  <Dashboard />
                </Suspense>
              </div>
            </>
          )}
        </ErrorBoundary>
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <LanguageProvider>
      <ExpenseDataProvider>
        <DashboardUIProvider>
          <AppContent />
        </DashboardUIProvider>
      </ExpenseDataProvider>
    </LanguageProvider>
  );
};

export default App;
