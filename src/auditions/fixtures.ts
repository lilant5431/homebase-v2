// Disposable presentation data. This module deliberately imports no planner engines.
export type Concept = "aether" | "meridian" | "prism";
export type Workflow = "week" | "assignments" | "planning";
export const concepts = {
  aether: {
    name: "Aether",
    subtitle: "Luminous clarity",
    line: "Room to think.",
    description: "An open sky. A clear mind. A week that feels like yours.",
  },
  meridian: {
    name: "Meridian",
    subtitle: "Cinematic architecture",
    line: "A place for your mind.",
    description: "Step inside. Find your rhythm. Build something meaningful.",
  },
  prism: {
    name: "Prism",
    subtitle: "Optical precision",
    line: "Bring it into focus.",
    description: "Less noise. More signal. Your next move, in perfect clarity.",
  },
} as const;
export const assignments = [
  {
    id: "memory",
    title: "The architecture of memory",
    course: "PSY 204",
    category: "Psychology",
    due: "Thu, Oct 22 · 17:00",
    priority: "High",
    progress: 65,
    color: "lavender",
    note: "Connect the hippocampus and spatial memory. Refine the evidence section before the final read-through.",
  },
  {
    id: "algebra",
    title: "Problem set 04",
    course: "MAT 201",
    category: "Mathematics",
    due: "Fri, Oct 23 · 12:00",
    priority: "High",
    progress: 30,
    color: "blue",
    note: "Eigenvalues and linear transformations. Questions 1–3 are complete; revisit the proof in question 4.",
  },
  {
    id: "modernism",
    title: "Reading response: Modernism",
    course: "ENG 210",
    category: "Literature",
    due: "Wed, Oct 21 · 18:00",
    priority: "Medium",
    progress: 80,
    color: "peach",
    note: "A short response to Woolf. Choose one passage and connect its rhythm to the experience of time.",
  },
  {
    id: "biology",
    title: "Cell observation report",
    course: "BIO 110",
    category: "Biology",
    due: "Sun, Oct 25 · 23:00",
    priority: "Low",
    progress: 10,
    color: "green",
    note: "Label the microscopy images and compare the observed cell structures with the reference slides.",
  },
] as const;
export type Assignment = (typeof assignments)[number];
export const events = [
  {
    id: "psych",
    day: 0,
    hour: 10,
    duration: 1.5,
    title: "Cognitive psychology",
    label: "Lecture · PSY 204",
    color: "lavender",
  },
  {
    id: "math",
    day: 1,
    hour: 9,
    duration: 1.5,
    title: "Linear algebra",
    label: "Lecture · MAT 201",
    color: "blue",
  },
  {
    id: "reading",
    day: 1,
    hour: 13,
    duration: 1.5,
    title: "Reading & reflection",
    label: "Focus · ENG 210",
    color: "peach",
  },
  {
    id: "literature",
    day: 2,
    hour: 11,
    duration: 1.5,
    title: "Literature seminar",
    label: "Seminar · ENG 210",
    color: "peach",
  },
  {
    id: "writing",
    day: 3,
    hour: 10,
    duration: 2,
    title: "The architecture of memory",
    label: "Focus · PSY 204",
    color: "lavender",
  },
  {
    id: "lab",
    day: 4,
    hour: 13,
    duration: 2,
    title: "Biology lab",
    label: "Lab · BIO 110",
    color: "green",
  },
] as const;
export const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export function parseConcept(hash: string): Concept {
  const value = hash.split("/")[1];
  return value === "meridian" || value === "prism" ? value : "aether";
}
