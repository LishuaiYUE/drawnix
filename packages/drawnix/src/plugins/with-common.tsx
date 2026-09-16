import type { ImageProps, PlaitImageBoard, RenderComponentRef } from '@plait/common';
import { PlaitBoard, PlaitI18nBoard } from '@plait/core';
import { withImagePlugin } from './with-image';
import { DrawI18nKey } from '@plait/draw';
import { MindI18nKey } from '@plait/mind';
import { i18nInsidePlaitHook } from '../i18n';
export const withCommonPlugin = (board: PlaitBoard) => {
  const newBoard = board as PlaitBoard & PlaitImageBoard & PlaitI18nBoard;

  newBoard.renderImage = (container: Element | DocumentFragment, props: ImageProps) => {
    const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    image.setAttribute('preserveAspectRatio', 'none');
    image.classList.add('image-origin');
    if (container instanceof Element) {
      container.replaceWith(image);
    } else {
      container.append(image);
    }
    let newProps = { ...props };
    const render = () => {
      image.setAttribute('href', newProps.imageItem.url);
      image.classList.toggle('image-origin--focus', !!newProps.isFocus);
    };
    render();
    const ref: RenderComponentRef<ImageProps> & {
      updateRectangle: (rectangle: ReturnType<ImageProps['getRectangle']>) => void;
    } = {
      destroy: () => image.remove(),
      updateRectangle: (rectangle) => {
        image.setAttribute('x', `${rectangle.x}`);
        image.setAttribute('y', `${rectangle.y}`);
        image.setAttribute('width', `${rectangle.width}`);
        image.setAttribute('height', `${rectangle.height}`);
      },
      update: (updatedProps: Partial<ImageProps>) => {
        newProps = { ...newProps, ...updatedProps };
        render();
      },
    };
    ref.updateRectangle(props.getRectangle());
    return ref;
  };

  const { t } = i18nInsidePlaitHook(board);

  newBoard.getI18nValue = (key: string) => {
    if (key === DrawI18nKey.lineText) {
      return t('draw.lineText');
    }
    if (key === DrawI18nKey.geometryText) {
      return t('draw.geometryText');
    }
    if (key === MindI18nKey.mindCentralText) {
      return t('mind.centralText');
    }
    if (key === MindI18nKey.abstractNodeText) {
      return t('mind.abstractNodeText');
    }

    return null;
  };

  return withImagePlugin(newBoard);
};
