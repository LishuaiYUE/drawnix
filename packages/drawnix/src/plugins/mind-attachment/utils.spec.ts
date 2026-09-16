import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@plait/core', () => ({
  getElementById: (board: any, id: string) => board.all.find((element: any) => element.id === id),
  getSelectedElements: (board: any) => board.selected || [],
  PlaitBoard: {
    findPath: (board: any, element: any) => [board.children.indexOf(element)],
  },
  Transforms: {
    setNode: (board: any, properties: any, path: number[]) =>
      Object.assign(board.children[path[0]], properties),
  },
}));

vi.mock('@plait/mind', () => ({
  MindElement: {
    isMindElement: (_board: any, element: any) => element?.type === 'mind_child',
    getAncestors: (board: any, element: any) => board.ancestors[element.id] || [],
  },
}));

vi.mock('@plait/draw', () => ({
  PlaitDrawElement: {
    isShapeElement: (element: any) =>
      ['geometry', 'image', 'table', 'swimlane'].includes(element?.type),
    isArrowLine: (element: any) => element?.type === 'arrow-line',
  },
}));

import {
  getMindAttachmentContext,
  getValidMindAttachment,
  isLineBoundToHiddenMindNode,
  isMindAttachmentCollapsed,
  remapPastedAttachmentLines,
  setMindAttachment,
  syncMindAttachment,
} from './utils';
import { withMindAttachment } from './with-mind-attachment';

const mind = { id: 'mind-1', type: 'mind_child', children: [], data: { topic: true } };
const shape = { id: 'shape-1', type: 'geometry' };
const line = {
  id: 'line-1',
  type: 'arrow-line',
  source: { boundId: mind.id },
  target: { boundId: shape.id },
};

describe('mind attachments', () => {
  let board: any;

  beforeEach(() => {
    board = {
      children: [line, mind, shape].map((element) => structuredClone(element)),
      all: [],
      ancestors: {},
    };
    board.all = board.children;
  });

  it('recognizes a mind-to-shape line and validates its persisted relation', () => {
    const targetLine = board.children[0];
    expect(getMindAttachmentContext(board, targetLine)).toMatchObject({
      mindNodeId: mind.id,
      elementId: shape.id,
    });
    setMindAttachment(board, targetLine, true);
    expect(getValidMindAttachment(board, targetLine)).toMatchObject({
      mindNodeId: mind.id,
      elementId: shape.id,
    });
  });

  it.each(['geometry', 'image', 'table', 'swimlane'])(
    'accepts a mind connection to a %s element',
    (type) => {
      const external = { id: `external-${type}`, type };
      const targetLine = {
        ...structuredClone(line),
        target: { boundId: external.id },
      };
      board.children = [targetLine, board.children[1], external];
      board.all = board.children;
      expect(getMindAttachmentContext(board, targetLine)).toMatchObject({
        mindNodeId: mind.id,
        elementId: external.id,
      });
    }
  );

  it('treats stale or mismatched persisted ids as an ordinary line', () => {
    const targetLine = board.children[0];
    targetLine.mindAttachment = { mindNodeId: 'missing', elementId: shape.id };
    expect(getValidMindAttachment(board, targetLine)).toBeNull();
  });

  it('treats the owner itself and collapsed ancestors as hidden', () => {
    const owner = board.children[1];
    owner.isCollapsed = true;
    expect(isMindAttachmentCollapsed(board, owner)).toBe(true);
    owner.isCollapsed = false;
    const parent = {
      id: 'parent',
      type: 'mind_child',
      isCollapsed: true,
      children: [owner],
      data: { topic: true },
    };
    board.children = [board.children[0], parent, board.children[2]];
    expect(isMindAttachmentCollapsed(board, owner)).toBe(true);
  });

  it('preserves an enabled relation when collapse removes the mind node from the render index', () => {
    const targetLine = board.children[0];
    const owner = board.children[1];
    const external = board.children[2];
    setMindAttachment(board, targetLine, true);
    const parent = {
      id: 'parent',
      type: 'mind_child',
      isCollapsed: true,
      children: [owner],
      data: { topic: true },
    };
    board.children = [targetLine, external, parent];
    board.all = [targetLine, external, parent];

    syncMindAttachment(board, targetLine);

    expect(targetLine.mindAttachment).toEqual({
      mindNodeId: owner.id,
      elementId: external.id,
    });
    expect(getValidMindAttachment(board, targetLine)).not.toBeNull();
    expect(isMindAttachmentCollapsed(board, owner)).toBe(true);
  });

  it('keeps the toggle enabled and hides both the line and external element after collapse', () => {
    const targetLine = board.children[0];
    const owner = board.children[1];
    const external = board.children[2];
    setMindAttachment(board, targetLine, true);
    const parent = {
      id: 'parent',
      type: 'mind_child',
      isCollapsed: true,
      children: [owner],
      data: { topic: true },
    };
    board.children = [targetLine, external, parent];
    board.all = [targetLine, external, parent];
    board.isVisible = () => true;
    board.getDeletedFragment = (elements: any[]) => elements;
    board.globalPointerUp = () => undefined;
    board.insertFragment = () => undefined;
    withMindAttachment(board);

    board.globalPointerUp({} as PointerEvent);

    expect(targetLine.mindAttachment).toEqual({
      mindNodeId: owner.id,
      elementId: external.id,
    });
    expect(board.isVisible(targetLine)).toBe(false);
    expect(board.isVisible(external)).toBe(false);
  });

  it('keeps only one attachment owner for an external element', () => {
    const otherMind = { id: 'mind-2', type: 'mind_child', children: [], data: { topic: true } };
    const otherLine = {
      id: 'line-2',
      type: 'arrow-line',
      source: { boundId: otherMind.id },
      target: { boundId: shape.id },
    };
    board.children.push(otherLine, otherMind);
    board.all = board.children;
    setMindAttachment(board, board.children[0], true);
    const result = setMindAttachment(board, otherLine, true);
    expect(result.changedOwner).toBe(true);
    expect(board.children[0].mindAttachment).toBeUndefined();
    expect(otherLine.mindAttachment).toEqual({ mindNodeId: otherMind.id, elementId: shape.id });
  });

  it('updates or clears an enabled relation after endpoint rebinding', () => {
    const targetLine = board.children[0];
    setMindAttachment(board, targetLine, true);
    const otherShape = { id: 'shape-2', type: 'image' };
    board.children.push(otherShape);
    board.all = board.children;
    targetLine.target.boundId = otherShape.id;
    syncMindAttachment(board, targetLine);
    expect(targetLine.mindAttachment).toEqual({
      mindNodeId: mind.id,
      elementId: otherShape.id,
    });
    targetLine.source.boundId = otherShape.id;
    syncMindAttachment(board, targetLine);
    expect(targetLine.mindAttachment).toBeUndefined();
  });

  it('hides an ordinary line to a descendant without hiding its external endpoint', () => {
    const owner = board.children[1];
    const parent = {
      id: 'parent',
      type: 'mind_child',
      isCollapsed: true,
      children: [owner],
      data: { topic: true },
    };
    board.children = [board.children[0], parent, board.children[2]];
    expect(isLineBoundToHiddenMindNode(board, board.children[0])).toBe(true);
    expect(isMindAttachmentCollapsed(board, owner)).toBe(true);
  });

  it('remaps both endpoints and attachment ids when all related elements are pasted', () => {
    const pastedLine = {
      ...structuredClone(line),
      id: 'new-line',
      mindAttachment: { mindNodeId: mind.id, elementId: shape.id },
    };
    const pastedMind = { ...structuredClone(mind), id: 'new-mind' };
    const pastedShape = { ...structuredClone(shape), id: 'new-shape' };
    board.children = [pastedLine, pastedMind, pastedShape];
    board.all = board.children;
    remapPastedAttachmentLines(
      board,
      [
        {
          originalLineId: line.id,
          sourceBoundId: mind.id,
          targetBoundId: shape.id,
          mindAttachment: { mindNodeId: mind.id, elementId: shape.id },
        },
      ],
      {
        [line.id]: pastedLine.id,
        [mind.id]: pastedMind.id,
        [shape.id]: pastedShape.id,
      }
    );
    expect(pastedLine.source.boundId).toBe(pastedMind.id);
    expect(pastedLine.target.boundId).toBe(pastedShape.id);
    expect(pastedLine.mindAttachment).toEqual({
      mindNodeId: pastedMind.id,
      elementId: pastedShape.id,
    });
  });

  it('drops the attachment when only part of the relation is pasted', () => {
    const pastedLine = {
      ...structuredClone(line),
      id: 'new-line',
      mindAttachment: { mindNodeId: mind.id, elementId: shape.id },
    };
    board.children = [pastedLine];
    board.all = board.children;
    remapPastedAttachmentLines(
      board,
      [
        {
          originalLineId: line.id,
          mindAttachment: { mindNodeId: mind.id, elementId: shape.id },
        },
      ],
      { [line.id]: pastedLine.id, [mind.id]: 'new-mind' }
    );
    expect(pastedLine.mindAttachment).toBeUndefined();
  });
});
