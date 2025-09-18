// 도서 검색 및 정보 조회 서비스

import { Book, CreateBookInput, BookFactory } from '../../domain/models/Book';
import { NetworkError, SearchError, ParseError } from '../../domain/models/Errors';
import { SearchResultParser } from '../../infrastructure/parsers/SearchResultParser';
import { BookDetailParser } from '../../infrastructure/parsers/BookDetailParser';
import { Logger } from '../../shared/utils/Logger';

/**
 * 검색 옵션 인터페이스
 */
export interface SearchOptions {
  maxResults?: number;
  enableDetailFetch?: boolean;
  cacheResults?: boolean;
  timeout?: number;
}

/**
 * 검색 결과 인터페이스
 */
export interface SearchResult {
  books: Book[];
  totalFound: number;
  searchTime: number;
  query: string;
  hasMore: boolean;
  parseMetrics: ReturnType<SearchResultParser['getParseMetrics']>;
}

/**
 * 도서 세부 정보 결과 인터페이스
 */
export interface BookDetailResult {
  book: Book;
  parseResults: ReturnType<BookDetailParser['getParseResults']>;
  fetchTime: number;
}

/**
 * HTTP 클라이언트 인터페이스 (의존성 주입용)
 */
export interface HttpClient {
  get(url: string, options?: { timeout?: number }): Promise<string>;
  // optional methods (runtime-checked)
  getDataUrl?(url: string, options?: { timeout?: number }): Promise<string>;
}

/**
 * 캐시 인터페이스 (의존성 주입용)
 */
export interface BookCache {
  get(key: string): Book | undefined;
  set(key: string, book: Book): void;
  has(key: string): boolean;
  clear(): void;
  size(): number;
}

/**
 * 도서 검색 및 정보 조회를 위한 서비스 클래스
 *
 * 역할:
 * - 교보문고 도서 검색 비즈니스 로직
 * - HTML 파서 조정 및 오케스트레이션
 * - 캐싱 및 성능 최적화
 * - 에러 처리 및 복구
 */
export class BookService {
  private readonly httpClient: HttpClient;
  private readonly cache?: BookCache;
  private readonly logger: Logger;

  private readonly defaultOptions: Required<SearchOptions> = {
    maxResults: 20,
    enableDetailFetch: false,
    cacheResults: true,
    timeout: 10000
  };

  constructor(
    httpClient: HttpClient,
    logger: Logger,
    cache?: BookCache
  ) {
    this.httpClient = httpClient;
    this.logger = logger;
    this.cache = cache;
  }

  /**
   * 도서 검색
   */
  async searchBooks(
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult> {
    const mergedOptions = { ...this.defaultOptions, ...options };
    const startTime = Date.now();

    this.logger.debug('BookService', `도서 검색 시작: "${query}"`);

    try {
      // 입력 유효성 검사
      this.validateSearchQuery(query);

      // 캐시 확인
      const cacheKey = this.buildSearchCacheKey(query, mergedOptions);
      if (mergedOptions.cacheResults && this.cache?.has(cacheKey)) {
        this.logger.debug('BookService', '캐시에서 검색 결과 반환');
        return this.getCachedSearchResult(cacheKey, query, startTime);
      }

      // 검색 URL 생성
      const searchUrl = this.buildSearchUrl(query, mergedOptions.maxResults);

      // HTML 페이지 가져오기
      const html = await this.fetchWithRetry(searchUrl, mergedOptions.timeout);

      // 검색 결과 파싱
      const parser = new SearchResultParser(html);
      const books = parser.parseBooks(mergedOptions.maxResults);
      const parseMetrics = parser.getParseMetrics();

      // 상세 정보 가져오기 (옵션 활성화 시)
      const enrichedBooks = mergedOptions.enableDetailFetch
        ? await this.enrichBooksWithDetails(books, mergedOptions.timeout)
        : books;

      // 검색 결과 구성
      const result: SearchResult = {
        books: enrichedBooks,
        totalFound: parseMetrics.totalItems,
        searchTime: Date.now() - startTime,
        query,
        hasMore: enrichedBooks.length < parseMetrics.totalItems,
        parseMetrics
      };

      // 캐시에 저장
      if (mergedOptions.cacheResults && this.cache) {
        this.cacheSearchResult(cacheKey, result);
      }

      this.logger.info('BookService',
        `검색 완료: ${enrichedBooks.length}권 발견 (${result.searchTime}ms)`);

      return result;

    } catch (error) {
      this.logger.error('BookService', '도서 검색 실패', { query, error });

      if (error instanceof NetworkError || error instanceof SearchError) {
        throw error;
      }

      throw new SearchError(
        '도서 검색 중 오류가 발생했습니다',
        'BookService',
        { query, originalError: error instanceof Error ? error.message : String(error) },
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * 도서 상세 정보 조회
   */
  async getBookDetail(bookId: string, timeout = 10000, options: { tocApiFirst?: boolean } = {}): Promise<BookDetailResult> {
    const startTime = Date.now();

    this.logger.debug('BookService', `도서 상세 정보 조회: ${bookId}`);

    try {
      // 캐시 확인
      const cacheKey = `detail:${bookId}`;
      if (this.cache?.has(cacheKey)) {
        const cachedBook = this.cache.get(cacheKey)!;
        // 캐시된 객체가 검색 단계의 축약 정보인지 검증(핵심 필드 없으면 무시)
        const hasEnriched = Boolean(
          (cachedBook.description && cachedBook.description.trim().length > 0) ||
          (cachedBook.tableOfContents && cachedBook.tableOfContents.trim().length > 0) ||
          (cachedBook.isbn && cachedBook.isbn.trim().length >= 10) ||
          (typeof cachedBook.pages === 'number' && cachedBook.pages > 0)
        );
        if (hasEnriched) {
          this.logger.debug('BookService', '캐시에서 상세 정보 반환');
          return {
            book: cachedBook,
            parseResults: {
              successRate: 100,
              totalFields: 0,
              successfulFields: 0,
              isbn: true,
              pages: true,
              description: true,
              tableOfContents: true,
              categories: true,
              rating: true,
              coverImage: true,
              errors: []
            },
            fetchTime: Date.now() - startTime
          };
        } else {
          this.logger.debug('BookService', '캐시 히트 무시(축약 데이터) → 원본 상세 요청 진행');
        }
      }

      // 상세 페이지 URL 생성
      const detailUrl = this.buildDetailUrl(bookId);

      // HTML 페이지 가져오기
      const html = await this.fetchWithRetry(detailUrl, timeout);

      // 기본 Book 객체 생성 (ID만으로)
      const baseBook = BookFactory.create({
        id: bookId,
        title: '',
        authors: [],
        publisher: '',
        detailPageUrl: detailUrl,
        language: 'ko'
      });

      // 상세 정보 파싱 및 병합
      const parser = new BookDetailParser(html);
      const enrichedBook = parser.enrichBook(baseBook);
      const parseResults = parser.getParseResults();

      let finalBook = enrichedBook;

      // 옵션: TOC를 API/발견 경로로 먼저 시도
      if (options.tocApiFirst) {
        try {
          // 1) 인라인 JSON/발견 엔드포인트 우선
          let toc = await this.fetchTocFromDiscovered(parser, detailUrl, timeout);
          // 2) 기존 추정 경로 폴백
          if (!toc) toc = await this.fetchTocFromApi(bookId, timeout);
          if (toc) {
            finalBook = BookFactory.update(enrichedBook, { tableOfContents: toc });
          }
        } catch (e) {
          this.logger.warn('BookService', 'TOC API 우선 시도 실패', { bookId, error: e });
        }
      }

      // 목차가 비어 있으면 API 폴백 시도
      if (!finalBook.tableOfContents || finalBook.tableOfContents.trim() === '') {
        try {
          let toc = await this.fetchTocFromDiscovered(parser, detailUrl, timeout);
          if (!toc) toc = await this.fetchTocFromApi(bookId, timeout);
          if (toc) {
            finalBook = BookFactory.update(finalBook, { tableOfContents: toc });
          }
        } catch (e) {
          this.logger.warn('BookService', 'TOC API 폴백 실패', { bookId, error: e });
        }
      }

      // 캐시에 저장
      if (this.cache) {
        this.cache.set(cacheKey, finalBook);
      }

      const result: BookDetailResult = {
        book: finalBook,
        parseResults,
        fetchTime: Date.now() - startTime
      };

      this.logger.info('BookService',
        `상세 정보 조회 완료: ${finalBook.title} (${result.fetchTime}ms)`);

      return result;

    } catch (error) {
      this.logger.error('BookService', '상세 정보 조회 실패', { bookId, error });

      if (error instanceof NetworkError || error instanceof ParseError) {
        throw error;
      }

      throw new ParseError(
        '도서 상세 정보 조회 중 오류가 발생했습니다',
        'BookService',
        { bookId, originalError: error instanceof Error ? error.message : String(error) },
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * 교보 API 폴백으로 목차 요청 시도
   */
  private async fetchTocFromApi(bookId: string, timeout = 10000): Promise<string | null> {
    // 일반적으로는 S 접두 포함 ID 그대로 사용
    const id = bookId.startsWith('S') ? bookId : `S${bookId}`;
    const candidates = [
      `https://product.kyobobook.co.kr/api/product/${id}/toc`
    ];
    for (const url of candidates) {
      try {
        const json = await this.httpClient.get(url, { timeout });
        const data = JSON.parse(json);
        // 다양한 구조 대응
        if (Array.isArray(data)) {
          const items = data.map((it: any) => (it && (it.title || it.text || String(it))).toString().trim()).filter(Boolean);
          if (items.length > 0) return items.join('\n');
        } else if (data && data.items && Array.isArray(data.items)) {
          const items = data.items.map((it: any) => (it && (it.title || it.text || String(it))).toString().trim()).filter(Boolean);
          if (items.length > 0) return items.join('\n');
        } else if (data && typeof data === 'object') {
          // 단일 문자열 필드
          const text = data.toc || data.content || data.text;
          if (typeof text === 'string' && text.trim()) return text.trim();
        }
      } catch (e) {
        // 다음 후보 시도
        continue;
      }
    }
    return null;
  }

  /**
   * 파서가 발견한 엔드포인트/인라인 JSON에서 TOC를 시도
   */
  private async fetchTocFromDiscovered(
    parser: import('../..//infrastructure/parsers/BookDetailParser').BookDetailParser,
    detailUrl: string,
    timeout = 10000
  ): Promise<string | null> {
    try {
      // 1) 인라인 JSON 먼저
      const inline = parser.getInlineJsonToc();
      if (inline && inline.trim()) return inline.trim();

      // 2) 엔드포인트 후보들 순회
      const urls = (parser.getDiscoveredTocUrls() || []).slice(0, 4);
      for (const url of urls) {
        try {
          // Referer 헤더를 함께 전달(일부 엔드포인트에서 요구)
          let body: string;
          try {
            body = await (this.httpClient as any).get(url, { timeout, headers: { 'Referer': detailUrl } });
          } catch {
            body = await this.httpClient.get(url, { timeout });
          }
          const trimmed = body.trim();
          // JSON일 가능성
          if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            try {
              const data = JSON.parse(trimmed);
              if (Array.isArray(data)) {
                const items = data.map((it: any) => (it && (it.title || it.text || String(it))).toString().trim()).filter(Boolean);
                if (items.length > 0) return items.join('\n');
              } else if (data && data.items && Array.isArray(data.items)) {
                const items = data.items.map((it: any) => (it && (it.title || it.text || String(it))).toString().trim()).filter(Boolean);
                if (items.length > 0) return items.join('\n');
              } else if (typeof data === 'object') {
                const text = data.toc || data.content || data.text;
                if (typeof text === 'string' && text.trim()) return text.trim();
              }
            } catch {}
          }
          // HTML일 가능성: <br>와 </li>를 줄바꿈으로 처리해 라인화
          const md = trimmed
            .replace(/<br\s*\/?>(?=\s*\n?)/gi, '\n')
            .replace(/<\/(li|p)>/gi, '\n')
            .replace(/<[^>]+>/g, '')
            .replace(/\r\n?/g, '\n')
            .split(/\n+/)
            .map(l => l.trim())
            .filter(l => l.length > 1 && l.length < 300);
          if (md.length > 1) return md.join('\n');
        } catch (e) {
          continue;
        }
      }
    } catch (e) {
      // ignore
    }
    return null;
  }

  /**
   * 도서 상세 정보로 기존 Book 객체 보강
   */
  async enrichBook(book: Book, timeout = 10000, options: { tocApiFirst?: boolean } = {}): Promise<BookDetailResult> {
    return this.getBookDetail(book.id, timeout, options);
  }

  /**
   * 캐시 상태 조회
   */
  getCacheStats(): { size: number; enabled: boolean } {
    return {
      size: this.cache?.size() || 0,
      enabled: !!this.cache
    };
  }

  /**
   * 캐시 비우기
   */
  clearCache(): void {
    if (this.cache) {
      this.cache.clear();
      this.logger.info('BookService', '캐시가 비워졌습니다');
    }
  }

  // === Private Methods ===

  /**
   * 검색 쿼리 유효성 검사
   */
  private validateSearchQuery(query: string): void {
    if (!query || query.trim().length === 0) {
      throw new SearchError(
        '검색어를 입력해주세요',
        'BookService',
        { query }
      );
    }

    if (query.trim().length < 2) {
      throw new SearchError(
        '검색어는 2글자 이상 입력해주세요',
        'BookService',
        { query }
      );
    }

    if (query.trim().length > 100) {
      throw new SearchError(
        '검색어가 너무 깁니다 (최대 100자)',
        'BookService',
        { query }
      );
    }
  }

  /**
   * 검색 URL 생성
   */
  private buildSearchUrl(query: string, maxResults: number): string {
    const params = new URLSearchParams({
      keyword: query.trim(),
      target: 'total',
      gbCode: 'TOT',
      len: maxResults.toString()
    });

    return `https://search.kyobobook.co.kr/search?${params.toString()}`;
  }

  /**
   * 상세 페이지 URL 생성
   */
  private buildDetailUrl(bookId: string): string {
    // S 접두사가 없으면 추가
    const id = bookId.startsWith('S') ? bookId : `S${bookId}`;
    return `https://product.kyobobook.co.kr/detail/${id}`;
  }

  /**
   * 캐시 키 생성
   */
  private buildSearchCacheKey(query: string, options: Required<SearchOptions>): string {
    const key = JSON.stringify({
      query: query.trim().toLowerCase(),
      maxResults: options.maxResults,
      enableDetailFetch: options.enableDetailFetch
    });
    return `search:${Buffer.from(key).toString('base64')}`;
  }

  /**
   * HTTP 요청 (재시도 로직 포함)
   */
  private async fetchWithRetry(
    url: string,
    timeout: number,
    maxRetries = 3
  ): Promise<string> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.debug('BookService', `HTTP 요청 시도 ${attempt}/${maxRetries}: ${url}`);

        const html = await this.httpClient.get(url, { timeout });

        if (!html || html.trim().length === 0) {
          throw new NetworkError(
            '빈 응답을 받았습니다',
            'BookService',
            { url, attempt }
          );
        }

        return html;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        this.logger.warn('BookService',
          `HTTP 요청 실패 ${attempt}/${maxRetries}`, { url, error: lastError });

        if (attempt === maxRetries) {
          break;
        }

        // 지수 백오프 (1초, 2초, 4초)
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
      }
    }

    throw new NetworkError(
      `네트워크 요청이 ${maxRetries}회 실패했습니다`,
      'BookService',
      { url, maxRetries },
      lastError
    );
  }

  /**
   * 도서 목록에 상세 정보 추가
   */
  private async enrichBooksWithDetails(
    books: Book[],
    timeout: number
  ): Promise<Book[]> {
    const enrichedBooks: Book[] = [];

    for (const book of books) {
      try {
        const result = await this.getBookDetail(book.id, timeout);
        enrichedBooks.push(result.book);
      } catch (error) {
        this.logger.warn('BookService',
          `상세 정보 가져오기 실패, 기본 정보로 대체: ${book.id}`, { error });
        enrichedBooks.push(book);
      }
    }

    return enrichedBooks;
  }

  /**
   * 캐시에서 검색 결과 가져오기
   */
  private getCachedSearchResult(
    cacheKey: string,
    query: string,
    startTime: number
  ): SearchResult {
    // 실제 구현에서는 검색 결과 전체를 캐시해야 하지만
    // 현재는 개별 Book 객체만 캐시하므로 기본 구조만 반환
    return {
      books: [],
      totalFound: 0,
      searchTime: Date.now() - startTime,
      query,
      hasMore: false,
      parseMetrics: {
        totalItems: 0,
        successfulItems: 0,
        failedItems: 0,
        parseTime: 0,
        errors: [],
        successRate: 0
      }
    };
  }

  /**
   * 검색 결과를 캐시에 저장
   */
  private cacheSearchResult(cacheKey: string, result: SearchResult): void {
    // 검색 결과 단계의 Book은 축약 정보이므로 상세 캐시에 저장하지 않음.
    // 필요시 별도 프리뷰 캐시를 도입할 수 있음.
  }

  /**
   * 이미지 URL을 data URL로 변환 (가능하면 클라이언트 기능 사용)
   */
  async fetchImageAsDataUrl(url: string, timeout = 10000): Promise<string | null> {
    try {
      if ((this.httpClient as any).getDataUrl) {
        const dataUrl = await (this.httpClient as any).getDataUrl(url, { timeout });
        return dataUrl || null;
      }
      // 최후 수단: 환경 fetch 사용 시도 (일부 환경에서 실패할 수 있음)
      const res = await fetch(url);
      const ab = await res.arrayBuffer();
      const base64 = this.arrayBufferToBase64(ab);
      const mime = this.guessMime(url);
      return `data:${mime};base64,${base64}`;
    } catch (e) {
      this.logger.warn('BookService', '이미지 dataUrl 변환 실패', { url, error: e });
      return null;
    }
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  private guessMime(u: string): string {
    const m = u.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i);
    if (!m) return 'image/jpeg';
    const ext = m[1].toLowerCase();
    return ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
  }
}
