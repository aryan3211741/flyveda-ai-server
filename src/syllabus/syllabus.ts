/**
 * Aviation syllabus taxonomy — the grounding layer for FlyVeda.
 *
 * This is what separates FlyVeda from a generic LLM wrapper: every AI answer and
 * every generated question is anchored to a real ground-school subject + topic code.
 *
 * For the MVP this is a curated in-memory taxonomy with lightweight keyword
 * retrieval. The `retrieveTopics` interface is intentionally simple so it can later
 * be swapped for vector / embedding RAG over licensed content without touching
 * the services that consume it.
 */

export type Goal = "PPL" | "CPL" | "ATPL" | "DGCA";

export interface Topic {
  /** Stable citation code, e.g. "NAV.3" */
  code: string;
  title: string;
  /** One-line scope used to ground the model and keep answers on-syllabus */
  summary: string;
  keywords: string[];
}

export interface Subject {
  code: string;
  name: string;
  goals: Goal[];
  topics: Topic[];
}

export const SYLLABUS: Subject[] = [
  {
    code: "AERO",
    name: "Aerodynamics & Principles of Flight",
    goals: ["PPL", "CPL", "ATPL", "DGCA"],
    topics: [
      {
        code: "AERO.1",
        title: "The Four Forces",
        summary: "Lift, weight, thrust and drag and their equilibrium in steady flight.",
        keywords: ["lift", "weight", "thrust", "drag", "forces", "equilibrium"],
      },
      {
        code: "AERO.2",
        title: "Lift Generation",
        summary: "How aerofoils produce lift: pressure differential, angle of attack, lift equation.",
        keywords: ["lift", "aerofoil", "airfoil", "bernoulli", "angle of attack", "coefficient", "camber"],
      },
      {
        code: "AERO.3",
        title: "Drag",
        summary: "Parasite vs induced drag, the drag curve and minimum drag speed.",
        keywords: ["drag", "induced", "parasite", "vortex", "drag curve"],
      },
      {
        code: "AERO.4",
        title: "Stalls & Spins",
        summary: "Critical angle of attack, stall speed, recovery, and spin entry/recovery.",
        keywords: ["stall", "spin", "critical angle", "buffet", "recovery", "stall speed"],
      },
      {
        code: "AERO.5",
        title: "Stability & Control",
        summary: "Longitudinal, lateral and directional stability; control surfaces.",
        keywords: ["stability", "longitudinal", "lateral", "directional", "control", "aileron", "elevator", "rudder"],
      },
    ],
  },
  {
    code: "NAV",
    name: "Air Navigation",
    goals: ["PPL", "CPL", "ATPL", "DGCA"],
    topics: [
      {
        code: "NAV.1",
        title: "The Earth & Position",
        summary: "Latitude, longitude, great circles, rhumb lines and convergency.",
        keywords: ["latitude", "longitude", "great circle", "rhumb", "convergency", "position"],
      },
      {
        code: "NAV.2",
        title: "Direction & Magnetism",
        summary: "True/magnetic/compass heading, variation, deviation and isogonals.",
        keywords: ["heading", "variation", "deviation", "magnetic", "true", "compass", "isogonal"],
      },
      {
        code: "NAV.3",
        title: "Speed, Time & Distance",
        summary: "TAS, IAS, groundspeed, the 1-in-60 rule and dead reckoning.",
        keywords: ["tas", "ias", "groundspeed", "1 in 60", "dead reckoning", "eta", "drift"],
      },
      {
        code: "NAV.4",
        title: "The Wind Triangle",
        summary: "Heading, track, wind correction angle and groundspeed solution.",
        keywords: ["wind triangle", "track", "wind correction", "heading", "drift", "vector"],
      },
    ],
  },
  {
    code: "MET",
    name: "Aviation Meteorology",
    goals: ["PPL", "CPL", "ATPL", "DGCA"],
    topics: [
      {
        code: "MET.1",
        title: "The Atmosphere",
        summary: "ISA, pressure/temperature/density lapse rates and atmospheric layers.",
        keywords: ["isa", "atmosphere", "lapse rate", "tropopause", "pressure", "density"],
      },
      {
        code: "MET.2",
        title: "Pressure & Altimetry",
        summary: "QNH, QFE, QNE, pressure altitude and density altitude.",
        keywords: ["qnh", "qfe", "qne", "altimeter", "pressure altitude", "density altitude"],
      },
      {
        code: "MET.3",
        title: "Clouds & Precipitation",
        summary: "Cloud formation, types, icing conditions and thunderstorm hazards.",
        keywords: ["cloud", "cumulonimbus", "icing", "thunderstorm", "precipitation", "fog"],
      },
      {
        code: "MET.4",
        title: "Weather Reports",
        summary: "Reading METAR, TAF and decoding aviation weather products.",
        keywords: ["metar", "taf", "weather report", "visibility", "decode"],
      },
    ],
  },
  {
    code: "REG",
    name: "Air Regulations / Air Law",
    goals: ["PPL", "CPL", "ATPL", "DGCA"],
    topics: [
      {
        code: "REG.1",
        title: "Rules of the Air",
        summary: "Right-of-way, separation, lights and signals (ICAO Annex 2 / CAR).",
        keywords: ["rules of the air", "right of way", "separation", "annex 2", "car", "signals"],
      },
      {
        code: "REG.2",
        title: "Airspace Classification",
        summary: "Classes A–G, controlled vs uncontrolled airspace and entry requirements.",
        keywords: ["airspace", "class", "controlled", "uncontrolled", "ctr", "tma"],
      },
      {
        code: "REG.3",
        title: "Licensing & Medicals",
        summary: "Licence privileges, ratings, currency and medical requirements.",
        keywords: ["licence", "license", "rating", "currency", "medical", "privileges", "dgca"],
      },
    ],
  },
  {
    code: "TECH",
    name: "Aircraft Technical / Powerplant & Systems",
    goals: ["CPL", "ATPL", "DGCA"],
    topics: [
      {
        code: "TECH.1",
        title: "Piston Engines",
        summary: "The four-stroke cycle, carburetion, fuel/ignition and engine handling.",
        keywords: ["piston", "four stroke", "carburettor", "carburetor", "magneto", "ignition", "mixture"],
      },
      {
        code: "TECH.2",
        title: "Gas Turbine Engines",
        summary: "Jet engine thrust cycle: intake, compression, combustion, exhaust.",
        keywords: ["jet", "turbine", "thrust", "compressor", "combustion", "exhaust", "turbofan", "engine"],
      },
      {
        code: "TECH.3",
        title: "Aircraft Systems",
        summary: "Hydraulics, electrics, pneumatics, fuel and landing gear systems.",
        keywords: ["hydraulic", "electrical", "pneumatic", "fuel system", "landing gear", "systems"],
      },
      {
        code: "TECH.4",
        title: "Flight Instruments",
        summary: "Pitot-static instruments, gyroscopic instruments and errors.",
        keywords: ["instrument", "pitot", "static", "gyroscopic", "asi", "altimeter", "vsi", "attitude"],
      },
    ],
  },
  {
    code: "FPP",
    name: "Flight Planning & Performance",
    goals: ["CPL", "ATPL", "DGCA"],
    topics: [
      {
        code: "FPP.1",
        title: "Mass & Balance",
        summary: "Centre of gravity, loading limits and weight-shift calculations.",
        keywords: ["mass", "balance", "centre of gravity", "cg", "loading", "moment", "weight"],
      },
      {
        code: "FPP.2",
        title: "Takeoff & Landing Performance",
        summary: "Runway requirements, V-speeds and factors affecting performance.",
        keywords: ["takeoff", "landing", "performance", "runway", "v speed", "v1", "vr", "v2"],
      },
      {
        code: "FPP.3",
        title: "Fuel Planning",
        summary: "Trip, contingency, alternate and reserve fuel requirements.",
        keywords: ["fuel planning", "reserve", "alternate", "contingency", "endurance", "range"],
      },
    ],
  },
  {
    code: "HPL",
    name: "Human Performance & Limitations",
    goals: ["PPL", "CPL", "ATPL", "DGCA"],
    topics: [
      {
        code: "HPL.1",
        title: "Aviation Physiology",
        summary: "Hypoxia, hyperventilation, spatial disorientation and G-effects.",
        keywords: ["hypoxia", "hyperventilation", "disorientation", "physiology", "g force", "vision"],
      },
      {
        code: "HPL.2",
        title: "Threat & Error Management",
        summary: "Decision-making, situational awareness and crew resource management.",
        keywords: ["trem", "crm", "situational awareness", "decision", "human factors", "error"],
      },
    ],
  },
];

const FLAT_TOPICS: Array<{ subject: Subject; topic: Topic }> = SYLLABUS.flatMap(
  (subject) => subject.topics.map((topic) => ({ subject, topic }))
);

export interface RetrievedTopic {
  subjectCode: string;
  subjectName: string;
  topicCode: string;
  topicTitle: string;
  summary: string;
  score: number;
}

/**
 * Lightweight keyword retriever. Returns the syllabus topics most relevant to the
 * query, optionally biased toward the student's goal. Swap this for vector search
 * later — the return shape is what the services depend on.
 */
export function retrieveTopics(
  query: string,
  goal?: Goal,
  limit = 4
): RetrievedTopic[] {
  const q = query.toLowerCase();
  const tokens = q.split(/[^a-z0-9]+/).filter((t) => t.length > 2);

  const scored = FLAT_TOPICS.map(({ subject, topic }) => {
    let score = 0;

    for (const kw of topic.keywords) {
      if (q.includes(kw)) score += 3;
      else if (tokens.some((t) => kw.includes(t) || t.includes(kw))) score += 1;
    }
    if (q.includes(topic.title.toLowerCase())) score += 4;
    for (const t of tokens) {
      if (topic.title.toLowerCase().includes(t)) score += 1;
      if (subject.name.toLowerCase().includes(t)) score += 0.5;
    }
    if (goal && subject.goals.includes(goal)) score += 0.5;

    return {
      subjectCode: subject.code,
      subjectName: subject.name,
      topicCode: topic.code,
      topicTitle: topic.title,
      summary: topic.summary,
      score,
    };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function getSubjectsForGoal(goal?: Goal): Subject[] {
  if (!goal) return SYLLABUS;
  return SYLLABUS.filter((s) => s.goals.includes(goal));
}

export function findTopicByCode(code: string): RetrievedTopic | undefined {
  const match = FLAT_TOPICS.find(
    ({ topic }) => topic.code.toLowerCase() === code.toLowerCase()
  );
  if (!match) return undefined;
  return {
    subjectCode: match.subject.code,
    subjectName: match.subject.name,
    topicCode: match.topic.code,
    topicTitle: match.topic.title,
    summary: match.topic.summary,
    score: 1,
  };
}
