// Remounts on every navigation, so each page gently fades in.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="gs-fade-in">{children}</div>;
}
