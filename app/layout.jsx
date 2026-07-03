import './globals.css';

export const metadata = {
  title: 'Painel Suprimentos 2026 - Compras Ageis',
  description: 'Painel de indicadores de suprimentos, produtividade, aging, SLA e saving.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
