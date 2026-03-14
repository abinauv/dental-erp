export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="h-screen overflow-y-auto bg-gradient-to-br from-primary/5 via-background to-primary/5">
      <div className="min-h-screen flex items-center justify-center py-8">
        <div className="w-full max-w-md px-4">
          {children}
        </div>
      </div>
    </div>
  )
}
