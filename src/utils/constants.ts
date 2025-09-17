// 상수 정의

export const KYOBOBOOK_URLS = {
  SEARCH_BASE: 'https://search.kyobobook.co.kr/search',
  BOOK_DETAIL_BASE: 'https://product.kyobobook.co.kr/detail',
  COVER_IMAGE_BASE: 'https://contents.kyobobook.co.kr/sih/fit-in/200x0/pdt'
} as const;

export const DEFAULT_SEARCH_PARAMS = {
  target: 'total',
  gbCode: 'TOT',
  len: 20
} as const;

export const SEARCH_LIMITS = {
  MIN_QUERY_LENGTH: 2,
  MAX_RESULTS: 100,
  DEFAULT_RESULTS: 20,
  REQUEST_TIMEOUT: 10000, // 10초
  RETRY_ATTEMPTS: 3
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
  INVALID_QUERY: '검색어를 2글자 이상 입력해주세요',
  TIMEOUT_ERROR: '요청 시간이 초과되었습니다',
  PARSING_ERROR: '데이터 파싱 중 오류가 발생했습니다',
  FOLDER_CREATION_ERROR: '폴더 생성 중 오류가 발생했습니다'
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
  SETTINGS: 'kyobobook-settings',
  SEARCH_CONTAINER: 'kyobobook-search-container',
  SEARCH_BUTTON: 'kyobobook-search-button'
} as const;

// HTTP 헤더
export const HTTP_HEADERS = {
  USER_AGENT: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  ACCEPT: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  ACCEPT_LANGUAGE: 'ko-KR,ko;q=0.9,en;q=0.8',
  ACCEPT_ENCODING: 'gzip, deflate, br',
  CACHE_CONTROL: 'no-cache',
  PRAGMA: 'no-cache'
} as const;

// DOM 선택자 패턴
export const SELECTOR_PATTERNS = {
  // 검색 결과 선택자들 - 실제 교보문고 구조 기반
  SEARCH_RESULT_SELECTORS: [
    // 2024년 교보문고 검색 결과 구조
    '.prod_item',
    '.search_list .prod_item',
    '.prod_list .prod_item',
    '.search_result .prod_item',
    
    // 리스트 아이템 (fallback)
    'li.prod_item',
    'div.prod_item',
    '.product_item',
    '.book_item'
  ] as const,

  // 도서 링크 선택자들 - 참고 코드에서 검증된 패턴
  BOOK_LINK_SELECTORS: [
    // 교보문고 상세 페이지 링크 (실제 작동하는 패턴)
    'a[href*="/detail/S"]',
    'a[href*="product.kyobobook.co.kr/detail"]',
    'a[href*="kyobobook.co.kr/detail"]',
    
    // 일반 링크들 (fallback)
    'a[href*="/detail/"]',
    'a',
    '.prod_title a',
    '.book_title a'
  ] as const,

  // 책 제목 선택자들 - 실제 교보문고 구조
  BOOK_TITLE_SELECTORS: [
    // 참고 코드에서 검증된 제목 선택자
    '#contents h1 span.prod_title',
    '.prod_title',
    'h1 .prod_title',
    
    // 검색 결과에서의 제목
    '.prod_info .prod_name',
    '.prod_name',
    '.book_title',
    'a[href*="/detail/"]',
    'a'
  ] as const,

  // 저자 정보 선택자들 - 참고 코드 패턴 적용
  AUTHOR_SELECTORS: [
    // 참고 코드에서 사용하는 저자 선택자
    '#contents .author',
    '.author',
    '.prod_author',
    '.book_author',
    
    // 검색 결과에서의 저자 정보
    '.prod_info .author',
    '.author_info',
    '.writer_info'
  ] as const,

  // 출판사 정보 선택자들 - 참고 코드 패턴
  PUBLISHER_SELECTORS: [
    // 참고 코드에서 사용하는 출판사 선택자
    '.prod_info_text.publish_date a',
    '.prod_info .publisher',
    '.prod_publisher',
    '.publisher',
    '.book_publisher',
    '.company_info'
  ] as const,

  // 커버 이미지 선택자들 - 참고 코드 기반
  COVER_IMAGE_SELECTORS: [
    // 참고 코드에서 사용하는 og:image 메타 태그
    'meta[property="og:image"]',
    
    // 일반 이미지들
    'img[src*="contents.kyobobook.co.kr"]',
    'img[src*="image.kyobobook.co.kr"]',
    'img[src*="pdt"]',
    'img[alt*="표지"]',
    'img[alt*="커버"]',
    'img[alt*="cover"]',
    'img'
  ] as const
};