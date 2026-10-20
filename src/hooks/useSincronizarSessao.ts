import { useEffect } from 'react';
import { AuthService } from '@/services/auth.service';
import { useUserStore } from '@/store/useUserStore';

/**
 * Relê `/auth/me` uma vez quando o app abre com sessão salva (PER-21f).
 *
 * Papel, capacidades e permissões ficam no localStorage; sem reler, quem perdeu
 * (ou ganhou) acesso continuaria vendo o menu antigo até sair e entrar de novo.
 * Falha de rede não derruba nada: segue com o que estava salvo, e o 401 cai no
 * fluxo normal do interceptor.
 */
let jaSincronizou = false;

export function useSincronizarSessao() {
  const temUsuario = useUserStore((s) => !!s.user?.id);

  useEffect(() => {
    if (jaSincronizou || !temUsuario || !AuthService.getToken()) return;
    jaSincronizou = true;
    AuthService.getCurrentUser()
      .then((me) => {
        if (me && (me as { id?: string }).id) useUserStore.getState().setUser(me);
      })
      .catch(() => {
        // mantém a sessão salva
      });
  }, [temUsuario]);
}
