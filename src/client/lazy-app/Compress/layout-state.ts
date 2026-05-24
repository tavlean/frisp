export type CompressionPanelMode = 'mobile' | 'desktop';
export type CompressionPanelContent = 'options' | 'result';
export type CompressionPanelSide = 0 | 1;

export interface CompressionPanelSlot {
  key: string;
  side: CompressionPanelSide;
  content: CompressionPanelContent;
}

export interface CompressionPanelColumn {
  key: string;
  side: CompressionPanelSide;
  slots: CompressionPanelSlot[];
}

export interface CompressionPanelLayout {
  mode: CompressionPanelMode;
  mobileSlots: CompressionPanelSlot[];
  desktopColumns: CompressionPanelColumn[];
}

function panelSlot(
  side: CompressionPanelSide,
  content: CompressionPanelContent,
): CompressionPanelSlot {
  return {
    key: `${side}-${content}`,
    side,
    content,
  };
}

export function getCompressionPanelLayout(
  mobileView: boolean,
): CompressionPanelLayout {
  const leftOptions = panelSlot(0, 'options');
  const leftResult = panelSlot(0, 'result');
  const rightOptions = panelSlot(1, 'options');
  const rightResult = panelSlot(1, 'result');

  return {
    mode: mobileView ? 'mobile' : 'desktop',
    mobileSlots: [leftResult, leftOptions, rightResult, rightOptions],
    desktopColumns: [
      {
        key: 'left',
        side: 0,
        slots: [leftOptions, leftResult],
      },
      {
        key: 'right',
        side: 1,
        slots: [rightOptions, rightResult],
      },
    ],
  };
}
