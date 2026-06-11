export interface AppConfig {
  root_path: string;
  cli_path: string;
  app_data_dir: string;
  [key: string]: unknown;
}

export interface CliStatus {
  status: string;
  message: string;
  repo_url: string;
  installed_version: string;
  latest_version: string;
  update_available: boolean;
  last_checked: string;
}

export interface WorkspaceItem {
  name: string;
  path: string;
  has_children?: boolean;
  [key: string]: unknown;
}

export interface ImageItem {
  name: string;
  url: string;
  size?: number;
}

export interface DepartmentEntry {
  code: string;
  id: string;
  name: string;
  wordpress_category_slug: string;
  wordpress_category_parent_slug: string | null;
  wordpress_tag_slug: string;
}

export interface DepartmentsFile {
  departments: DepartmentEntry[];
}

export interface BatchDetails {
  name: string;
  content: string;
  images: ImageItem[];
  [key: string]: unknown;
}

export interface WorkspaceNode extends BatchDetails {
  path: string;
  openable: boolean;
  children: WorkspaceItem[];
}

export interface WorkspaceZone {
  name: string;
  path: string;
  items: WorkspaceItem[];
}

export interface WorkspaceState {
  root_path: string;
  zones: {
    raws: WorkspaceZone;
    batches: WorkspaceZone;
    canvas: WorkspaceZone;
  };
  legacy: WorkspaceItem[];
}

export interface PreparedPost {
  name: string;
  content: string;
  images: ImageItem[];
}

export interface CommandLog {
  stdout: string;
  stderr: string;
  returncode: number;
  command: string;
  cwd?: string;
  batch_path?: string;
  output_path?: string;
}

export interface BrowseResult {
  path?: string;
}

export interface WordPressConfig {
  WP_URL: string;
  WP_USERNAME: string;
  WP_APPLICATION_PASSWORD: string;
}

export interface ActionStatus {
  tone: 'success' | 'error';
  title: string;
  message: string;
}

export type AppView = 'editor' | 'settings';
