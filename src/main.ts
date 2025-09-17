import { Plugin } from 'obsidian';
import { KyobobookPluginSettings } from './types';
import { DEFAULT_SETTINGS } from './settings';
import { KyobobookSearchModal } from './ui/search-modal';
import { KyobobookSettingTab } from './ui/settings-tab';
import { BookService } from './application/services/BookService';
import { KyobobookClientFactory } from './infrastructure/http/KyobobookClient';
import { BookMemoryCache } from './infrastructure/cache/MemoryCache';
import { Logger, createDevelopmentLogger, createProductionLogger } from './shared/utils/Logger';
import { DebugLogger } from './utils/debug';

export default class KyobobookPlugin extends Plugin {
  settings!: KyobobookPluginSettings;

  // 새로운 서비스 레이어
  private bookService!: BookService;
  private httpClient!: ReturnType<typeof KyobobookClientFactory.createDevelopmentClient>;
  private cache!: BookMemoryCache;
  private logger!: Logger;

  async onload() {
    console.log('교보문고 플러그인 로딩 시작');

    try {
      // 설정 로드
      await this.loadSettings();

      // 서비스 레이어 초기화
      await this.initializeServices();

      // 레거시 디버그 시스템 (호환성 유지)
      DebugLogger.setDebugMode(this.settings.debugMode);
      DebugLogger.log('PLUGIN', `디버그 모드: ${this.settings.debugMode ? '활성화' : '비활성화'}`);

      // UI 컴포넌트 등록
      this.registerUIComponents();

      // 설정 탭 추가
      this.addSettingTab(new KyobobookSettingTab(this.app, this));

      this.logger.info('KyobobookPlugin', '플러그인 로딩 완료');
      console.log('교보문고 플러그인 로딩 완료');

    } catch (error) {
      console.error('교보문고 플러그인 로딩 실패:', error);
      throw error;
    }
  }

  onunload() {
    this.logger?.info('KyobobookPlugin', '플러그인 언로딩 시작');

    // 캐시 정리
    this.cache?.clear();

    // 로거 정리
    this.logger?.clearOutputs();

    console.log('교보문고 플러그인 언로딩 완료');
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);

    // 설정 변경 시 디버그 모드도 업데이트
    DebugLogger.setDebugMode(this.settings.debugMode);
    DebugLogger.log('PLUGIN', `디버그 모드 업데이트: ${this.settings.debugMode ? '활성화' : '비활성화'}`);

    // 새로운 로거 시스템에도 적용
    if (this.logger) {
      const logLevel = this.settings.debugMode ? 0 : 1; // DEBUG : INFO
      this.logger.setLogLevel(logLevel);
      this.logger.info('KyobobookPlugin', `로그 레벨 업데이트: ${this.settings.debugMode ? 'DEBUG' : 'INFO'}`);
    }
  }

  /**
   * 서비스 레이어 초기화
   */
  private async initializeServices(): Promise<void> {
    // 로거 초기화
    this.logger = this.settings.debugMode
      ? createDevelopmentLogger()
      : createProductionLogger();

    this.logger.info('KyobobookPlugin', '서비스 레이어 초기화 시작');

    // HTTP 클라이언트 초기화
    this.httpClient = this.settings.debugMode
      ? KyobobookClientFactory.createDevelopmentClient(this.logger)
      : KyobobookClientFactory.createProductionClient(this.logger);

    // 캐시 초기화
    this.cache = new BookMemoryCache(
      this.settings.maxCacheSize || 200,
      (this.settings.cacheTimeoutMinutes || 60) * 60 * 1000,
      this.logger
    );

    // BookService 초기화
    this.bookService = new BookService(
      this.httpClient,
      this.logger,
      this.cache
    );

    // 연결 테스트
    const isHealthy = await this.httpClient.healthCheck();
    if (isHealthy) {
      this.logger.info('KyobobookPlugin', '교보문고 서버 연결 확인 완료');
    } else {
      this.logger.warn('KyobobookPlugin', '교보문고 서버 연결 실패 - 오프라인 모드로 동작');
    }

    this.logger.info('KyobobookPlugin', '서비스 레이어 초기화 완료');
  }

  /**
   * UI 컴포넌트 등록
   */
  private registerUIComponents(): void {
    // 사이드 패널에 도서 검색 버튼 추가
    this.addRibbonIcon('book-open', '교보문고 도서 검색', () => {
      this.openSearchModal();
    });

    // 검색 커맨드 등록
    this.addCommand({
      id: 'search-kyobobook',
      name: '교보문고 도서 검색',
      callback: () => {
        this.openSearchModal();
      }
    });

    // 캐시 상태 확인 커맨드 (디버그 모드에서만)
    if (this.settings.debugMode) {
      this.addCommand({
        id: 'kyobobook-cache-status',
        name: '캐시 상태 확인',
        callback: () => {
          this.showCacheStatus();
        }
      });
    }
  }

  /**
   * 검색 모달 열기
   */
  private openSearchModal(): void {
    try {
      const modal = new KyobobookSearchModal(
        this.app,
        this,
        this.bookService,
        this.logger
      );
      modal.open();
    } catch (error) {
      this.logger.error('KyobobookPlugin', '검색 모달 열기 실패', { error });
      console.error('검색 모달 열기 실패:', error);
    }
  }

  /**
   * 캐시 상태 표시 (디버그용)
   */
  private showCacheStatus(): void {
    const stats = this.cache.getStats();
    const serviceStats = this.bookService.getCacheStats();

    console.log('=== 캐시 상태 ===');
    console.log('크기:', stats.size, '/', stats.maxSize);
    console.log('히트율:', (stats.hitRate * 100).toFixed(1) + '%');
    console.log('총 히트:', stats.hitCount);
    console.log('총 미스:', stats.missCount);
    console.log('제거 횟수:', stats.evictionCount);
    console.log('서비스 통계:', serviceStats);

    this.logger.info('KyobobookPlugin', '캐시 상태 조회', { stats, serviceStats });
  }

  /**
   * 서비스 레이어 접근자 (외부에서 사용 가능)
   */
  getBookService(): BookService {
    return this.bookService;
  }

  getLogger(): Logger {
    return this.logger;
  }

  getCache(): BookMemoryCache {
    return this.cache;
  }
}