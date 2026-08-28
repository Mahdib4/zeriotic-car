/**
 * Catalogue.tsx — the site underneath the film.
 *
 * Every vehicle, every specification, in plain semantic HTML. It is always
 * present in the document, which does three jobs at once:
 *
 *   1. Screen readers and crawlers get the whole range without needing to
 *      scrub a WebGL canvas.
 *   2. `prefers-reduced-motion` visitors get a complete, still, premium
 *      one-page site — CSS alone reveals it, no JavaScript branch required.
 *   3. If JavaScript never runs, this is the site.
 *
 * CSS hides this by default and a reduced-motion media query reveals it, which is
 * what visually hides this. Server component — ships no JavaScript.
 */

import { dealership, formatPrice, vehicles } from "@/lib/content";

export function Catalogue() {
  return (
    <div className="catalogue">
      <div className="static-site">
        <header className="static-hero">
          <p className="eyebrow">{dealership.wordmark.secondary}</p>
          <h1 className="display">{dealership.wordmark.primary}</h1>
          <p className="lede">{dealership.brandStatement}</p>
          <p className="body-muted">{dealership.about.body}</p>
          <div className="still" role="img" aria-label="The Axiom GT under showroom lighting" />
        </header>

        <section aria-labelledby="range-heading" style={{ display: "grid", gap: "1.5rem" }}>
          <h2 id="range-heading" className="model-name">
            The range
          </h2>

          {vehicles.map((v) => (
            <article className="static-vehicle" key={v.id} id={v.id}>
              <div style={{ display: "grid", gap: "1rem" }}>
                <div
                  className="still"
                  style={{ ["--accent" as string]: v.accentHex }}
                  role="img"
                  aria-label={`${v.name}, ${v.category}`}
                />
                <div>
                  <p className="eyebrow">{v.category}</p>
                  <h3 className="model-name" style={{ marginTop: "0.4rem" }}>
                    {v.name}
                  </h3>
                  <p className="lede" style={{ marginTop: "0.7rem", color: "var(--muted)" }}>
                    {v.tagline}
                  </p>
                  <p className="body-muted" style={{ marginTop: "0.7rem" }}>
                    {v.designStatement}
                  </p>
                </div>
              </div>

              <div>
                <dl className="spec-table" style={{ width: "100%" }}>
                  {v.fullSpecs.map((row) => (
                    <div className="spec-row" key={row.label}>
                      <dt>{row.label}</dt>
                      <dd>{row.value}</dd>
                    </div>
                  ))}
                </dl>

                <p className="eyebrow" style={{ marginTop: "1.4rem" }}>
                  Paint
                </p>
                <ul
                  style={{
                    listStyle: "none",
                    padding: 0,
                    margin: "0.5rem 0 0",
                    display: "grid",
                    gap: "0.2rem",
                  }}
                >
                  {v.paints.map((p) => (
                    <li key={p.id} className="spec-row">
                      <span>{p.name}</span>
                      <span className="mono">
                        {p.price === 0 ? "Included" : `+${formatPrice(p.price)}`}
                      </span>
                    </li>
                  ))}
                </ul>

                <p className="eyebrow" style={{ marginTop: "1.4rem" }}>
                  Trim
                </p>
                <ul style={{ listStyle: "none", padding: 0, margin: "0.5rem 0 0", display: "grid", gap: "0.6rem" }}>
                  {v.trims.map((t) => (
                    <li key={t.id}>
                      <div className="spec-row">
                        <span>{t.name}</span>
                        <span className="mono">
                          {t.price === 0 ? "Included" : `+${formatPrice(t.price)}`}
                        </span>
                      </div>
                      <p className="body-muted" style={{ fontSize: "var(--step--1)" }}>
                        {t.description}
                      </p>
                    </li>
                  ))}
                </ul>

                <p className="eyebrow" style={{ marginTop: "1.4rem" }}>
                  Packages
                </p>
                <ul style={{ listStyle: "none", padding: 0, margin: "0.5rem 0 0", display: "grid", gap: "0.6rem" }}>
                  {v.packages.map((p) => (
                    <li key={p.id}>
                      <div className="spec-row">
                        <span>{p.name}</span>
                        <span className="mono">+{formatPrice(p.price)}</span>
                      </div>
                      <p className="body-muted" style={{ fontSize: "var(--step--1)" }}>
                        {p.description}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}
