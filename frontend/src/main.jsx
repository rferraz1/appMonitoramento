import React from 'react';
import ReactDOM from 'react-dom/client';
import { Navigate, RouterProvider, createBrowserRouter } from 'react-router-dom';
import './index.css';
import { AuthProvider } from './context/AuthContext.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import { Layout } from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Cameras from './pages/Cameras.jsx';
import Cadastros from './pages/Cadastros.jsx';
import Analitico from './pages/Analitico.jsx';
import Relatorios from './pages/Relatorios.jsx';
import ExcelIntegracao from './pages/ExcelIntegracao.jsx';
import Usuarios from './pages/Usuarios.jsx';

const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <Layout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'cameras', element: <Cameras /> },
      { path: 'cadastros', element: <Cadastros /> },
      { path: 'analitico', element: <Analitico /> },
      { path: 'relatorios', element: <Relatorios /> },
      { path: 'excel', element: <ExcelIntegracao /> },
      { path: 'usuarios', element: <Usuarios /> }
    ]
  },
  { path: '*', element: <Navigate to="/" replace /> }
]);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </React.StrictMode>
);
