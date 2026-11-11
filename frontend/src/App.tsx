import { Link, Route, Routes } from 'react-router';
import { Layout } from './components/Layout';
import { RequireGroup } from './components/RequireGroup';
import { EmptyState } from './components/ui';
import { Catalog } from './pages/Catalog';
import { ProjectDetail } from './pages/ProjectDetail';
import { MyDonations } from './pages/MyDonations';
import { Manage } from './pages/Manage';
import { Audit } from './pages/Audit';
import { Callback } from './pages/Callback';

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Catalog />} />
        <Route path="proyectos/:projectId" element={<ProjectDetail />} />
        <Route path="callback" element={<Callback />} />
        <Route
          path="mis-donaciones"
          element={
            <RequireGroup group="DONANTE">
              <MyDonations />
            </RequireGroup>
          }
        />
        <Route
          path="gestion"
          element={
            <RequireGroup group="GESTOR">
              <Manage />
            </RequireGroup>
          }
        />
        <Route
          path="auditoria"
          element={
            <RequireGroup group="AUDITOR">
              <Audit />
            </RequireGroup>
          }
        />
        <Route
          path="*"
          element={
            <EmptyState title="Página no encontrada">
              <Link to="/" className="font-semibold text-terra-700 underline">
                Volver al inicio
              </Link>
            </EmptyState>
          }
        />
      </Route>
    </Routes>
  );
}
