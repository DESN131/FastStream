import assert from 'node:assert/strict';
import test from 'node:test';
import {DashTrackUtils} from '../chrome/player/players/dash/DashTrackUtils.mjs';

/**
 * Builds a fake DASH track as getVideoLevelList/getAudioLevelList see it.
 * @param {string} type - 'video' or 'audio'.
 * @param {Array} representations - [id, bandwidth, width, height] tuples.
 * @return {Object} The fake track.
 */
function track(type, representations) {
  return {
    mimeType: `${type}/mp4`,
    codec: `${type}/mp4;codecs="av01.0.08M.08"`,
    lang: 'und',
    bitrateList: representations.map(([id, bandwidth, width, height]) => {
      return {id, bandwidth, width, height};
    }),
  };
}

/**
 * Runs `build` while collecting anything logged with console.debug.
 * @param {Function} build - The function under test.
 * @return {{levels: Map, reports: Array}} Result and collected reports.
 */
function captureReports(build) {
  const originalDebug = console.debug;
  const reports = [];
  console.debug = (...args) => reports.push(args);
  try {
    return {levels: build(), reports};
  } finally {
    console.debug = originalDebug;
  }
}

// Each test uses its own representation ids: a collision is reported once per id per
// page, which is the point of the throttle.

test('skips levels whose id is reused by another adaptation', () => {
  const tracks = [
    track('video', [[16, 1000, 1920, 1080], [32, 2000, 3840, 2160]]),
    track('video', [[16, 1500, 1920, 1080], [64, 3000, 3840, 2160]]),
  ];

  const {levels, reports} = captureReports(() => DashTrackUtils.getVideoLevelList(tracks));

  assert.deepEqual(Array.from(levels.keys()), ['video-16', 'video-32', 'video-64']);
  assert.equal(levels.get('video-16').bitrate, 1000);
  assert.equal(reports.length, 1);
  assert.equal(reports[0][0], 'Duplicate level id found in getVideoLevelList:');
  assert.equal(reports[0][1], 'video-16');
});

test('reports a duplicated id once, not on every rebuild', () => {
  const tracks = [
    track('video', [[160, 1000, 1920, 1080]]),
    track('video', [[160, 2000, 1920, 1080]]),
  ];

  // The level list is rebuilt by updateHasDownloadSpace on every main loop tick.
  const reports = [];
  let levels;
  for (let tick = 0; tick < 5; tick++) {
    const run = captureReports(() => DashTrackUtils.getVideoLevelList(tracks));
    reports.push(...run.reports);
    levels = run.levels;
  }

  assert.equal(reports.length, 1);
  assert.deepEqual(Array.from(levels.keys()), ['video-160']);
});

test('throttles duplicate audio ids the same way', () => {
  const tracks = [
    track('audio', [[48, 128000]]),
    track('audio', [[48, 256000], [96, 320000]]),
  ];

  const {levels, reports} = captureReports(() => DashTrackUtils.getAudioLevelList(tracks));

  assert.deepEqual(Array.from(levels.keys()), ['audio-48', 'audio-96']);
  assert.equal(reports.length, 1);
  assert.equal(reports[0][0], 'Duplicate level id found in getAudioLevelList:');
  assert.equal(reports[0][1], 'audio-48');
});

test('does not warn for tracks with unique ids', () => {
  const videoTracks = [
    track('video', [[224, 1000, 1920, 1080]]),
    track('video', [[256, 2000, 3840, 2160]]),
  ];
  const audioTracks = [track('audio', [[288, 128000]])];

  const video = captureReports(() => DashTrackUtils.getVideoLevelList(videoTracks));
  const audio = captureReports(() => DashTrackUtils.getAudioLevelList(audioTracks));

  assert.equal(video.reports.length, 0);
  assert.equal(audio.reports.length, 0);
  assert.equal(video.levels.size, 2);
  assert.equal(audio.levels.size, 1);
});
