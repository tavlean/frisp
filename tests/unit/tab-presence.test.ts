import { afterEach, describe, expect, it } from 'vitest';
import {
  anotherTabIsBusy,
  answerBusyQueries,
} from '../../src/client/lazy-app/sw-bridge/runtime';

// Each test uses its own channel so stray answerers never cross tests.
let channelSerial = 0;
const disposers: (() => void)[] = [];
afterEach(() => disposers.splice(0).forEach((dispose) => dispose()));

function channel(): string {
  channelSerial += 1;
  return `test:tabs:${channelSerial}`;
}

describe('tab presence before a service-worker update', () => {
  it('reports a busy other tab', async () => {
    const channelName = channel();
    disposers.push(
      answerBusyQueries(() => true, { tabId: 'other', channelName }),
    );
    await expect(
      anotherTabIsBusy({ tabId: 'me', channelName, waitMs: 200 }),
    ).resolves.toBe(true);
  });

  it('ignores idle tabs', async () => {
    const channelName = channel();
    disposers.push(
      answerBusyQueries(() => false, { tabId: 'other', channelName }),
    );
    await expect(
      anotherTabIsBusy({ tabId: 'me', channelName, waitMs: 50 }),
    ).resolves.toBe(false);
  });

  it('never counts the asking tab as another tab', async () => {
    const channelName = channel();
    disposers.push(answerBusyQueries(() => true, { tabId: 'me', channelName }));
    await expect(
      anotherTabIsBusy({ tabId: 'me', channelName, waitMs: 50 }),
    ).resolves.toBe(false);
  });

  it('stops answering once disposed', async () => {
    const channelName = channel();
    const dispose = answerBusyQueries(() => true, {
      tabId: 'other',
      channelName,
    });
    dispose();
    await expect(
      anotherTabIsBusy({ tabId: 'me', channelName, waitMs: 50 }),
    ).resolves.toBe(false);
  });
});
