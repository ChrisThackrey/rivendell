export default function GantLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className="min-h-screen bg-background">{children}</div>;
}

export const metadata = {
  title: "Gantt Chart | Project Roadmap",
  description: "Interactive Gantt chart for project planning and management",
};
