export type MessageRole = "user" | "assistant";

export type MessageStatus = "thinking" | "writing" | "done" | "error";

export type AgentActivityKind =
  | "plan"
  | "inspect"
  | "search"
  | "read"
  | "edit"
  | "create"
  | "delete"
  | "rename"
  | "verify"
  | "complete";

export type AgentActivityStatus = "pending" | "active" | "completed" | "error";

export interface AgentActivity {
  id: string;
  kind: AgentActivityKind;
  status: AgentActivityStatus;
  title: string;
  detail: string;
  tool?: string;
  targets?: string[];
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  status: MessageStatus;
  tokenCount?: number;
  latencyMs?: number;
  codeSnapshot?: string;
  activities?: AgentActivity[];
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
  source: "runtime" | "compile" | "unknown";
  message: string;
  code: string;
  filePath?: string;
  line?: number;
  column?: number;
  prompt: string;
  timestamp: number;
}

export interface ConsoleEntry {
  id: string;
  level: "log" | "info" | "warn" | "error" | "debug";
  text: string;
  createdAt: number;
}
