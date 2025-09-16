import { requestUrl } from 'obsidian';
import { BookInfo, SearchResult } from '../types';
import { KyobobookSearchParams, ParsedBookData, BookDetailData } from './types';
import { BookDetailParser } from '../utils/parser';
import { KYOBOBOOK_URLS, DEFAULT_SEARCH_PARAMS, ERROR_MESSAGES } from '../utils/constants';

export class KyobobookAPI {

  static async searchBooks(query: string, maxResults: number = 20): Promise<SearchResult> {
    try {
      const searchUrl = this.buildSearchUrl(query, maxResults);
      console.log('검색 URL:', searchUrl);

      const response = await requestUrl({
        url: searchUrl,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const books = this.parseSearchResults(response.text);

      return {
        books: books.slice(0, maxResults),
        totalCount: books.length
      };
    } catch (error) {
      console.error('교보문고 검색 오류:', error);
      throw new Error(`${ERROR_MESSAGES.SEARCH_FAILED}: ${(error as Error).message}`);
    }
  }

  static async getBookDetail(book: BookInfo): Promise<BookInfo> {
    if (!book.url) {
      return book;
    }

    try {
      console.log('상세 정보 가져오기:', book.url);

      const response = await requestUrl({
        url: book.url,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const detailData = this.parseBookDetail(response.text);

      return {
        ...book,
        ...detailData
      };
    } catch (error) {
      console.error('상세 정보 가져오기 오류:', error);
      // 상세 정보를 가져올 수 없어도 기본 정보는 반환
      return book;
    }
  }

  private static buildSearchUrl(query: string, maxResults: number): string {
    const params: KyobobookSearchParams = {
      keyword: query,
      target: DEFAULT_SEARCH_PARAMS.target,
      gbCode: DEFAULT_SEARCH_PARAMS.gbCode,
      len: Math.min(maxResults, DEFAULT_SEARCH_PARAMS.len)
    };

    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      searchParams.append(key, value.toString());
    });

    return `${KYOBOBOOK_URLS.SEARCH_BASE}?${searchParams.toString()}`;
  }

  private static parseSearchResults(html: string): BookInfo[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const prodItems = doc.querySelectorAll('#shopData_list .prod_list .prod_item');
    const books: BookInfo[] = [];

    for (const prodItem of Array.from(prodItems)) {
      try {
        const book = this.parseBookItem(prodItem);
        if (book) {
          books.push(book);
        }
      } catch (error) {
        console.warn('도서 항목 파싱 오류:', error);
      }
    }

    return books;
  }

  private static parseBookItem(prodItem: Element): BookInfo | null {
    // 체크박스에서 pid와 bid 추출
    const checkbox = prodItem.querySelector('input[data-pid][data-bid]') as HTMLInputElement;
    if (!checkbox) {
      return null;
    }

    // 패키지 상품 제외
    const categoryElement = prodItem.querySelector('.prod_category');
    if (categoryElement?.textContent?.trim() === '[패키지]') {
      return null;
    }

    // 기본 정보 추출
    const titleElement = prodItem.querySelector('.prod_info');
    const authorElement = prodItem.querySelector('.prod_author_group .auto_overflow_inner');
    const publisherElement = prodItem.querySelector('.prod_publish a');
    const dateElement = prodItem.querySelector('.prod_publish .date');

    if (!titleElement || !authorElement) {
      return null;
    }

    const pid = checkbox.dataset.pid!;
    const bid = checkbox.dataset.bid!;
    const url = (titleElement as HTMLAnchorElement).href;

    const book: BookInfo = {
      title: this.cleanText(titleElement.textContent || ''),
      authors: this.cleanText(authorElement.textContent || ''),
      publisher: this.cleanText(publisherElement?.textContent || ''),
      publishDate: this.cleanText(dateElement?.textContent || ''),
      pid,
      bid,
      url,
      coverImage: `${KYOBOBOOK_URLS.COVER_IMAGE_BASE}/${bid}.jpg`
    };

    return book;
  }

  private static parseBookDetail(html: string): BookDetailData {
    const parser = new BookDetailParser(html);

    const detail: BookDetailData = {};

    try {
      detail.isbn = parser.extractISBN();
      detail.pages = parser.extractPages();
      detail.description = parser.extractDescription();
      detail.toc = parser.extractTableOfContents();
      detail.categories = parser.extractCategories();
      detail.rating = parser.extractRating();
    } catch (error) {
      console.warn('상세 정보 파싱 중 오류:', error);
    }

    return detail;
  }

  private static cleanText(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
  }
}