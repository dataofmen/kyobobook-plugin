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
  }
}