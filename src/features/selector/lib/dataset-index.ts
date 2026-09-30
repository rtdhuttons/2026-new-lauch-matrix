import type {
  Block,
  DataStatus,
  Dataset,
  Layout,
  Stack,
  Unit,
} from "../model/types";

export interface DatasetIndex {
  ds: Dataset;
  block: (id: string) => Block;
  layout: (id: string) => Layout;
  stack: (id: string) => Stack;
  unit: (id: string) => Unit | undefined;
  stackBlock: (stackId: string) => Block;
  stackLayout: (stackId: string) => Layout;
  unitsInStack: (stackId: string) => Unit[];
  /** Every level of a stack's block, including levels without homes. */
  levelsForStack: (stackId: string) => number[];
}

function byId<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((i) => [i.id, i]));
}

function must<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`Unknown ${what}`);
  return value;
}

export function indexDataset(ds: Dataset): DatasetIndex {
  const blocks = byId(ds.blocks);
  const layouts = byId(ds.layouts);
  const stacks = byId(ds.stacks);
  const units = byId(ds.units);
  const unitsByStack = new Map<string, Unit[]>();
  for (const u of ds.units) {
    const list = unitsByStack.get(u.stackId) ?? [];
    list.push(u);
    unitsByStack.set(u.stackId, list);
  }
  for (const list of unitsByStack.values()) list.sort((a, b) => a.level - b.level);

  const block = (id: string) => must(blocks.get(id), `block ${id}`);
  const stack = (id: string) => must(stacks.get(id), `stack ${id}`);

  return {
    ds,
    block,
    layout: (id) => must(layouts.get(id), `layout ${id}`),
    stack,
    unit: (id) => units.get(id),
    stackBlock: (stackId) => block(stack(stackId).blockId),
    stackLayout: (stackId) => must(layouts.get(stack(stackId).layoutId), "layout"),
    unitsInStack: (stackId) => unitsByStack.get(stackId) ?? [],
    levelsForStack: (stackId) => {
      const b = block(stack(stackId).blockId);
      // A stack starts at its own lowest home; some stacks in a block start higher.
      const own = unitsByStack.get(stackId);
      const start = own?.length ? own[0].level : b.firstResidentialLevel;
      const levels: number[] = [];
      for (let l = start; l <= b.storeys; l++) levels.push(l);
      return levels;
    },
  };
}

const STATUS_RANK: Record<DataStatus, number> = {
  verified: 0,
  estimated: 1,
  assumed: 2,
  unknown: 3,
};

/** The least certain of several statuses. */
export function weakestStatus(statuses: DataStatus[]): DataStatus {
  if (statuses.length === 0) return "unknown";
  return statuses.reduce((a, b) => (STATUS_RANK[b] > STATUS_RANK[a] ? b : a));
}

export function unitLabel(ix: DatasetIndex, unit: Unit): string {
  const block = ix.stackBlock(unit.stackId);
  return `${block.name} #${String(unit.level).padStart(2, "0")}-${unit.stackId}`;
}
