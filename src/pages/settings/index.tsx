import { Layout } from '@/components/common/Layout'
import { TitleCard } from '@/components/common/title-card'
import { AccountForm } from '@/features/configuracoes/perfil/account-form'

export function Settings() {
  return (
    <Layout>
      <Layout.Main>
        <TitleCard
          title={'Perfil'}
          description={'Gerencie seu perfil e suas informações pessoais.'}
          hiddenSelect
        />
        <AccountForm />
      </Layout.Main>
    </Layout>
  )
}