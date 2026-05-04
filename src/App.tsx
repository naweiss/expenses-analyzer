import React, { Suspense, lazy } from 'react';
import { ListRestart, Globe } from 'lucide-react';
import { LanguageProvider } from './context/LanguageProvider';
import { useLanguage } from './context/LanguageContext';
import { ExpenseDataProvider } from './context/DataProvider';
import { useExpenseData } from './context/DataContext';
import { DashboardUIProvider } from './context/UIProvider';
import { useDashboardUI } from './context/UIContext';
import DragDropUpload from './components/DragDropUpload/DragDropUpload';
import FileNavigator from './components/FileNavigator/FileNavigator';
import styles from './App.module.css';

const Dashboard = lazy(() => import('./components/Dashboard/Dashboard'));

const AppContent: React.FC = () => {
  const { files } = useExpenseData();
  const { resetView } = useDashboardUI();
  const { currentLanguage, setLanguage, translation } = useLanguage();

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
        </div>
        {files.length > 0 && (
          <button type="button" className={styles.resetButton} onClick={resetView}>
            <ListRestart size={18} />
            <span>{translation.reset}</span>
          </button>
        )}
      </header>

      <main className={styles.main}>
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
