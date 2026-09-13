/* GoSee brand logos — the real brand assets from /public.
   LogoFull = the horizontal "GO SEE" lockup; LogoIcon = the square pin mark. */

export function LogoFull({ className = "w-44 h-auto" }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/dashboardlogo.png" alt="GoSee" className={className} />;
}

export function LogoIcon({ className, size = 40 }: { className?: string; size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src="/applogo.png"
      alt="GoSee"
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={className}
    />
  );
}
