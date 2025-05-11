import type { Connection } from "../types"; // Assuming types.ts is one level up

// Define the hardcoded connections for the diagram
export const ALL_CONNECTIONS_DATA: Connection[] = [
  { from: "input", to: "s1", type: "accepted", level: 0 },
  { from: "input", to: "s2", type: "secondary", level: 0 },
  { from: "input", to: "s3", type: "rejected", level: 0 },
  { from: "input", to: "s4", type: "secondary", level: 0 },
  { from: "s1", to: "s5", type: "accepted", level: 1 },
  { from: "s1", to: "s6", type: "secondary", level: 1 },
  { from: "s2", to: "s6", type: "accepted", level: 1 },
  { from: "s2", to: "s7", type: "secondary", level: 1 },
  { from: "s3", to: "s7", type: "accepted", level: 1 },
  { from: "s3", to: "s8", type: "secondary", level: 1 },
  { from: "s4", to: "s8", type: "accepted", level: 1 },
  { from: "s4", to: "s9", type: "rejected", level: 1 },
  { from: "s5", to: "s10", type: "accepted", level: 2 },
  { from: "s5", to: "s11", type: "secondary", level: 2 },
  { from: "s6", to: "s10", type: "secondary", level: 2 },
  { from: "s6", to: "s11", type: "accepted", level: 2 },
  { from: "s7", to: "s11", type: "secondary", level: 2 },
  { from: "s7", to: "s12", type: "accepted", level: 2 },
  { from: "s8", to: "s12", type: "secondary", level: 2 },
  { from: "s8", to: "s13", type: "rejected", level: 2 },
  { from: "s9", to: "s13", type: "accepted", level: 2 },
  { from: "s9", to: "s14", type: "rejected", level: 2 },
  { from: "s10", to: "s15", type: "accepted", level: 3 },
  { from: "s10", to: "s16", type: "secondary", level: 3 },
  { from: "s11", to: "s15", type: "secondary", level: 3 },
  { from: "s11", to: "s16", type: "accepted", level: 3 },
  { from: "s12", to: "s16", type: "secondary", level: 3 },
  { from: "s12", to: "s17", type: "secondary", level: 3 },
  { from: "s13", to: "s17", type: "accepted", level: 3 },
  { from: "s13", to: "s18", type: "rejected", level: 3 },
  { from: "s14", to: "s18", type: "accepted", level: 3 },
  { from: "s14", to: "s19", type: "rejected", level: 3 },
  { from: "s15", to: "s20", type: "accepted", level: 4 },
  { from: "s15", to: "s21", type: "secondary", level: 4 },
  { from: "s16", to: "s20", type: "secondary", level: 4 },
  { from: "s16", to: "s21", type: "accepted", level: 4 },
  { from: "s17", to: "s21", type: "secondary", level: 4 },
  { from: "s17", to: "s22", type: "rejected", level: 4 },
  { from: "s18", to: "s22", type: "accepted", level: 4 },
  { from: "s18", to: "s23", type: "rejected", level: 4 },
  { from: "s19", to: "s23", type: "accepted", level: 4 },
  { from: "s19", to: "s24", type: "rejected", level: 4 },
];

// Placeholder for _optimizedPath if it's found to be used and constant
// export const OPTIMIZED_PATH_DATA: Connection[] = [
//   { from: "input", to: "s2", type: "accepted", level: 0 },
//   ...
// ];