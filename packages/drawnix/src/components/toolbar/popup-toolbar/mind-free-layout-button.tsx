import {
  cacheSelectedElements,
  getElementById,
  getSelectedElements,
  PlaitBoard,
  PlaitOptionsBoard,
  Transforms,
} from '@plait/core';
import { MindElement, PlaitMind, WithMindOptions, WithMindPluginKey } from '@plait/mind';
import { useState } from 'react';
import { MindFreeLayoutIcon, UndoIcon } from '../../icons';
import { ToolButton } from '../../tool-button';
import { useI18n } from '../../../i18n';

export const MindFreeLayoutButton = ({ board }: { board: PlaitBoard }) => {
  const { t } = useI18n();
  const [, refresh] = useState(0);
  const optionBoard = board as PlaitOptionsBoard;
  const selectedNodes = getSelectedElements(board).filter(
    (element): element is MindElement =>
      MindElement.isMindElement(board, element) && !PlaitMind.isMind(element)
  );
  if (!selectedNodes.length) {
    return null;
  }
  const currentNodes = selectedNodes
    .map((node) => getElementById<MindElement>(board, node.id))
    .filter((node): node is MindElement => !!node);

  const enabled =
    !!optionBoard.getPluginOptions<WithMindOptions>(WithMindPluginKey)?.freeNodeLayout;
  const title = t('popupToolbar.freeMindLayout');
  const resetTitle = t('popupToolbar.resetMindPosition');

  return (
    <>
      <ToolButton
        type="button"
        visible={true}
        selected={enabled}
        icon={MindFreeLayoutIcon}
        title={title}
        aria-label={title}
        data-testid="mind-free-layout-button"
        onPointerUp={() => {
          optionBoard.setPluginOptions<WithMindOptions>(WithMindPluginKey, {
            freeNodeLayout: !enabled,
          });
          refresh((value) => value + 1);
        }}
      />
      {currentNodes.some((node) => node.manualOffset) && (
        <ToolButton
          type="button"
          visible={true}
          icon={UndoIcon}
          title={resetTitle}
          aria-label={resetTitle}
          data-testid="mind-reset-position-button"
          onPointerUp={() => {
            const selectedIds = currentNodes.map((node) => node.id);
            currentNodes.forEach((node) => {
              Transforms.setNode(
                board,
                { manualOffset: undefined },
                PlaitBoard.findPath(board, node)
              );
            });
            const nextSelection = selectedIds
              .map((id) => getElementById<MindElement>(board, id))
              .filter((node): node is MindElement => !!node);
            cacheSelectedElements(board, nextSelection);
          }}
        />
      )}
    </>
  );
};
