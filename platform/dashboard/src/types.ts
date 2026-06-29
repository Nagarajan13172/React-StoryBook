// Shape of the scanner's analysis.json (platform/core/scan.mjs). Kept in sync by
// hand — the dashboard only reads it, so a loose/partial match is tolerated.

export interface StoryStates {
  applicable: string[];
  covered: string[];
  missing: string[];
}

export interface ComponentInfo {
  name: string;
  file: string;
  exportType: 'named' | 'default';
  props: string[];
  hasStory: boolean;
  hasTest: boolean;
  states: StoryStates;
}

export interface Gap {
  area: string;
  // Known severities drive sort/colour; unknown/future strings are tolerated
  // (rendered with a neutral chip, sorted last) rather than coerced.
  severity: 'high' | 'medium' | 'low' | (string & {});
  message: string;
}

export interface Analysis {
  scannedAt: string | null;
  root: string;
  framework: { name: string; react: string | null; typescript: boolean; nextAppRouter?: boolean };
  stack: Record<string, boolean>;
  browsers: string[];
  summary: {
    components: { total: number; tested: number; untested: number; coveragePct: number };
    hooks: { total: number; tested: number };
    routes: number;
    apiFiles: number;
    stateStores: number;
    storyFiles: number;
    testFiles: number;
  };
  components: ComponentInfo[];
  hooks: { name: string; file: string; hasTest: boolean }[];
  routes: { file: string; paths: string[]; tested: boolean }[];
  api: { file: string; calls: number; methods: string[] }[];
  state: { kind: string; file: string }[];
  gaps: Gap[];
}

// The 8 spec states, shown as columns in the components table.
export const ALL_STATES = ['Default', 'Loading', 'Disabled', 'Error', 'Empty', 'Dark', 'Mobile', 'Long'];
