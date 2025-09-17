// 교보문고 플러그인 타입 정의 (레거시 호환성)

import { Book, BookSearchResult, BookSearchParams } from './domain/models/Book';
import { PluginError } from './domain/models/Errors';

// 레거시 호환성을 위한 BookInfo 인터페이스 (deprecated)
/** @deprecated Book 모델을 사용하세요 */
export interface BookInfo {
  // 필수 필드
  title: string;
  authors: string;
  publisher: string;
  publishDate: string;
  pid: string;

  // 선택적 필드
  bid?: string;
  url?: string;
  isbn?: string;
  pages?: string;
  description?: string;
  toc?: string;
  categories?: string[];
  tags?: string[];
  rating?: string;
  coverImage?: string;
}

// 플러그인 설정
export interface KyobobookPluginSettings {
  saveFolder: string;
  noteTemplate: string;
  filenameTemplate: string;
  maxSearchResults: number;
  autoCreateTags: boolean;
  debugMode: boolean;
  // 엄격 모드: 노트 생성/목록 전 상세정보 선조회
  strictDetailPrefetch: boolean;
  // 썸네일을 교보 정적 URL로 강제
  enforceStaticCover: boolean;
  // 목록 선조회 개수(상세정보)
  prefetchCount?: number;
  // 노트에 표지를 data URL로 내장
  embedCoverInNote?: boolean;
}

// 레거시 호환성을 위한 검색 결과 (deprecated)
/** @deprecated BookSearchResult를 사용하세요 */
export interface SearchResult {
  books: BookInfo[];
  totalCount: number;
}

// API 검색 파라미터 (deprecated)
/** @deprecated BookSearchParams를 사용하세요 */
export interface KyobobookSearchParams {
  keyword: string;
  target?: string;
  gbCode?: string;
  len?: number;
}

// 도서 상세 정보 데이터 (deprecated)
/** @deprecated Book 모델의 업데이트 기능을 사용하세요 */
export interface BookDetailData {
  isbn?: string;
  pages?: string;
  description?: string;
  toc?: string;
  categories?: string[];
  rating?: string;
  coverImage?: string;
}

// 레거시 에러 타입 (deprecated)
/** @deprecated PluginError 계층을 사용하세요 */
export interface KyobobookError extends Error {
  code?: string;
  statusCode?: number;
  details?: unknown;
}

// API 응답 타입
export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: PluginError | Error;
}

// 레거시 타입을 새 타입으로 변환하는 유틸리티 함수들
export namespace LegacyAdapter {
  /**
   * BookInfo를 Book으로 변환
   */
  export function bookInfoToBook(bookInfo: BookInfo): Book {
    return {
      id: bookInfo.pid || bookInfo.bid || Date.now().toString(),
      title: bookInfo.title,
      authors: bookInfo.authors ? bookInfo.authors.split(',').map(a => a.trim()) : [],
      publisher: bookInfo.publisher,
      publishDate: bookInfo.publishDate,
      isbn: bookInfo.isbn,
      pages: bookInfo.pages ? parseInt(bookInfo.pages, 10) : undefined,
      description: bookInfo.description,
      tableOfContents: bookInfo.toc,
      categories: bookInfo.categories,
      rating: bookInfo.rating ? parseFloat(bookInfo.rating) : undefined,
      coverImageUrl: bookInfo.coverImage,
      detailPageUrl: bookInfo.url,
      tags: bookInfo.tags,
      language: 'ko',
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Book을 BookInfo로 변환 (하위 호환성)
   */
  export function bookToBookInfo(book: Book): BookInfo {
    return {
      title: book.title,
      authors: book.authors.join(', '),
      publisher: book.publisher,
      publishDate: book.publishDate || '',
      pid: book.id,
      bid: book.id,
      url: book.detailPageUrl,
      isbn: book.isbn,
      pages: book.pages?.toString(),
      description: book.description,
      toc: book.tableOfContents,
      categories: book.categories ? [...book.categories] : undefined,
      tags: book.tags ? [...book.tags] : undefined,
      rating: book.rating?.toString(),
      coverImage: book.coverImageUrl
    };
  }

  /**
   * SearchResult를 BookSearchResult로 변환
   */
  export function searchResultToBookSearchResult(searchResult: SearchResult): BookSearchResult {
    return {
      books: searchResult.books.map(bookInfoToBook),
      totalCount: searchResult.totalCount,
      hasMore: false // 기본값
    };
  }

  /**
   * BookSearchResult를 SearchResult로 변환
   */
  export function bookSearchResultToSearchResult(bookSearchResult: BookSearchResult): SearchResult {
    return {
      books: bookSearchResult.books.map(bookToBookInfo),
      totalCount: bookSearchResult.totalCount
    };
  }

  /**
   * KyobobookSearchParams를 BookSearchParams로 변환
   */
  export function kyobobookSearchParamsToBookSearchParams(params: KyobobookSearchParams): BookSearchParams {
    return {
      query: params.keyword,
      maxResults: params.len
    };
  }
}
