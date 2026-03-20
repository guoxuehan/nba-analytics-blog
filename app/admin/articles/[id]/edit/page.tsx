import { notFound } from 'next/navigation'
import { getAdminArticle } from '../../_actions'
import { ArticleEditor } from '@/app/admin/_components/ArticleEditor'

export default async function EditArticlePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const article = await getAdminArticle(id)

  if (!article) notFound()

  return <ArticleEditor initialData={article} />
}
