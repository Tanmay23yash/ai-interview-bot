import type { CSSProperties } from "react";

/** Sample questions shown on the landing page carousel and the auth pages' showcase. */
export const EXAMPLES: { tag: string; question: string; glyph: string; surface: CSSProperties }[] = [
  {
    tag: "Technical · Backend",
    question: "Your API handled 10k requests a minute. Where would it break first at 100k?",
    glyph: "{ }",
    surface: { background: "radial-gradient(circle at 30% 25%, #d4f6ff, #4DC5E5 45%, #1f93b8)", color: "#063a4a" },
  },
  {
    tag: "Machine Learning",
    question: "Why did you pick gradient boosting over a neural net for churn?",
    glyph: "∑",
    surface: { background: "radial-gradient(circle at 70% 20%, #2a3a22, #0F0F0F 60%)", color: "#9be86f" },
  },
  {
    tag: "Behavioral",
    question: "Tell me about a time you shipped something you disagreed with.",
    glyph: "★",
    surface: { background: "radial-gradient(circle at 30% 25%, #ffd1ea, #ea2a8e 50%, #a30d5c)", color: "#ffe3f2" },
  },
  {
    tag: "Technical · Frontend",
    question: "How did you keep the dashboard fast as the dataset grew?",
    glyph: "</>",
    surface: { background: "linear-gradient(160deg, #fff6b8, #E9D352 55%, #c7ad1f)", color: "#4a3f06" },
  },
  {
    tag: "Behavioral",
    question: "Walk me through a project that failed. What would you change?",
    glyph: "↺",
    surface: { background: "linear-gradient(160deg, #f6f6f6, #dcdcdc)", color: "#0F0F0F" },
  },
  {
    tag: "Machine Learning",
    question: "How did you make sure the model wasn't leaking future data?",
    glyph: "◎",
    surface: { background: "linear-gradient(140deg, #4DC5E5, #63AD45)", color: "#06281a" },
  },
  {
    tag: "Technical · Databases",
    question: "Why PostgreSQL over a document store for this project?",
    glyph: "SQL",
    surface: { background: "radial-gradient(circle at 30% 20%, #2a2a2a, #0F0F0F 70%)", color: "#4DC5E5" },
  },
  {
    tag: "Behavioral · Leadership",
    question: "How did you get two teams to agree on one API contract?",
    glyph: "⇄",
    surface: { background: "radial-gradient(circle at 30% 25%, #c9ff8f, #63AD45 50%, #2f7a10)", color: "#123d05" },
  },
];
