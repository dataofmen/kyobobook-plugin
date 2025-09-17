// HTML 선택자 상수 (하드코딩 제거 및 중앙화)

/**
 * 교보문고 HTML 선택자 모음
 */
export const SELECTORS = {
  // 검색 결과 페이지 선택자들 (우선순위 순)
  SEARCH_RESULT_ITEMS: [
    // 최신 교보문고 검색 결과 구조 (2024년 기준)
    '.prod_list .prod_item',
    '.search_list .prod_item',
    '.result_list .prod_item',
    '.list_search_result .prod_item',

    // 리스트 기반 구조
    'main list[role="list"] > listitem',
    'main list > listitem',
    'list[role="list"] > listitem',
    'list > listitem',

    // 일반 상품 아이템들
    '.prod_item',
    '.product_item',
    '.book_item',
    '.search_item',
    '.result_item',

    // 컨테이너 내 아이템들
    '#shopData_list .prod_list .prod_item',
    '.contents_wrap .prod_item',
    '.search_result_wrap .prod_item',

    // 기존 호환성 선택자들
    '.list_search_result .item',
    '.search_result .item',
    '.contents_wrap .item',
    '.list_type_1 .item',
    '.prod_list_type .item',

    // div 기반 구조
    'div[class*="prod_item"]',
    'div[class*="book_item"]',
    'div[class*="product_item"]',
    'div[class*="item"]',

    // 리스트 아이템들
    'li.item',
    'li.prod_item',
    'li.product_item',
    'li.book_item',

    // 테이블 기반 (fallback)
    'tr.prod_item',
    'tbody tr',
    '.search_table tr',
    '.table_list tr',

    // 최후 fallback 선택자들
    '[data-testid*="product"]',
    '[data-testid*="book"]',
    '[class*="search_result"]'
  ] as const,

  // 도서 상세 링크 선택자들
  BOOK_DETAIL_LINKS: [
    'a[href*="/detail/S"]',
    'a[href*="product.kyobobook.co.kr/detail"]',
    'a[href*="kyobobook.co.kr/detail"]',
    'a[href*="/detail/"]',
    'a[href*="product"]'
  ] as const,

  // 제목 선택자들 (우선순위 순)
  TITLE: [
    '#contents h1 span.prod_title',  // 상세 페이지용
    '.prod_title',
    '.prod_name',
    '.book_title',
    'h1.title',
    'h2.title',
    '.title'
  ] as const,

  // 저자 선택자들
  AUTHOR: [
    '#contents .author',   // 상세 페이지용
    '.author',
    '.prod_author',
    '.book_author',
    '.author_info',
    '.writer'
  ] as const,

  // 출판사 선택자들
  PUBLISHER: [
    '.prod_info_text.publish_date a',  // 참고 코드 패턴
    '.prod_publisher',
    '.publisher',
    '.book_publisher',
    '.company_info',
    'a.btn_publish_link',
    '.publish_info'
  ] as const,

  // 이미지 선택자들
  COVER_IMAGE: [
    'img[src*="contents.kyobobook.co.kr"]',
    'img[src*="image.kyobobook.co.kr"]',
    'img[src*="pdt"]',
    'img[data-kbbfn="s3-image"]',
    '.portrait_img_box img',
    'img[alt*="표지"]',
    'img[alt*="커버"]',
    'img[alt*="cover"]',
    '.prod_img img',
    '.book_img img',
    '.product_img img',
    '.cover_img img'
  ] as const,

  // 상세 정보 선택자들
  DETAIL: {
    // ISBN 선택자들
    ISBN: [
      '[data-testid="isbn"]',
      '.isbn',
      '.prod_detail_isbn',
      '.book_isbn',
      '.prod_detail_area .auto_overflow_contents'
    ] as const,

    // 페이지 수 선택자들
    PAGES: [
      '[data-testid="page"]',
      '.page',
      '.prod_detail_page',
      '.book_page'
    ] as const,

    // 카테고리 선택자들
    CATEGORIES: [
      '.prod_category',
      '.book_category',
      '.breadcrumb a',
      '.category_path a',
      '.prod_path a',
      '.location_list a'
    ] as const,

    // 평점 선택자들
    RATING: [
      '.rating',
      '.prod_rating',
      '.book_rating',
      '.score',
      '.prod_grade .grade_num',
      '.rating_num'
    ] as const,

    // 메타 이미지 선택자들
    META_IMAGE: [
      'meta[property="og:image"]',
      'meta[name="twitter:image"]'
    ] as const,

    // 목차 관련 선택자들
    TOC: {
      HEADINGS: 'h1, h2, h3, h4, h5, h6',
      CONTENT: [
        '.toc_content',
        '.contents_text',
        '.book_toc',
        '.table_contents',
        '.contents_area',
        '#toc_content'
      ] as const
    }
  }
} as const;

/**
 * CSS 클래스 상수
 */
export const CSS_CLASSES = {
  // 플러그인 관련 클래스
  SEARCH_MODAL: 'kyobobook-search-modal',
  SEARCH_CONTAINER: 'kyobobook-search-container',
  SEARCH_BUTTON: 'kyobobook-search-button',
  SUGGESTION_ITEM: 'kyobobook-suggestion-item',

  // 도서 정보 표시 클래스
  BOOK_COVER: 'book-cover',
  BOOK_COVER_PLACEHOLDER: 'book-cover-placeholder',
  BOOK_INFO: 'book-info',
  BOOK_TITLE: 'book-title',
  BOOK_AUTHOR: 'book-author',
  BOOK_PUBLISHER: 'book-publisher',
  BOOK_DATE: 'book-date',
  BOOK_DEBUG: 'book-debug',
  BOOK_LINK: 'book-link',

  // 상태 관련 클래스
  LOADING: 'loading',
  ERROR: 'error',
  EMPTY: 'empty'
} as const;

/**
 * 검색 패턴 상수
 */
export const PATTERNS = {
  // URL 패턴
  BOOK_ID: /\/detail\/S?(\d+)/,
  ISBN: /ISBN[:\s]*([0-9\-X]{10,17})/i,
  PAGES: /(\d+)\s*페이지/,
  RATING: /(\d+\.?\d*)\s*점?/,
  DATE: /(\d{4})[년\-\.\/](\d{1,2})[월\-\.\/]?(\d{1,2})?[일]?/,

  // 텍스트 정리 패턴
  WHITESPACE: /\s+/g,
  NEWLINES: /\n+/g,
  HTML_TAGS: /<[^>]+>/g,
  BRACKETS: /^\[[^\]]*\]\s*/g,
  SHIPPING_INFO: /\([^)]*배송[^)]*\)\s*/g,
  KYOBOBOOK_SUFFIX: /\s*[\|\-]\s*교보문고\s*/g,

  // 제외할 이미지 패턴
  INVALID_IMAGE: [
    /no[_-]?image/i,
    /placeholder/i,
    /default/i,
    /blank/i,
    /1x1/,
    /loading/i,
    /error/i
  ] as const,

  // 유효한 이미지 패턴
  VALID_IMAGE: [
    /contents\.kyobobook\.co\.kr/,
    /image\.kyobobook\.co\.kr/,
    /pdt\/.*\.(jpg|jpeg|png|gif|webp)/i,
    /\.(jpg|jpeg|png|gif|webp)(\?|$)/i
  ] as const
} as const;

/**
 * 키워드 상수
 */
export const KEYWORDS = {
  // 패키지 상품 키워드
  PACKAGE_PRODUCTS: ['패키지', '세트', '전집', '시리즈', '묶음'],

  // 제외할 카테고리
  EXCLUDED_CATEGORIES: ['홈', '전체', '도서'],

  // 불용어 목록
  STOP_WORDS: [
    '그', '이', '저', '것', '들', '등', '및', '또는', '그리고', '하지만', '그러나',
    '의', '가', '을', '를', '에', '와', '과', '로', '으로', '에서', '부터', '까지',
    '도서', '책', '출판', '저자', '작가', '출판사', '페이지'
  ],

  // 저자 역할 키워드
  AUTHOR_ROLES: ['저', '편', '역', '그림', '지음', '옮김', '감수', '글', '작가']
} as const;

/**
 * 제한값 상수
 */
export const LIMITS = {
  // 텍스트 길이 제한
  MAX_TITLE_LENGTH: 200,
  MAX_AUTHOR_LENGTH: 50,
  MAX_PUBLISHER_LENGTH: 100,
  MAX_DESCRIPTION_LENGTH: 5000,
  MAX_TOC_LENGTH: 10000,

  // 배열 크기 제한
  MAX_AUTHORS: 5,
  MAX_CATEGORIES: 10,
  MAX_KEYWORDS: 10,

  // 검색 관련 제한
  MAX_SEARCH_RESULTS: 50,
  MIN_QUERY_LENGTH: 2,
  MAX_QUERY_LENGTH: 100,

  // 파일명 길이 제한
  MAX_FILENAME_LENGTH: 100,

  // 이미지 URL 길이 제한
  MIN_IMAGE_URL_LENGTH: 20,
  MAX_IMAGE_URL_LENGTH: 500
} as const;

/**
 * 기본값 상수
 */
export const DEFAULTS = {
  LANGUAGE: 'ko',
  SEARCH_RESULTS: 20,
  IMAGE_SIZE: 'medium',
  RATING_SCALE: 10,
  AUTHOR_UNKNOWN: '저자미상',
  PUBLISHER_UNKNOWN: '출판사미상'
} as const;
