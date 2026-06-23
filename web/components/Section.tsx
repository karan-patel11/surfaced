export default function Section({
  eyebrow,
  title,
  children
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="section-rule mt-12">
      <div className="eyebrow mb-6">{eyebrow}</div>
      <h2 className="mb-9 font-serif text-[clamp(2.4rem,4vw,4.2rem)] font-semibold leading-none">
        {title}
      </h2>
      {children}
    </section>
  );
}
