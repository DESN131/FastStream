const PlayerURL = chrome.runtime.getURL('player/index.html');

// Messages are sent to tabs, frames and content scripts that may not exist (yet) or may
// already be gone, which Chrome reports as an error. That is expected and not actionable,
// so only real messaging failures are worth a warning.
const NO_RECEIVER_ERROR = /could not establish connection|receiving end does not exist/i;

export class BackgroundUtils {
  static checkMessageError(message, suppress = false) {
    const error = chrome.runtime.lastError;
    if (!error || NO_RECEIVER_ERROR.test(error.message || '')) {
      return;
    }
    if (!suppress) {
      console.warn(`Unable to send message '${message}'`, error);
    }
  }

  static checkPermissions() {
    return new Promise((resolve, reject) => {
      chrome.permissions.contains({
        origins: ['<all_urls>'],
        permissions: ['storage', 'tabs', 'webRequest', 'declarativeNetRequest'],
      }, (result) => {
        resolve(result);
      });
    });
  }

  static openWelcomePageOnInstall() {
    chrome.runtime.onInstalled.addListener((object) => {
      chrome.storage.local.get('welcome', (result) => {
        if (!result || !result.welcome) {
          chrome.tabs.create({
            url: chrome.runtime.getURL('welcome.html'),
          }, (tab) => {
            chrome.storage.local.set({
              welcome: true,
            });
          });
        }
      });
    });
  }

  static updateTabIcon(tab, skipNotify) {
    clearTimeout(tab.tabIconTimeout);
    if (tab.isOn) {
      chrome.action.setBadgeText({
        text: 'On',
        tabId: tab.tabId,
      });
      chrome.action.setIcon({
        path: '/icon2_128.png',
        tabId: tab.tabId,
      });
    } else {
      chrome.action.setIcon({
        path: '/icon128.png',
        tabId: tab.tabId,
      });
      if (skipNotify) {
        chrome.action.setBadgeText({
          text: '',
          tabId: tab.tabId,
        });
      } else {
        chrome.action.setBadgeText({
          text: 'Off',
          tabId: tab.tabId,
        });
        tab.tabIconTimeout = setTimeout(() => {
          chrome.action.setBadgeText({
            text: '',
            tabId: tab.tabId,
          });
        }, 1000);
      }
    }
  }

  static queryTabs() {
    return new Promise((resolve, reject) => {
      chrome.tabs.query({}, (tabs) => {
        resolve(tabs);
      });
    });
  }

  static isSubtitles(ext) {
    return ext === 'vtt' || ext === 'srt';
  }

  static isUrlPlayerUrl(url) {
    return url.substring(0, PlayerURL.length) === PlayerURL;
  }

  static getPlayerUrl() {
    return PlayerURL;
  }

  static isUserScriptsAvailable() {
    try {
      // Method call which throws if API permission or toggle is not enabled.
      chrome.userScripts.getScripts();
      return true;
    } catch {
      // Not available.
      return false;
    }
  }
}
