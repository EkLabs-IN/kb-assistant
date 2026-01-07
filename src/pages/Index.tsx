import { useAuth, AuthProvider } from '@/contexts/AuthContext';
import { LoginPage } from '@/components/login/LoginPage';
import { MainApp } from '@/components/MainApp';
import { DataSourceSelection } from '@/components/onboarding/DataSourceSelection';

function AppContent() {
  const { isAuthenticated, hasSelectedDataSource, selectDataSource } = useAuth();

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  if (!hasSelectedDataSource) {
    return <DataSourceSelection onComplete={selectDataSource} />;
  }

  return <MainApp />;
}

const Index = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default Index;
