import { Layout } from '@/components/common/Layout'
import { TitleCard } from '@/components/common/title-card'
import { AccountForm } from '@/features/configuracoes/perfil/account-form'

export function Settings() {
  return (
    <Layout>
      <Layout.Main>
        <div className="flex flex-col w-full">
          <TitleCard
            title={'Perfil'}
            description={'Gerencie seu perfil e suas informações pessoais.'}
          />
          <AccountForm />
        </div>
      </Layout.Main>
    </Layout>
  )
}
