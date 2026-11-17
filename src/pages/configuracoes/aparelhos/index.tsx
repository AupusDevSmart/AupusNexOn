import { Layout } from '@/components/common/Layout';
import { TitleCard } from '@/components/common/title-card';
import { AparelhosTodos } from '@/features/supervisorio/cameras/components/AparelhosTodos';
import { useUserStore } from '@/store/useUserStore';

/** Configurações › Aparelhos: todos os Raspberry das câmeras, de todas as usinas (só administrador). */
export default function ConfiguracoesAparelhos() {
  const papel = useUserStore((s) => s.papel);
  return (
    <Layout>
      <Layout.Main>
        <div className="flex h-full w-full flex-col">
          <TitleCard
            title="Aparelhos das câmeras"
            description="Todos os Raspberry de todas as usinas: versão, contato e câmeras. Atualize, reinicie e veja os registros pela internet."
          />
          {papel === 'admin' ? (
            <AparelhosTodos />
          ) : (
            <p className="rounded-xl border border-border p-6 text-sm text-muted-foreground">Só o administrador vê esta tela.</p>
          )}
        </div>
      </Layout.Main>
    </Layout>
  );
}
