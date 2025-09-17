// URL 빌더 유틸리티
import { KYOBOBOOK_URLS } from '../utils/constants';

export class UrlBuilder {
  static buildSearchUrl(query: string, _maxResults: number = 20): string {
    const searchParams = new URLSearchParams();
    searchParams.append('keyword', query);
    searchParams.append('target', 'total');
    searchParams.append('gbCode', 'TOT');

    return `${KYOBOBOOK_URLS.SEARCH_BASE}?${searchParams.toString()}`;
  }

  static buildDetailUrl(bookId: string): string {
    return `${KYOBOBOOK_URLS.BOOK_DETAIL_BASE}/S${bookId}`;
  }

  static buildCoverImageUrl(bookId: string): string {
    return `${KYOBOBOOK_URLS.COVER_IMAGE_BASE}/${bookId}.jpg`;
  }

  static ensureAbsoluteUrl(url: string, baseUrl: string = 'https://product.kyobobook.co.kr'): string {
    if (url.startsWith('http')) {
      return url;
    }

    if (url.startsWith('/')) {
      return `${baseUrl}${url}`;
    }

    return `${baseUrl}/${url}`;
  }

  static extractBookIdFromUrl(url: string): string | null {
    const match = url.match(/\/detail\/S(\d+)/);
    return match ? match[1] : null;
  }
}