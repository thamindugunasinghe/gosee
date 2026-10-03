// Shared layout + simple typography for the public legal/support pages.
import Link from "next/link";
import { LogoFull } from "@/components/Logo";

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated?: string;
  children: React.ReactNode;
}) {
  return (
    <main style={{ minHeight: "100vh", background: "#f4f6fb" }}>
      <div style={{ background: "linear-gradient(135deg,#0a2a5e,#071e45)", padding: "22px 0" }}>
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 20px" }}>
          <Link href="/">
            <span style={{ display: "inline-block", background: "#fff", borderRadius: 10, padding: "8px 12px" }}>
              <LogoFull className="" />
            </span>
          </Link>
        </div>
      </div>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "28px 20px 64px" }}>
        <h1 style={{ color: "#0b1b3a", fontSize: 30, fontWeight: 800, margin: "4px 0 2px" }}>{title}</h1>
        {updated && <p style={{ color: "#5b6272", fontSize: 13, marginBottom: 18 }}>Last updated: {updated}</p>}
        <div style={{ color: "#1f2a44", fontSize: 15, lineHeight: 1.65 }}>{children}</div>
        <p style={{ marginTop: 36, fontSize: 13, color: "#8b93a7" }}>GoSee</p>
      </div>
    </main>
  );
}

export function H2({ children }: { children: React.ReactNode }) {
  return <h2 style={{ color: "#0a2a5e", fontSize: 19, fontWeight: 700, margin: "26px 0 8px" }}>{children}</h2>;
}

export function P({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: "0 0 12px" }}>{children}</p>;
}

export function UL({ items }: { items: string[] }) {
  return (
    <ul style={{ margin: "0 0 12px", paddingLeft: 22 }}>
      {items.map((t, i) => (
        <li key={i} style={{ marginBottom: 6 }}>
          {t}
        </li>
      ))}
    </ul>
  );
}
