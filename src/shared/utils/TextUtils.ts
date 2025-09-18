// 텍스트 처리 유틸리티 (중복 제거 및 통합)

/**
 * 텍스트 정리 및 변환 유틸리티
 */
export class TextUtils {
  /**
   * 기본 텍스트 정리 (공백 정규화, 트림)
   */
  static clean(text: string): string {
    if (!text) return '';

    return text
      .replace(/\s+/g, ' ')  // 연속된 공백을 하나로
      .replace(/\n+/g, '\n') // 연속된 줄바꿈을 하나로
      .trim();
  }

  /**
   * 도서 제목 전용 정리 (교보문고 메타데이터 제거)
   */
  static cleanTitle(title: string): string {
    if (!title) return '';

    return this.clean(title)
      // [국내 도서], [수입 도서], [전자책] 등 카테고리 제거
      .replace(/^\[[^\]]*\]\s*/g, '')
      // (국내배송), (해외배송) 등 배송정보 제거
      .replace(/\([^)]*배송[^)]*\)\s*/g, '')
      // 교보문고 특정 메타데이터 제거
      .replace(/\s*\|\s*교보문고\s*/g, '')
      .replace(/\s*-\s*교보문고\s*/g, '')
      // 시작/끝 부분의 하이픈 제거
      .replace(/^\s*-\s*/, '')
      .replace(/\s*-\s*$/, '')
      .trim();
  }

  /**
   * 저자명 정리 (구분자 처리 및 정규화)
   */
  static cleanAuthor(author: string): string {
    if (!author) return '';

    return this.clean(author)
      // 역할 정보 제거 (저, 편, 역, 그림 등)
      .replace(/\s*\([^)]*\)\s*/g, '')
      .replace(/\s*(저|편|역|그림|지음|옮김|감수)\s*/g, '')
      .trim();
  }

  /**
   * 저자 목록 파싱 (문자열에서 배열로)
   */
  static parseAuthors(authorsString: string): string[] {
    if (!authorsString) return [];

    // 다양한 구분자로 분리
    const separators = /[,;|·\u00B7]/; // 쉼표, 세미콜론, 파이프, 중점

    return authorsString
      .split(separators)
      .map(author => this.cleanAuthor(author))
      .filter(author => author.length > 0 && author.length < 50) // 유효한 길이
      .slice(0, 5); // 최대 5명
  }

  /**
   * 출판사명 정리
   */
  static cleanPublisher(publisher: string): string {
    if (!publisher) return '';

    return this.clean(publisher)
      // 출판사 관련 불필요한 접미사 제거
      .replace(/\s*(출판사|출판|주식회사|㈜)\s*$/g, '')
      .trim();
  }

  /**
   * 카테고리 정리 및 파싱
   */
  static parseCategories(categoriesString: string): string[] {
    if (!categoriesString) return [];

    // 다양한 구분자로 분리
    const separators = /[>\u003E\u00BB\u203A]/; // >, », ›

    return categoriesString
      .split(separators)
      .map(category => this.clean(category))
      .filter(category =>
        category.length > 0 &&
        category.length < 50 &&
        category !== '홈' &&
        category !== '전체' &&
        category !== '도서'
      )
      .slice(0, 10); // 최대 10개
  }

  /**
   * HTML 태그 제거
   */
  static stripHtml(html: string): string {
    if (!html) return '';

    return html
      .replace(/<[^>]+>/g, '') // HTML 태그 제거
      .replace(/&nbsp;/gi, ' ')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .trim();
  }

  /**
   * 숫자 추출 (페이지 수, 평점 등)
   */
  static extractNumber(text: string, pattern: RegExp): number | undefined {
    if (!text) return undefined;

    const match = text.match(pattern);
    if (!match || !match[1]) return undefined;

    const num = parseFloat(match[1]);
    return isNaN(num) ? undefined : num;
  }

  /**
   * 페이지 수 추출
   */
  static extractPages(text: string): number | undefined {
    if (!text) return undefined;
    // 다양한 표기: "344페이지", "344쪽", "쪽수 344쪽", "p.344"
    const patterns = [
      /(\d{1,4})\s*페이지/,
      /(\d{1,4})\s*쪽/,
      /쪽수\s*[:\-]?\s*(\d{1,4})\s*쪽?/, // 라벨 기반
      /p\.?\s*(\d{1,4})\b/i
    ];
    for (const p of patterns) {
      const m = text.match(p);
      if (m && m[1]) {
        const num = parseInt(m[1], 10);
        if (!isNaN(num) && num > 0 && num < 5000) return num;
      }
    }
    return undefined;
  }

  /**
   * 평점 추출 (0-10 범위로 정규화)
   */
  static extractRating(text: string): number | undefined {
    const ratingPattern = /(\d+\.?\d*)\s*점?/;
    const rating = this.extractNumber(text, ratingPattern);

    if (rating === undefined) return undefined;

    // 5점 만점을 10점 만점으로 변환
    if (rating <= 5) {
      return rating * 2;
    }

    // 10점 만점 그대로
    return rating <= 10 ? rating : undefined;
  }

  /**
   * 날짜 형식 정규화 (YYYY-MM-DD)
   */
  static normalizeDateString(dateString: string): string | undefined {
    if (!dateString) return undefined;

    // 다양한 날짜 형식 패턴
    const patterns = [
      /(\d{4})[년\-\.\/](\d{1,2})[월\-\.\/](\d{1,2})[일]?/,
      /(\d{4})[년\-\.\/](\d{1,2})/,
      /(\d{4})/
    ];

    for (const pattern of patterns) {
      const match = dateString.match(pattern);
      if (match) {
        const year = match[1];
        const month = match[2] ? match[2].padStart(2, '0') : '01';
        const day = match[3] ? match[3].padStart(2, '0') : '01';

        // 유효한 날짜인지 확인
        const date = new Date(`${year}-${month}-${day}`);
        if (!isNaN(date.getTime())) {
          return `${year}-${month}-${day}`;
        }
      }
    }

    return undefined;
  }

  /**
   * ISBN 형식 정규화
   */
  static normalizeISBN(isbn: string): string | undefined {
    if (!isbn) return undefined;

    // ISBN에서 숫자와 X만 추출
    const cleaned = isbn.replace(/[^\dX]/gi, '').toUpperCase();

    // ISBN-10 또는 ISBN-13 길이 확인
    if (cleaned.length === 10 || cleaned.length === 13) {
      return cleaned;
    }

    return undefined;
  }

  /**
   * 문자열 길이 제한 (말줄임표 추가)
   */
  static truncate(text: string, maxLength: number, suffix = '...'): string {
    if (!text || text.length <= maxLength) return text;

    return text.slice(0, maxLength - suffix.length) + suffix;
  }

  /**
   * 파일명에 안전한 문자열로 변환
   */
  static toSafeFileName(text: string): string {
    if (!text) return 'untitled';

    return this.clean(text)
      .replace(/[\\/:*?"<>|]/g, '_') // 파일명에 사용 불가능한 문자들 제거
      .replace(/\s+/g, '_')          // 공백을 언더스코어로
      .replace(/_{2,}/g, '_')        // 연속된 언더스코어를 하나로
      .replace(/^_+|_+$/g, '')       // 시작/끝의 언더스코어 제거
      .slice(0, 100);                // 길이 제한
  }

  /**
   * 키워드 추출 (검색, 태그 생성용)
   */
  static extractKeywords(text: string, maxKeywords = 10): string[] {
    if (!text) return [];

    // 불용어 목록
    const stopWords = new Set([
      '그', '이', '저', '것', '들', '등', '및', '또는', '그리고', '하지만', '그러나',
      '의', '가', '을', '를', '에', '와', '과', '로', '으로', '에서', '부터', '까지',
      '도서', '책', '출판', '저자', '작가', '출판사', '페이지'
    ]);

    // 단어 추출 및 정리
    const words = this.clean(text)
      .toLowerCase()
      .split(/\s+/)
      .map(word => word.replace(/[^\w가-힣]/g, ''))
      .filter(word =>
        word.length >= 2 &&
        word.length <= 20 &&
        !stopWords.has(word) &&
        !/^\d+$/.test(word) // 숫자만 있는 단어 제외
      );

    // 빈도수 계산
    const wordCount = new Map<string, number>();
    words.forEach(word => {
      wordCount.set(word, (wordCount.get(word) || 0) + 1);
    });

    // 빈도수 순으로 정렬하여 상위 키워드 반환
    return Array.from(wordCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxKeywords)
      .map(([word]) => word);
  }

  /**
   * 유사도 계산 (Levenshtein distance 기반)
   */
  static similarity(str1: string, str2: string): number {
    if (!str1 || !str2) return 0;

    const s1 = this.clean(str1).toLowerCase();
    const s2 = this.clean(str2).toLowerCase();

    if (s1 === s2) return 1;

    const matrix: number[][] = [];
    const len1 = s1.length;
    const len2 = s2.length;

    // 초기화
    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    // 계산
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,     // 삭제
          matrix[i][j - 1] + 1,     // 삽입
          matrix[i - 1][j - 1] + cost // 치환
        );
      }
    }

    const maxLen = Math.max(len1, len2);
    return maxLen === 0 ? 1 : (maxLen - matrix[len1][len2]) / maxLen;
  }
}
