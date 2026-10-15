import {AudioLevel, VideoLevel} from '../Levels.mjs';

// A manifest may repeat a representation id across adaptations (YouTube's AV1 sets
// do), and the level list is rebuilt on every main loop tick. The duplicate is skipped
// by design, so report each collision once at debug level instead of warning on every
// rebuild.
const reportedDuplicateLevelIds = new Set();

/**
 * Reports a level id claimed by two tracks, at most once per id.
 * @param {string} source - Name of the level list being built.
 * @param {string} levelId - The colliding level id.
 * @param {Object} track - The track that was skipped.
 * @param {Object} existingTrack - The track that already claimed the id.
 */
function reportDuplicateLevelId(source, levelId, track, existingTrack) {
  if (reportedDuplicateLevelIds.has(levelId)) {
    return;
  }
  reportedDuplicateLevelIds.add(levelId);
  console.debug(`Duplicate level id found in ${source}:`, levelId, track, existingTrack);
}

export class DashTrackUtils {
  static getLevelFromRepresentation(rep) {
    const type = rep.adaptation.type;
    const id = rep.id;
    return `${type}-${id}`;
  }

  static deconstructLevel(levelId) {
    const parts = levelId.split('-');
    if (parts.length < 2) {
      return levelId;
    }
    const type = parts[0];
    const id = parts.slice(1).join('-');
    return {type, id};
  }

  static getVideoLevelList(tracks) {
    // make into map
    const map = new Map();

    tracks.forEach((track) => {
      track.bitrateList.forEach((data) => {
        const levelId = 'video-' + data.id;
        const existing = map.get(levelId);
        if (existing) {
          reportDuplicateLevelId('getVideoLevelList', levelId, track, existing.track);
          return;
        }

        map.set(levelId, new VideoLevel({
          id: levelId,
          width: data.width,
          height: data.height,
          bitrate: data.bandwidth,
          mimeType: track.mimeType,
          language: track.lang,
          videoCodec: this.mimeCodecToCodec(track.codec),
          track: track,
        }));
      });
    });
    return map;
  }

  static mimeCodecToCodec(mimeCodec) {
    // mimeCodec format: video/mp4; codecs="avc1.42E01E, mp4a.40.2"
    const parts = mimeCodec.split(';');
    if (parts.length < 2) {
      return null;
    }
    const codecPart = parts[1].trim();
    if (!codecPart.startsWith('codecs=')) {
      return null;
    }
    let codecStr = codecPart.substring(7).trim();
    if (codecStr.startsWith('"') && codecStr.endsWith('"')) {
      codecStr = codecStr.substring(1, codecStr.length - 1);
    }
    return codecStr;
  }

  static getAudioLevelList(tracks) {
    // make into map
    const map = new Map();

    tracks.forEach((track) => {
      track.bitrateList.forEach((data) => {
        const levelId = 'audio-' + data.id;
        const existing = map.get(levelId);
        if (existing) {
          reportDuplicateLevelId('getAudioLevelList', levelId, track, existing.track);
          return;
        }

        map.set(levelId, new AudioLevel({
          id: levelId,
          bitrate: data.bandwidth,
          mimeType: track.mimeType,
          language: track.lang,
          audioCodec: this.mimeCodecToCodec(track.codec),
          track: track,
        }));
      });
    });

    return map;
  }
}

