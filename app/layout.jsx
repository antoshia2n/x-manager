export const metadata = {
  title: 'X Manager',
  description: 'X運用管理ツール',
}
export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  )
}
