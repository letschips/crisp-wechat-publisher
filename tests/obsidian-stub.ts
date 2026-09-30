export class TFile {
  path = '';
  name = '';
  basename = '';
  extension = '';
  parent: { path: string } | null = null;
  stat = { ctime: 0, mtime: 0, size: 0 };
}

export class Notice {
  constructor(_message: string, _timeout?: number) {}
  setMessage(_message: string) {}
  hide() {}
}

export class App {}
export class WorkspaceLeaf {}
export class MarkdownView {}
export class Menu {}
export class Modal {}
export class ItemView {}
export class PluginSettingTab {}
export class Setting {}

export class Plugin {
  app: unknown;
}

export function requestUrl(): never {
  throw new Error('Network requests are unavailable in unit tests');
}

export function addIcon(_iconId: string, _svgContent: string): void {}

