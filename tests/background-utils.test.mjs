import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * Runs `check` with console.warn captured.
 * @param {Object|null} lastError - Value to put on chrome.runtime.lastError.
 * @param {Function} check - The call under test.
 * @return {Array} Arguments of every warning that was logged.
 */
function warningsFor(lastError, check) {
  const originalWarn = console.warn;
  const warnings = [];
  console.warn = (...args) => warnings.push(args);
  try {
    globalThis.chrome.runtime.lastError = lastError;
    check();
  } finally {
    console.warn = originalWarn;
    globalThis.chrome.runtime.lastError = null;
  }
  return warnings;
}

test('only warns about messaging failures that are not a missing receiver', async () => {
  const previousChrome = globalThis.chrome;
  globalThis.chrome = {
    runtime: {
      getURL: (path) => `chrome-extension://test/${path}`,
      lastError: null,
    },
  };

  try {
    // Imported here: the module reads chrome.runtime at load time.
    const {BackgroundUtils} = await import('../chrome/background/BackgroundUtils.mjs');

    const noReceiver = warningsFor(
        {message: 'Could not establish connection. Receiving end does not exist.'},
        () => BackgroundUtils.checkMessageError('remove_players'));
    assert.equal(noReceiver.length, 0);

    const failure = warningsFor({message: 'Something else went wrong'},
        () => BackgroundUtils.checkMessageError('sources'));
    assert.equal(failure.length, 1);
    assert.match(failure[0][0], /Unable to send message 'sources'/);

    const suppressed = warningsFor({message: 'Something else went wrong'},
        () => BackgroundUtils.checkMessageError('options', true));
    assert.equal(suppressed.length, 0);

    const noError = warningsFor(null, () => BackgroundUtils.checkMessageError('playlist_poll'));
    assert.equal(noError.length, 0);
  } finally {
    globalThis.chrome = previousChrome;
  }
});
