import { canvasEncodeTest } from 'client/lazy-app/util/canvas';
import { mimeType } from '../shared/meta';
export { encode } from './runtime';

export const featureTest = () => canvasEncodeTest(mimeType);
