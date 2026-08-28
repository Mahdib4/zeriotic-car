# MASTER PROMPT — Cinematic Car Showroom Experience (Claude Code + Higgsfield)

Paste this whole document as one message to Claude Code (Higgsfield-connected). It plays the same role the interior-studio master prompt played: it is both the cinematic direction AND the dealership business/website spec in one piece — there is no separate storyboard-approval step for this one, this document is the full brief.

---

## YOUR ROLE

You are acting as four people at once on this project:

1. **Automotive Commercial Director / VFX Supervisor** — responsible for the "car comes to life" cinematic sequence, in the tradition of high-end automotive launch films (Porsche, Audi, Rivian, Polestar reveal films).
2. **3D Visualization / Motion Designer** — responsible for making mechanical assembly feel real: correct part order, correct physics of how things seat and lock, believable material behavior (metal, glass, carbon fiber, leather, rubber).
3. **Brand & Editorial Designer** — responsible for this reading as a real, premium dealership's digital showroom, not a car-configurator tech demo.
4. **Senior Next.js + Three.js Engineer** — responsible for building a production website where scroll drives the entire assembly, showcase, and showroom experience.

## THE CORE CONCEPT — "A Car Comes to Life"

This is not a website with a hero video of a car. This is a website where **the car does not exist until the visitor scrolls it into existence.**

The experience begins in a void — a dark, spotlit, empty space. Individual components float, separated, suspended: chassis rails, engine block, drivetrain, body panels, doors, hood, windows, headlights, grille, mirrors, seats, dashboard, steering wheel, exhaust system, wheels, tires. As the visitor scrolls, these components move, rotate, and slide together — smoothly, mechanically, believably — until the car is fully assembled. This is the automotive equivalent of the house building itself brick by brick: **the vehicle is the main character, and its construction is the story.**

## MOST IMPORTANT RULE

**Never show a static component waiting for the camera. Never show the camera simply orbiting a already-finished part.**

Every single moment must contain active mechanical motion: something sliding, rotating, seating, locking, igniting, or reflecting light differently as the camera moves. If a shot would otherwise be "camera moves past a stationary headlight," add motion — the headlight assembly self-focuses its lens elements, or the light activates as the camera passes. Nothing is ever frozen while the camera works around it.

---

## THE JOURNEY (Act Structure)

### Act 0 — The Void
Pure black/dark-grey space. A single volumetric spotlight cuts on. Individual components are visible, floating, softly rotating in place, cables/details barely visible in rim light. No dealership branding yet except a minimal wordmark that resolves out of lens flare/light streaks — the brand name assembles the way the car is about to.

### Act 1 — Mechanical Assembly
The camera moves slowly through the component field as pieces begin finding each other:
- Chassis rails and subframe assemble first, rising/locking from below
- Engine block and drivetrain lower into the chassis and seat with a mechanical settle
- Suspension and wheel wells attach
- Body panels fly in from the surrounding dark space and weld/seat into place, panel by panel (this is the direct equivalent of "brick by brick")
- Glass (windshield, windows) slides in and seals
- Doors swing in from the void and hang on their hinges
- Headlights, grille, mirrors self-assemble and activate (lights flicker on once seated)
- Interior becomes visible through the now-glazed windows: dashboard grows into place, seats slide in and settle, steering wheel locks onto the column
- Exhaust system seats at the rear
- Wheels and tires roll in from off-frame and mount, tires inflating/seating onto rims as a final beat
- Paint/finish "resolves" last — matte-to-gloss transition across the body as the final touch, like a coat being applied in real time

Camera throughout: continuous slow orbit + push, never cutting, rising slightly as the car completes, arriving at a 3/4 hero angle exactly as the last panel locks.

### Act 2 — Cinematic Showcase (Completed Car)
The camera now performs a full, slow, deliberate orbit around the completed vehicle — hero lighting, studio-quality reflections sweeping across the paint and glass as the camera moves, subtle rim light separating the car from the dark environment. As the orbit completes, key information resolves onto screen in sync with specific camera positions (not all at once):
- Model name (appears as camera settles on the 3/4 front angle)
- One-line design statement
- Key spec callouts appear near the part they describe as the camera passes it (horsepower callout near the hood/engine bay, 0–60 callout as the camera passes the wheels, interior material callout as camera glides past an open door)
- Price appears last, once the full orbit completes and the camera settles

### Act 3 — Showroom Expansion
The environment itself now builds around the finished car: floor material resolves (polished concrete or dark reflective stone), architectural lighting rigs lower from above and ignite, display platform forms beneath the vehicle, background architecture (minimal walls, glass, negative space) grows into place — echoing the "environment constructs itself" language from the interior project, but here it happens *after* the hero car exists, turning one car into an anchor for a full showroom.

As the environment completes, the camera pulls back and additional vehicles begin appearing in the depth of the space — not as a grid, but through **spatial reveal**:
- The hero car shifts slightly, catching new rim light, as the camera passes it
- A second vehicle (different category — SUV, sedan, EV, performance, off-road) is revealed coming into focus in the background as the camera glides past the hero car
- Transitions between vehicles use the same disassembly/reassembly language from Act 1 in miniature: as the camera approaches a new vehicle, its own components can be shown finishing their assembly, or the previous car's silhouette can dissolve into particles that reform as the next model — same "world transform" technique as the interior project's house-to-house transition
- Repeat this spatial reveal across the full lineup (Sports, SUV, Sedan, Luxury, EV, Performance, Off-Road) — camera never stops moving, never cuts

### Act 4 — Individual Model Exploration
For each vehicle the visitor lingers on (scroll-triggered, not click-triggered — lingering scroll speed slows the camera into a focused orbit of that one car), a condensed version of Act 1–2 plays: a few of that car's signature components get a quick assembly beat (unique to what makes that model distinctive — e.g. the EV's battery pack sliding into the floorpan and illuminating, the off-road vehicle's suspension articulating and lifting, the performance car's rear wing deploying), followed by its own spec/price reveal.

### Act 5 — Specifications & Configuration Layer
Woven into the showroom lighting itself (not a separate "specs page"): as the visitor scrolls past a given vehicle, trim level and color options can be shown by the car's paint/material actually shifting in real time (color swatches trigger the paint finish to change on the model), with pricing updating alongside. This should feel like operating actual showroom lighting/turntable controls, not filling out a form.

### Act 6 — Contact / Inquiry / Closing
Camera rises out of the showroom (echoing the interior project's rooftop-exit epilogue), revealing the full showroom and lineup from above as one composed shot. Dealership identity resolves fully here: name, tagline, "Book a Test Drive" / "Request a Quote" CTA, financing note, location, contact details, social links. This is the one moment allowed to feel like a clean, final "page" — the film has ended, the invitation begins.

---

## CAMERA, MATERIAL & LIGHTING CONTINUITY BIBLE

| Phase | Lens | Camera height/distance | Move speed | Lighting mood |
|---|---|---|---|---|
| Act 0 — Void | 35mm | Eye-level, close to components (0.8–1.5m) | Very slow drift, 0.15 m/s | Near-black with single volumetric spotlight |
| Act 1 — Assembly | 35mm | Rises gradually 1.2m → 1.8m as car completes | 0.2–0.3 m/s | Cool key light + warm practical highlights on welds/seams |
| Act 2 — Showcase orbit | 50mm | Fixed 1.6m, orbiting at constant radius | Constant slow orbit, 0.2 m/s angular | Studio three-point — soft key, rim light, subtle fill; reflections must sweep believably as camera moves |
| Act 3 — Showroom expansion | 28mm (wider, to sell scale) | Rises to 2.5–4m for spatial reveals | 0.25–0.35 m/s | Architectural — cool ambient base, dramatic accent spots per vehicle |
| Act 4 — Individual exploration | 50mm | Returns to 1.6m orbit per car | 0.2 m/s | Same three-point studio setup as Act 2, tuned per vehicle's category (warmer for luxury, cooler/sharper for performance/EV) |
| Act 6 — Epilogue | 24mm | Rises from 2m to 15m+ (aerial) | 0.2 m/s rise | Full showroom lighting revealed, dealership signage/branding visible in environment |

**Hand-off rule (identical to the interior project):** the last frame of every clip must match the first frame of the next in camera position, lens, and lighting state. Extract last frames via ffmpeg and feed them as init frames into Higgsfield for the next generation — this is what makes scroll feel like one continuous film rather than a cut-together sequence.

**Material rule:** paint, glass, and chrome must show *consistent* environment reflections across cuts — if the void is dark with one spotlight in Act 0–1, that same light source must be traceable in the reflections through Act 2, even as the environment builds around it in Act 3.

---

## CONTENT INTEGRATION MAP (Dealership Business Content)

Exactly like the interior project, content does not get separate pages — it rides on existing camera holds:

| Beat | Business content that appears here |
|---|---|
| Act 0 fog/light resolve | Dealership wordmark + one-line brand statement (e.g. "Every car we sell, we build in front of you.") |
| End of Act 1 (car fully assembled, before orbit begins) | Nothing yet — let the completed car breathe for a beat first |
| Act 2 orbit | Model name, design statement, spec callouts tied to physical parts, price — as detailed above |
| Act 3 environment construction | Short "About the Dealership" line — years in business, specialization, service philosophy |
| Act 3 spatial reveals between vehicles | Category labels only (Sports / SUV / Sedan / Luxury / EV / Performance / Off-Road) — no paragraph copy here, motion carries it |
| Act 4 per-vehicle exploration | Full spec sheet per model (horsepower, torque, 0–60, range/MPG, seating, starting price) |
| Act 5 configuration beats | Trim/color/package options and live price updates |
| Act 6 epilogue | Full contact section: dealership name, address, phone, hours, financing note, "Book a Test Drive" and "Request a Quote" CTAs, social links, and 2–3 short customer testimonials |

Do not add customer testimonials or long brand copy anywhere in Act 1–2 — the assembly and first showcase must stay purely visual and mechanical. Save all voice/trust content for Act 3 onward, once the "wow" has already landed.

---

## CONTENT & COPY REQUIREMENTS

Provide (placeholder-quality, premium-toned) copy for:
- Dealership name + wordmark treatment
- One-line brand statement + one-paragraph "About" statement
- 6–7 vehicle entries (one per category: Sports, SUV, Sedan, Luxury, EV, Performance, Off-Road) each with: model name, tagline, 4–6 key specs, starting price
- Financing/CTA copy ("Book a Test Drive," "Request a Quote," "Explore Financing")
- 2–3 short customer testimonials
- Contact block: address, phone, hours, social links

Voice: confident, technical, restrained — think a premium automotive brand's own site (Porsche, Polestar, Rivian) rather than a used-car-lot ad. No exclamation points, no "unbeatable deals" language.

Structure this as a single `content.ts`/`content.json` file, one object per vehicle, so adding/removing models later doesn't touch layout or animation code.

---

## TECHNICAL BUILD REQUIREMENTS

**Stack:** Next.js App Router, GSAP + ScrollTrigger, Lenis (smooth scroll), Framer Motion (UI/text micro-interactions only), Three.js / React Three Fiber for the layer that needs true real-time interactivity (per-vehicle color/trim swapping in Act 5, and any hover/orbit-drag exploration you add to Act 4) — everything else (assembly, showroom builds, transitions) is Higgsfield-generated cinematic video, scroll-scrubbed exactly as in the interior project.

**Scroll architecture:**
- One continuous route, one master ScrollTrigger timeline, pinned per Act/beat as scoped above
- Video clips scrubbed by scroll position (`video.currentTime` bound to scroll progress) — never autoplayed
- Spec/content overlays are separate DOM layers, absolutely positioned over the pinned canvas, faded via GSAP synced to scroll progress
- The one Three.js-driven layer (color/trim swap) takes over only during Act 5 for the vehicle currently in focus, then hands back to video for the next transition — the seam between video-driven and real-time-driven layers must be invisible (same lighting state, same camera position at handoff)
- Shot manifest (Shot ID → filename → scroll-percentage range) drives which clip and which overlay is active at any scroll position, same pattern as the interior project

**Higgsfield integration:**
- Generate all Act 0–3 and Act 6 clips using the seed-frame chaining method (extract last frame via ffmpeg, feed as init frame for the next clip) to guarantee the hand-off rule above
- Respect the Continuity Bible's lens/height/speed/lighting locks per phase
- Store assets with a clear naming convention (`[Vehicle]-[Act]-[###]_[description].mp4`) plus a CSV manifest mapping shot → file → scroll range

**HARD CONSTRAINT — Higgsfield credit budget: 400 credits total, no exceptions.**
This budget covers every generation for the entire site — first passes and any re-generations/corrections. Before generating a single clip, do the following, in order:

1. **Cost out the full shot list first.** Write out every planned Higgsfield generation with its estimated credit cost (check current Higgsfield pricing/credit-cost-per-generation before assuming a number), running total, and confirm the total against the 400-credit ceiling. Present this budget breakdown back before generating anything — do not start burning credits on a shot list that hasn't been reconciled against the cap.
2. **Hold back a correction buffer.** Target the first-pass plan at roughly 320–340 credits, leaving the remainder for re-generating any clip that breaks continuity (bad hand-off frame, lighting mismatch, artifact) rather than assuming every generation succeeds on the first try.
3. **Tier the shots by priority, and only fully hero-generate the top tier:**
   - **Tier 1 (must be full Higgsfield cinematic video, no shortcuts):** Act 0 void, the complete Act 1 assembly sequence for ONE flagship vehicle only, that same vehicle's Act 2 orbit showcase, and the Act 6 epilogue. This is the sequence that has to deliver the "wow" — do not thin this out.
   - **Tier 2 (abbreviated Higgsfield generation):** Act 3 showroom construction, and the spatial-reveal/dissolve transitions between vehicles — use fewer, longer single generations rather than many short ones (consolidate hand-off pairs wherever Higgsfield's max clip length allows, since every additional generation call consumes budget regardless of how short the clip is).
   - **Tier 3 (do NOT spend Higgsfield credits here — build these with real-time Three.js/GSAP instead):** the other six vehicles' Act 4 exploration beats. Rather than a full teardown-rebuild per car, model these in Three.js with real geometry and drive their "signature component" motion (battery pack sliding in, suspension articulating, wing deploying) with code-driven animation, not generative video. This is the single biggest budget saver in the plan, and it also means adding or swapping a model later doesn't cost any credits at all.
   - **Act 5 configurator (color/trim swap):** already scoped as real-time Three.js, not Higgsfield — keep it that way; this line item should cost zero credits.
4. **Reuse before regenerating.** If two vehicles share a plausible transition pattern (e.g. two sedans dissolving into each other), reuse or lightly re-grade one generated clip rather than generating a bespoke one for each pairing.
5. **If the reconciled shot list still exceeds 400 credits after steps 1–4,** cut scope by reducing Tier 1 to a shorter assembly sequence (fewer components shown assembling individually, grouped into larger sub-assemblies) before cutting Tier 1 out entirely — the flagship car's build sequence is the one thing this project cannot ship without.

**UI/branding layer:**
- Floating minimal navigation: dealership mark + subtle progress indicator (not a conventional nav bar)
- Typography: one confident sans/geometric face for specs/UI, a slightly heavier weight for model names — futuristic but restrained, not "gamer" styling
- Dark base palette throughout, with each vehicle category getting a distinct accent tone in its lighting (used consistently in Act 4)
- No autoplay sound, no popups

**Performance & accessibility:**
- Lazy-load upcoming clips just ahead of scroll position; preload next hand-off pair
- Compress video aggressively without visible loss on continuity-critical hand-off frames, and without visible loss on paint/chrome reflections (these are the most quality-sensitive assets in the whole project — test compression on these first)
- Full `prefers-reduced-motion` fallback: static key-frame stills plus all spec/contact content laid out as a conventional but still premium one-page site
- Target 60fps scroll on desktop; on mobile, fall back the Act 5 real-time Three.js color-swap layer to pre-rendered color variant clips instead of live 3D if performance requires it
- All spec/content text fully readable and screen-reader accessible over video — proper contrast, semantic HTML underneath

---

## WHAT SUCCESS LOOKS LIKE

A visitor scrolls in to darkness and a few floating parts, and within seconds watches a complete car assemble itself in front of them — mechanically, believably, dramatically. Without ever feeling like they left that world, they orbit the finished car and absorb its specs, watch a full showroom construct around it, discover six more vehicles across every category the dealership sells, explore the one that catches their eye down to trim and color, and end at a clear, confident invitation to book a test drive or request a quote. They should walk away able to name the dealership, describe what makes it different, and know exactly how to take the next step.

---

## DELIVERABLES FOR THIS SESSION

1. A full shot list with estimated Higgsfield credit cost per clip and a running total, reconciled against the 400-credit ceiling per the budget rules above — this comes back to me for approval before any generation happens.
2. Project scaffold (Next.js App Router) with the master scroll/pin architecture wired to placeholder clips first, so assembly timing and hand-offs can be validated before real Higgsfield renders exist.
3. `content.ts`/`content.json` with full dealership + per-vehicle copy per the requirements above.
4. Shot manifest CSV wired to the ScrollTrigger timeline.
5. A short README covering: how to swap in final Higgsfield clips once generated, how the Act 5 real-time color/trim layer hands off to/from video, how the Tier 3 vehicles' real-time Three.js assembly differs from the Tier 1 flagship's Higgsfield footage, and how to edit the content file.

Confirm this plan back briefly, then start with the project scaffold and placeholder-driven scroll timeline before generating real Higgsfield assets.
