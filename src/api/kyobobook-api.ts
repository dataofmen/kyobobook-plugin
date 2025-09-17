import { BookInfo, SearchResult, BookDetailData } from '../types';
import { HttpService } from './http-service';
import { UrlBuilder } from './url-builder';
import { SearchResultParser, BookDetailParser } from '../utils/html-parser';
import { BookItemParser } from '../utils/book-item-parser';
import { DebugLogger } from '../utils/debug';

export class KyobobookAPI {

  static async searchBooks(query: string, maxResults: number = 20): Promise<SearchResult> {
    DebugLogger.log('API', `검색 시작: "${query}" (최대 ${maxResults}개)`);

    const searchUrl = UrlBuilder.buildSearchUrl(query, maxResults);
    DebugLogger.log('API', `검색 URL: ${searchUrl}`);

    const response = await HttpService.get(searchUrl);

    if (!response.success) {
      DebugLogger.error('API', '검색 요청 실패', response.error);
      throw response.error;
    }

    const html = response.data!;
    DebugLogger.log('API', `응답 HTML 길이: ${html.length}자`);

    // 디버그 모드일 때 HTML 파일로 저장
    DebugLogger.saveHtmlToFile(html, `search-${query}`);

    // HTML 구조 분석
    DebugLogger.analyzeHtmlStructure(html, `검색결과 (${query})`);

    const parser = new SearchResultParser(html);
    parser.analyzeStructure();

    const books = this.parseSearchResults(html);
    DebugLogger.log('API', `파싱된 도서 수: ${books.length}개`);

    return {
      books: books.slice(0, maxResults),
      totalCount: books.length
    };
  }

  static async getBookDetail(book: BookInfo): Promise<BookInfo> {
    if (!book.url) {
      DebugLogger.log('API', '상세 정보 URL이 없음, 기본 정보 반환');
      return book;
    }

    DebugLogger.log('API', `상세 정보 요청: ${book.title}`);
    DebugLogger.log('API', `상세 페이지 URL: ${book.url}`);

    const response = await HttpService.get(book.url);

    if (!response.success) {
      DebugLogger.warn('API', '상세 정보 가져오기 실패', response.error);
      // 상세 정보를 가져올 수 없어도 기본 정보는 반환
      return book;
    }

    const html = response.data!;
    DebugLogger.log('API', `상세 페이지 HTML 길이: ${html.length}자`);

    // 디버그 모드일 때 HTML 파일로 저장
    DebugLogger.saveHtmlToFile(html, `detail-${book.pid || 'unknown'}`);

    const detailData = this.parseBookDetail(html);
    DebugLogger.log('API', '상세 정보 파싱 완료', detailData);

    return {
      ...book,
      ...detailData
    };
  }


  private static parseSearchResults(html: string): BookInfo[] {
    const parser = new SearchResultParser(html);
    const items = parser.findResultItems();

    DebugLogger.log('PARSER', `검색 결과 항목 수: ${items.length}개`);

    if (items.length === 0) {
      DebugLogger.warn('PARSER', '검색 결과 항목을 찾을 수 없음, fallback 모드로 전환');
      return this.parseFromLinks(html);
    }

    return this.parseItemsOptimized(items);
  }

  private static parseItemsOptimized(items: Element[]): BookInfo[] {
    const books: BookInfo[] = [];
    const batchSize = 10; // 배치 크기로 메모리 사용량 제어

    DebugLogger.log('PARSER', `최적화된 파싱 시작: ${items.length}개 항목을 ${batchSize}개씩 처리`);

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = this.parseBatch(batch, i);
      books.push(...batchResults);

      // 중간 진행상황 로깅
      if (i + batchSize < items.length) {
        DebugLogger.log('PARSER', `진행률: ${Math.min(i + batchSize, items.length)}/${items.length} (${books.length}개 성공)`);
      }
    }

    DebugLogger.log('PARSER', `최적화된 파싱 완료: 총 ${books.length}개 도서 추출`);
    return books;
  }

  private static parseBatch(items: Element[], startIndex: number): BookInfo[] {
    const results: BookInfo[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const itemIndex = startIndex + i + 1;

      try {
        DebugLogger.log('PARSER', `항목 ${itemIndex} 파싱 시작`);
        const startTime = Date.now();

        const bookParser = new BookItemParser(item);
        const book = bookParser.parse();

        const parseTime = Date.now() - startTime;

        if (book) {
          results.push(book);
          DebugLogger.log('PARSER', `항목 ${itemIndex} 파싱 성공 (${parseTime}ms): ${book.title}`);
        } else {
          DebugLogger.warn('PARSER', `항목 ${itemIndex} 파싱 결과가 null (${parseTime}ms)`);
        }
      } catch (error) {
        DebugLogger.error('PARSER', `항목 ${itemIndex} 파싱 오류`, error);
      }
    }

    return results;
  }


  private static parseBookDetail(html: string): BookDetailData {
    const parser = new BookDetailParser(html);

    const detail: BookDetailData = {};

    try {
      detail.isbn = parser.extractISBN();
      detail.pages = parser.extractPages();
      detail.description = ''; // 설명 추출은 생략
      detail.toc = parser.extractTableOfContents();
      detail.categories = parser.extractCategories();
      detail.rating = parser.extractRating();

      const extractedCoverImage = parser.extractCoverImage();
      if (extractedCoverImage) {
        detail.coverImage = extractedCoverImage;
      }

      DebugLogger.log('BOOK_DETAIL', '상세 정보 파싱 결과', {
        isbn: detail.isbn,
        pages: detail.pages,
        tocLength: detail.toc?.length || 0,
        categories: detail.categories?.length || 0,
        rating: detail.rating,
        hasCoverImage: !!detail.coverImage
      });
    } catch (error) {
      DebugLogger.error('BOOK_DETAIL', '상세 정보 파싱 중 오류', error);
    }

    return detail;
  }

  private static parseFromLinks(html: string): BookInfo[] {
    DebugLogger.log('PARSER', 'Fallback 모드: 링크에서 도서 정보 추출 시작');

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const detailLinks = doc.querySelectorAll('a[href*="detail"], a[href*="product"]');
    DebugLogger.log('PARSER', `찾은 상세 페이지 링크: ${detailLinks.length}개`);

    const books: BookInfo[] = [];

    for (let i = 0; i < Math.min(detailLinks.length, 20); i++) {
      const link = detailLinks[i];
      try {
        const href = link.getAttribute('href');
        if (!href) {
          DebugLogger.warn('PARSER', `링크 ${i + 1}: href 속성이 없음`);
          continue;
        }

        const bookId = UrlBuilder.extractBookIdFromUrl(href);
        if (!bookId) {
          DebugLogger.warn('PARSER', `링크 ${i + 1}: 도서 ID 추출 실패 - ${href}`);
          continue;
        }

        const title = link.textContent?.trim();
        if (!title || title.length < 2) {
          DebugLogger.warn('PARSER', `링크 ${i + 1}: 제목이 너무 짧음 - "${title}"`);
          continue;
        }

        const book: BookInfo = {
          title: this.cleanText(title),
          authors: '저자미상',
          publisher: '',
          publishDate: '',
          pid: bookId,
          bid: bookId,
          url: UrlBuilder.ensureAbsoluteUrl(href),
          coverImage: UrlBuilder.buildCoverImageUrl(bookId)
        };

        books.push(book);
        DebugLogger.log('PARSER', `Fallback 링크 ${i + 1} 파싱 성공: ${book.title}`);
      } catch (error) {
        DebugLogger.error('PARSER', `링크 ${i + 1} 파싱 오류`, error);
      }
    }

    DebugLogger.log('PARSER', `Fallback 모드에서 ${books.length}개 도서 추출 완료`);
    return books;
  }


  private static cleanText(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
  }
}