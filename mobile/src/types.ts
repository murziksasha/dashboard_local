export type Project = { id: string; name: string; key: string };
export type Status = { id: string; name: string };
export type Issue = {
  id: string;
  key: string;
  title: string;
  description?: string | null;
  type?: string;
  status_id: string;
  status_name?: string;
  assignee_name?: string | null;
  assignee_names?: string | null;
};
export type Comment = { id: string; body: string; author_name?: string; created_at?: string };
export type Attachment = {
  id: string;
  filename: string;
  mime_type?: string | null;
  size_bytes?: number;
};
