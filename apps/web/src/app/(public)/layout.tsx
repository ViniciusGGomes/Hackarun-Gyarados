export default function PublicLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <div className="h-2.5 bg-strip" />
      {children}
    </>
  )
}
