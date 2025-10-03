// app/components/TiledSection.tsx
export default function TiledSection({
  image = '/base.jpg',
  children,
}: {
  image?: string
  children: React.ReactNode
}) {
  return (
    <section
      style={{
        backgroundImage: `url('${image}')`,
        backgroundRepeat: 'repeat-y',
        backgroundPosition: 'center top',
        backgroundSize: '100% auto',
      }}
    >
      <div className="px-5 py-8">
        <div className="max-w-6xl mx-auto">{children}</div>
      </div>
    </section>
  )
}
