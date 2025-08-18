import { useUserStore } from '@/store/useUserStore';
import { Permissao } from '@/types/dtos/usuarios-dto';
import { type ReactNode, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

type FeatureWrapperProps = {
  feature: Permissao;
  children: ReactNode;
};

export function FeatureWrapper({ feature, children }: FeatureWrapperProps) {
  const navigate = useNavigate();
  const { acessivel } = useUserStore();

  useEffect(() => {
    // if (acessivel && !acessivel.includes(feature)) {
    //   navigate('/', { replace: true });
    // }
  }, [acessivel, feature, navigate]);

  return children;
}