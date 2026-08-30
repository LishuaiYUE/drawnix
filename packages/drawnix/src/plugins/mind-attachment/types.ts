import type { PlaitArrowLine } from '@plait/draw';

export type MindAttachment = {
  mindNodeId: string;
  elementId: string;
};

export type MindAttachmentLine = PlaitArrowLine & {
  mindAttachment?: MindAttachment;
};
