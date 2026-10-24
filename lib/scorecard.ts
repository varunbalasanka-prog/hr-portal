export const SCORE_AREAS = ["Communication", "Product / job knowledge", "Attitude", "Appearance", "Experience", "Salary fit"];

export type ScoreInput = { ratings: Record<string, number>; recommendation: "hire" | "hold" | "reject"; notes: string };

export type ScoreRow = {
  id: string; interviewer: string; ratings: Record<string, number>; overall: number | null;
  recommendation: "hire" | "hold" | "reject"; notes: string | null; created_at: string;
};
