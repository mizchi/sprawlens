export type GraphLayoutItem = {
  id: string;
  path: string;
  loc: number;
};

export type GraphLayoutDependency = {
  from: string;
  to: string;
  importCount: number;
};

export type GraphLayoutSize = {
  width: number;
  height: number;
};

export type GraphLayoutRect = {
  id: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

type SimNode = GraphLayoutItem & {
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  group: string;
};

const MIN_WIDTH = 44;
const MIN_HEIGHT = 30;
const NODE_GAP = 8;

export function layoutDependencyMap(items: GraphLayoutItem[], dependencies: GraphLayoutDependency[], size: GraphLayoutSize): GraphLayoutRect[] {
  if (items.length === 0) {
    return [];
  }
  const nodes = createNodes(items, size);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const links = dependencies
    .map((dependency) => ({
      source: nodeById.get(dependency.from),
      target: nodeById.get(dependency.to),
      weight: Math.max(1, Math.log2(dependency.importCount + 1)),
    }))
    .filter((link): link is { source: SimNode; target: SimNode; weight: number } => Boolean(link.source && link.target && link.source !== link.target));

  for (let iteration = 0; iteration < 240; iteration += 1) {
    applyLinkForces(links);
    applyClusterForces(nodes, size);
    applyCollisionForces(nodes);
    applyCenterForce(nodes, size);
    integrate(nodes, size, iteration);
  }
  resolveOverlaps(nodes, size);

  return nodes
    .map((node) => ({
      id: node.id,
      x0: node.x - node.width / 2,
      y0: node.y - node.height / 2,
      x1: node.x + node.width / 2,
      y1: node.y + node.height / 2,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function createNodes(items: GraphLayoutItem[], size: GraphLayoutSize): SimNode[] {
  const totalLoc = Math.max(1, items.reduce((sum, item) => sum + Math.max(1, item.loc), 0));
  const targetArea = size.width * size.height * 0.3;
  const sorted = [...items].sort((a, b) => b.loc - a.loc || a.id.localeCompare(b.id));
  const columns = Math.max(1, Math.ceil(Math.sqrt(sorted.length * (size.width / Math.max(1, size.height)))));
  const rows = Math.max(1, Math.ceil(sorted.length / columns));

  return sorted.map((item, index) => {
    const area = clamp((Math.max(1, item.loc) / totalLoc) * targetArea, MIN_WIDTH * MIN_HEIGHT, size.width * size.height * 0.1);
    const aspect = 1.18 + (hashNumber(item.id) % 28) / 100;
    const width = clamp(Math.sqrt(area * aspect), MIN_WIDTH, size.width * 0.42);
    const height = clamp(area / width, MIN_HEIGHT, size.height * 0.42);
    const column = index % columns;
    const row = Math.floor(index / columns);
    const jitter = hashNumber(item.id);
    return {
      ...item,
      group: groupForPath(item.path),
      width,
      height,
      x: ((column + 0.5) / columns) * size.width + ((jitter % 17) - 8),
      y: ((row + 0.5) / rows) * size.height + (((jitter >> 4) % 17) - 8),
      vx: 0,
      vy: 0,
    };
  });
}

function applyLinkForces(links: Array<{ source: SimNode; target: SimNode; weight: number }>) {
  for (const link of links) {
    const dx = link.target.x - link.source.x;
    const dy = link.target.y - link.source.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const desired = (link.source.width + link.source.height + link.target.width + link.target.height) / 4 + 42;
    const force = (distance - desired) * 0.012 * link.weight;
    const fx = (dx / distance) * force;
    const fy = (dy / distance) * force;
    link.source.vx += fx;
    link.source.vy += fy;
    link.target.vx -= fx;
    link.target.vy -= fy;
  }
}

function applyClusterForces(nodes: SimNode[], size: GraphLayoutSize) {
  const centers = new Map<string, { x: number; y: number; count: number }>();
  for (const node of nodes) {
    const center = centers.get(node.group) ?? { x: 0, y: 0, count: 0 };
    center.x += node.x;
    center.y += node.y;
    center.count += 1;
    centers.set(node.group, center);
  }
  for (const center of centers.values()) {
    center.x /= center.count;
    center.y /= center.count;
  }
  for (const node of nodes) {
    const center = centers.get(node.group) ?? { x: size.width / 2, y: size.height / 2, count: 1 };
    node.vx += (center.x - node.x) * 0.002;
    node.vy += (center.y - node.y) * 0.002;
  }
}

function applyCollisionForces(nodes: SimNode[]) {
  for (let i = 0; i < nodes.length; i += 1) {
    const a = nodes[i];
    if (!a) continue;
    for (let j = i + 1; j < nodes.length; j += 1) {
      const b = nodes[j];
      if (!b) continue;
      const dx = b.x - a.x || 0.01;
      const dy = b.y - a.y || 0.01;
      const overlapX = (a.width + b.width) / 2 + NODE_GAP - Math.abs(dx);
      const overlapY = (a.height + b.height) / 2 + NODE_GAP - Math.abs(dy);
      if (overlapX <= 0 || overlapY <= 0) {
        continue;
      }
      if (overlapX < overlapY) {
        const push = (overlapX / 2) * Math.sign(dx);
        a.vx -= push * 0.18;
        b.vx += push * 0.18;
      } else {
        const push = (overlapY / 2) * Math.sign(dy);
        a.vy -= push * 0.18;
        b.vy += push * 0.18;
      }
    }
  }
}

function applyCenterForce(nodes: SimNode[], size: GraphLayoutSize) {
  const centerX = size.width / 2;
  const centerY = size.height / 2;
  for (const node of nodes) {
    node.vx += (centerX - node.x) * 0.0015;
    node.vy += (centerY - node.y) * 0.0015;
  }
}

function integrate(nodes: SimNode[], size: GraphLayoutSize, iteration: number) {
  const damping = 0.84 - Math.min(0.22, iteration / 900);
  for (const node of nodes) {
    node.x = clamp(node.x + node.vx, node.width / 2, size.width - node.width / 2);
    node.y = clamp(node.y + node.vy, node.height / 2, size.height - node.height / 2);
    node.vx *= damping;
    node.vy *= damping;
  }
}

function resolveOverlaps(nodes: SimNode[], size: GraphLayoutSize) {
  for (let iteration = 0; iteration < 260; iteration += 1) {
    let maxOverlap = 0;
    for (let i = 0; i < nodes.length; i += 1) {
      const a = nodes[i];
      if (!a) continue;
      for (let j = i + 1; j < nodes.length; j += 1) {
        const b = nodes[j];
        if (!b) continue;
        const dx = b.x - a.x || deterministicSign(a.id, b.id) * 0.01;
        const dy = b.y - a.y || deterministicSign(`${a.id}:y`, `${b.id}:y`) * 0.01;
        const overlapX = (a.width + b.width) / 2 + NODE_GAP - Math.abs(dx);
        const overlapY = (a.height + b.height) / 2 + NODE_GAP - Math.abs(dy);
        if (overlapX <= 0 || overlapY <= 0) {
          continue;
        }
        maxOverlap = Math.max(maxOverlap, Math.min(overlapX, overlapY));
        if (overlapX < overlapY) {
          const direction = Math.sign(dx) || deterministicSign(a.id, b.id);
          const push = overlapX / 2 + 0.25;
          a.x -= direction * push;
          b.x += direction * push;
        } else {
          const direction = Math.sign(dy) || deterministicSign(`${a.id}:y`, `${b.id}:y`);
          const push = overlapY / 2 + 0.25;
          a.y -= direction * push;
          b.y += direction * push;
        }
      }
    }
    for (const node of nodes) {
      node.x = clamp(node.x, node.width / 2, size.width - node.width / 2);
      node.y = clamp(node.y, node.height / 2, size.height - node.height / 2);
    }
    if (maxOverlap <= 0.5) {
      return;
    }
  }
  packRows(nodes, size);
}

function packRows(nodes: SimNode[], size: GraphLayoutSize) {
  const ordered = [...nodes].sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id));
  let x = NODE_GAP;
  let y = NODE_GAP;
  let rowHeight = 0;
  for (const node of ordered) {
    if (x + node.width > size.width - NODE_GAP && x > NODE_GAP) {
      x = NODE_GAP;
      y += rowHeight + NODE_GAP;
      rowHeight = 0;
    }
    if (y + node.height > size.height - NODE_GAP) {
      y = NODE_GAP;
    }
    node.x = x + node.width / 2;
    node.y = y + node.height / 2;
    x += node.width + NODE_GAP;
    rowHeight = Math.max(rowHeight, node.height);
  }
}

function groupForPath(modulePath: string): string {
  const parts = modulePath.split("/");
  if ((parts[0] === "packages" || parts[0] === "apps") && parts[1]) {
    return `${parts[0]}/${parts[1]}`;
  }
  return parts[0] ?? ".";
}

function hashNumber(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function deterministicSign(a: string, b: string): -1 | 1 {
  return a.localeCompare(b) <= 0 ? -1 : 1;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
