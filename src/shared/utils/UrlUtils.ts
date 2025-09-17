// URL 처리 유틸리티

/**
 * URL 및 링크 처리 유틸리티
 */
export class UrlUtils {
  // 교보문고 도메인 상수
  private static readonly KYOBOBOOK_DOMAINS = [
    'www.kyobobook.co.kr',
    'product.kyobobook.co.kr',
    'kyobobook.co.kr'
  ] as const;

  private static readonly KYOBOBOOK_IMAGE_DOMAINS = [
    'contents.kyobobook.co.kr',
    'image.kyobobook.co.kr'
  ] as const;

  // URL 패턴
  private static readonly BOOK_ID_PATTERNS_PRIMARY = [
    /\/detail\/S(\d{6,})/,           // /detail/S1234567890
    /\/detail\/(\d{6,})/,            // /detail/1234567890
    /product\.kyobobook\.co\.kr\/detail\/S(\d{6,})/, // 전체 URL
    /product\.kyobobook\.co\.kr\/detail\/(\d{6,})/,  // 전체 URL
  ] as const;
  // 쿼리 파라미터 기반(ID/바코드)은 노이즈가 많아 기본적으로 사용하지 않음
  private static readonly BOOK_ID_PATTERNS_FALLBACK = [
    /[?&]id=(\d{6,})/
  ] as const;

  /**
   * 교보문고 도서 ID 추출
   */
  static extractBookId(url: string): string | null {
    if (!url) return null;

    // URL 디코딩
    const decodedUrl = decodeURIComponent(url);

    // 1) 상세 경로 기반(가장 신뢰도 높음)
    for (const pattern of this.BOOK_ID_PATTERNS_PRIMARY) {
      const match = decodedUrl.match(pattern);
      if (match && match[1]) return match[1];
    }

    // 2) 제한된 쿼리 파라미터 기반(최후 수단)
    for (const pattern of this.BOOK_ID_PATTERNS_FALLBACK) {
      const match = decodedUrl.match(pattern);
      if (match && match[1]) return match[1];
    }

    return null;
  }

  /**
   * 상대 URL을 절대 URL로 변환
   */
  static toAbsoluteUrl(url: string, baseUrl = 'https://www.kyobobook.co.kr'): string {
    if (!url) return '';

    // 이미 절대 URL인 경우
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }

    // 프로토콜 상대 URL (//domain.com/path)
    if (url.startsWith('//')) {
      return `https:${url}`;
    }

    // 절대 경로 (/path)
    if (url.startsWith('/')) {
      const base = new URL(baseUrl);
      return `${base.protocol}//${base.host}${url}`;
    }

    // 상대 경로 (path)
    return `${baseUrl.replace(/\/$/, '')}/${url}`;
  }

  /**
   * 교보문고 도서 상세 페이지 URL 생성
   */
  static buildDetailPageUrl(bookId: string): string {
    if (!bookId) return '';

    // S 접두사가 없으면 추가
    const id = bookId.startsWith('S') ? bookId : `S${bookId}`;
    return `https://product.kyobobook.co.kr/detail/${id}`;
  }

  /**
   * 교보문고 검색 URL 생성
   */
  static buildSearchUrl(query: string, maxResults = 20): string {
    if (!query) return '';

    const params = new URLSearchParams({
      keyword: query.trim(),
      target: 'total',
      gbCode: 'TOT',
      len: maxResults.toString()
    });

    return `https://search.kyobobook.co.kr/search?${params.toString()}`;
  }

  /**
   * 교보문고 표지 이미지 URL 생성
   */
  static buildCoverImageUrl(code: string, size: 'small' | 'medium' | 'large' = 'medium'): string {
    if (!code) return '';

    const sizeMap = {
      small: '150x0',
      medium: '200x0',
      large: '300x0'
    } as const;

    // 우선순위: 13자리 바코드/ISBN(EAN)을 그대로 사용
    const normalized = code.replace(/^S/, '').replace(/[^0-9Xx]/g, '');
    const isBarcode = /^\d{12,13}$/.test(normalized);
    const target = isBarcode ? normalized : code.replace(/^S/, '');

    return `https://contents.kyobobook.co.kr/sih/fit-in/${sizeMap[size]}/pdt/${target}.jpg`;
  }

  /**
   * URL이 교보문고 도메인인지 확인
   */
  static isKyobobookUrl(url: string): boolean {
    if (!url) return false;

    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();

      return this.KYOBOBOOK_DOMAINS.some(domain =>
        hostname === domain || hostname.endsWith(`.${domain}`)
      );
    } catch {
      return false;
    }
  }

  /**
   * URL이 교보문고 이미지 도메인인지 확인
   */
  static isKyobobookImageUrl(url: string): boolean {
    if (!url) return false;

    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();

      return this.KYOBOBOOK_IMAGE_DOMAINS.some(domain =>
        hostname === domain || hostname.endsWith(`.${domain}`)
      );
    } catch {
      return false;
    }
  }

  /**
   * 이미지 URL 유효성 검증
   */
  static isValidImageUrl(url: string): boolean {
    if (!url || url.length < 10) return false;

    // 프로토콜 확인
    if (!url.startsWith('http') && !url.startsWith('//')) {
      return false;
    }

    // 이미지 확장자 확인 (교보 이미지 도메인은 확장자 없이도 허용)
    const imageExtensions = /\.(jpg|jpeg|png|gif|webp)(\?|$)/i;
    const hasExt = imageExtensions.test(url);

    try {
      const u = new URL(url.startsWith('//') ? `https:${url}` : url);
      const host = u.hostname.toLowerCase();
      const isKyoboImageHost = (['contents.kyobobook.co.kr','image.kyobobook.co.kr'] as string[])
        .some(d => host === d || host.endsWith(`.${d}`));
      if (!hasExt && !isKyoboImageHost) {
        return false;
      }
    } catch {
      if (!hasExt) return false;
    }

    // 제외할 패턴
    const invalidPatterns = [
      /no[_-]?image/i,
      /placeholder/i,
      /default/i,
      /blank/i,
      /1x1/,
      /loading/i,
      /error/i
    ];

    return !invalidPatterns.some(pattern => pattern.test(url));
  }

  /**
   * URL에서 쿼리 파라미터 추출
   */
  static getQueryParams(url: string): Record<string, string> {
    if (!url) return {};

    try {
      const urlObj = new URL(url);
      const params: Record<string, string> = {};

      urlObj.searchParams.forEach((value, key) => {
        params[key] = value;
      });

      return params;
    } catch {
      return {};
    }
  }

  /**
   * URL에 쿼리 파라미터 추가
   */
  static addQueryParams(url: string, params: Record<string, string | number>): string {
    if (!url) return '';

    try {
      const urlObj = new URL(url);

      Object.entries(params).forEach(([key, value]) => {
        urlObj.searchParams.set(key, String(value));
      });

      return urlObj.toString();
    } catch {
      return url;
    }
  }

  /**
   * URL에서 특정 쿼리 파라미터 제거
   */
  static removeQueryParams(url: string, paramsToRemove: string[]): string {
    if (!url) return '';

    try {
      const urlObj = new URL(url);

      paramsToRemove.forEach(param => {
        urlObj.searchParams.delete(param);
      });

      return urlObj.toString();
    } catch {
      return url;
    }
  }

  /**
   * URL 단축 (표시용)
   */
  static shortenUrl(url: string, maxLength = 50): string {
    if (!url || url.length <= maxLength) return url;

    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname;
      const path = urlObj.pathname;

      if (domain.length >= maxLength - 3) {
        return domain.slice(0, maxLength - 3) + '...';
      }

      const remainingLength = maxLength - domain.length - 3; // 3 for "..."
      if (path.length <= remainingLength) {
        return domain + path;
      }

      return domain + path.slice(0, remainingLength) + '...';
    } catch {
      return url.slice(0, maxLength - 3) + '...';
    }
  }

  /**
   * URL 정규화 (일관된 형식으로 변환)
   */
  static normalizeUrl(url: string): string {
    if (!url) return '';

    try {
      const urlObj = new URL(url);

      // HTTPS로 강제 변환
      urlObj.protocol = 'https:';

      // 기본 포트 제거
      if (urlObj.port === '443' || urlObj.port === '80') {
        urlObj.port = '';
      }

      // trailing slash 정규화
      if (urlObj.pathname.endsWith('/') && urlObj.pathname.length > 1) {
        urlObj.pathname = urlObj.pathname.slice(0, -1);
      }

      // 쿼리 파라미터 정렬
      const params = Array.from(urlObj.searchParams.entries())
        .sort(([a], [b]) => a.localeCompare(b));

      urlObj.search = '';
      params.forEach(([key, value]) => {
        urlObj.searchParams.set(key, value);
      });

      return urlObj.toString();
    } catch {
      return url;
    }
  }

  /**
   * 이미지 URL 최적화 (크기, 품질 조정)
   */
  static optimizeImageUrl(
    url: string,
    options: {
      width?: number;
      height?: number;
      quality?: number;
      format?: 'jpg' | 'webp' | 'png';
    } = {}
  ): string {
    if (!url || !this.isKyobobookImageUrl(url)) {
      return url;
    }

    try {
      const urlObj = new URL(url);

      // 교보문고 이미지 서버의 경우 fit-in 파라미터 사용
      if (urlObj.hostname.includes('contents.kyobobook.co.kr')) {
        const { width = 200, height = 0 } = options;
        const sizePath = `fit-in/${width}x${height}`;

        // 기존 경로에서 fit-in 부분 교체
        urlObj.pathname = urlObj.pathname.replace(
          /fit-in\/\d+x\d+/,
          sizePath
        );
      }

      return urlObj.toString();
    } catch {
      return url;
    }
  }

  /**
   * URL이 접근 가능한지 확인 (헤드 요청)
   */
  static async isUrlAccessible(url: string): Promise<boolean> {
    if (!url) return false;

    try {
      // Obsidian의 requestUrl을 사용하여 헤드 요청
      const response = await fetch(url, {
        method: 'HEAD',
        timeout: 5000
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * 여러 이미지 URL 중 가장 적합한 것 선택
   */
  static selectBestImageUrl(urls: string[]): string | null {
    if (!urls || urls.length === 0) return null;

    // 유효한 URL만 필터링
    const validUrls = urls.filter(url => this.isValidImageUrl(url));

    if (validUrls.length === 0) return null;

    // 교보문고 이미지 우선
    const kyobobookImages = validUrls.filter(url => this.isKyobobookImageUrl(url));
    if (kyobobookImages.length > 0) {
      return kyobobookImages[0];
    }

    // 그 외 첫 번째 유효한 이미지
    return validUrls[0];
  }

  /**
   * URL의 도메인 추출
   */
  static extractDomain(url: string): string | null {
    if (!url) return null;

    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return null;
    }
  }

  /**
   * URL이 HTTPS인지 확인
   */
  static isSecureUrl(url: string): boolean {
    if (!url) return false;

    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  }
}
