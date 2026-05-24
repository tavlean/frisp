export interface ResultDownloadFile {
  name: string;
}

export interface ResultDownloadState {
  side: 'left' | 'right';
  isOriginal: boolean;
  href: string | undefined;
  downloadName: string;
  disabled: boolean;
}

export function getResultDownloadState<FileType extends ResultDownloadFile>(
  flipSide: boolean,
  isOriginal: boolean,
  showLoadingState: boolean,
  downloadUrl: string | undefined,
  imageFile: FileType | undefined,
): ResultDownloadState {
  return {
    side: flipSide ? 'right' : 'left',
    isOriginal,
    href: downloadUrl,
    downloadName: imageFile ? imageFile.name : '',
    disabled: showLoadingState,
  };
}
