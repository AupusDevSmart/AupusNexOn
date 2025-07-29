import { useUserStore } from '@/store/useUserStore';
import { Navigate } from 'react-router-dom';

export function DefaultRedirect() {
  const { user } = useUserStore();

  if (!user) {
    return <Navigate to="/login" />;
  }

  const userRole = user.roles[0]?.name;

  switch (userRole) {
    case 'super_admin':
      return <Navigate to="/monitoramento-de-clientes" />;
    case 'admin':
      return <Navigate to="/monitoramento-de-clientes" />;
    case 'cativo':
      return <Navigate to="/monitoramento-de-consumo" />;
    case 'corretor':
      return <Navigate to="/prospeccao" />;
    case 'associado':
      return <Navigate to="/area-do-associado" />;
    case 'proprietario':
      return <Navigate to="/area-do-proprietario" />;
    default:
      return;
  }
}