import {
  getElementById,
  getSelectedElements,
  PlaitBoard,
  PlaitElement,
  Transforms,
} from '@plait/core';
import { MindElement } from '@plait/mind';
import { PlaitArrowLine, PlaitDrawElement } from '@plait/draw';
import type { MindAttachment, MindAttachmentLine } from './types';

export type MindAttachmentContext = MindAttachment & {
  mindNode: MindElement;
  element: PlaitElement;
};

export const getMindAttachmentContext = (
  board: PlaitBoard,
  line: MindAttachmentLine
): MindAttachmentContext | null => {
  const source = line.source.boundId ? getElementById(board, line.source.boundId) : undefined;
  const target = line.target.boundId ? getElementById(board, line.target.boundId) : undefined;
  if (!source || !target) {
    return null;
  }
  const mindNode = MindElement.isMindElement(board, source)
    ? source
    : MindElement.isMindElement(board, target)
      ? target
      : undefined;
  const element = PlaitDrawElement.isShapeElement(source)
    ? source
    : PlaitDrawElement.isShapeElement(target)
      ? target
      : undefined;
  if (!mindNode || !element) {
    return null;
  }
  return { mindNodeId: mindNode.id, elementId: element.id, mindNode, element };
};

export const getValidMindAttachment = (
  board: PlaitBoard,
  line: MindAttachmentLine
): MindAttachmentContext | null => {
  if (!line.mindAttachment) {
    return null;
  }
  const context = getMindAttachmentContext(board, line);
  if (
    !context ||
    context.mindNodeId !== line.mindAttachment.mindNodeId ||
    context.elementId !== line.mindAttachment.elementId
  ) {
    return null;
  }
  return context;
};

export const isMindNodeHiddenByAncestor = (board: PlaitBoard, element: MindElement) => {
  return MindElement.getAncestors(board, element).some(
    (ancestor) => MindElement.isMindElement(board, ancestor) && ancestor.isCollapsed
  );
};

export const isMindAttachmentCollapsed = (board: PlaitBoard, element: MindElement) => {
  return !!element.isCollapsed || isMindNodeHiddenByAncestor(board, element);
};

export const getAttachmentLines = (board: PlaitBoard) =>
  board.children.filter(PlaitDrawElement.isArrowLine) as MindAttachmentLine[];

export const getAttachmentLineForElement = (board: PlaitBoard, elementId: string) =>
  getAttachmentLines(board).find((line) => {
    const context = getValidMindAttachment(board, line);
    return context?.elementId === elementId;
  });

export const setMindAttachment = (
  board: PlaitBoard,
  line: MindAttachmentLine,
  enabled: boolean
) => {
  const context = getMindAttachmentContext(board, line);
  if (!context) {
    return { changedOwner: false, changed: false };
  }
  let changedOwner = false;
  if (enabled) {
    getAttachmentLines(board).forEach((candidate) => {
      if (candidate.id === line.id) {
        return;
      }
      const candidateContext = getValidMindAttachment(board, candidate);
      if (candidateContext?.elementId === context.elementId) {
        Transforms.setNode(
          board,
          { mindAttachment: undefined } as Partial<MindAttachmentLine>,
          PlaitBoard.findPath(board, candidate)
        );
        changedOwner = true;
      }
    });
  }
  const mindAttachment: MindAttachment | undefined = enabled
    ? { mindNodeId: context.mindNodeId, elementId: context.elementId }
    : undefined;
  Transforms.setNode(
    board,
    { mindAttachment } as Partial<MindAttachmentLine>,
    PlaitBoard.findPath(board, line)
  );
  return { changedOwner, changed: true };
};

export const getSelectedAttachmentLine = (board: PlaitBoard) => {
  const selected = getSelectedElements(board);
  return selected.length === 1 && PlaitDrawElement.isArrowLine(selected[0])
    ? (selected[0] as MindAttachmentLine)
    : null;
};

export const syncMindAttachment = (board: PlaitBoard, line: MindAttachmentLine) => {
  if (!line.mindAttachment) {
    return;
  }
  const context = getMindAttachmentContext(board, line);
  const next = context
    ? { mindNodeId: context.mindNodeId, elementId: context.elementId }
    : undefined;
  if (
    next?.mindNodeId === line.mindAttachment.mindNodeId &&
    next.elementId === line.mindAttachment.elementId
  ) {
    return;
  }
  Transforms.setNode(
    board,
    { mindAttachment: next } as Partial<MindAttachmentLine>,
    PlaitBoard.findPath(board, line)
  );
};

export const isLineBoundToHiddenMindNode = (board: PlaitBoard, line: PlaitArrowLine) => {
  return [line.source.boundId, line.target.boundId].some((id) => {
    const element = id ? getElementById(board, id) : undefined;
    return (
      !!element &&
      MindElement.isMindElement(board, element) &&
      isMindNodeHiddenByAncestor(board, element)
    );
  });
};

export type PastedLineSnapshot = {
  originalLineId: string;
  sourceBoundId?: string;
  targetBoundId?: string;
  mindAttachment?: MindAttachment;
};

export const remapPastedAttachmentLines = (
  board: PlaitBoard,
  snapshots: PastedLineSnapshot[],
  idsMap: Record<string, string>
) => {
  snapshots.forEach((snapshot) => {
    const lineId = idsMap[snapshot.originalLineId];
    const line = lineId ? getElementById<MindAttachmentLine>(board, lineId) : undefined;
    if (!line || !PlaitDrawElement.isArrowLine(line)) {
      return;
    }
    const source = {
      ...line.source,
      boundId: snapshot.sourceBoundId ? idsMap[snapshot.sourceBoundId] : line.source.boundId,
    };
    const target = {
      ...line.target,
      boundId: snapshot.targetBoundId ? idsMap[snapshot.targetBoundId] : line.target.boundId,
    };
    const mindAttachment =
      snapshot.mindAttachment &&
      idsMap[snapshot.mindAttachment.mindNodeId] &&
      idsMap[snapshot.mindAttachment.elementId]
        ? {
            mindNodeId: idsMap[snapshot.mindAttachment.mindNodeId],
            elementId: idsMap[snapshot.mindAttachment.elementId],
          }
        : undefined;
    Transforms.setNode(
      board,
      { source, target, mindAttachment } as Partial<MindAttachmentLine>,
      PlaitBoard.findPath(board, line)
    );
  });
};
