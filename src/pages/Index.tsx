import { useAuth, AuthProvider } from '@/contexts/AuthContext';
import { LoginPage } from '@/components/login/LoginPage';
import { MainApp } from '@/components/MainApp';

function AppContent() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <LoginPage />;
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
