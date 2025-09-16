// 상수 정의

export const KYOBOBOOK_URLS = {
  SEARCH_BASE: 'https://search.kyobobook.co.kr/search',
  BOOK_DETAIL_BASE: 'https://product.kyobobook.co.kr/detail',
  COVER_IMAGE_BASE: 'https://contents.kyobobook.co.kr/sih/fit-in/200x0/pdt'
} as const;

export const DEFAULT_SEARCH_PARAMS = {
  target: 'total',
  gbCode: 'TOT',
  len: 100
} as const;

export const SEARCH_LIMITS = {
  MIN_QUERY_LENGTH: 2,
  MAX_RESULTS: 100,
  DEFAULT_RESULTS: 20
} as const;

export const FILE_CONSTRAINTS = {
  MAX_FILENAME_LENGTH: 100,
  INVALID_FILENAME_CHARS: /[\\/:*?"<>|]/g
} as const;

export const ERROR_MESSAGES = {
  SEARCH_FAILED: '검색 중 오류가 발생했습니다',
  DETAIL_FETCH_FAILED: '상세 정보를 가져올 수 없습니다',
  NOTE_CREATION_FAILED: '노트 생성 중 오류가 발생했습니다',
  NETWORK_ERROR: '네트워크 연결을 확인해주세요',
  INVALID_QUERY: '검색어를 2글자 이상 입력해주세요'
} as const;

export const CSS_CLASSES = {
  MODAL: 'kyobobook-search-modal',
  SUGGESTION_ITEM: 'kyobobook-suggestion-item',
  BOOK_COVER: 'book-cover',
  BOOK_INFO: 'book-info',
  BOOK_TITLE: 'book-title',
  BOOK_AUTHOR: 'book-author',
  BOOK_PUBLISHER: 'book-publisher',
  BOOK_DATE: 'book-date',
  BOOK_LINK: 'book-link',
  SETTINGS: 'kyobobook-settings'
} as const;