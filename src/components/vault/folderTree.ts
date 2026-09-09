import type { VaultFolder } from './types';

export interface FolderNode extends VaultFolder {
  children: FolderNode[];
  depth: number;
}

/** Build a nested tree from the flat live-folder list. */
export function buildFolderTree(folders: VaultFolder[]): FolderNode[] {
  const byId = new Map<string, FolderNode>();
  folders.forEach((f) => byId.set(f.id, { ...f, children: [], depth: 0 }));
  const roots: FolderNode[] = [];
  byId.forEach((node) => {
    if (node.parent_id && byId.has(node.parent_id)) {
      byId.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  const sort = (nodes: FolderNode[], depth: number) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name));
    nodes.forEach((n) => {
      n.depth = depth;
      sort(n.children, depth + 1);
    });
  };
  sort(roots, 0);
  return roots;
}

/** Flatten a tree to a depth-annotated list (for indented pickers/rails). */
export function flattenTree(nodes: FolderNode[], out: FolderNode[] = []): FolderNode[] {
  nodes.forEach((n) => {
    out.push(n);
    flattenTree(n.children, out);
  });
  return out;
}

/** ids of `folderId` and everything under it — invalid move targets. */
export function descendantIds(folders: VaultFolder[], folderId: string): Set<string> {
  const childrenOf = new Map<string, string[]>();
  folders.forEach((f) => {
    if (!f.parent_id) return;
    childrenOf.set(f.parent_id, [...(childrenOf.get(f.parent_id) ?? []), f.id]);
  });
  const acc = new Set<string>([folderId]);
  const stack = [folderId];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const c of childrenOf.get(cur) ?? []) {
      if (!acc.has(c)) {
        acc.add(c);
        stack.push(c);
      }
    }
  }
  return acc;
}
