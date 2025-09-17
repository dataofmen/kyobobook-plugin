// HTML 파싱 유틸리티

export class BookDetailParser {
  private doc: Document;

  constructor(html: string) {
    const parser = new DOMParser();
    this.doc = parser.parseFromString(html, 'text/html');
  }

  extractISBN(): string {
    const selectors = [
      '[data-testid="isbn"]',
      '.isbn',
      '.prod_detail_isbn',
      '.book_isbn',
      '.prod_detail_area .auto_overflow_contents'
    ];

    for (const selector of selectors) {
      const element = this.doc.querySelector(selector);
      if (element) {
        const text = this.cleanText(element.textContent || '');
        const isbnMatch = text.match(/ISBN[:\s]*([0-9\-X]+)/i);
        if (isbnMatch) {
          return isbnMatch[1];
        }
      }
    }

    // 교보문고 특정 방식: auto_overflow_contents 내에서 ISBN을 포함한 요소 찾기
    const autoOverflowElements = this.doc.querySelectorAll('.auto_overflow_contents');
    for (const element of Array.from(autoOverflowElements)) {
      const spans = element.querySelectorAll('span');
      for (const span of Array.from(spans)) {
        if (span.textContent?.includes('ISBN')) {
          const text = this.cleanText(element.textContent || '');
          const isbnMatch = text.match(/ISBN[:\s]*([0-9\-X]+)/i);
          if (isbnMatch) {
            return isbnMatch[1];
          }
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
      const element = this.doc.querySelector(selector);
      if (element) {
        const text = this.cleanText(element.textContent || '');
        const pageMatch = text.match(/(\d+)\s*페이지/);
        if (pageMatch) {
          return pageMatch[1] + '페이지';
        }
      }
    }

    // 상세 정보 영역에서 페이지 정보 검색
    const detailElements = this.doc.querySelectorAll('.prod_detail_area, .book_detail, .prod_info_detail');
    for (const element of Array.from(detailElements)) {
      const text = this.cleanText(element.textContent || '');
      const pageMatch = text.match(/(\d+)\s*페이지/);
      if (pageMatch) {
        return pageMatch[1] + '페이지';
      }
    }

    return '';
  }

  extractDescription(): string {
    // 책 소개 파싱 포기 - 항상 빈 문자열 반환
    console.log('책 소개 파싱 생략됨');
    return '';
  }

  extractTableOfContents(): string {
    // html-parser.ts의 BookDetailParser와 동일한 로직 사용
    console.log('=== 목차 추출 시작 (향상된 로직) ===');

    // "목차" 텍스트를 포함하는 헤딩 요소 찾기
    const headingElements = this.doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
    let tocSection: Element | null = null;

    for (const heading of Array.from(headingElements)) {
      if (heading.textContent?.includes('목차')) {
        console.log(`목차 헤딩 발견: ${heading.textContent}`);
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
        console.log(`목차 추출 성공: ${tocContent.length}자`);
        return this.convertHtmlToMarkdown(tocContent);
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
      const element = this.doc.querySelector(selector);
      if (element) {
        const content = this.cleanText(element.textContent || '');
        if (content.length > 50) { // 최소 길이 체크
          console.log(`선택자 "${selector}"로 목차 발견: ${content.length}자`);
          return this.convertHtmlToMarkdown(element.innerHTML);
        }
      }
    }

    // 전체 텍스트에서 목차 패턴 찾기 (fallback)
    const bodyText = this.doc.body?.textContent || '';
    const tocMatch = bodyText.match(/목차\s*\n([\s\S]{100,2000})(?:\n\n|저자|출판|ISBN)/);

    if (tocMatch) {
      console.log('패턴 매칭으로 목차 발견');
      return this.convertHtmlToMarkdown(tocMatch[1]);
    }

    console.log('목차를 찾을 수 없음');
    return '';
  }

  private convertHtmlToMarkdown(htmlContent: string): string {
    console.log('HTML → 마크다운 변환 시작');

    let markdown = htmlContent;

    // HTML 태그들을 마크다운으로 변환
    const conversions = [
      // <br>, <br/>, <br > 태그를 줄바꿈으로 변환 (핵심 개선사항)
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
        console.log(`변환 적용: ${from} → ${to} (${before} → ${after}자)`);
      }
    });

    console.log(`HTML → 마크다운 변환 완료: ${htmlContent.length} → ${markdown.length}자`);
    return markdown;
  }

  extractCategories(): string[] {
    const categories: Set<string> = new Set();

    const selectors = [
      '.prod_category',
      '.book_category',
      '.breadcrumb a',
      '.category_path a',
      // 교보문고 특정 선택자
      '.prod_path a',
      '.location_list a'
    ];

    for (const selector of selectors) {
      const elements = this.doc.querySelectorAll(selector);
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
      // 교보문고 특정 선택자
      '.prod_grade .grade_num',
      '.rating_num'
    ];

    for (const selector of selectors) {
      const element = this.doc.querySelector(selector);
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
    console.log('=== 표지 이미지 추출 시작 ===');

    // 1. 다양한 이미지 선택자로 표지 이미지 찾기
    const imageSelectors = [
      // 교보문고 표준 구조
      '.prod_img img',
      '.book_img img',
      '.product_img img',
      '.cover_img img',

      // 일반적인 이미지 선택자
      'img[alt*="표지"]',
      'img[alt*="커버"]',
      'img[alt*="cover"]',
      'img[src*="cover"]',
      'img[src*="pdt"]',  // 교보문고 이미지 경로 패턴

      // 메타 태그에서 이미지 정보
      'meta[property="og:image"]',
      'meta[name="twitter:image"]'
    ];

    for (const selector of imageSelectors) {
      const elements = this.doc.querySelectorAll(selector);
      console.log(`이미지 선택자 "${selector}": ${elements.length}개 요소 발견`);

      for (const element of Array.from(elements)) {
        let imageUrl = '';

        if (element.tagName.toLowerCase() === 'img') {
          const imgElement = element as HTMLImageElement;
          imageUrl = imgElement.src || imgElement.getAttribute('data-src') || '';
        } else if (element.tagName.toLowerCase() === 'meta') {
          imageUrl = element.getAttribute('content') || '';
        }

        if (imageUrl && this.isValidCoverImage(imageUrl)) {
          console.log('표지 이미지 추출 성공:', imageUrl);
          return imageUrl;
        }
      }
    }

    console.log('표지 이미지 추출 실패');
    return '';
  }

  // 유효한 표지 이미지인지 확인
  private isValidCoverImage(imageUrl: string): boolean {
    if (!imageUrl || imageUrl.length < 10) {
      return false;
    }

    // 교보문고 이미지 패턴 확인
    const validPatterns = [
      /contents\.kyobobook\.co\.kr/,
      /image\.kyobobook\.co\.kr/,
      /pdt\/.*\.(jpg|jpeg|png|gif)/i,
      /cover.*\.(jpg|jpeg|png|gif)/i
    ];

    // 무효한 패턴 제외
    const invalidPatterns = [
      /no[_-]?image/i,
      /placeholder/i,
      /default/i,
      /blank/i,
      /1x1/,
      /\.gif$/i  // 작은 gif 파일 제외
    ];

    const hasValidPattern = validPatterns.some(pattern => pattern.test(imageUrl));
    const hasInvalidPattern = invalidPatterns.some(pattern => pattern.test(imageUrl));

    return hasValidPattern && !hasInvalidPattern;
  }

  // 제목 다음의 컨텐츠 요소 찾기 (목차용)
  private findContentAfterTitle(titleElement: Element): Element | null {
    // 다양한 방법으로 컨텐츠 찾기
    const searchTargets = [
      titleElement.nextElementSibling,
      titleElement.parentElement?.nextElementSibling,
      titleElement.parentElement?.parentElement?.nextElementSibling
    ];

    for (const target of searchTargets) {
      if (!target) continue;

      // .info_text나 적절한 컨텐츠 클래스 찾기
      const contentSelectors = [
        '.info_text',
        '.content_text',
        '.description_text',
        '[class*="text"]',
        '[class*="content"]'
      ];

      for (const selector of contentSelectors) {
        const contentEl = target.querySelector(selector);
        if (contentEl && contentEl.textContent && contentEl.textContent.trim().length > 50) {
          return contentEl;
        }
      }

      // 직접 텍스트가 충분한 경우
      if (target.textContent && target.textContent.trim().length > 100) {
        return target;
      }
    }

    return null;
  }

  extractPublisherInfo(): { publisher: string; publishDate: string } {
    const selectors = [
      '.prod_publish',
      '.book_publish',
      '.publisher_info',
      '.pub_info'
    ];

    for (const selector of selectors) {
      const element = this.doc.querySelector(selector);
      if (element) {
        const text = this.cleanText(element.textContent || '');

        // 출판사와 출판일 분리
        const parts = text.split('|').map(part => part.trim());
        if (parts.length >= 2) {
          return {
            publisher: parts[0],
            publishDate: parts[1]
          };
        }
      }
    }

    return { publisher: '', publishDate: '' };
  }

  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim();
  }

}