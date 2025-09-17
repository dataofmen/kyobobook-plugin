// 검색 결과 파싱 클래스 (분리 및 최적화)

import { BaseParser } from './BaseParser';
import { Book, CreateBookInput, BookFactory } from '../../domain/models/Book';
import { ParseError } from '../../domain/models/Errors';
import { SELECTORS, PATTERNS, KEYWORDS, LIMITS } from '../../shared/constants/selectors';
import { TextUtils } from '../../shared/utils/TextUtils';
import { UrlUtils } from '../../shared/utils/UrlUtils';

/**
 * 검색 결과 페이지 파서
 */
export class SearchResultParser extends BaseParser {
  private parseMetrics = {
    totalItems: 0,
    successfulItems: 0,
    failedItems: 0,
    parseTime: 0,
    errors: [] as string[]
  };

  /**
   * 검색 결과에서 도서 목록 추출
   */
  parseBooks(maxResults: number = LIMITS.MAX_SEARCH_RESULTS): Book[] {
    const startTime = Date.now();

    try {
      // 1단계: 검색 결과 아이템 요소들 찾기
      const itemElements = this.findResultItems();
      this.parseMetrics.totalItems = itemElements.length;

      if (itemElements.length === 0) {
        throw new ParseError('검색 결과 아이템을 찾을 수 없습니다', 'SearchResultParser');
      }

      // 2단계: 각 아이템을 Book 객체로 파싱
      const books = this.parseItems(itemElements, maxResults);

      this.parseMetrics.parseTime = Date.now() - startTime;
      this.parseMetrics.successfulItems = books.length;

      return books;
    } catch (error) {
      this.parseMetrics.parseTime = Date.now() - startTime;

      if (error instanceof ParseError) {
        throw error;
      }

      throw new ParseError(
        '검색 결과 파싱 중 오류가 발생했습니다',
        'SearchResultParser',
        { originalError: error instanceof Error ? error.message : String(error) },
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * 검색 결과 아이템 요소들 찾기
   */
  private findResultItems(): Element[] {
    // 1차: 기본 선택자들로 시도
    const items = this.findAllBySelectors(SELECTORS.SEARCH_RESULT_ITEMS);

    if (items.length > 0) {
      return this.filterValidItems(items);
    }

    // 2차: 폴백 방식으로 도서 링크 기반 검색
    return this.findItemsByLinks();
  }

  /**
   * 유효한 아이템들만 필터링
   */
  private filterValidItems(items: Element[]): Element[] {
    return items.filter(item => {
      // 숨겨진 요소 제외
      if (!this.isVisible(item)) {
        return false;
      }

      // 도서 링크가 있는지 확인
      const hasBookLink = item.querySelector('a[href*="detail"]') !== null;
      if (!hasBookLink) {
        return false;
      }

      // 최소한의 텍스트 내용이 있는지 확인
      const textContent = this.extractText(item);
      if (textContent.length < 10) {
        return false;
      }

      // 패키지 상품 제외
      if (this.isPackageProduct(textContent)) {
        return false;
      }

      return true;
    });
  }

  /**
   * 도서 링크 기반으로 아이템 찾기 (폴백)
   */
  private findItemsByLinks(): Element[] {
    const bookLinks = this.findAllBySelectors(SELECTORS.BOOK_DETAIL_LINKS);
    const items: Element[] = [];
    const processedParents = new Set<Element>();

    for (const link of bookLinks) {
      const container = this.findBookContainer(link);

      if (container && !processedParents.has(container)) {
        processedParents.add(container);
        items.push(container);

        // 최대 20개까지만
        if (items.length >= 20) break;
      }
    }

    return items;
  }

  /**
   * 링크에서 도서 컨테이너 찾기
   */
  private findBookContainer(link: Element): Element | null {
    return this.findAncestor(link, (element) => {
      const className = element.className?.toLowerCase() || '';
      const tagName = element.tagName.toLowerCase();

      // 상품 컨테이너로 보이는 패턴
      const containerPatterns = [
        'prod', 'product', 'book', 'item', 'result', 'search',
        'list', 'card', 'box', 'wrap', 'container'
      ];

      const isContainer = containerPatterns.some(pattern =>
        className.includes(pattern)
      );

      // 적절한 크기의 요소인지 확인
      const textLength = element.textContent?.length || 0;
      const hasReasonableContent = textLength > 20 && textLength < 1000;

      return isContainer && hasReasonableContent;
    }, 5);
  }

  /**
   * 아이템들을 Book 객체로 파싱
   */
  private parseItems(items: Element[], maxResults: number): Book[] {
    const books: Book[] = [];
    const batchSize = 10; // 배치 처리로 메모리 효율성 개선

    for (let i = 0; i < items.length && books.length < maxResults; i += batchSize) {
      const batch = items.slice(i, Math.min(i + batchSize, items.length));
      const batchBooks = this.parseBatch(batch, maxResults - books.length);
      books.push(...batchBooks);
    }

    return books;
  }

  /**
   * 배치 단위로 아이템 파싱
   */
  private parseBatch(items: Element[], remainingSlots: number): Book[] {
    const books: Book[] = [];

    for (let i = 0; i < items.length && books.length < remainingSlots; i++) {
      try {
        const book = this.parseItem(items[i]);
        if (book) {
          books.push(book);
        }
      } catch (error) {
        this.parseMetrics.failedItems++;
        this.parseMetrics.errors.push(
          `Item ${i + 1}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    return books;
  }

  /**
   * 단일 아이템을 Book 객체로 파싱
   */
  private parseItem(item: Element): Book | null {
    // 1. 기본 정보 추출
    const { url, bookId } = this.extractUrlAndId(item);
    const title = this.extractTitle(item);
    const authors = this.extractAuthors(item);
    const { publisher, publishDate } = this.extractPublisherInfo(item);
    // data-kbbfn-bid가 있으면 우선 사용(정확한 바코드)
    const bidFromLazy = (item.querySelector('img[data-kbbfn="s3-image"]')?.getAttribute('data-kbbfn-bid') || '') as string;
    // ISBN 저장(가능 시)
    const isbn = (bidFromLazy && /^\d{12,13}$/.test(bidFromLazy)) ? bidFromLazy : '';
    let coverImageUrl = this.extractCoverImage(item);

    // 2. 필수 정보 검증
    if (!title || title.length < 2) {
      return null;
    }

    if (!bookId) {
      return null;
    }

    // 2-1. 커버 이미지가 없으면 ID 기반 URL 생성 (폴백)
    if ((!coverImageUrl || coverImageUrl.length < 10)) {
      if (isbn) coverImageUrl = UrlUtils.buildCoverImageUrl(isbn);
      else if (bookId) coverImageUrl = UrlUtils.buildCoverImageUrl(bookId);
    }

    // 3. Book 객체 생성
    const bookInput: CreateBookInput = {
      id: bookId,
      title: TextUtils.cleanTitle(title),
      authors: authors.length > 0 ? authors : ['저자미상'],
      publisher: publisher || '출판사미상',
      publishDate: publishDate,
      isbn: isbn || undefined,
      coverImageUrl: coverImageUrl,
      detailPageUrl: url,
      language: 'ko'
    };

    return BookFactory.create(bookInput);
  }

  /**
   * URL과 도서 ID 추출
   */
  private extractUrlAndId(item: Element): { url: string; bookId: string } {
    // 우선순위: /detail/S... 링크 → /detail/... → 그 외
    const preferredSelectors = [
      'a[href*="/detail/S"]',
      'a[href*="/detail/"]',
      'a[href*="product.kyobobook.co.kr/detail"]',
      'a[href]'
    ];

    for (const selector of preferredSelectors) {
      const links = item.querySelectorAll(selector);
      for (const link of Array.from(links)) {
        const href = this.extractAttribute(link, 'href');
        if (!href) continue;

        const bookId = UrlUtils.extractBookId(href);
        if (bookId) {
          return {
            url: UrlUtils.buildDetailPageUrl(bookId),
            bookId
          };
        }
      }
    }

    // ID를 찾지 못한 경우 임시 ID 생성
    return {
      url: '',
      bookId: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }

  /**
   * 제목 추출
   */
  private extractTitle(item: Element): string {
    // 우선: 상세 페이지 링크 텍스트에서 추출 (가장 신뢰도 높음)
    const invalidTitles = new Set(['종이책', '전자책', 'ebook', 'e북', '세트', '전집', '패키지', '원서/번역서', '원서', '번역서']);
    const linkEls = item.querySelectorAll('a[href*="detail"]');
    let best: string = '';
    for (const link of Array.from(linkEls)) {
      // title/aria-label 속성 우선 사용
      const attrTitle = this.extractAttribute(link, 'title') || this.extractAttribute(link as Element, 'aria-label');
      const candidateRaw = attrTitle || this.extractText(link);
      const t = TextUtils.cleanTitle(candidateRaw);
      if (!t) continue;
      if (t.length < 2 || t.length > LIMITS.MAX_TITLE_LENGTH) continue;
      if (invalidTitles.has(t.toLowerCase())) continue;
      // 한글/영문자가 포함되어야 유효한 제목으로 간주
      if (!/[A-Za-z가-힣]/.test(t)) continue;
      if (t.length > best.length) best = t;
    }
    if (best) return best;

    // 다음: 아이템 내부의 제목 관련 선택자에서 추출
    const titleElement = this.findFirstBySelectorsWithin(item, SELECTORS.TITLE);
    if (titleElement) {
      const tt = TextUtils.cleanTitle(this.extractText(titleElement));
      if (tt && !invalidTitles.has(tt.toLowerCase())) return tt;
    }

    return '';
  }

  /**
   * 저자 정보 추출
   */
  private extractAuthors(item: Element): string[] {
    const authorContainer = this.findFirstBySelectorsWithin(item, SELECTORS.AUTHOR);

    if (authorContainer) {
      // 저자 링크들에서 추출
      const authorLinks = authorContainer.querySelectorAll('a');
      const authors: string[] = [];

      for (const link of Array.from(authorLinks)) {
        const authorName = TextUtils.cleanAuthor(this.extractText(link));
        if (authorName && authorName.length > 0 && authorName.length < LIMITS.MAX_AUTHOR_LENGTH) {
          authors.push(authorName);
        }
      }

      if (authors.length > 0) {
        return authors.slice(0, LIMITS.MAX_AUTHORS);
      }

      // 링크가 없으면 전체 텍스트에서 파싱
      const authorText = this.extractText(authorContainer);
      if (authorText) {
        return TextUtils.parseAuthors(authorText);
      }
    }

    return [];
  }

  /**
   * 출판사 및 출판일 정보 추출
   */
  private extractPublisherInfo(item: Element): { publisher: string; publishDate: string } {
    let publisher = '';
    let publishDate = '';

    // 출판사 정보 추출
    const publisherElement = this.findFirstBySelectorsWithin(item, SELECTORS.PUBLISHER);
    if (publisherElement) {
      publisher = TextUtils.cleanPublisher(this.extractText(publisherElement));
    }

    // 출판일 추출 (전체 텍스트에서)
    const itemText = this.extractText(item);
    publishDate = TextUtils.normalizeDateString(itemText) || '';

    return { publisher, publishDate };
  }

  /**
   * 표지 이미지 추출
   */
  private extractCoverImage(item: Element): string {
    const images = this.findAllBySelectorsWithin(item, SELECTORS.COVER_IMAGE);

    for (const img of images) {
      const imageUrl = this.extractImageUrl(img);
      if (imageUrl && UrlUtils.isValidImageUrl(imageUrl)) {
        return imageUrl;
      }
    }

    // Kyobo lazy spec: data-kbbfn="s3-image" with pid/size
    const lazy = item.querySelector('img[data-kbbfn="s3-image"]');
    if (lazy) {
      const bid = this.extractAttribute(lazy, 'data-kbbfn-bid') || this.extractAttribute(lazy, 'data-bid');
      const pid = this.extractAttribute(lazy, 'data-kbbfn-pid') || this.extractAttribute(lazy, 'data-pid');
      const size = this.extractAttribute(lazy, 'data-kbbfn-size') || '200x0';
      const code = bid || pid;
      if (code) {
        const url = UrlUtils.buildCoverImageUrl(code, size === '300x0' ? 'large' : size === '150x0' ? 'small' : 'medium');
        if (UrlUtils.isValidImageUrl(url)) return url;
      }
    }

    // 배경 이미지 스타일에서 추출 (예: div style="background-image:url(...)" )
    const allElements = item.querySelectorAll('*');
    for (const el of Array.from(allElements)) {
      const styleUrl = this.extractImageUrl(el);
      if (styleUrl && UrlUtils.isValidImageUrl(styleUrl)) {
        return styleUrl;
      }
    }

    return '';
  }

  /**
   * 패키지 상품인지 확인
   */
  private isPackageProduct(text: string): boolean {
    return KEYWORDS.PACKAGE_PRODUCTS.some(keyword => text.includes(keyword));
  }

  /**
   * 파싱 메트릭 반환
   */
  getParseMetrics() {
    return {
      ...this.parseMetrics,
      successRate: this.parseMetrics.totalItems > 0
        ? (this.parseMetrics.successfulItems / this.parseMetrics.totalItems) * 100
        : 0
    };
  }

  /**
   * HTML 구조 분석 (디버깅용)
   */
  analyzeStructure(): {
    pageTitle: string;
    searchTermElements: Record<string, number>;
    detailLinks: number;
    listElements: number;
    stats: ReturnType<BaseParser['getParsingStats']>;
  } {
    const pageTitle = this.extractText(this.querySelector('title')) || '';

    // 검색 관련 요소들 분석
    const searchTerms = ['search', 'result', 'list', 'prod', 'book', 'item'];
    const searchTermElements: Record<string, number> = {};

    searchTerms.forEach(term => {
      const elements = this.querySelectorAll(`[class*="${term}"]`);
      if (elements.length > 0) {
        searchTermElements[term] = elements.length;
      }
    });

    const detailLinks = this.querySelectorAll('a[href*="detail"], a[href*="product"]').length;
    const listElements = this.querySelectorAll('ul, ol, div[class*="list"], section[class*="list"]').length;

    return {
      pageTitle,
      searchTermElements,
      detailLinks,
      listElements,
      stats: this.getParsingStats()
    };
  }
}
