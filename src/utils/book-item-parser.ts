// 도서 항목 파싱 유틸리티
import { BookInfo } from '../types';
import { UrlBuilder } from '../api/url-builder';
import { DebugLogger } from './debug';


export class BookItemParser {
  private element: Element;

  constructor(element: Element) {
    this.element = element;
  }

  parse(): BookInfo | null {
    try {
      DebugLogger.log('BOOK_PARSER', '도서 항목 파싱 시작');

      // 기본 정보 추출 (참고 코드 패턴 적용)
      const bookData = this.extractBasicInfoNew();
      DebugLogger.log('BOOK_PARSER', '기본 정보 추출 완료', bookData);

      if (!bookData.title || bookData.title.length < 2) {
        DebugLogger.log('BOOK_PARSER', `제목이 너무 짧아 파싱 제외: "${bookData.title}"`);
        return null;
      }

      // 패키지 상품 제외
      if (this.isPackageProduct()) {
        DebugLogger.log('BOOK_PARSER', '패키지 상품으로 판단되어 파싱 제외');
        return null;
      }

      DebugLogger.log('BOOK_PARSER', '도서 항목 파싱 성공', bookData);
      return bookData;
    } catch (error) {
      DebugLogger.error('BOOK_PARSER', '도서 항목 파싱 오류', error);
      return null;
    }
  }

  private extractBasicInfoNew(): BookInfo {
    // 참고 코드 패턴 기반으로 정보 추출
    const { url, pid, bid } = this.extractUrlAndIdsNew();
    const title = this.extractTitleNew();
    const authors = this.extractAuthorsNew();
    const { publisher, publishDate } = this.extractPublisherInfoNew();
    const coverImage = this.extractCoverImageNew();

    return {
      title: this.cleanText(title),
      authors: authors.length > 0 ? authors.join(', ') : '저자미상',
      publisher: publisher || '',
      publishDate: publishDate || '',
      pid: pid || this.generateTempId(),
      bid: bid || pid || this.generateTempId(),
      url: url || '',
      coverImage: coverImage || (bid ? UrlBuilder.buildCoverImageUrl(bid) : undefined)
    };
  }

  private extractUrlAndIdsNew(): { url: string; pid: string; bid: string } {
    DebugLogger.log('BOOK_PARSER', 'URL 및 ID 추출 시작');

    // 참고 코드에서 검증된 링크 선택자들 사용
    const linkSelectors = [
      'a[href*="/detail/S"]',                    // 교보문고 표준 상세 링크
      'a[href*="product.kyobobook.co.kr/detail"]', // 전체 URL 패턴
      'a[href*="kyobobook.co.kr/detail"]',       // 도메인 패턴
      'a[href*="/detail/"]',                     // 일반 상세 링크
      'a'                                        // 모든 링크 (최종 fallback)
    ];

    for (const selector of linkSelectors) {
      const links = this.element.querySelectorAll(selector);
      for (const link of Array.from(links)) {
        const href = link.getAttribute('href');
        if (!href) continue;

        const bookId = UrlBuilder.extractBookIdFromUrl(href);
        if (bookId) {
          const fullUrl = UrlBuilder.ensureAbsoluteUrl(href);
          DebugLogger.log('BOOK_PARSER', `도서 링크 추출 성공: ${bookId}`);
          return {
            url: fullUrl,
            pid: bookId,
            bid: bookId
          };
        }
      }
    }

    // 링크를 찾지 못한 경우
    DebugLogger.log('BOOK_PARSER', '도서 링크를 찾을 수 없음, 임시 ID 생성');
    const tempId = this.generateTempId();
    return {
      url: '',
      pid: tempId,
      bid: tempId
    };
  }

  private extractTitleNew(): string {
    DebugLogger.log('BOOK_PARSER', '제목 추출 시작');

    // 참고 코드에서 사용하는 제목 선택자들
    const titleSelectors = [
      '#contents h1 span.prod_title',  // 상세 페이지용 (참고 코드)
      '.prod_title',                   // 일반 제품 제목
      '.prod_name',                    // 제품명
      '.book_title',                   // 도서 제목
      'a[href*="/detail/"]',          // 상세 링크의 텍스트
      'a'                             // 모든 링크 텍스트
    ];

    for (const selector of titleSelectors) {
      const elements = this.element.querySelectorAll(selector);
      for (const element of Array.from(elements)) {
        const text = this.cleanText(element.textContent || '');
        if (text && text.length >= 2 && text.length <= 200) {
          DebugLogger.log('BOOK_PARSER', `제목 추출 성공: ${text}`);
          return text;
        }
      }
    }

    DebugLogger.log('BOOK_PARSER', '제목을 찾을 수 없음');
    return '';
  }

  private extractAuthorsNew(): string[] {
    DebugLogger.log('BOOK_PARSER', '저자 정보 추출 시작');

    const authors: string[] = [];

    // 참고 코드 패턴: .author 요소에서 a 태그들 찾기
    const authorSelectors = [
      '#contents .author',   // 상세 페이지용 (참고 코드)
      '.author',             // 일반 저자 정보
      '.prod_author',        // 제품 저자
      '.book_author',        // 도서 저자
      '.author_info'         // 저자 정보
    ];

    for (const selector of authorSelectors) {
      const authorContainer = this.element.querySelector(selector);
      if (authorContainer) {
        // 참고 코드처럼 a 태그에서 저자명 추출
        const authorLinks = authorContainer.querySelectorAll('a');
        for (const link of Array.from(authorLinks)) {
          const text = this.cleanText(link.textContent || '');
          if (text && text.length > 0 && text.length < 30 && !authors.includes(text)) {
            authors.push(text);
            DebugLogger.log('BOOK_PARSER', `저자 추출: ${text}`);
          }
        }

        if (authors.length > 0) {
          break;
        }
      }
    }

    if (authors.length === 0) {
      DebugLogger.log('BOOK_PARSER', '저자 정보를 찾을 수 없음');
    }

    return authors.slice(0, 3); // 최대 3명까지
  }

  private extractPublisherInfoNew(): { publisher: string; publishDate: string } {
    DebugLogger.log('BOOK_PARSER', '출판사 정보 추출 시작');

    let publisher = '';
    let publishDate = '';

    // 참고 코드에서 사용하는 출판사 선택자
    const publisherSelectors = [
      '.prod_info_text.publish_date a',  // 참고 코드 패턴
      '.prod_publisher',
      '.publisher',
      '.book_publisher',
      '.company_info'
    ];

    for (const selector of publisherSelectors) {
      const element = this.element.querySelector(selector);
      if (element) {
        const text = this.cleanText(element.textContent || '');
        if (text && text.length > 0 && text.length < 50) {
          publisher = text;
          DebugLogger.log('BOOK_PARSER', `출판사 추출: ${publisher}`);
          break;
        }
      }
    }

    // 텍스트에서 출판 날짜 패턴 찾기
    const textContent = this.element.textContent || '';
    const datePattern = /(\d{4})[년\-\.\/](\d{1,2})[월\-\.\/](\d{1,2})[일]?/;
    const dateMatch = textContent.match(datePattern);
    if (dateMatch) {
      publishDate = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;
      DebugLogger.log('BOOK_PARSER', `출판일 추출: ${publishDate}`);
    }

    return { publisher, publishDate };
  }

  private extractCoverImageNew(): string | undefined {
    DebugLogger.log('BOOK_PARSER', '커버 이미지 추출 시작');

    // 참고 코드에서 사용하는 og:image 메타 태그 우선 확인 (상세 페이지용)
    const metaImage = document.head?.querySelector('meta[property="og:image"]') as HTMLMetaElement;
    if (metaImage?.content && this.isValidCoverImage(metaImage.content)) {
      DebugLogger.log('BOOK_PARSER', `og:image에서 커버 이미지 추출: ${metaImage.content}`);
      return metaImage.content;
    }

    // 일반 이미지 선택자들
    const imageSelectors = [
      'img[src*="contents.kyobobook.co.kr"]',
      'img[src*="image.kyobobook.co.kr"]',
      'img[src*="pdt"]',
      'img[alt*="표지"]',
      'img[alt*="커버"]',
      'img[alt*="cover"]',
      'img'
    ];

    for (const selector of imageSelectors) {
      const images = this.element.querySelectorAll(selector);
      for (const img of Array.from(images)) {
        const imageUrl = this.getImageUrl(img as HTMLImageElement);
        if (imageUrl && this.isValidCoverImage(imageUrl)) {
          DebugLogger.log('BOOK_PARSER', `커버 이미지 추출 성공: ${imageUrl}`);
          return imageUrl;
        }
      }
    }

    // 검색 결과에서는 커버 이미지가 없는 것이 정상
    DebugLogger.log('BOOK_PARSER', '커버 이미지를 찾을 수 없음 (검색 결과에서는 정상)');
    return undefined;
  }

  private isPackageProduct(): boolean {
    const text = this.element.textContent || '';
    const packageKeywords = ['패키지', '세트', '전집', '시리즈', '묶음'];
    return packageKeywords.some(keyword => text.includes(keyword));
  }

  private getImageUrl(img: HTMLImageElement): string {
    return img.src || img.getAttribute('data-src') || img.getAttribute('data-original') || '';
  }

  private isValidCoverImage(imageUrl: string): boolean {
    if (!imageUrl || imageUrl.length < 10) {
      return false;
    }

    // 교보문고 이미지 URL 패턴 (우선순위 순서)
    const validPatterns = [
      /contents\.kyobobook\.co\.kr/,
      /image\.kyobobook\.co\.kr/,
      /pdt\/.*\.(jpg|jpeg|png|gif|webp)/i,
      /\.(jpg|jpeg|png|gif|webp)(\?|$)/i
    ];

    // 제외할 패턴들
    const invalidPatterns = [
      /no[_-]?image/i,
      /placeholder/i,
      /default/i,
      /blank/i,
      /1x1/,
      /loading/i,
      /error/i
    ];

    const hasValidPattern = validPatterns.some(pattern => pattern.test(imageUrl));
    const hasInvalidPattern = invalidPatterns.some(pattern => pattern.test(imageUrl));
    const hasReasonableLength = imageUrl.length >= 20 && imageUrl.length <= 500;
    const hasValidProtocol = imageUrl.startsWith('http') || imageUrl.startsWith('//');

    return hasValidPattern && !hasInvalidPattern && hasReasonableLength && hasValidProtocol;
  }

  private generateTempId(): string {
    return Date.now().toString();
  }

  private cleanText(text: string): string {
    return this.cleanTitle(text.replace(/\s+/g, ' ').trim());
  }

  private cleanTitle(title: string): string {
    if (!title) return '';

    // 불필요한 접두사/접미사 제거
    const cleanedTitle = title
      // [국내 도서], [수입 도서], [전자책] 등 카테고리 제거
      .replace(/^\[[^\]]*\]\s*/g, '')
      // (국내배송), (해외배송) 등 배송정보 제거
      .replace(/\([^)]*배송[^)]*\)\s*/g, '')
      // 교보문고 특정 메타데이터 제거
      .replace(/\s*\|\s*교보문고\s*/g, '')
      .replace(/\s*-\s*교보문고\s*/g, '')
      // 연속된 공백이나 특수문자 정리
      .replace(/\s+/g, ' ')
      .replace(/^\s*-\s*/, '') // 시작 부분의 하이픈 제거
      .replace(/\s*-\s*$/, '') // 끝 부분의 하이픈 제거
      .trim();

    DebugLogger.log('BOOK_PARSER', `제목 정제: "${title}" → "${cleanedTitle}"`);
    return cleanedTitle;
  }
}