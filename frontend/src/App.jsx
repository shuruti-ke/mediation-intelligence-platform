import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminTrainingAcademyPage from './pages/AdminTrainingAcademyPage';
import ClientDashboardPage from './pages/ClientDashboardPage';
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
import TraineeTrainingPage from './pages/TraineeTrainingPage';
import TraineeArticlePage from './pages/TraineeArticlePage';
import PracticeScenarioPage from './pages/PracticeScenarioPage';
import CalendarPage from './pages/CalendarPage';
import OfflineBanner from './components/OfflineBanner';
import { auth } from './api/client';
import './App.css';

function getRedirectForRole(role) {
  if (role === 'super_admin') return '/admin';
  if (role === 'client_corporate' || role === 'client_individual') return '/client';
  return '/dashboard';
}

function ProtectedRoute({ children }) {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

function RoleRedirect() {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" replace />;
  const userStr = localStorage.getItem('user');
  let role = 'mediator';
  try {
    if (userStr) role = JSON.parse(userStr).role;
  } catch {}
  return <Navigate to={getRedirectForRole(role)} replace />;
}

function RoleBasedRoute({ children, allowedRoles }) {
  const [user, setUser] = useState(() => {
    try {
      const u = localStorage.getItem('user');
      return u ? JSON.parse(u) : null;
    } catch { return null; }
  });
  const [loading, setLoading] = useState(!user);

  useEffect(() => {
    if (user) {
      setLoading(false);
      return;
    }
    auth.getMe()
      .then(({ data }) => {
        localStorage.setItem('user', JSON.stringify(data));
        setUser(data);
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-screen"><div className="loading-spinner" /><p>Loading...</p></div>;
  if (!user) return <Navigate to="/login" replace />;
  const allowed = allowedRoles.includes(user.role);
  if (!allowed) return <Navigate to={getRedirectForRole(user.role)} replace />;
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
          path="/admin"
          element={
            <ProtectedRoute>
              <RoleBasedRoute allowedRoles={['super_admin']}>
                <AdminDashboardPage />
              </RoleBasedRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/training-academy"
          element={
            <ProtectedRoute>
              <RoleBasedRoute allowedRoles={['super_admin']}>
                <AdminTrainingAcademyPage />
              </RoleBasedRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/client"
          element={
            <ProtectedRoute>
              <RoleBasedRoute allowedRoles={['client_corporate', 'client_individual']}>
                <ClientDashboardPage />
              </RoleBasedRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <RoleBasedRoute allowedRoles={['mediator', 'trainee']}>
                <DashboardPage />
              </RoleBasedRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/cases/new"
          element={
            <ProtectedRoute>
              <RoleBasedRoute allowedRoles={['mediator', 'trainee', 'super_admin']}>
                <NewCasePage />
              </RoleBasedRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/cases/:id/edit"
          element={
            <ProtectedRoute>
              <RoleBasedRoute allowedRoles={['mediator', 'trainee', 'super_admin']}>
                <NewCasePage edit />
              </RoleBasedRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/cases/:id"
          element={
            <ProtectedRoute>
              <RoleBasedRoute allowedRoles={['mediator', 'trainee', 'super_admin']}>
                <CaseDetailPage />
              </RoleBasedRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/calendar"
          element={
            <ProtectedRoute>
              <CalendarPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/library"
          element={
            <ProtectedRoute>
              <RoleBasedRoute allowedRoles={['mediator', 'trainee', 'super_admin']}>
                <LibraryPage />
              </RoleBasedRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/judiciary"
          element={
            <ProtectedRoute>
              <RoleBasedRoute allowedRoles={['mediator', 'trainee', 'super_admin']}>
                <JudiciaryPage />
              </RoleBasedRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/training"
          element={
            <ProtectedRoute>
              <RoleBasedRoute allowedRoles={['mediator', 'trainee', 'super_admin']}>
                <TrainingPage />
              </RoleBasedRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/training/modules/:id"
          element={
            <ProtectedRoute>
              <RoleBasedRoute allowedRoles={['mediator', 'trainee', 'super_admin']}>
                <TrainingModulePage />
              </RoleBasedRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/training/cpd"
          element={
            <ProtectedRoute>
              <RoleBasedRoute allowedRoles={['mediator', 'trainee', 'super_admin']}>
                <CPDDashboardPage />
              </RoleBasedRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/training/scenarios/:scenarioId"
          element={
            <ProtectedRoute>
              <RoleBasedRoute allowedRoles={['mediator', 'trainee', 'super_admin']}>
                <PracticeScenarioPage />
              </RoleBasedRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/training/role-play"
          element={
            <ProtectedRoute>
              <RoleBasedRoute allowedRoles={['mediator', 'trainee', 'super_admin']}>
                <RolePlayPage />
              </RoleBasedRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/training/role-play/session/:sessionId"
          element={
            <ProtectedRoute>
              <RoleBasedRoute allowedRoles={['mediator', 'trainee', 'super_admin']}>
                <RolePlayPage />
              </RoleBasedRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/training/trainee-academy"
          element={
            <ProtectedRoute>
              <RoleBasedRoute allowedRoles={['mediator', 'trainee', 'super_admin']}>
                <TraineeTrainingPage />
              </RoleBasedRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/training/trainee-academy/article/:lessonId"
          element={
            <ProtectedRoute>
              <RoleBasedRoute allowedRoles={['mediator', 'trainee', 'super_admin']}>
                <TraineeArticlePage />
              </RoleBasedRoute>
            </ProtectedRoute>
          }
        />
        <Route path="/app" element={<RoleRedirect />} />
      </Routes>
    </BrowserRouter>
    </>
  );
}
