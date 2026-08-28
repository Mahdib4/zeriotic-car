/**
 * Epilogue.tsx — Act 6, once the film has ended.
 *
 * The one screen in the whole experience allowed to behave like a
 * conventional page: real semantic HTML, real headings, real links. It
 * scrolls up over the final aerial. Everything the brief asks a visitor to
 * walk away knowing lives here.
 *
 * This is a server component — no interactivity, so it ships no JavaScript.
 */

import { dealership } from "@/lib/content";
import { RevealOnScroll } from "./RevealOnScroll";

export function Epilogue() {
  const { contact, cta, testimonials, about, financingNote } = dealership;

  return (
    <section className="epilogue" id="contact">
      <RevealOnScroll className="epilogue-inner">
        <div className="epilogue-head">
          <h2 className="display">{dealership.name}</h2>
          <p className="lede">{dealership.brandStatement}</p>
          <p className="body-muted">{about.body}</p>
          <div className="cta-row">
            <a className="cta cta-primary" href={cta.primary.href} id="book">
              {cta.primary.label}
            </a>
            <a className="cta" href={cta.secondary.href} id="quote">
              {cta.secondary.label}
            </a>
            <a className="cta" href={cta.tertiary.href} id="financing">
              {cta.tertiary.label}
            </a>
          </div>
          <p className="body-muted" style={{ fontSize: "var(--step--1)" }}>
            {financingNote}
          </p>
        </div>

        <div className="grid-3">
          <div className="contact-block">
            <h3>Showroom</h3>
            <address style={{ fontStyle: "normal" }}>
              {contact.address.map((line) => (
                <div key={line}>{line}</div>
              ))}
            </address>
            <p style={{ marginTop: "0.8rem" }}>
              <a href={`tel:${contact.phone.replace(/\s/g, "")}`}>{contact.phone}</a>
            </p>
            <p>
              <a href={`mailto:${contact.email}`}>{contact.email}</a>
            </p>
          </div>

          <div className="contact-block">
            <h3>Hours</h3>
            <ul>
              {contact.hours.map((h) => (
                <li key={h.days}>
                  <span style={{ color: "var(--muted)" }}>{h.days}</span>
                  <span style={{ float: "right" }} className="mono">
                    {h.time}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="contact-block">
            <h3>Follow</h3>
            <ul>
              {contact.social.map((s) => (
                <li key={s.label}>
                  <a href={s.href} rel="noopener noreferrer" target="_blank">
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="grid-3">
          {testimonials.map((t) => (
            <figure className="testimonial" key={t.author}>
              <blockquote>{t.quote}</blockquote>
              <figcaption>
                <cite>
                  {t.author} — {t.detail}
                </cite>
              </figcaption>
            </figure>
          ))}
        </div>

        <div className="colophon">
          <span>
            © {new Date().getFullYear()} {dealership.name}
          </span>
          <span className="build-credit">
            {dealership.credit.prefix}{" "}
            <a
              href={dealership.credit.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              {dealership.credit.name}
            </a>
          </span>
          <span>Vehicles shown are illustrative. Specifications subject to change.</span>
        </div>
      </RevealOnScroll>
    </section>
  );
}
