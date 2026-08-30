import {
  ClipboardData,
  depthFirstRecursion,
  PlaitElement,
  PlaitPlugin,
  Point,
  WritableClipboardOperationType,
} from '@plait/core';
import { MindElement } from '@plait/mind';
import { PlaitDrawElement } from '@plait/draw';
import type { MindAttachmentLine } from './types';
import {
  getAttachmentLineForElement,
  getAttachmentLines,
  getValidMindAttachment,
  isLineBoundToHiddenMindNode,
  isMindAttachmentCollapsed,
  remapPastedAttachmentLines,
  syncMindAttachment,
} from './utils';

export const withMindAttachment: PlaitPlugin = (board) => {
  const { isVisible, getDeletedFragment, globalPointerUp, insertFragment } = board;

  board.isVisible = (element: PlaitElement) => {
    if (!isVisible(element)) {
      return false;
    }
    if (PlaitDrawElement.isArrowLine(element)) {
      const attachment = getValidMindAttachment(board, element);
      if (attachment && isMindAttachmentCollapsed(board, attachment.mindNode)) {
        return false;
      }
      return !isLineBoundToHiddenMindNode(board, element);
    }
    const attachmentLine = getAttachmentLineForElement(board, element.id);
    if (!attachmentLine) {
      return true;
    }
    const attachment = getValidMindAttachment(board, attachmentLine);
    return !attachment || !isMindAttachmentCollapsed(board, attachment.mindNode);
  };

  board.getDeletedFragment = (data: PlaitElement[]) => {
    const deletedIds = new Set<string>();
    data.forEach((element) => {
      if (MindElement.isMindElement(board, element)) {
        depthFirstRecursion(element, (node) => deletedIds.add(node.id));
      }
    });
    if (deletedIds.size) {
      getAttachmentLines(board).forEach((line) => {
        if (
          (line.source.boundId && deletedIds.has(line.source.boundId)) ||
          (line.target.boundId && deletedIds.has(line.target.boundId))
        ) {
          data.push(line);
        }
      });
    }
    return getDeletedFragment(Array.from(new Set(data)));
  };

  board.globalPointerUp = (event: PointerEvent) => {
    globalPointerUp(event);
    getAttachmentLines(board).forEach((line) => syncMindAttachment(board, line));
  };

  board.insertFragment = (
    clipboardData: ClipboardData | null,
    targetPoint: Point,
    operationType?: WritableClipboardOperationType
  ) => {
    const records =
      clipboardData?.elements?.map((element) => ({ element, originalId: element.id })) ?? [];
    const snapshots = records
      .filter(({ element }) => PlaitDrawElement.isArrowLine(element))
      .map(({ element, originalId }) => {
        const line = element as MindAttachmentLine;
        return {
          originalLineId: originalId,
          sourceBoundId: line.source.boundId,
          targetBoundId: line.target.boundId,
          mindAttachment: line.mindAttachment ? { ...line.mindAttachment } : undefined,
        };
      });
    insertFragment(clipboardData, targetPoint, operationType);
    const idsMap = Object.fromEntries(
      records.map(({ element, originalId }) => [originalId, element.id])
    );
    remapPastedAttachmentLines(board, snapshots, idsMap);
  };

  return board;
};
