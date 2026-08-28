/**
 * content.ts — single source of truth for every word and number on this site.
 *
 * Nothing in here knows about layout, scroll position, or animation. Add,
 * remove or reorder a vehicle and the timeline, the shot manifest and the 3D
 * lineup all re-derive from this file. See README, "Editing the content file".
 */

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type CategoryId =
  | "sports"
  | "suv"
  | "sedan"
  | "luxury"
  | "ev"
  | "performance"
  | "offroad";

/** Which production path renders this vehicle. Drives the shot manifest. */
export type RenderTier =
  /** Tier 1 — full Higgsfield cinematic assembly + orbit. Exactly one vehicle. */
  | "higgsfield-hero"
  /** Tier 3 — real-time Three.js only. Costs zero Higgsfield credits. */
  | "realtime";

/** Which physical part of the car a spec callout should sit next to. */
export type PartAnchor =
  | "hood"
  | "wheels"
  | "door"
  | "rear"
  | "cabin"
  | "underbody";

export interface SpecRow {
  label: string;
  value: string;
  /** Act 2 places this callout near the anchored part as the camera passes it. */
  anchor: PartAnchor;
}

export interface PaintOption {
  id: string;
  name: string;
  hex: string;
  /** Metal flake amount, 0–1. Drives material metalness. */
  metallic: number;
  /** Price delta in USD applied to the configured total. */
  price: number;
}

export interface TrimOption {
  id: string;
  name: string;
  description: string;
  /** Cabin material colour used by the real-time interior. */
  interiorHex: string;
  brightwork: "chrome" | "satin" | "gloss-black";
  price: number;
}

export interface PackageOption {
  id: string;
  name: string;
  description: string;
  price: number;
}

/**
 * The one component that makes this model distinctive. In Act 4 this part gets
 * its own animated beat, driven by code — never by generated video.
 */
export type SignatureMove =
  | "battery-slide" // EV battery pack slides into the floorpan and lights
  | "suspension-lift" // off-road suspension articulates and raises the body
  | "wing-deploy" // active rear wing rises to its high-downforce angle
  | "door-present" // luxury door opens slowly to present the cabin
  | "grille-shutter" // active aero shutters cycle across the grille
  | "seat-recline" // rear lounge seat reclines
  | "quad-exhaust"; // exhaust valves open, tips glow with heat

/** Body dimensions in metres. Feeds the procedural vehicle builder directly. */
export interface Proportions {
  bodyLength: number;
  bodyWidth: number;
  /** Ground clearance to the underside of the floorpan. */
  rideHeight: number;
  /** Top of the lower body / bottom of the glass. */
  beltlineY: number;
  /** Top of the roof. */
  roofY: number;
  /** Z of the base of the windscreen (positive = toward the nose). */
  cabinFront: number;
  /** Z of the base of the rear glass. */
  cabinRear: number;
  /** How much narrower the greenhouse is than the body, 0–1. */
  roofTaper: number;
  wheelbase: number;
  track: number;
  wheelRadius: number;
  tireWidth: number;
  /** Nose height relative to the beltline, 0–1. Lower = more wedge. */
  noseDrop: number;
}

export interface Vehicle {
  id: CategoryId;
  /** Shown as the category label during Act 3 spatial reveals. */
  category: string;
  name: string;
  tagline: string;
  /** One-line design statement, revealed on the Act 2 / Act 4 hero angle. */
  designStatement: string;
  startingPrice: number;
  /** Four callouts tied to physical parts. Used in Act 2 / Act 4 orbits. */
  specs: SpecRow[];
  /** Full sheet shown in Act 4. Superset of `specs`. */
  fullSpecs: { label: string; value: string }[];
  paints: PaintOption[];
  trims: TrimOption[];
  packages: PackageOption[];
  signatureMove: SignatureMove;
  /** Accent tone for this category's lighting. Used consistently in Act 4. */
  accentHex: string;
  /** Key light colour. Warmer for luxury, cooler for performance and EV. */
  keyLightHex: string;
  proportions: Proportions;
  renderTier: RenderTier;
}

/* ------------------------------------------------------------------ */
/* Dealership                                                          */
/* ------------------------------------------------------------------ */

export const dealership = {
  name: "Meridian Motorworks",
  wordmark: { primary: "MERIDIAN", secondary: "MOTORWORKS" },
  brandStatement: "Every car we sell, we build in front of you.",
  /** Build credit, shown once at the close of the film. */
  credit: {
    prefix: "Crafted by",
    name: "Zeriotic",
    href: "https://zeriotic.com/",
  },
  about: {
    heading: "Twenty-two years, one method",
    body:
      "Meridian Motorworks has specified, sourced and delivered performance and " +
      "luxury vehicles since 2003. We hold a deliberately small floor — seven " +
      "cars, one per discipline — because we would rather know every vehicle we " +
      "sell completely than carry a hundred we know partially. Every car is " +
      "stripped, inspected and reassembled on site before it reaches the floor. " +
      "You are welcome to watch.",
  },
  cta: {
    primary: { label: "Book a Test Drive", href: "#book" },
    secondary: { label: "Request a Quote", href: "#quote" },
    tertiary: { label: "Explore Financing", href: "#financing" },
  },
  financingNote:
    "Structured lease and balloon finance available on all models, 24 to 60 " +
    "months. Rates are quoted after a soft credit check that does not affect " +
    "your score.",
  contact: {
    address: ["Meridian Motorworks", "4 Kellerman Yard", "Salford Quays, M50 3AZ"],
    phone: "+44 161 555 0142",
    email: "floor@meridianmotorworks.com",
    hours: [
      { days: "Monday to Friday", time: "09:00 – 19:00" },
      { days: "Saturday", time: "09:00 – 17:00" },
      { days: "Sunday", time: "By appointment" },
    ],
    social: [
      { label: "Instagram", href: "https://instagram.com" },
      { label: "YouTube", href: "https://youtube.com" },
      { label: "LinkedIn", href: "https://linkedin.com" },
    ],
  },
  testimonials: [
    {
      quote:
        "They took the car apart in front of me before they would let me buy " +
        "it. No other dealer has ever done that.",
      author: "R. Okonjo",
      detail: "Sovereign owner, three years",
    },
    {
      quote:
        "I arrived knowing what I wanted and left with something better argued. " +
        "They will talk you out of things.",
      author: "H. Lindqvist",
      detail: "Apex RS owner",
    },
    {
      quote:
        "Service bookings are honest about time. That is rarer than it should be.",
      author: "D. Marchetti",
      detail: "Terra owner, two vehicles",
    },
  ],
} as const;

/* ------------------------------------------------------------------ */
/* Vehicles — array order is the order of the Act 3 spatial reveal      */
/* ------------------------------------------------------------------ */

export const vehicles: Vehicle[] = [
  {
    id: "sports",
    category: "Sports",
    name: "Axiom GT",
    tagline: "Nothing between intention and asphalt.",
    designStatement:
      "A mid-engined shape drawn around the driver's sightline, then given the " +
      "smallest body that would still contain it.",
    startingPrice: 214_500,
    renderTier: "higgsfield-hero",
    specs: [
      { label: "Horsepower", value: "612 hp", anchor: "hood" },
      { label: "0–60 mph", value: "3.1 s", anchor: "wheels" },
      { label: "Cabin", value: "Anodised alloy and Nappa", anchor: "door" },
      { label: "Kerb weight", value: "1,428 kg", anchor: "underbody" },
    ],
    fullSpecs: [
      { label: "Engine", value: "4.0L twin-turbo flat-six" },
      { label: "Horsepower", value: "612 hp at 6,750 rpm" },
      { label: "Torque", value: "580 lb-ft at 2,300 rpm" },
      { label: "0–60 mph", value: "3.1 s" },
      { label: "Top speed", value: "205 mph" },
      { label: "Economy", value: "21 mpg combined" },
      { label: "Transmission", value: "8-speed dual-clutch" },
      { label: "Seating", value: "2" },
      { label: "Kerb weight", value: "1,428 kg" },
      { label: "Starting price", value: "$214,500" },
    ],
    paints: [
      { id: "graphite", name: "Graphite Solid", hex: "#2A2D31", metallic: 0.35, price: 0 },
      { id: "arctic", name: "Arctic White", hex: "#E8E9EA", metallic: 0.2, price: 1_900 },
      { id: "ember", name: "Ember Metallic", hex: "#C4451F", metallic: 0.85, price: 4_200 },
      { id: "abyss", name: "Abyss Blue", hex: "#16304F", metallic: 0.8, price: 4_200 },
    ],
    trims: [
      {
        id: "gt",
        name: "GT",
        description: "Nappa leather, alloy shift paddles, 20-inch forged wheels.",
        interiorHex: "#3A3027",
        brightwork: "satin",
        price: 0,
      },
      {
        id: "gt-lightweight",
        name: "GT Lightweight",
        description: "Carbon shell seats, titanium exhaust, 41 kg removed.",
        interiorHex: "#1C1E22",
        brightwork: "gloss-black",
        price: 28_000,
      },
    ],
    packages: [
      {
        id: "ceramic",
        name: "Carbon-ceramic brakes",
        description: "410 mm front discs, six-piston monobloc calipers.",
        price: 9_400,
      },
      {
        id: "lift",
        name: "Front axle lift",
        description: "40 mm of extra clearance in 2.5 seconds.",
        price: 3_100,
      },
    ],
    signatureMove: "quad-exhaust",
    accentHex: "#FF6B35",
    keyLightHex: "#DCE6F2",
    proportions: {
      bodyLength: 4.52,
      bodyWidth: 1.96,
      rideHeight: 0.11,
      beltlineY: 0.86,
      roofY: 1.22,
      // Cab-forward: the cabin sits ahead of centre so the engine can live
      // behind it, which is what makes the mid-engined claim true in the
      // silhouette rather than only in the copy.
      cabinFront: 0.72,
      cabinRear: -0.62,
      roofTaper: 0.2,
      wheelbase: 2.62,
      track: 1.68,
      wheelRadius: 0.36,
      tireWidth: 0.32,
      noseDrop: 0.36,
    },
  },
  {
    id: "suv",
    category: "SUV",
    name: "Terra",
    tagline: "Command without compromise.",
    designStatement:
      "Upright, square-shouldered and unapologetic about the space it takes. " +
      "Everything inside it sits where your hand already expects it.",
    startingPrice: 96_800,
    renderTier: "realtime",
    specs: [
      { label: "Horsepower", value: "462 hp", anchor: "hood" },
      { label: "0–60 mph", value: "5.4 s", anchor: "wheels" },
      { label: "Seating", value: "7", anchor: "cabin" },
      { label: "Towing", value: "3,500 kg", anchor: "rear" },
    ],
    fullSpecs: [
      { label: "Engine", value: "3.0L inline-six mild hybrid" },
      { label: "Horsepower", value: "462 hp" },
      { label: "Torque", value: "479 lb-ft" },
      { label: "0–60 mph", value: "5.4 s" },
      { label: "Economy", value: "26 mpg combined" },
      { label: "Seating", value: "7" },
      { label: "Towing capacity", value: "3,500 kg" },
      { label: "Ground clearance", value: "221 mm" },
      { label: "Starting price", value: "$96,800" },
    ],
    paints: [
      { id: "slate", name: "Slate Grey", hex: "#484D53", metallic: 0.5, price: 0 },
      { id: "onyx", name: "Onyx", hex: "#14161A", metallic: 0.4, price: 1_400 },
      { id: "pewter", name: "Pewter Silver", hex: "#9AA0A6", metallic: 0.9, price: 2_600 },
      { id: "forest", name: "Deep Forest", hex: "#1E3A2E", metallic: 0.75, price: 2_600 },
    ],
    trims: [
      {
        id: "core",
        name: "Core",
        description: "Six seats, air suspension, 21-inch wheels.",
        interiorHex: "#2B2E33",
        brightwork: "satin",
        price: 0,
      },
      {
        id: "estate",
        name: "Estate",
        description: "Seven seats, quilted hide, rear entertainment.",
        interiorHex: "#4A3B2E",
        brightwork: "chrome",
        price: 14_500,
      },
    ],
    packages: [
      {
        id: "tow",
        name: "Heavy tow pack",
        description: "Integrated hitch and trailer stability assist.",
        price: 2_200,
      },
      {
        id: "air",
        name: "Adaptive air suspension",
        description: "Three-mode ride height with load levelling.",
        price: 4_800,
      },
    ],
    signatureMove: "seat-recline",
    accentHex: "#5B8DEF",
    keyLightHex: "#D6E2F0",
    proportions: {
      bodyLength: 4.94,
      bodyWidth: 2.01,
      rideHeight: 0.22,
      beltlineY: 1.16,
      roofY: 1.82,
      cabinFront: 0.42,
      cabinRear: -1.72,
      roofTaper: 0.1,
      wheelbase: 2.98,
      track: 1.71,
      wheelRadius: 0.41,
      tireWidth: 0.3,
      noseDrop: 0.1,
    },
  },
  {
    id: "sedan",
    category: "Sedan",
    name: "Lumen",
    tagline: "Composure, at any speed.",
    designStatement:
      "A long dash-to-axle and a roofline that falls for two metres without a " +
      "single break. The proportion does the work; there is no ornament.",
    startingPrice: 78_400,
    renderTier: "realtime",
    specs: [
      { label: "Horsepower", value: "394 hp", anchor: "hood" },
      { label: "0–60 mph", value: "4.6 s", anchor: "wheels" },
      { label: "Seating", value: "5", anchor: "cabin" },
      { label: "Economy", value: "31 mpg", anchor: "underbody" },
    ],
    fullSpecs: [
      { label: "Engine", value: "3.0L inline-six turbo" },
      { label: "Horsepower", value: "394 hp" },
      { label: "Torque", value: "398 lb-ft" },
      { label: "0–60 mph", value: "4.6 s" },
      { label: "Economy", value: "31 mpg combined" },
      { label: "Seating", value: "5" },
      { label: "Boot volume", value: "540 L" },
      { label: "Drag coefficient", value: "0.22 Cd" },
      { label: "Starting price", value: "$78,400" },
    ],
    paints: [
      { id: "silver", name: "Meridian Silver", hex: "#B4BAC0", metallic: 0.9, price: 0 },
      { id: "ink", name: "Ink Blue", hex: "#1B2A3D", metallic: 0.8, price: 1_800 },
      { id: "bone", name: "Bone White", hex: "#DEDCD5", metallic: 0.25, price: 1_800 },
      { id: "carbon", name: "Carbon Grey", hex: "#33373C", metallic: 0.65, price: 2_400 },
    ],
    trims: [
      {
        id: "line",
        name: "Line",
        description: "Open-pore ash, 19-inch wheels, adaptive dampers.",
        interiorHex: "#33363B",
        brightwork: "satin",
        price: 0,
      },
      {
        id: "line-plus",
        name: "Line Plus",
        description: "Rear axle steering, 21-inch wheels, acoustic glazing.",
        interiorHex: "#463A31",
        brightwork: "chrome",
        price: 11_200,
      },
    ],
    packages: [
      {
        id: "acoustic",
        name: "Acoustic glazing",
        description: "Laminated side glass, 4 dB quieter at motorway speed.",
        price: 1_900,
      },
      {
        id: "assist",
        name: "Highway assist",
        description: "Lane-centring with hands-off certification.",
        price: 3_400,
      },
    ],
    signatureMove: "grille-shutter",
    accentHex: "#7DD3E8",
    keyLightHex: "#E0EAF4",
    proportions: {
      bodyLength: 4.98,
      bodyWidth: 1.89,
      rideHeight: 0.14,
      beltlineY: 0.98,
      roofY: 1.45,
      cabinFront: 0.32,
      cabinRear: -1.5,
      roofTaper: 0.16,
      wheelbase: 3.02,
      track: 1.62,
      wheelRadius: 0.37,
      tireWidth: 0.27,
      noseDrop: 0.2,
    },
  },
  {
    id: "luxury",
    category: "Luxury",
    name: "Sovereign",
    tagline: "The quietest room you will ever drive.",
    designStatement:
      "Built outward from the rear seat. Every line, every seal and every " +
      "millimetre of glass thickness exists to protect the silence inside it.",
    startingPrice: 189_000,
    renderTier: "realtime",
    specs: [
      { label: "Horsepower", value: "563 hp", anchor: "hood" },
      { label: "Cabin noise", value: "54 dB at 70 mph", anchor: "cabin" },
      { label: "Rear recline", value: "43°", anchor: "door" },
      { label: "0–60 mph", value: "4.4 s", anchor: "wheels" },
    ],
    fullSpecs: [
      { label: "Engine", value: "4.4L twin-turbo V8" },
      { label: "Horsepower", value: "563 hp" },
      { label: "Torque", value: "553 lb-ft" },
      { label: "0–60 mph", value: "4.4 s" },
      { label: "Economy", value: "22 mpg combined" },
      { label: "Seating", value: "4, executive layout" },
      { label: "Cabin noise", value: "54 dB at 70 mph" },
      { label: "Rear seat recline", value: "43 degrees" },
      { label: "Starting price", value: "$189,000" },
    ],
    paints: [
      { id: "obsidian", name: "Obsidian", hex: "#0F1114", metallic: 0.45, price: 0 },
      { id: "champagne", name: "Champagne", hex: "#C8B48C", metallic: 0.85, price: 5_600 },
      { id: "oxford", name: "Oxford Blue", hex: "#14233B", metallic: 0.7, price: 5_600 },
      { id: "pearl", name: "Pearl", hex: "#EFEDE8", metallic: 0.35, price: 7_400 },
    ],
    trims: [
      {
        id: "sovereign",
        name: "Sovereign",
        description: "Four-place cabin, lambswool floor, rear tables.",
        interiorHex: "#4E4034",
        brightwork: "chrome",
        price: 0,
      },
      {
        id: "sovereign-noir",
        name: "Sovereign Noir",
        description: "Black ash veneer, darkened brightwork, privacy glazing.",
        interiorHex: "#1A1A1D",
        brightwork: "gloss-black",
        price: 22_000,
      },
    ],
    packages: [
      {
        id: "rear-lounge",
        name: "Rear lounge",
        description: "Heated, ventilated and massaging rear thrones.",
        price: 12_800,
      },
      {
        id: "audio",
        name: "Reference audio",
        description: "26 speakers with active road-noise cancellation.",
        price: 8_900,
      },
    ],
    signatureMove: "door-present",
    accentHex: "#D4AF6A",
    keyLightHex: "#F5E6CE",
    proportions: {
      bodyLength: 5.32,
      bodyWidth: 1.96,
      rideHeight: 0.15,
      beltlineY: 1.04,
      roofY: 1.5,
      cabinFront: 0.34,
      cabinRear: -1.72,
      roofTaper: 0.12,
      wheelbase: 3.22,
      track: 1.68,
      wheelRadius: 0.39,
      tireWidth: 0.28,
      noseDrop: 0.14,
    },
  },
  {
    id: "ev",
    category: "EV",
    name: "Volta",
    tagline: "Silence, engineered.",
    designStatement:
      "A skateboard floorpan lets the cabin sit forward and the glass run " +
      "uninterrupted from screen to tailgate. The battery is the architecture.",
    startingPrice: 104_900,
    renderTier: "realtime",
    specs: [
      { label: "Output", value: "690 hp", anchor: "underbody" },
      { label: "Range", value: "412 mi", anchor: "underbody" },
      { label: "0–60 mph", value: "3.4 s", anchor: "wheels" },
      { label: "Charge", value: "10–80% in 18 min", anchor: "rear" },
    ],
    fullSpecs: [
      { label: "Drivetrain", value: "Dual motor, all-wheel drive" },
      { label: "Output", value: "690 hp" },
      { label: "Torque", value: "627 lb-ft" },
      { label: "0–60 mph", value: "3.4 s" },
      { label: "Range", value: "412 mi WLTP" },
      { label: "Battery", value: "108 kWh usable, 800 V" },
      { label: "Charging", value: "10–80% in 18 minutes at 270 kW" },
      { label: "Seating", value: "5" },
      { label: "Starting price", value: "$104,900" },
    ],
    paints: [
      { id: "vapour", name: "Vapour Grey", hex: "#8E959C", metallic: 0.75, price: 0 },
      { id: "void", name: "Void Black", hex: "#101215", metallic: 0.5, price: 1_600 },
      { id: "signal", name: "Signal Teal", hex: "#12706B", metallic: 0.8, price: 3_200 },
      { id: "chalk", name: "Chalk", hex: "#E4E4E0", metallic: 0.2, price: 1_600 },
    ],
    trims: [
      {
        id: "long-range",
        name: "Long Range",
        description: "Single-pedal drive, heat pump, 20-inch aero wheels.",
        interiorHex: "#2E3237",
        brightwork: "satin",
        price: 0,
      },
      {
        id: "dual-motor",
        name: "Dual Motor Performance",
        description: "690 hp, adaptive air suspension, 21-inch wheels.",
        interiorHex: "#1B1D21",
        brightwork: "gloss-black",
        price: 16_400,
      },
    ],
    packages: [
      {
        id: "v2h",
        name: "Vehicle-to-home",
        description: "11 kW bidirectional export with transfer switch.",
        price: 2_900,
      },
      {
        id: "glass-roof",
        name: "Full glass roof",
        description: "Electrochromic, five opacity states.",
        price: 3_600,
      },
    ],
    signatureMove: "battery-slide",
    accentHex: "#35E5D4",
    keyLightHex: "#D2ECF5",
    proportions: {
      bodyLength: 4.78,
      bodyWidth: 1.93,
      rideHeight: 0.16,
      beltlineY: 0.96,
      roofY: 1.44,
      cabinFront: 0.62,
      cabinRear: -1.56,
      roofTaper: 0.14,
      wheelbase: 3.0,
      track: 1.66,
      wheelRadius: 0.38,
      tireWidth: 0.28,
      noseDrop: 0.24,
    },
  },
  {
    id: "performance",
    category: "Performance",
    name: "Apex RS",
    tagline: "Built to be driven at its limit.",
    designStatement:
      "Homologation shape, road plates. The aero is not styling — every surface " +
      "on it was signed off by a lap time, not a sketch.",
    startingPrice: 268_000,
    renderTier: "realtime",
    specs: [
      { label: "Horsepower", value: "710 hp", anchor: "hood" },
      { label: "Downforce", value: "860 kg at 180 mph", anchor: "rear" },
      { label: "0–60 mph", value: "2.7 s", anchor: "wheels" },
      { label: "Kerb weight", value: "1,312 kg", anchor: "underbody" },
    ],
    fullSpecs: [
      { label: "Engine", value: "4.0L twin-turbo V8" },
      { label: "Horsepower", value: "710 hp at 7,200 rpm" },
      { label: "Torque", value: "590 lb-ft" },
      { label: "0–60 mph", value: "2.7 s" },
      { label: "Top speed", value: "217 mph" },
      { label: "Peak downforce", value: "860 kg at 180 mph" },
      { label: "Kerb weight", value: "1,312 kg" },
      { label: "Seating", value: "2" },
      { label: "Starting price", value: "$268,000" },
    ],
    paints: [
      { id: "race-black", name: "Race Black", hex: "#0D0E10", metallic: 0.55, price: 0 },
      { id: "flare", name: "Flare Red", hex: "#B3121C", metallic: 0.7, price: 6_800 },
      { id: "acid", name: "Acid Yellow", hex: "#C9B00E", metallic: 0.6, price: 6_800 },
      { id: "gunmetal", name: "Gunmetal", hex: "#3B4046", metallic: 0.95, price: 4_400 },
    ],
    trims: [
      {
        id: "rs",
        name: "RS",
        description: "Carbon tub, six-point harness mounts, centre-lock wheels.",
        interiorHex: "#17181B",
        brightwork: "gloss-black",
        price: 0,
      },
      {
        id: "rs-track",
        name: "RS Track",
        description: "Roll cage, polycarbonate rear glass, 24 kg removed.",
        interiorHex: "#101113",
        brightwork: "gloss-black",
        price: 41_000,
      },
    ],
    packages: [
      {
        id: "aero",
        name: "Track aero",
        description: "Extended dive planes and a 40 mm taller wing element.",
        price: 14_600,
      },
      {
        id: "telemetry",
        name: "Telemetry suite",
        description: "On-board logging, predictive lap timing, camera.",
        price: 5_200,
      },
    ],
    signatureMove: "wing-deploy",
    accentHex: "#FF3B47",
    keyLightHex: "#E4EEFA",
    proportions: {
      bodyLength: 4.58,
      bodyWidth: 2.03,
      rideHeight: 0.09,
      beltlineY: 0.83,
      roofY: 1.18,
      cabinFront: 0.68,
      cabinRear: -0.58,
      roofTaper: 0.22,
      wheelbase: 2.66,
      track: 1.74,
      wheelRadius: 0.37,
      tireWidth: 0.35,
      noseDrop: 0.42,
    },
  },
  {
    id: "offroad",
    category: "Off-Road",
    name: "Basalt",
    tagline: "Where the map stops.",
    designStatement:
      "Ladder frame, live rear axle, and a 38-degree approach angle. Nothing " +
      "about it was softened to make it easier to sell.",
    startingPrice: 88_600,
    renderTier: "realtime",
    specs: [
      { label: "Horsepower", value: "418 hp", anchor: "hood" },
      { label: "Articulation", value: "612 mm RTI", anchor: "underbody" },
      { label: "Wading depth", value: "900 mm", anchor: "door" },
      { label: "Approach angle", value: "38°", anchor: "wheels" },
    ],
    fullSpecs: [
      { label: "Engine", value: "3.5L twin-turbo V6" },
      { label: "Horsepower", value: "418 hp" },
      { label: "Torque", value: "480 lb-ft" },
      { label: "0–60 mph", value: "6.1 s" },
      { label: "Economy", value: "19 mpg combined" },
      { label: "Wading depth", value: "900 mm" },
      { label: "Approach and departure", value: "38° / 31°" },
      { label: "Seating", value: "5" },
      { label: "Starting price", value: "$88,600" },
    ],
    paints: [
      { id: "basalt", name: "Basalt Grey", hex: "#3F4348", metallic: 0.35, price: 0 },
      { id: "sand", name: "Desert Sand", hex: "#A8956E", metallic: 0.3, price: 2_100 },
      { id: "moss", name: "Moss", hex: "#414A33", metallic: 0.35, price: 2_100 },
      { id: "clay", name: "Clay Red", hex: "#7A3B27", metallic: 0.4, price: 2_100 },
    ],
    trims: [
      {
        id: "field",
        name: "Field",
        description: "Locking diffs front and rear, steel bumpers, 33-inch tyres.",
        interiorHex: "#2A2B27",
        brightwork: "gloss-black",
        price: 0,
      },
      {
        id: "expedition",
        name: "Expedition",
        description: "Winch, roof platform, dual battery, 35-inch tyres.",
        interiorHex: "#33352F",
        brightwork: "gloss-black",
        price: 18_900,
      },
    ],
    packages: [
      {
        id: "recovery",
        name: "Recovery kit",
        description: "Winch, rated points, traction boards and compressor.",
        price: 4_700,
      },
      {
        id: "platform",
        name: "Roof platform",
        description: "Load-rated platform with integrated tent mounts.",
        price: 3_300,
      },
    ],
    signatureMove: "suspension-lift",
    accentHex: "#E8A33D",
    keyLightHex: "#F0E2C8",
    proportions: {
      bodyLength: 4.72,
      bodyWidth: 2.06,
      rideHeight: 0.31,
      beltlineY: 1.26,
      roofY: 1.96,
      cabinFront: 0.5,
      cabinRear: -1.6,
      roofTaper: 0.06,
      wheelbase: 2.86,
      track: 1.76,
      wheelRadius: 0.45,
      tireWidth: 0.34,
      noseDrop: 0.04,
    },
  },
];

/* ------------------------------------------------------------------ */
/* Derived helpers                                                     */
/* ------------------------------------------------------------------ */

/** The one vehicle that gets full Higgsfield treatment (Acts 0–2). */
export const flagship: Vehicle =
  vehicles.find((v) => v.renderTier === "higgsfield-hero") ?? vehicles[0];

/** Everything else — rendered entirely in real time, at zero credit cost. */
export const realtimeVehicles: Vehicle[] = vehicles.filter(
  (v) => v.id !== flagship.id,
);

export const getVehicle = (id: CategoryId): Vehicle =>
  vehicles.find((v) => v.id === id) ?? flagship;

export const formatPrice = (n: number): string => `$${n.toLocaleString("en-US")}`;
