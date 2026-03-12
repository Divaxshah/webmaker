export type MessageRole = "user" | "assistant";

export type MessageStatus = "thinking" | "writing" | "done" | "error";

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  status: MessageStatus;
  tokenCount?: number;
  latencyMs?: number;
  codeSnapshot?: string;
  createdAt: string;
}

export interface ProjectFile {
  code: string;
  hidden?: boolean;
  active?: boolean;
}

export type ProjectFileMap = Record<string, ProjectFile>;

export interface GeneratedProject {
  title: string;
  summary: string;
  framework: "react-ts";
  entry: string;
  dependencies: Record<string, string>;
  files: ProjectFileMap;
}

export interface Session {
  id: string;
  messages: Message[];
  currentProject: GeneratedProject;
  createdAt: string;
}

export interface RuntimeErrorState {
  message: string;
  code: string;
  timestamp: number;
}

export interface ConsoleEntry {
  id: string;
  level: "log" | "info" | "warn" | "error" | "debug";
  text: string;
  createdAt: number;
}
