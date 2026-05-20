import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "TCG Backend",
  description: "API y servicios de TCG Hub.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
