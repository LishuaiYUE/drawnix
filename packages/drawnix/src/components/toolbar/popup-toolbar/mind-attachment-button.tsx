import type { PlaitBoard } from '@plait/core';
import { ToolButton } from '../../tool-button';
import { MindAttachmentIcon } from '../../icons';
import { useI18n } from '../../../i18n';
import type { DrawnixBoard } from '../../../hooks/use-drawnix';
import {
  getMindAttachmentContext,
  getSelectedAttachmentLine,
  getValidMindAttachment,
  setMindAttachment,
} from '../../../plugins/mind-attachment/utils';

export const MindAttachmentButton = ({ board }: { board: PlaitBoard }) => {
  const { t } = useI18n();
  const line = getSelectedAttachmentLine(board);
  if (!line || !getMindAttachmentContext(board, line)) {
    return null;
  }
  const selected = !!getValidMindAttachment(board, line);
  const title = t('popupToolbar.followMindCollapse');
  return (
    <ToolButton
      type="button"
      visible={true}
      selected={selected}
      className="mind-attachment-button"
      icon={MindAttachmentIcon}
      title={title}
      aria-label={title}
      data-testid="mind-attachment-button"
      onPointerUp={() => {
        const result = setMindAttachment(board, line, !selected);
        if (result.changedOwner) {
          (board as DrawnixBoard).showToast?.({
            message: t('mindAttachment.reassigned'),
            type: 'info',
          });
        }
      }}
    />
  );
};
