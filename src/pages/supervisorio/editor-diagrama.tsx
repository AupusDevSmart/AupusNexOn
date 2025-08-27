import { Layout } from "@/components/common/Layout";
import { EditorDiagramaUnifilar } from "@/features/supervisorio/components/editor-diagrama";

export function EditorDiagramaPage() {
  return (
    <Layout>
      <Layout.Main className="w-full h-screen p-0">
        <EditorDiagramaUnifilar />
      </Layout.Main>
    </Layout>
  );
}
