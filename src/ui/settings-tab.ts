import { App, PluginSettingTab, Setting } from 'obsidian';
import KyobobookPlugin from '../main';

export class KyobobookSettingTab extends PluginSettingTab {
  plugin: KyobobookPlugin;

  constructor(app: App, plugin: KyobobookPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();
    containerEl.addClass('kyobobook-settings');

    containerEl.createEl('h2', { text: '교보문고 플러그인 설정' });

    // 저장 폴더 설정
    new Setting(containerEl)
      .setName('저장 폴더')
      .setDesc('도서 노트가 저장될 폴더를 지정합니다. 비워두면 루트 폴더에 저장됩니다.')
      .addText(text => text
        .setPlaceholder('예: 도서')
        .setValue(this.plugin.settings.saveFolder)
        .onChange(async (value) => {
          this.plugin.settings.saveFolder = value;
          await this.plugin.saveSettings();
        }));

    // 파일명 템플릿 설정
    new Setting(containerEl)
      .setName('파일명 템플릿')
      .setDesc('생성될 노트의 파일명 형식을 지정합니다. 사용 가능한 변수: {{title}}, {{authors}}, {{publisher}}, {{publishDate}}')
      .addText(text => text
        .setPlaceholder('예: {{title}} - {{authors}}')
        .setValue(this.plugin.settings.filenameTemplate)
        .onChange(async (value) => {
          this.plugin.settings.filenameTemplate = value;
          await this.plugin.saveSettings();
        }));

    // 최대 검색 결과 수
    new Setting(containerEl)
      .setName('최대 검색 결과 수')
      .setDesc('검색 시 표시할 최대 결과 개수를 설정합니다.')
      .addSlider(slider => slider
        .setLimits(10, 100, 10)
        .setValue(this.plugin.settings.maxSearchResults)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.maxSearchResults = value;
          await this.plugin.saveSettings();
        }));

    // 자동 태그 생성
    new Setting(containerEl)
      .setName('자동 태그 생성')
      .setDesc('도서의 카테고리를 자동으로 태그로 변환합니다.')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.autoCreateTags)
        .onChange(async (value) => {
          this.plugin.settings.autoCreateTags = value;
          await this.plugin.saveSettings();
        }));

    // 노트 생성 전 상세정보 선조회(엄격 모드)
    new Setting(containerEl)
      .setName('노트 생성 전 상세정보 선조회(엄격 모드)')
      .setDesc('검색 결과 목록/노트 생성 전에 상세 정보를 미리 조회하여 표지/소개/목차를 최대한 보장합니다. 결과 표시가 느려질 수 있습니다.')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.strictDetailPrefetch)
        .onChange(async (value) => {
          this.plugin.settings.strictDetailPrefetch = value;
          await this.plugin.saveSettings();
        }));

    // 목록 상세 선조회 개수
    new Setting(containerEl)
      .setName('목록 상세 선조회 개수')
      .setDesc('엄격 모드에서 검색 결과 상단 몇 개 항목에 대해 상세 정보를 선조회할지 설정합니다.')
      .addSlider(slider => slider
        .setLimits(0, 20, 1)
        .setValue(this.plugin.settings.prefetchCount ?? 8)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.prefetchCount = value;
          await this.plugin.saveSettings();
        }));

    // 선조회 완전 OFF
    new Setting(containerEl)
      .setName('검색 후 상세 선조회 끄기 (속도 우선)')
      .setDesc('검색 직후 상세 정보를 선조회하지 않습니다. 선택/노트 생성 시에만 상세 요청을 수행합니다.')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.disablePrefetch ?? false)
        .onChange(async (value) => {
          this.plugin.settings.disablePrefetch = value;
          await this.plugin.saveSettings();
        }));

    // 썸네일 강제 교보 정적 URL 사용
    new Setting(containerEl)
      .setName('썸네일 강제 교보 정적 URL 사용')
      .setDesc('검색 목록과 생성 노트의 표지를 항상 교보 정적 이미지 URL로 사용합니다. 가장 안정적이지만 해상도/최신성이 제한될 수 있습니다.')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.enforceStaticCover)
        .onChange(async (value) => {
          this.plugin.settings.enforceStaticCover = value;
          await this.plugin.saveSettings();
        }));

    // 노트에 표지를 data URL로 내장
    new Setting(containerEl)
      .setName('노트에 표지를 내장(data URL)')
      .setDesc('핫링크 차단으로 이미지가 표시되지 않는 경우를 방지하기 위해, 노트에 표지 이미지를 data URL로 직접 내장합니다. 노트 용량이 커질 수 있습니다.')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.embedCoverInNote ?? false)
        .onChange(async (value) => {
          this.plugin.settings.embedCoverInNote = value;
          await this.plugin.saveSettings();
        }));

    // 목차 강제 API 우선
    new Setting(containerEl)
      .setName('목차 강제 API 우선')
      .setDesc('목차를 먼저 API로 요청하고, 실패 시 HTML 파싱으로 폴백합니다. 일부 환경에서 더 안정적입니다.')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.tocApiFirst ?? false)
        .onChange(async (value) => {
          this.plugin.settings.tocApiFirst = value;
          await this.plugin.saveSettings();
        }));

    // 디버깅 모드
    new Setting(containerEl)
      .setName('디버깅 모드')
      .setDesc('개발 디버깅을 위한 상세한 로그를 출력하고 HTML 파일을 저장합니다.')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.debugMode)
        .onChange(async (value) => {
          this.plugin.settings.debugMode = value;
          await this.plugin.saveSettings();
        }));

    // 노트 템플릿 설정
    const templateSetting = new Setting(containerEl)
      .setName('노트 템플릿')
      .setDesc('생성될 노트의 템플릿을 설정합니다.');

    templateSetting.descEl.createDiv({
      cls: 'setting-item-description',
      text: '사용 가능한 변수: {{title}}, {{authors}}, {{publisher}}, {{publishDate}}, {{isbn}}, {{pages}}, {{description}}, {{toc}}, {{categories}}, {{tags}}, {{rating}}, {{url}}, {{created}}'
    });

    templateSetting.addTextArea(text => {
      text.setValue(this.plugin.settings.noteTemplate);
      text.inputEl.rows = 20;
      text.inputEl.cols = 50;
      text.onChange(async (value) => {
        this.plugin.settings.noteTemplate = value;
        await this.plugin.saveSettings();
      });
      return text;
    });

    // 기본 템플릿 복원 버튼
    new Setting(containerEl)
      .setName('기본 템플릿 복원')
      .setDesc('노트 템플릿을 기본값으로 복원합니다.')
      .addButton(button => button
        .setButtonText('기본값 복원')
        .setWarning()
        .onClick(async () => {
          const { DEFAULT_SETTINGS } = await import('../settings');
          this.plugin.settings.noteTemplate = DEFAULT_SETTINGS.noteTemplate;
          await this.plugin.saveSettings();
          this.display(); // 설정 탭 새로고침
        }));

    // 파일 로깅
    new Setting(containerEl)
      .setName('파일 로깅 활성화')
      .setDesc('실행 로그를 Vault 파일에 저장합니다. 문제 재현 로그 공유에 유용합니다.')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.enableFileLogging ?? true)
        .onChange(async (value) => {
          this.plugin.settings.enableFileLogging = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('로그 파일 경로')
      .setDesc('Vault 기준 상대 경로. 예: .obsidian/plugins/kyobobook-plugin/kyobobook.log')
      .addText(text => text
        .setPlaceholder('.obsidian/plugins/kyobobook-plugin/kyobobook.log')
        .setValue(this.plugin.settings.logFilePath || '.obsidian/plugins/kyobobook-plugin/kyobobook.log')
        .onChange(async (value) => {
          this.plugin.settings.logFilePath = value || '.obsidian/plugins/kyobobook-plugin/kyobobook.log';
          await this.plugin.saveSettings();
        }));
  }
}
