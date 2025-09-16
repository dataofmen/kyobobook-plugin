import { Plugin } from 'obsidian';
import { KyobobookPluginSettings } from './types';
import { DEFAULT_SETTINGS } from './settings';
import { KyobobookSearchModal } from './ui/search-modal';
import { KyobobookSettingTab } from './ui/settings-tab';

export default class KyobobookPlugin extends Plugin {
  settings!: KyobobookPluginSettings;

  async onload() {
    console.log('교보문고 플러그인 로딩 시작');

    // 설정 로드
    await this.loadSettings();

    // 검색 커맨드 등록
    this.addCommand({
      id: 'search-kyobobook',
      name: '교보문고 도서 검색',
      callback: () => {
        new KyobobookSearchModal(this.app, this).open();
      }
    });

    // 설정 탭 추가
    this.addSettingTab(new KyobobookSettingTab(this.app, this));

    console.log('교보문고 플러그인 로딩 완료');
  }

  onunload() {
    console.log('교보문고 플러그인 언로딩');
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}