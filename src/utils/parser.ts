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
      // 교보문고 특정 선택자들
      '.auto_overflow_contents:has(span:contains("ISBN"))',
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
    const selectors = [
      '.prod_introduction',
      '.book_introduction',
      '.prod_detail_desc',
      '.book_description',
      '.prod_summary',
      // 교보문고 특정 선택자
      '.prod_detail_contents .auto_overflow_contents:first-child',
      '.introduce_detail'
    ];

    for (const selector of selectors) {
      const element = this.doc.querySelector(selector);
      if (element) {
        const text = this.cleanText(element.textContent || '');
        if (text.length > 50) { // 충분히 긴 텍스트만 반환
          return text;
        }
      }
    }

    return '';
  }

  extractTableOfContents(): string {
    const selectors = [
      '.prod_toc',
      '.book_toc',
      '.prod_detail_toc',
      '.table_of_contents',
      // 교보문고 특정 선택자
      '.prod_detail_contents .auto_overflow_contents:has(strong:contains("목차"))',
      '.toc_detail'
    ];

    for (const selector of selectors) {
      const element = this.doc.querySelector(selector);
      if (element) {
        const text = this.cleanText(element.textContent || '');
        if (text.length > 20) { // 목차는 보통 길어야 함
          return text;
        }
      }
    }

    // "목차" 텍스트 근처의 내용 검색
    const allElements = this.doc.querySelectorAll('*');
    for (const element of Array.from(allElements)) {
      if (element.textContent?.includes('목차') && element.textContent.length > 50) {
        const text = this.cleanText(element.textContent);
        return text;
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