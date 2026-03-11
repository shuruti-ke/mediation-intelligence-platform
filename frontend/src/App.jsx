import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import CaseDetailPage from './pages/CaseDetailPage';
import NewCasePage from './pages/NewCasePage';
import LibraryPage from './pages/LibraryPage';
import JudiciaryPage from './pages/JudiciaryPage';
import PublicLandingPage from './pages/PublicLandingPage';
import ShouldIMediatePage from './pages/ShouldIMediatePage';
import FreeTierPage from './pages/FreeTierPage';
import TrainingPage from './pages/TrainingPage';
import TrainingModulePage from './pages/TrainingModulePage';
import CPDDashboardPage from './pages/CPDDashboardPage';
import RolePlayPage from './pages/RolePlayPage';
import OfflineBanner from './components/OfflineBanner';
import './App.css';

function ProtectedRoute({ children }) {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <>
      <OfflineBanner />
      <BrowserRouter>
      <Routes>
        <Route path="/" element={<PublicLandingPage />} />
        <Route path="/should-i-mediate" element={<ShouldIMediatePage />} />
        <Route path="/free-tier" element={<FreeTierPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cases/new"
          element={
            <ProtectedRoute>
              <NewCasePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cases/:id"
          element={
            <ProtectedRoute>
              <CaseDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/library"
          element={
            <ProtectedRoute>
              <LibraryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/judiciary"
          element={
            <ProtectedRoute>
              <JudiciaryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/training"
          element={
            <ProtectedRoute>
              <TrainingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/training/modules/:id"
          element={
            <ProtectedRoute>
              <TrainingModulePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/training/cpd"
          element={
            <ProtectedRoute>
              <CPDDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/training/role-play"
          element={
            <ProtectedRoute>
              <RolePlayPage />
            </ProtectedRoute>
          }
        />
        <Route path="/app" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
    </>
  );
}
