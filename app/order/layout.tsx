import TopBar from '@/components/TopBar'
import FloatingCartButton from '@/components/FloatingCartButton'

export default function OrderLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <TopBar />
      {children}
      <FloatingCartButton />
    </>
  )
}