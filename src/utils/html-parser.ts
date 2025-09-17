// HTML 파싱 베이스 클래스
import { DebugLogger } from './debug';

export abstract class BaseHtmlParser {
  protected doc: Document;

  constructor(html: string) {
    const parser = new DOMParser();
    this.doc = parser.parseFromString(html, 'text/html');
  }

  protected cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim();
  }

  protected querySelector(selector: string): Element | null {
    return this.doc.querySelector(selector);
  }

  protected querySelectorAll(selector: string): NodeListOf<Element> {
    return this.doc.querySelectorAll(selector);
  }

  protected findElementWithText(text: string, tagName?: string): Element | null {
    const selector = tagName || '*';
    const elements = this.querySelectorAll(selector);

    for (const element of Array.from(elements)) {
      if (element.textContent?.includes(text)) {
        return element;
      }
    }

    return null;
  }

  protected extractTextByPattern(text: string, pattern: RegExp): string {
    const match = text.match(pattern);
    return match ? match[1] : '';
  }
}

// 검색 결과 파서
export class SearchResultParser extends BaseHtmlParser {
  private static readonly SELECTORS = [
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
  ] as const;

  findResultItems(): Element[] {
    DebugLogger.log('PARSER', '검색 결과 아이템 찾기 시작');

    // 1단계: 기본 선택자들로 시도
    for (let i = 0; i < SearchResultParser.SELECTORS.length; i++) {
      const selector = SearchResultParser.SELECTORS[i];
      const items = this.querySelectorAll(selector);

      DebugLogger.log('PARSER', `선택자 "${selector}": ${items.length}개 발견`);

      if (items.length > 0) {
        DebugLogger.log('PARSER', `선택자 "${selector}"로 ${items.length}개 아이템 발견, 사용함`);
        return Array.from(items);
      }
    }

    // 2단계: 더 넓은 범위로 검색
    DebugLogger.warn('PARSER', '기본 선택자로 결과를 찾을 수 없음, 확장 검색 시작');
    return this.findItemsWithFallback();
  }

  private findItemsWithFallback(): Element[] {
    DebugLogger.log('PARSER', 'Fallback 모드로 아이템 검색');

    // 도서 링크가 포함된 요소들을 부모로 해서 아이템 찾기
    const bookLinks = this.querySelectorAll('a[href*="/detail/S"], a[href*="product.kyobobook.co.kr"]');
    DebugLogger.log('PARSER', `도서 링크 발견: ${bookLinks.length}개`);

    if (bookLinks.length > 0) {
      const items: Element[] = [];
      const processedParents = new Set<Element>();

      for (const link of Array.from(bookLinks)) {
        // 링크의 부모 요소들을 검사하여 상품 아이템 컨테이너 찾기
        let current = link.parentElement;
        let depth = 0;

        while (current && depth < 5) {
          const className = current.className || '';
          const tagName = current.tagName.toLowerCase();

          // 상품 아이템 컨테이너로 보이는 요소들
          if (this.isProductContainer(current) && !processedParents.has(current)) {
            items.push(current);
            processedParents.add(current);
            DebugLogger.log('PARSER', `Fallback 아이템 발견: ${tagName}.${className}`);
            break;
          }

          current = current.parentElement;
          depth++;
        }
      }

      if (items.length > 0) {
        DebugLogger.log('PARSER', `Fallback 모드에서 ${items.length}개 아이템 발견`);
        return items;
      }
    }

    // 3단계: 매우 넓은 범위로 모든 div, li, tr 요소 검사
    DebugLogger.warn('PARSER', '링크 기반 검색 실패, 전체 요소 검색');
    return this.findItemsByContent();
  }

  private isProductContainer(element: Element): boolean {
    const className = (element.className || '').toLowerCase();
    const id = (element.id || '').toLowerCase();

    // 상품 컨테이너로 보이는 클래스명이나 ID 패턴
    const containerPatterns = [
      'prod', 'product', 'book', 'item', 'result', 'search',
      'list', 'card', 'box', 'wrap', 'container'
    ];

    return containerPatterns.some(pattern =>
      className.includes(pattern) || id.includes(pattern)
    );
  }

  private findItemsByContent(): Element[] {
    DebugLogger.log('PARSER', '내용 기반으로 아이템 검색');

    const allElements = this.querySelectorAll('div, li, tr, article, section');
    const items: Element[] = [];

    for (const element of Array.from(allElements)) {
      // 요소 내에 도서 링크와 텍스트가 있는지 확인
      const hasBookLink = element.querySelector('a[href*="/detail/S"], a[href*="product.kyobobook.co.kr"]');
      const textContent = element.textContent || '';

      if (hasBookLink && textContent.length > 20 && textContent.length < 500) {
        // 저자, 출판사 등의 키워드가 있는지 확인
        const hasBookInfo = /저자|출판|지은이|글|작가|ISBN|\d{4}년|\d{4}\./i.test(textContent);

        if (hasBookInfo) {
          items.push(element);
          DebugLogger.log('PARSER', `내용 기반 아이템 발견: ${element.tagName}.${element.className}`);
        }
      }

      // 너무 많이 찾으면 중단
      if (items.length >= 20) break;
    }

    DebugLogger.log('PARSER', `내용 기반 검색에서 ${items.length}개 아이템 발견`);
    return items;
  }

  analyzeStructure(): void {
    DebugLogger.log('HTML_PARSER', '=== SearchResultParser 구조 분석 시작 ===');

    const title = this.querySelector('title')?.textContent;
    DebugLogger.log('HTML_PARSER', `페이지 제목: ${title}`);

    // 검색 결과 관련 키워드가 포함된 요소 찾기
    const searchTerms = ['search', 'result', 'list', 'prod', 'book', 'item'];

    searchTerms.forEach(term => {
      const elementsWithClass = this.querySelectorAll(`[class*="${term}"]`);
      if (elementsWithClass.length > 0) {
        DebugLogger.log('HTML_PARSER', `"${term}" 클래스 요소: ${elementsWithClass.length}개`);

        // 처음 3개 요소의 클래스명 로깅
        Array.from(elementsWithClass).slice(0, 3).forEach((el, i) => {
          DebugLogger.log('HTML_PARSER', `  ${i + 1}. ${el.className}`);
        });
      }
    });

    // 상세 페이지 링크 분석
    const detailLinks = this.querySelectorAll('a[href*="detail"], a[href*="product"]');
    DebugLogger.log('HTML_PARSER', `상세 페이지 링크: ${detailLinks.length}개`);

    // 첫 5개 링크의 href 로깅
    Array.from(detailLinks).slice(0, 5).forEach((link, i) => {
      const href = link.getAttribute('href');
      DebugLogger.log('HTML_PARSER', `  ${i + 1}. ${href}`);
    });

    DebugLogger.log('HTML_PARSER', '=== SearchResultParser 구조 분석 완료 ===');
  }
}

// 도서 상세 정보 파서
export class BookDetailParser extends BaseHtmlParser {
  extractISBN(): string {
    const selectors = [
      '[data-testid="isbn"]',
      '.isbn',
      '.prod_detail_isbn',
      '.book_isbn',
      '.prod_detail_area .auto_overflow_contents'
    ];

    for (const selector of selectors) {
      const element = this.querySelector(selector);
      if (element) {
        const text = this.cleanText(element.textContent || '');
        const isbnMatch = text.match(/ISBN[:\s]*([0-9\-X]+)/i);
        if (isbnMatch) {
          return isbnMatch[1];
        }
      }
    }

    // 전체 텍스트에서 ISBN 패턴 검색
    const bodyText = this.doc.body?.textContent || '';
    const isbnMatch = bodyText.match(/ISBN[:\s]*([0-9\-X]{10,17})/i);
    return isbnMatch ? isbnMatch[1] : '';
  }

  extractPages(): string {
    const selectors = [
      '[data-testid="page"]',
      '.page',
      '.prod_detail_page',
      '.book_page'
    ];

    for (const selector of selectors) {
      const element = this.querySelector(selector);
      if (element) {
        const text = this.cleanText(element.textContent || '');
        const pageMatch = text.match(/(\d+)\s*페이지/);
        if (pageMatch) {
          return pageMatch[1] + '페이지';
        }
      }
    }

    // 상세 정보 영역에서 페이지 정보 검색
    const detailElements = this.querySelectorAll('.prod_detail_area, .book_detail, .prod_info_detail');
    for (const element of Array.from(detailElements)) {
      const text = this.cleanText(element.textContent || '');
      const pageMatch = text.match(/(\d+)\s*페이지/);
      if (pageMatch) {
        return pageMatch[1] + '페이지';
      }
    }

    return '';
  }

  extractCategories(): string[] {
    const categories: Set<string> = new Set();

    const selectors = [
      '.prod_category',
      '.book_category',
      '.breadcrumb a',
      '.category_path a',
      '.prod_path a',
      '.location_list a'
    ];

    for (const selector of selectors) {
      const elements = this.querySelectorAll(selector);
      for (const element of Array.from(elements)) {
        const text = this.cleanText(element.textContent || '');
        if (text && text !== '홈' && text !== '전체' && text.length > 1) {
          categories.add(text);
        }
      }
    }

    return Array.from(categories);
  }

  extractRating(): string {
    const selectors = [
      '.rating',
      '.prod_rating',
      '.book_rating',
      '.score',
      '.prod_grade .grade_num',
      '.rating_num'
    ];

    for (const selector of selectors) {
      const element = this.querySelector(selector);
      if (element) {
        const text = this.cleanText(element.textContent || '');
        const ratingMatch = text.match(/(\d+\.?\d*)\s*점?/);
        if (ratingMatch) {
          return ratingMatch[1] + '점';
        }
      }
    }

    return '';
  }

  extractCoverImage(): string {
    const imageSelectors = [
      '.prod_img img',
      '.book_img img',
      '.product_img img',
      '.cover_img img',
      'img[alt*="표지"]',
      'img[alt*="커버"]',
      'img[alt*="cover"]',
      'img[src*="cover"]',
      'img[src*="pdt"]',
      'meta[property="og:image"]',
      'meta[name="twitter:image"]'
    ];

    for (const selector of imageSelectors) {
      const elements = this.querySelectorAll(selector);

      for (const element of Array.from(elements)) {
        let imageUrl = '';

        if (element.tagName.toLowerCase() === 'img') {
          const imgElement = element as HTMLImageElement;
          imageUrl = imgElement.src || imgElement.getAttribute('data-src') || '';
        } else if (element.tagName.toLowerCase() === 'meta') {
          imageUrl = element.getAttribute('content') || '';
        }

        if (imageUrl && this.isValidCoverImage(imageUrl)) {
          return imageUrl;
        }
      }
    }

    return '';
  }

  extractTableOfContents(): string {
    DebugLogger.log('TOC_PARSER', '목차 추출 시작');

    // 목차 섹션 찾기를 위한 선택자들 (추후 확장 가능)
    // const tocSectionSelectors = [
    //   'h3:contains("목차"), h4:contains("목차"), h5:contains("목차")',
    //   '.toc_section', '.table_of_contents', '.contents_list',
    //   '.book_contents', '#contents', '.prod_detail_toc'
    // ];

    // "목차" 텍스트를 포함하는 헤딩 요소 찾기
    const headingElements = this.querySelectorAll('h1, h2, h3, h4, h5, h6');
    let tocSection: Element | null = null;

    for (const heading of Array.from(headingElements)) {
      if (heading.textContent?.includes('목차')) {
        DebugLogger.log('TOC_PARSER', `목차 헤딩 발견: ${heading.textContent}`);
        tocSection = heading;
        break;
      }
    }

    if (tocSection) {
      // 목차 헤딩 다음에 오는 콘텐츠 찾기
      let nextElement = tocSection.nextElementSibling;
      let tocContent = '';

      while (nextElement) {
        const tagName = nextElement.tagName.toLowerCase();
        const textContent = this.cleanText(nextElement.textContent || '');

        // 다음 섹션 헤딩이 나오면 중단
        if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
          const headingText = textContent.toLowerCase();
          if (!headingText.includes('목차') &&
              (headingText.includes('저자') || headingText.includes('출판') ||
               headingText.includes('책소개') || headingText.includes('리뷰'))) {
            break;
          }
        }

        // 목차 내용으로 보이는 텍스트 수집
        if (textContent.length > 0) {
          if (tagName === 'div' || tagName === 'p' || tagName === 'ul' || tagName === 'ol') {
            tocContent += textContent + '\n';
          }
        }

        nextElement = nextElement.nextElementSibling;
      }

      if (tocContent.trim()) {
        DebugLogger.log('TOC_PARSER', `목차 추출 성공: ${tocContent.length}자`);
        return this.formatTableOfContents(tocContent);
      }
    }

    // 헤딩 방식으로 찾지 못한 경우 클래스/ID 기반으로 시도
    const contentSelectors = [
      '.toc_content',
      '.contents_text',
      '.book_toc',
      '.table_contents',
      '.contents_area',
      '#toc_content'
    ];

    for (const selector of contentSelectors) {
      const element = this.querySelector(selector);
      if (element) {
        const content = this.cleanText(element.textContent || '');
        if (content.length > 50) { // 최소 길이 체크
          DebugLogger.log('TOC_PARSER', `선택자 "${selector}"로 목차 발견: ${content.length}자`);
          return this.formatTableOfContents(content);
        }
      }
    }

    // 전체 텍스트에서 목차 패턴 찾기 (fallback)
    const bodyText = this.doc.body?.textContent || '';
    const tocMatch = bodyText.match(/목차\s*\n([\s\S]{100,2000})(?:\n\n|저자|출판|ISBN)/);

    if (tocMatch) {
      DebugLogger.log('TOC_PARSER', '패턴 매칭으로 목차 발견');
      return this.formatTableOfContents(tocMatch[1]);
    }

    DebugLogger.warn('TOC_PARSER', '목차를 찾을 수 없음');
    return '';
  }

  private formatTableOfContents(rawContent: string): string {
    DebugLogger.log('TOC_PARSER', `목차 포맷팅 시작: 원본 ${rawContent.length}자`);

    // HTML 태그를 마크다운으로 변환
    let formatted = this.convertHtmlToMarkdown(rawContent);

    // 텍스트 정리
    formatted = formatted
      .replace(/\s+/g, ' ')  // 연속된 공백을 하나로
      .replace(/\n\s*\n/g, '\n')  // 연속된 빈 줄을 하나로
      .trim();

    // 챕터/섹션 번호가 있는 라인들을 찾아서 구조화
    const lines = formatted.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    const structuredToc: string[] = [];

    for (const line of lines) {
      // 챕터 번호 패턴 (1장, 제1장, Chapter 1, 1. 등)
      if (/^(제?\s*\d+[장절부편]|Chapter\s*\d+|Part\s*\d+|\d+\.|\d+\s*-)/i.test(line)) {
        structuredToc.push(line);
      }
      // 소제목 패턴 (1.1, 1-1, 가., (1) 등)
      else if (/^(\d+\.\d+|\d+-\d+|[가-힣]\.|[\(（]\d+[\)）])/i.test(line)) {
        structuredToc.push('  ' + line);
      }
      // 일반 목차 항목
      else if (line.length > 3 && line.length < 100) {
        structuredToc.push(line);
      }
    }

    const result = structuredToc.length > 0 ? structuredToc.join('\n') : formatted;

    DebugLogger.log('TOC_PARSER', `목차 포맷팅 완료: ${result.length}자, ${structuredToc.length}개 항목`);
    return result;
  }

  private convertHtmlToMarkdown(htmlContent: string): string {
    DebugLogger.log('TOC_PARSER', 'HTML → 마크다운 변환 시작');

    let markdown = htmlContent;

    // HTML 태그들을 마크다운으로 변환
    const conversions = [
      // <br>, <br/>, <br > 태그를 줄바꿈으로 변환
      { from: /<br\s*\/?>/gi, to: '\n' },

      // <p> 태그를 줄바꿈으로 변환
      { from: /<\/p>\s*<p[^>]*>/gi, to: '\n\n' },
      { from: /<p[^>]*>/gi, to: '' },
      { from: /<\/p>/gi, to: '\n' },

      // <div> 태그를 줄바꿈으로 변환
      { from: /<\/div>\s*<div[^>]*>/gi, to: '\n' },
      { from: /<div[^>]*>/gi, to: '' },
      { from: /<\/div>/gi, to: '\n' },

      // 리스트 태그들
      { from: /<\/li>\s*<li[^>]*>/gi, to: '\n' },
      { from: /<li[^>]*>/gi, to: '• ' },
      { from: /<\/li>/gi, to: '\n' },
      { from: /<\/?[uo]l[^>]*>/gi, to: '\n' },

      // 기타 태그들 제거
      { from: /<[^>]+>/g, to: '' },

      // HTML 엔티티 변환
      { from: /&nbsp;/gi, to: ' ' },
      { from: /&lt;/gi, to: '<' },
      { from: /&gt;/gi, to: '>' },
      { from: /&amp;/gi, to: '&' },
      { from: /&quot;/gi, to: '"' },
      { from: /&#39;/gi, to: "'" },

      // 연속된 줄바꿈 정리
      { from: /\n\s*\n\s*\n/g, to: '\n\n' },
      { from: /^\s*\n+/g, to: '' },  // 시작 부분 빈 줄 제거
      { from: /\n+\s*$/g, to: '' }   // 끝 부분 빈 줄 제거
    ];

    conversions.forEach(({ from, to }) => {
      const before = markdown.length;
      markdown = markdown.replace(from, to);
      const after = markdown.length;
      if (before !== after) {
        DebugLogger.log('TOC_PARSER', `변환 적용: ${from} → ${to} (${before} → ${after}자)`);
      }
    });

    DebugLogger.log('TOC_PARSER', `HTML → 마크다운 변환 완료: ${htmlContent.length} → ${markdown.length}자`);
    return markdown;
  }

  private isValidCoverImage(imageUrl: string): boolean {
    if (!imageUrl || imageUrl.length < 10) {
      return false;
    }

    const validPatterns = [
      /contents\.kyobobook\.co\.kr/,
      /image\.kyobobook\.co\.kr/,
      /pdt\/.*\.(jpg|jpeg|png|gif)/i,
      /cover.*\.(jpg|jpeg|png|gif)/i
    ];

    const invalidPatterns = [
      /no[_-]?image/i,
      /placeholder/i,
      /default/i,
      /blank/i,
      /1x1/,
      /\.gif$/i
    ];

    const hasValidPattern = validPatterns.some(pattern => pattern.test(imageUrl));
    const hasInvalidPattern = invalidPatterns.some(pattern => pattern.test(imageUrl));

    return hasValidPattern && !hasInvalidPattern;
  }
}