export default function GlassCard({
  children,
  className = "",
  glow = false,
  ...props
}) {
  return (
    <section
      className={`glass-panel ${glow ? "glass-glow" : ""} ${className}`}
      {...props}
    >
      {children}
    </section>
  );
}
