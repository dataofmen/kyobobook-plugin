// 도서 상세 정보 파싱 클래스

import { BaseParser } from './BaseParser';
import { Book, UpdateBookInput, BookFactory } from '../../domain/models/Book';
import { ParseError } from '../../domain/models/Errors';
import { SELECTORS, PATTERNS, LIMITS } from '../../shared/constants/selectors';
import { TextUtils } from '../../shared/utils/TextUtils';
import { UrlUtils } from '../../shared/utils/UrlUtils';

/**
 * 도서 상세 페이지 파서
 */
export class BookDetailParser extends BaseParser {
  private parseResults = {
    isbn: false,
    pages: false,
    description: false,
    tableOfContents: false,
    categories: false,
    rating: false,
    coverImage: false,
    errors: [] as string[]
  };

  /**
   * 기존 Book 객체에 상세 정보 추가
   */
  enrichBook(book: Book): Book {
    try {
      const updates = this.extractDetailedInfo();

      // 기존 정보와 새로운 정보 병합
      // 표지/목차 폴백 처리: ISBN(바코드) 우선, 없으면 ID
      if (!updates.coverImageUrl) {
        const code = updates.isbn || book.isbn || book.id;
        updates.coverImageUrl = UrlUtils.optimizeImageUrl(
          UrlUtils.buildCoverImageUrl(code),
          { width: 300, format: 'jpg' }
        );
      }

      const enrichedBook = BookFactory.update(book, updates);

      return enrichedBook;
    } catch (error) {
      throw new ParseError(
        '도서 상세 정보 파싱 중 오류가 발생했습니다',
        'BookDetailParser',
        { bookId: book.id, originalError: error instanceof Error ? error.message : String(error) },
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * 상세 정보 추출
   */
  private extractDetailedInfo(): UpdateBookInput {
    const updates: UpdateBookInput = {};

    // 0) JSON-LD에서 빠르게 추출(가능할 때)
    try {
      const ld = this.extractFromJsonLd();
      if (ld) {
        if (ld.isbn) updates.isbn = TextUtils.normalizeISBN(ld.isbn) || ld.isbn;
        if (ld.description && !updates.description) updates.description = ld.description;
        if (ld.image && !updates.coverImageUrl) updates.coverImageUrl = ld.image;
        if (ld.publisher && !updates.publisher) updates.publisher = ld.publisher;
        if (ld.authors && !updates.authors) updates.authors = ld.authors;
        if (ld.name && !updates.title) updates.title = ld.name;
      }
    } catch (e) {
      this.parseResults.errors.push(`JSON-LD: ${e}`);
    }

    // ISBN 추출
    try {
      const isbn = this.extractISBN();
      if (isbn) {
        updates.isbn = isbn;
        this.parseResults.isbn = true;
      }
    } catch (error) {
      this.parseResults.errors.push(`ISBN: ${error}`);
    }

    // 페이지 수 추출 비활성화: 부정확성/불필요성으로 인해 수집하지 않음
    // (요청에 따라 pages는 아예 추출하지 않습니다.)

    // 설명 추출
    try {
      const description = this.extractDescription();
      if (description) {
        updates.description = description;
        this.parseResults.description = true;
      }
    } catch (error) {
      this.parseResults.errors.push(`Description: ${error}`);
    }

    // 출판사 추출
    try {
      const publisher = this.extractPublisher();
      if (publisher) {
        updates.publisher = publisher;
      }
    } catch (error) {
      this.parseResults.errors.push(`Publisher: ${error}`);
    }

    // 출간일 추출
    try {
      const publishDate = this.extractPublishDate();
      if (publishDate) {
        updates.publishDate = publishDate;
      }
    } catch (error) {
      this.parseResults.errors.push(`PublishDate: ${error}`);
    }

    // 목차 추출
    try {
      const tableOfContents = this.extractTableOfContents();
      if (tableOfContents) {
        updates.tableOfContents = tableOfContents;
        this.parseResults.tableOfContents = true;
      }
    } catch (error) {
      this.parseResults.errors.push(`TOC: ${error}`);
    }

    // 카테고리 추출
    try {
      const categories = this.extractCategories();
      if (categories.length > 0) {
        updates.categories = categories;
        this.parseResults.categories = true;
      }
    } catch (error) {
      this.parseResults.errors.push(`Categories: ${error}`);
    }

    // 평점 추출
    try {
      const rating = this.extractRating();
      if (rating !== undefined) {
        updates.rating = rating;
        this.parseResults.rating = true;
      }
    } catch (error) {
      this.parseResults.errors.push(`Rating: ${error}`);
    }

    // 표지 이미지 추출 (더 고해상도)
    try {
      const coverImageUrl = this.extractCoverImage();
      if (coverImageUrl) {
        updates.coverImageUrl = coverImageUrl;
        this.parseResults.coverImage = true;
      }
    } catch (error) {
      this.parseResults.errors.push(`Cover: ${error}`);
    }

    return updates;
  }

  /**
   * ISBN 추출
   */
  private extractISBN(): string | undefined {
    // 1차: 선택자 기반 추출
    for (const selector of SELECTORS.DETAIL.ISBN) {
      const element = this.querySelector(selector);
      if (element) {
        const text = this.extractText(element);
        const isbn = this.extractByPattern(text, PATTERNS.ISBN);
        if (isbn) {
          return TextUtils.normalizeISBN(isbn);
        }
      }
    }

    // 2차: 전체 텍스트에서 패턴 매칭
    const isbn = this.extractFromFullText([PATTERNS.ISBN]);
    return isbn ? TextUtils.normalizeISBN(isbn) : undefined;
  }

  /**
   * 페이지 수 추출
   */
  private extractPages(): number | undefined {
    // 1차: 선택자 기반 추출
    for (const selector of SELECTORS.DETAIL.PAGES) {
      const element = this.querySelector(selector);
      if (element) {
        const text = this.extractText(element);
        const pages = TextUtils.extractPages(text);
        if (pages) return pages;
      }
    }

    // 2차: 상세 정보 영역에서 검색(라벨/본문)
    const detailElements = this.querySelectorAll('.prod_detail_area, .book_detail, .prod_info_detail, .product_detail_area, #infoset_detail, .prod_info_text.publish_date');
    for (const element of Array.from(detailElements)) {
      const text = this.extractText(element);
      const pages = TextUtils.extractPages(text);
      if (pages) return pages;
    }

    // 3차: 라벨 근접 탐색 (페이지/쪽/쪽수)
    const labelCandidates = this.querySelectorAll('li, tr, div, span, td, th, p');
    for (const el of Array.from(labelCandidates)) {
      const t = this.extractText(el);
      if (!t) continue;
      if (/페이지|쪽수|쪽/.test(t)) {
        const pages = TextUtils.extractPages(t);
        if (pages) return pages;
      }
    }

    // 4차: 본문 전체에서 라벨 기반으로 추출
    const full = this.document.body?.textContent || '';
    const pages = TextUtils.extractPages(full);
    if (pages) return pages;

    return undefined;
  }

  /**
   * 책 설명 추출
   */
  private extractDescription(): string | undefined {
    const descriptionSelectors = [
      '.prod_detail_desc',
      '.book_description',
      '.prod_intro',
      '.book_intro',
      '.description',
      '.intro',
      '#contents .auto_overflow_contents',
      '#infoset_introduce .box_detail_content',
      '.box_detail_article .txt_wrap',
      '.prod_detail_area [data-kbb-action="intro"]'
    ];

    for (const selector of descriptionSelectors) {
      const element = this.querySelector(selector);
      if (element) {
        // 원본 HTML을 마크다운으로 변환해 문단/줄바꿈 보존
        const html = (element as HTMLElement).innerHTML || this.extractText(element);
        const md = this.convertHtmlToMarkdown(html)
          .replace(/\n\s*\n\s*\n/g, '\n\n')
          .trim();

        const quality = this.assessTextQuality(md);

        if (quality.isValid && md.length > 50 && md.length <= LIMITS.MAX_DESCRIPTION_LENGTH) {
          return md;
        }
      }
    }

    return undefined;
  }

  /**
   * 목차 추출
   */
  private extractTableOfContents(): string | undefined {
    // 1차: "목차" 헤딩 찾기
    const headings = this.querySelectorAll(SELECTORS.DETAIL.TOC.HEADINGS);
    let tocSection: Element | null = null;

    for (const heading of Array.from(headings)) {
      if (this.extractText(heading).includes('목차')) {
        tocSection = heading;
        break;
      }
    }

    if (tocSection) {
      // h2.title_heading 다음 형제(동일 부모의 다음 형제)에 실제 컨텐츠가 있는 패턴 대응
      // 1) h2 자신의 다음 형제
      const next = tocSection.nextElementSibling as HTMLElement | null;
      if (next) {
        // 1-a) 특화: li.book_contents_item 리스트 우선 수집
        const listItems = next.querySelectorAll('ul.book_contents_list li.book_contents_item, li.book_contents_item, li[class*="contents_item"]');
        if (listItems && listItems.length > 0) {
          const lines: string[] = [];
          Array.from(listItems).forEach(li => {
            const html = (li as HTMLElement).innerHTML || '';
            const md = this.convertHtmlToMarkdown(html);
            md.split('\n').forEach(line => {
              const t = line.trim();
              if (t && t.length > 1 && t.length < 300) lines.push(t);
            });
          });
          const uniq = Array.from(new Set(lines));
          if (uniq.length > 0) return this.formatTableOfContents(uniq.join('\n'));
        }

        const box = next.querySelector('.auto_overflow_wrap, .box_detail_content, .auto_overflow_contents, .txt_wrap') as HTMLElement | null;
        const target = box || next;
        const html = (target && (target.querySelector('.auto_overflow_contents') as HTMLElement | null)?.innerHTML) || target?.innerHTML;
        if (html) {
          const md = this.convertHtmlToMarkdown(html).trim();
          if (md.length > 10 && md.length <= LIMITS.MAX_TOC_LENGTH) return this.formatTableOfContents(md);
        }
      }

      // 2) 부모(title_wrap)의 다음 형제에 컨텐츠(.auto_overflow_wrap)가 존재하는 패턴 대응
      const parent = tocSection.parentElement as HTMLElement | null;
      const parentNext = parent?.nextElementSibling as HTMLElement | null;
      if (parentNext) {
        // 특화: #infoset_toc 내부 ul.book_contents_list li.book_contents_item
        const itemsRoot = parentNext.querySelector('#infoset_toc') as HTMLElement | null;
        const items3 = (itemsRoot || parentNext).querySelectorAll('ul.book_contents_list li.book_contents_item, li.book_contents_item, li[class*="contents_item"]');
        if (items3 && items3.length > 0) {
          const lines3: string[] = [];
          Array.from(items3).forEach(li => {
            const html = (li as HTMLElement).innerHTML || '';
            const md = this.convertHtmlToMarkdown(html);
            md.split('\n').forEach(line => {
              const t = line.trim();
              if (t && t.length > 1 && t.length < 300) lines3.push(t);
            });
          });
          const uniq3 = Array.from(new Set(lines3));
          if (uniq3.length > 0) return this.formatTableOfContents(uniq3.join('\n'));
        }
        // 2-a) 특화: 부모의 다음 형제에서도 li.book_contents_item 우선 수집
        const items2 = parentNext.querySelectorAll('ul.book_contents_list li.book_contents_item, li.book_contents_item, li[class*="contents_item"]');
        if (items2 && items2.length > 0) {
          const lines2: string[] = [];
          Array.from(items2).forEach(li => {
            const html = (li as HTMLElement).innerHTML || '';
            const md = this.convertHtmlToMarkdown(html);
            md.split('\n').forEach(line => {
              const t = line.trim();
              if (t && t.length > 1 && t.length < 300) lines2.push(t);
            });
          });
          const uniq2 = Array.from(new Set(lines2));
          if (uniq2.length > 0) return this.formatTableOfContents(uniq2.join('\n'));
        }

        const wrap = parentNext.matches('.auto_overflow_wrap') ? parentNext : (parentNext.querySelector('.auto_overflow_wrap') as HTMLElement | null);
        const contentHost = (wrap && (wrap.querySelector('.auto_overflow_contents') as HTMLElement | null)) || parentNext.querySelector('.box_detail_content, .auto_overflow_contents, .txt_wrap') as HTMLElement | null;
        const html2 = contentHost?.innerHTML;
        if (html2) {
          const md2 = this.convertHtmlToMarkdown(html2).trim();
          if (md2.length > 10) return this.formatTableOfContents(md2);
        }
      }

      // 3) 기존 형제/부모 컨테이너 기반 수집
      const tocContent = this.extractTocFromSection(tocSection);
      if (tocContent) return tocContent;
    }

    // 2차: 선택자 기반 추출 (id 컨테이너 우선)
    const tocRoot = this.querySelector('#infoset_toc');
    if (tocRoot) {
      const el = tocRoot.querySelector('.box_detail_content, .auto_overflow_contents, .txt_wrap') as HTMLElement | null;
      if (el && el.innerHTML) {
        const content = this.convertHtmlToMarkdown(el.innerHTML).trim();
        if (content.length > 10 && content.length <= LIMITS.MAX_TOC_LENGTH) {
          return this.formatTableOfContents(content);
        }
      }
    }

    for (const selector of [...SELECTORS.DETAIL.TOC.CONTENT, '#infoset_toc .box_detail_content', '.prod_detail_area [data-kbb-action="toc"]']) {
      const element = this.querySelector(selector);
      if (element) {
        const html = (element as HTMLElement).innerHTML || this.extractText(element);
        const content = this.convertHtmlToMarkdown(html).trim();
        if (content.length > 10 && content.length <= LIMITS.MAX_TOC_LENGTH) {
          return this.formatTableOfContents(content);
        }
      }
    }

    // 3차: 패턴 매칭
    const fullText = this.document.body?.textContent || '';
    const tocMatch = fullText.match(/목차\s*\n([\s\S]{50,5000})(?:\n\n|저자|출판|ISBN|리뷰|소개)/);

    if (tocMatch) {
      return this.formatTableOfContents(tocMatch[1]);
    }

    // 4차: 일반화된 선택자에서 수집 (과한 매칭 방지로 제한된 클래스만)
    const genericSelectors = [
      '.toc_list',
      '.contents_list',
      '.book_index',
      '[class*="book_index"]',
      '[id*="toc"]',
      '.auto_overflow_wrap'
    ];

    for (const sel of genericSelectors) {
      const el = this.querySelector(sel) as HTMLElement | null;
      if (el) {
        const collected = this.collectTocItems(el);
        if (collected) return collected;
      }
    }

    return undefined;
  }

  /**
   * 목차 섹션에서 내용 추출
   */
  private extractTocFromSection(tocSection: Element): string | undefined {
    // 1) 헤딩 이후 형제에서 수집
    let tocContent = '';
    const siblings = this.getNextSiblings(tocSection, 50);
    for (const sibling of siblings) {
      const tagName = sibling.tagName.toLowerCase();
      const text = this.extractText(sibling);
      if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
        const headingText = text.toLowerCase();
        if (!headingText.includes('목차') && (headingText.includes('저자') || headingText.includes('출판') || headingText.includes('책소개') || headingText.includes('리뷰'))) {
          break;
        }
      }
      if (['div', 'p', 'ul', 'ol', 'section'].includes(tagName)) {
        const html = (sibling as HTMLElement).innerHTML || text;
        tocContent += this.convertHtmlToMarkdown(html) + '\n';
      }
    }

    if (tocContent.trim()) return this.formatTableOfContents(tocContent);

    // 2) 헤딩 부모 컨테이너에서 리스트 수집
    const container = this.findAncestor(tocSection, el => /toc|contents|목차/i.test(el.className || ''), 5) || tocSection.parentElement;
    if (container) {
      const lists = container.querySelectorAll('ul, ol');
      const parts: string[] = [];
      for (const list of Array.from(lists)) {
        const html = (list as HTMLElement).innerHTML;
        parts.push(this.convertHtmlToMarkdown(html));
      }
      const combined = parts.join('\n');
      if (combined.trim()) return this.formatTableOfContents(combined);
    }

    return undefined;
  }

  /**
   * 주어진 요소에서 목차 항목을 수집하고 마크다운으로 반환
   */
  private collectTocItems(root: HTMLElement): string | undefined {
    // 우선 특화 리스트 항목 수집
    const specialItems = root.querySelectorAll('ul.book_contents_list li.book_contents_item, li.book_contents_item, li[class*="contents_item"]');
    if (specialItems && specialItems.length > 0) {
      const lines: string[] = [];
      Array.from(specialItems).forEach(li => {
        const html = (li as HTMLElement).innerHTML || '';
        const md = this.convertHtmlToMarkdown(html);
        md.split('\n').forEach(line => {
          const t = line.trim();
          if (t && t.length > 1 && t.length < 300) lines.push(t);
        });
      });
      const uniq = Array.from(new Set(lines));
      if (uniq.length > 0) return this.formatTableOfContents(uniq.join('\n'));
    }

    // 일반 리스트 기반 수집
    const list = root.querySelector('ul, ol');
    if (list) {
      const html = (list as HTMLElement).innerHTML;
      const md = this.convertHtmlToMarkdown(html).trim();
      if (md.length > 10) return this.formatTableOfContents(md);
    }

    // 리스트가 없으면 p/div 항목 수집
    const items = root.querySelectorAll('li, p, div');
    const lines: string[] = [];
    for (const it of Array.from(items)) {
      const t = this.extractText(it);
      if (t && t.length > 2 && t.length < 200) lines.push(t);
      if (lines.length >= 200) break;
    }
    const uniq = Array.from(new Set(lines)).filter(Boolean);
    if (uniq.length > 1) {
      return this.formatTableOfContents(uniq.join('\n'));
    }
    return undefined;
  }

  /**
   * 상세 페이지에서 출판사 추출
   */
  private extractPublisher(): string | undefined {
    // 1) 명시적 선택자들 시도
    const selectors = [
      '.prod_publisher a',
      '.book_publisher a',
      '.publisher a',
      '.prod_info_text.publish_date a',
      '#infoset_publish .box_detail_content a',
      'a.btn_publish_link',
    ];
    for (const sel of selectors) {
      const el = this.querySelector(sel);
      const text = this.extractText(el);
      if (text && text.length > 1 && text.length < 60) {
        return TextUtils.cleanPublisher(text);
      }
    }
    // 2) 라벨 기반 탐색: "출판사" 인근 텍스트에서 추출
    const allText = this.document.body?.textContent || '';
    const m = allText.match(/출판사\s*[:\-]?\s*([\p{L}0-9·&()\s]{2,60})/u);
    if (m && m[1]) {
      const p = TextUtils.cleanPublisher(m[1]);
      if (p) return p;
    }
    return undefined;
  }

  /**
   * 출간일 추출 (예: 2025년 06월 02일 → 2025-06-02)
   */
  private extractPublishDate(): string | undefined {
    const el = this.querySelector('.prod_info_text.publish_date');
    if (el) {
      const text = this.extractText(el);
      const normalized = TextUtils.normalizeDateString(text);
      if (normalized) return normalized;
    }
    // 폴백: 본문 전체에서 날짜 패턴
    const full = this.document.body?.textContent || '';
    return TextUtils.normalizeDateString(full);
  }

  /**
   * 목차 포맷팅
   */
  private formatTableOfContents(rawContent: string): string {
    // HTML을 마크다운으로 변환
    let formatted = this.convertHtmlToMarkdown(rawContent);

    // 텍스트 정리
    // 개행을 보존해야 목차 라인이 유지됨. 공백 정규화는 라인 내에서만 수행.
    formatted = formatted
      .replace(/\r\n?/g, '\n')           // 윈도우 개행 → \n
      // <br> 변환 결과 등의 과도한 공백/탭을 라인 안에서만 정리
      .split('\n')
      .map(line => line.replace(/[\t ]{2,}/g, ' ').trim())
      .join('\n')
      // 3개 이상 연속 개행을 2개로 축소
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    // 구조화
    const lines = formatted.split(/\n+/)
      .map(line => line.trim())
      .filter(line => line.length > 0);

    const structuredToc: string[] = [];

    for (const line of lines) {
      // 챕터 번호 패턴
      if (/^(제?\s*\d+[장절부편]|Chapter\s*\d+|Part\s*\d+|\d+\.|\d+\s*-)/i.test(line)) {
        structuredToc.push(line);
      }
      // 소제목 패턴
      else if (/^(\d+\.\d+|\d+-\d+|[가-힣]\.|[\(（]\d+[\)）])/i.test(line)) {
        structuredToc.push('  ' + line);
      }
      // 일반 목차 항목
      else if (line.length > 3 && line.length < 100) {
        structuredToc.push(line);
      }
    }

    return structuredToc.length > 0 ? structuredToc.join('\n') : formatted;
  }

  /**
   * HTML을 마크다운으로 변환
   */
  private convertHtmlToMarkdown(htmlContent: string): string {
    let markdown = htmlContent;

    const conversions = [
      { from: /<br\s*\/?>/gi, to: '\n' },
      { from: /<\/p>\s*<p[^>]*>/gi, to: '\n\n' },
      { from: /<p[^>]*>/gi, to: '' },
      { from: /<\/p>/gi, to: '\n' },
      { from: /<\/div>\s*<div[^>]*>/gi, to: '\n' },
      { from: /<div[^>]*>/gi, to: '' },
      { from: /<\/div>/gi, to: '\n' },
      { from: /<\/li>\s*<li[^>]*>/gi, to: '\n' },
      { from: /<li[^>]*>/gi, to: '• ' },
      { from: /<\/li>/gi, to: '\n' },
      { from: /<\/?[uo]l[^>]*>/gi, to: '\n' },
      { from: /<[^>]+>/g, to: '' },
      { from: /&nbsp;/gi, to: ' ' },
      { from: /&lt;/gi, to: '<' },
      { from: /&gt;/gi, to: '>' },
      { from: /&amp;/gi, to: '&' },
      { from: /&quot;/gi, to: '"' },
      { from: /&#39;/gi, to: "'" },
      { from: /\n\s*\n\s*\n/g, to: '\n\n' },
      { from: /^\s*\n+/g, to: '' },
      { from: /\n+\s*$/g, to: '' }
    ];

    conversions.forEach(({ from, to }) => {
      markdown = markdown.replace(from, to);
    });

    return markdown;
  }

  /**
   * 카테고리 추출
   */
  private extractCategories(): string[] {
    const categories = new Set<string>();

    for (const selector of SELECTORS.DETAIL.CATEGORIES) {
      const elements = this.querySelectorAll(selector);
      for (const element of Array.from(elements)) {
        const text = this.extractText(element);
        if (text && text.length > 1 && text.length < 50) {
          const cleaned = TextUtils.clean(text);
          if (!['홈', '전체', '도서'].includes(cleaned)) {
            categories.add(cleaned);
          }
        }
      }
    }

    return Array.from(categories).slice(0, LIMITS.MAX_CATEGORIES);
  }

  /**
   * 평점 추출
   */
  private extractRating(): number | undefined {
    for (const selector of SELECTORS.DETAIL.RATING) {
      const element = this.querySelector(selector);
      if (element) {
        const text = this.extractText(element);
        const rating = TextUtils.extractRating(text);
        if (rating !== undefined) {
          return rating;
        }
      }
    }

    return undefined;
  }

  /**
   * 표지 이미지 추출 (고해상도)
   */
  private extractCoverImage(): string | undefined {
    // 0차: 상세 표지 전용 컨테이너 우선
    const portrait = this.querySelector('.portrait_img_box img') as HTMLImageElement | null;
    if (portrait) {
      const psrc = this.extractImageUrl(portrait);
      if (psrc && UrlUtils.isValidImageUrl(psrc)) {
        return UrlUtils.optimizeImageUrl(psrc, { width: 300, format: 'jpg' });
      }
    }

    // 1차: 메타 태그에서 추출
    const ogImage = this.extractFromMeta('og:image');
    if (ogImage && UrlUtils.isValidImageUrl(ogImage)) {
      return ogImage;
    }

    const twitterImage = this.extractFromMeta('twitter:image');
    if (twitterImage && UrlUtils.isValidImageUrl(twitterImage)) {
      return twitterImage;
    }

    // 2차: 이미지 요소에서 추출
    const images = this.findAllBySelectors(SELECTORS.COVER_IMAGE);

    for (const img of images) {
      const imageUrl = this.extractImageUrl(img);
      if (imageUrl && UrlUtils.isValidImageUrl(imageUrl)) {
        // 고해상도 버전으로 최적화
        return UrlUtils.optimizeImageUrl(imageUrl, {
          width: 300,
          format: 'jpg'
        });
      }
    }

    return undefined;
  }

  /**
   * JSON-LD(Book/Product)에서 속성 추출
   */
  private extractFromJsonLd(): { name?: string; isbn?: string; image?: string; description?: string; publisher?: string; authors?: string[] } | null {
    const scripts = this.querySelectorAll('script[type="application/ld+json"]');
    const results: any[] = [];
    for (const s of Array.from(scripts)) {
      try {
        const json = (s.textContent || '').trim();
        if (!json) continue;
        const data = JSON.parse(json);
        if (Array.isArray(data)) results.push(...data);
        else if (data['@graph']) results.push(...data['@graph']);
        else results.push(data);
      } catch {}
    }
    const out: any = {};
    for (const node of results) {
      const type = (node['@type'] || '').toString();
      if (/Book|Product/i.test(type)) {
        out.name = out.name || node.name;
        out.isbn = out.isbn || node.isbn || node['gtin13'] || node['sku'];
        out.image = out.image || node.image || (Array.isArray(node.image) ? node.image[0] : undefined);
        out.description = out.description || node.description;
        // publisher/brand may be object
        const pub = node.publisher || node.brand;
        if (pub) out.publisher = out.publisher || (typeof pub === 'string' ? pub : pub.name);
        const author = node.author;
        if (author) {
          if (Array.isArray(author)) out.authors = out.authors || author.map((a: any) => typeof a === 'string' ? a : a.name).filter(Boolean);
          else out.authors = out.authors || [typeof author === 'string' ? author : author.name].filter(Boolean);
        }
      }
    }
    return (out.name || out.isbn || out.image || out.description || out.publisher) ? out : null;
  }

  /**
   * 파싱 결과 반환
   */
  getParseResults() {
    const successfulFields = Object.values(this.parseResults)
      .filter(value => typeof value === 'boolean' && value).length;

    const totalFields = Object.keys(this.parseResults)
      .filter(key => key !== 'errors').length;

    return {
      ...this.parseResults,
      successRate: (successfulFields / totalFields) * 100,
      totalFields,
      successfulFields
    };
  }

  /**
   * 페이지 구조 분석 (디버깅용)
   */
  analyzePageStructure(): {
    pageTitle: string;
    hasDetailContent: boolean;
    detailSections: string[];
    imageCount: number;
    linkCount: number;
    stats: ReturnType<BaseParser['getParsingStats']>;
  } {
    const pageTitle = this.extractText(this.querySelector('title')) || '';

    // 상세 콘텐츠 영역 확인
    const detailSelectors = [
      '.prod_detail_area',
      '.book_detail',
      '.product_detail',
      '#contents'
    ];

    const hasDetailContent = detailSelectors.some(selector =>
      this.querySelector(selector) !== null
    );

    // 섹션 분석
    const detailSections: string[] = [];
    const headings = this.querySelectorAll('h1, h2, h3, h4, h5, h6');

    for (const heading of Array.from(headings)) {
      const text = this.extractText(heading);
      if (text && text.length > 0) {
        detailSections.push(text);
      }
    }

    const imageCount = this.querySelectorAll('img').length;
    const linkCount = this.querySelectorAll('a[href]').length;

    return {
      pageTitle,
      hasDetailContent,
      detailSections: detailSections.slice(0, 10), // 최대 10개
      imageCount,
      linkCount,
      stats: this.getParsingStats()
    };
  }

  /**
   * 동적 로딩을 위한 TOC 엔드포인트 후보 발견 (data-*, href/src 등)
   */
  getDiscoveredTocUrls(): string[] {
    // toc/book_contents 키워드가 path/query에 포함된 URL 후보 수집 (hostname의 'contents'는 제외)
    const attrs = ['data-url','data-src','data-ajax-url','data-href','href','src'];
    const urls = this.collectAttributeValues(attrs)
      .map(u => u.trim())
      .filter(u => /^(https?:)?\//.test(u) || u.startsWith('/'))
      .map(u => UrlUtils.toAbsoluteUrl(u));

    const isKyobo = (u: string) => {
      try { return /kyobobook\.co\.kr$/i.test(new URL(u).hostname); } catch { return false; }
    };
    const isTelemetry = (u: string) => /(google|gstatic|googletag|doubleclick|naver|kakao|clarity|scorecardresearch|facebook|criteo|bing)\./i.test(u);
    const isMedia = (u: string) => /\.(png|jpe?g|gif|webp|svg|ico|css|js|woff2?|ttf)(\?|$)/i.test(u);

    const hasTocKeywordInPath = (u: string) => {
      try {
        const url = new URL(u);
        const hay = url.pathname + '?' + url.searchParams.toString();
        return /(\/|\?|#)(book_contents|toc)(\W|$)/i.test(hay);
      } catch { return false; }
    };

    const notResources = (u: string) => {
      try { return !/\/resources\//i.test(new URL(u).pathname); } catch { return false; }
    };

    const filtered = urls
      .filter(u => isKyobo(u) && !isTelemetry(u) && !isMedia(u) && notResources(u))
      .filter(u => hasTocKeywordInPath(u));

    return Array.from(new Set(filtered));
  }

  /**
   * 인라인 스크립트 내 JSON에서 목차 후보 추출 (간단 휴리스틱)
   */
  getInlineJsonToc(): string | null {
    const scripts = this.querySelectorAll('script');
    for (const s of Array.from(scripts)) {
      const txt = s.textContent || '';
      if (!txt || txt.length < 20) continue;
      // 배열형 book_contents_list 추출
      const arrMatch = txt.match(/book_contents_list"?\s*:\s*\[(.*?)\]/s);
      if (arrMatch) {
        const raw = `[${arrMatch[1]}]`;
        try {
          const json = JSON.parse(raw.replace(/\,(\s*\])/g, '$1'));
          if (Array.isArray(json)) {
            const lines = json
              .map((v: any) => (typeof v === 'string' ? v : (v?.title || v?.text || '')))
              .map((t: string) => (t || '').toString().trim())
              .filter(Boolean);
            if (lines.length > 0) return lines.join('\n');
          }
        } catch {}
      }
      // 객체형 toc 필드 추출
      const objMatch = txt.match(/"toc"\s*:\s*"([\s\S]{20,20000})"/);
      if (objMatch) {
        const val = objMatch[1]
          .replace(/\\n/g, '\n')
          .replace(/\\"/g, '"');
        if (val.trim().length > 10) return val.trim();
      }
    }
    return null;
  }
}
