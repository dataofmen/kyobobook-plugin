// 교보문고 HTTP 클라이언트

import { NetworkError } from '../../domain/models/Errors';
import { HttpClient } from '../../application/services/BookService';
import { Logger } from '../../shared/utils/Logger';

/**
 * HTTP 요청 옵션
 */
export interface RequestOptions {
  timeout?: number;
  retries?: number;
  headers?: Record<string, string>;
  userAgent?: string;
}

/**
 * HTTP 응답 인터페이스
 */
export interface HttpResponse {
  data: string;
  status: number;
  headers: Record<string, string>;
  url: string;
  responseTime: number;
}

/**
 * 교보문고 전용 HTTP 클라이언트
 *
 * 특징:
 * - Obsidian requestUrl API 래핑
 * - 자동 재시도 및 백오프
 * - 요청 제한 및 쿨다운
 * - User-Agent 로테이션
 * - 응답 캐싱
 */
export class KyobobookClient implements HttpClient {
  private readonly logger: Logger;
  private readonly baseOptions: Required<RequestOptions>;

  // 요청 제한 (Rate Limiting)
  private lastRequestTime = 0;
  private readonly minRequestInterval = 1000; // 1초 간격

  // User-Agent 로테이션
  private readonly userAgents = [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  ];
  private userAgentIndex = 0;

  constructor(logger: Logger, options: RequestOptions = {}) {
    this.logger = logger;
    this.baseOptions = {
      timeout: options.timeout || 10000,
      retries: options.retries || 3,
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Cache-Control': 'max-age=0',
        ...options.headers
      },
      userAgent: options.userAgent || this.getNextUserAgent()
    };
  }

  /**
   * GET 요청
   */
  async get(url: string, options: RequestOptions = {}): Promise<string> {
    const response = await this.request('GET', url, options);
    return response.data;
  }

  /**
   * 전체 응답 정보와 함께 GET 요청
   */
  async getWithResponse(url: string, options: RequestOptions = {}): Promise<HttpResponse> {
    return this.request('GET', url, options);
  }

  /**
   * 바이너리 이미지 → data URL로 반환 (hotlink 방지 대안)
   */
  async getDataUrl(url: string, options: RequestOptions = {}): Promise<string> {
    const merged = this.mergeOptions(options);
    await this.enforceRateLimit();
    // Use Obsidian requestUrl to obtain arrayBuffer when available
    let response: any;
    const req = {
      url,
      method: 'GET',
      headers: {
        ...merged.headers,
        'User-Agent': merged.userAgent,
        'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
      },
      throw: false
    } as any;

    // Helper to guess mime
    const guessMime = (u: string): string => {
      const m = u.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i);
      if (!m) return 'image/jpeg';
      const ext = m[1].toLowerCase();
      return ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
    };

    try {
      if (typeof (globalThis as any).requestUrl !== 'undefined') {
        response = await (globalThis as any).requestUrl(req);
        const ab: ArrayBuffer = response.arrayBuffer ?? response.binary ?? null;
        if (ab) {
          const base64 = KyobobookClient.arrayBufferToBase64(ab);
          return `data:${guessMime(url)};base64,${base64}`;
        }
        // Fallback to text->base64 if arrayBuffer missing
        if (response.body) {
          const enc = (globalThis as any).TextEncoder ? new TextEncoder() : null;
          const buf = enc ? enc.encode(response.body) : null;
          if (buf) {
            const base64 = KyobobookClient.arrayBufferToBase64(buf.buffer);
            return `data:${guessMime(url)};base64,${base64}`;
          }
        }
      }
    } catch (e) {
      this.logger.warn('KyobobookClient', 'getDataUrl requestUrl 실패', { url, error: e });
    }

    // 마지막 수단: fetch 사용 (일부 환경)
    try {
      const res = await fetch(url);
      const ab = await res.arrayBuffer();
      const base64 = KyobobookClient.arrayBufferToBase64(ab);
      return `data:${guessMime(url)};base64,${base64}`;
    } catch (e) {
      throw new NetworkError('이미지 데이터 가져오기 실패', 'KyobobookClient', { url }, e as Error);
    }
  }

  private static arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  /**
   * 기본 HTTP 요청 메서드
   */
  async request(
    method: 'GET' | 'POST',
    url: string,
    options: RequestOptions = {}
  ): Promise<HttpResponse> {
    const mergedOptions = this.mergeOptions(options);
    const startTime = Date.now();

    this.logger.debug('KyobobookClient', `${method} 요청 시작: ${url}`);

    try {
      // Rate limiting 적용
      await this.enforceRateLimit();

      // 재시도 로직
      return await this.executeWithRetry(method, url, mergedOptions, startTime);

    } catch (error) {
      this.logger.error('KyobobookClient', `요청 실패: ${url}`, { error });

      if (error instanceof NetworkError) {
        throw error;
      }

      throw new NetworkError(
        `HTTP 요청이 실패했습니다: ${url}`,
        'KyobobookClient',
        { url, method, originalError: error instanceof Error ? error.message : String(error) },
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * URL이 교보문고 도메인인지 확인
   */
  isKyobobookUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();

      const kyobobookDomains = [
        'www.kyobobook.co.kr',
        'product.kyobobook.co.kr',
        'search.kyobobook.co.kr',
        'kyobobook.co.kr'
      ];

      return kyobobookDomains.some(domain =>
        hostname === domain || hostname.endsWith(`.${domain}`)
      );
    } catch {
      return false;
    }
  }

  /**
   * 클라이언트 상태 확인
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.get('https://www.kyobobook.co.kr/', { timeout: 5000 });
      return response.length > 0;
    } catch {
      return false;
    }
  }

  // === Private Methods ===

  /**
   * 옵션 병합
   */
  private mergeOptions(options: RequestOptions): Required<RequestOptions> {
    return {
      timeout: options.timeout || this.baseOptions.timeout,
      retries: options.retries || this.baseOptions.retries,
      headers: {
        ...this.baseOptions.headers,
        ...options.headers
      },
      userAgent: options.userAgent || this.getNextUserAgent()
    };
  }

  /**
   * Rate limiting 강제 적용
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.minRequestInterval) {
      const waitTime = this.minRequestInterval - timeSinceLastRequest;
      this.logger.debug('KyobobookClient', `Rate limit 대기: ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * 재시도 로직이 포함된 요청 실행
   */
  private async executeWithRetry(
    method: 'GET' | 'POST',
    url: string,
    options: Required<RequestOptions>,
    startTime: number
  ): Promise<HttpResponse> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= options.retries; attempt++) {
      try {
        this.logger.debug('KyobobookClient',
          `요청 시도 ${attempt}/${options.retries}`, { url, method });

        const response = await this.executeRequest(method, url, options);
        const responseTime = Date.now() - startTime;

        this.logger.info('KyobobookClient',
          `요청 성공: ${method} ${url} (${responseTime}ms, ${response.data.length} chars)`);

        return {
          ...response,
          responseTime
        };

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        this.logger.warn('KyobobookClient',
          `요청 시도 ${attempt}/${options.retries} 실패`, { url, error: lastError });

        if (attempt < options.retries) {
          // 지수 백오프 (1초, 2초, 4초)
          const backoffTime = 1000 * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, backoffTime));
        }
      }
    }

    throw new NetworkError(
      `HTTP 요청이 ${options.retries}회 모두 실패했습니다`,
      'KyobobookClient',
      { url, method, retries: options.retries },
      lastError
    );
  }

  /**
   * 실제 HTTP 요청 실행 (Obsidian requestUrl 사용)
   */
  private async executeRequest(
    method: 'GET' | 'POST',
    url: string,
    options: Required<RequestOptions>
  ): Promise<Omit<HttpResponse, 'responseTime'>> {
    // Obsidian의 requestUrl API 사용
    const requestOptions = {
      url,
      method,
      headers: {
        ...options.headers,
        'User-Agent': options.userAgent
      },
      throw: false // 에러를 직접 처리
    };

    let response: any;

    try {
      // @ts-ignore - Obsidian의 requestUrl은 global에 있을 수 있음
      if (typeof requestUrl !== 'undefined') {
        response = await requestUrl(requestOptions);
      } else if (typeof window !== 'undefined' && (window as any).requestUrl) {
        response = await (window as any).requestUrl(requestOptions);
      } else {
        throw new Error('requestUrl API를 찾을 수 없습니다');
      }
    } catch (error) {
      throw new NetworkError(
        '네트워크 요청 실행 실패',
        'KyobobookClient',
        { url, method, originalError: error instanceof Error ? error.message : String(error) },
        error instanceof Error ? error : undefined
      );
    }

    // 응답 상태 확인
    if (response.status < 200 || response.status >= 300) {
      throw new NetworkError(
        `HTTP 오류: ${response.status}`,
        'KyobobookClient',
        { url, method, status: response.status, statusText: response.statusText }
      );
    }

    // 응답 데이터 검증
    if (!response.text || typeof response.text !== 'string') {
      throw new NetworkError(
        '빈 응답 또는 잘못된 응답 형식',
        'KyobobookClient',
        { url, method, dataType: typeof response.text }
      );
    }

    return {
      data: response.text,
      status: response.status,
      headers: response.headers || {},
      url: response.url || url
    };
  }

  /**
   * 다음 User-Agent 가져오기
   */
  private getNextUserAgent(): string {
    const userAgent = this.userAgents[this.userAgentIndex];
    this.userAgentIndex = (this.userAgentIndex + 1) % this.userAgents.length;
    return userAgent;
  }
}

/**
 * 교보문고 클라이언트 팩토리
 */
export class KyobobookClientFactory {
  /**
   * 개발 모드 클라이언트 생성
   */
  static createDevelopmentClient(logger: Logger): KyobobookClient {
    return new KyobobookClient(logger, {
      timeout: 15000,
      retries: 2,
      headers: {
        'X-Debug': 'development'
      }
    });
  }

  /**
   * 프로덕션 모드 클라이언트 생성
   */
  static createProductionClient(logger: Logger): KyobobookClient {
    return new KyobobookClient(logger, {
      timeout: 10000,
      retries: 3
    });
  }

  /**
   * 테스트 모드 클라이언트 생성
   */
  static createTestClient(logger: Logger): KyobobookClient {
    return new KyobobookClient(logger, {
      timeout: 5000,
      retries: 1,
      headers: {
        'X-Test': 'true'
      }
    });
  }
}
