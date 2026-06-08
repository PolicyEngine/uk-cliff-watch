import './globals.css';

export const metadata = {
  title: 'UK CliffWatch — Benefit Cliff & Marginal Tax Rate Explorer',
  description:
    'Visualise UK benefit cliffs, Universal Credit taper rates, and effective marginal tax rates across the earnings spectrum. Powered by PolicyEngine UK.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en-GB">
      <body>{children}</body>
    </html>
  );
}
