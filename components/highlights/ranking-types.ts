interface RankingPositionView {
  segment: string;
  position: number;
  total: number;
  topPercent?: number | null;
}

export interface RankingsView {
  score?: number | null;
  optedIn?: boolean;
  message?: string;
  available?: string[];
  positions?: RankingPositionView[];
  note?: string;
}
