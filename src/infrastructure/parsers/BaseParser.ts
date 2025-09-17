// HTML 파싱 베이스 클래스 (추상화 및 공통 기능)

import { TextUtils } from '../../shared/utils/TextUtils';
import { UrlUtils } from '../../shared/utils/UrlUtils';

/**
 * HTML 파싱을 위한 베이스 클래스
 */
export abstract class BaseParser {
  protected readonly document: Document;
  protected readonly htmlContent: string;

  constructor(html: string) {
    this.htmlContent = html;
    this.document = this.parseHtml(html);
  }

  /**
   * HTML 문자열을 Document 객체로 파싱
   */
  private parseHtml(html: string): Document {
    const parser = new DOMParser();
    return parser.parseFromString(html, 'text/html');
  }

  /**
   * 선택자로 단일 요소 찾기
   */
  protected querySelector(selector: string): Element | null {
    return this.document.querySelector(selector);
  }

  /**
   * 선택자로 여러 요소 찾기
   */
  protected querySelectorAll(selector: string): NodeListOf<Element> {
    return this.document.querySelectorAll(selector);
  }

  /**
   * 특정 요소 내부에서 선택자로 단일 요소 찾기
   */
  protected queryWithin(root: Element, selector: string): Element | null {
    return root.querySelector(selector);
  }

  /**
   * 특정 요소 내부에서 선택자로 여러 요소 찾기
   */
  protected queryAllWithin(root: Element, selector: string): Element[] {
    return Array.from(root.querySelectorAll(selector));
  }

  /**
   * 여러 선택자 중 첫 번째로 찾은 요소 반환
   */
  protected findFirstBySelectors(selectors: readonly string[]): Element | null {
    for (const selector of selectors) {
      const element = this.querySelector(selector);
      if (element) {
        return element;
      }
    }
    return null;
  }

  /**
   * 여러 선택자로 찾은 모든 요소들 반환
   */
  protected findAllBySelectors(selectors: readonly string[]): Element[] {
    const elements: Element[] = [];

    for (const selector of selectors) {
      const found = Array.from(this.querySelectorAll(selector));
      elements.push(...found);
    }

    // 중복 제거
    return Array.from(new Set(elements));
  }

  /**
   * 특정 요소 내부에서 여러 선택자 중 첫 번째 요소 찾기
   */
  protected findFirstBySelectorsWithin(root: Element, selectors: readonly string[]): Element | null {
    for (const selector of selectors) {
      const element = this.queryWithin(root, selector);
      if (element) return element;
    }
    return null;
  }

  /**
   * 특정 요소 내부에서 여러 선택자로 찾은 모든 요소들 반환
   */
  protected findAllBySelectorsWithin(root: Element, selectors: readonly string[]): Element[] {
    const elements: Element[] = [];
    for (const selector of selectors) {
      elements.push(...this.queryAllWithin(root, selector));
    }
    return Array.from(new Set(elements));
  }

  /**
   * 텍스트 내용으로 요소 찾기
   */
  protected findElementByText(text: string, tagName?: string): Element | null {
    const selector = tagName || '*';
    const elements = this.querySelectorAll(selector);

    for (const element of Array.from(elements)) {
      if (element.textContent?.includes(text)) {
        return element;
      }
    }

    return null;
  }

  /**
   * 요소에서 텍스트 추출 및 정리
   */
  protected extractText(element: Element | null): string {
    if (!element || !element.textContent) return '';
    return TextUtils.clean(element.textContent);
  }

  /**
   * 요소에서 속성값 추출
   */
  protected extractAttribute(element: Element | null, attribute: string): string {
    if (!element) return '';
    return element.getAttribute(attribute) || '';
  }

  /**
   * 이미지 URL 추출 (다양한 속성 확인)
   */
  protected extractImageUrl(imgElement: Element | null): string {
    if (!imgElement) return '';

    // IMG 또는 SOURCE 태그 처리
    if (imgElement.tagName.toLowerCase() === 'img' || imgElement.tagName.toLowerCase() === 'source') {
      const img = imgElement as HTMLImageElement;

      // srcset에서 가장 큰 이미지 선택
      const pickFromSrcSet = (srcset?: string | null): string | undefined => {
        if (!srcset) return undefined;
        const parts = srcset.split(',').map(s => s.trim());
        // 마지막 항목이 보통 가장 큰 해상도
        const last = parts[parts.length - 1];
        const urlPart = last?.split(' ')[0];
        return urlPart || parts[0]?.split(' ')[0];
      };

      const possibleSources = [
        img.getAttribute('src'),
        img.getAttribute('data-src'),
        img.getAttribute('data-original'),
        img.getAttribute('data-lazy'),
        pickFromSrcSet(img.getAttribute('srcset')),
        pickFromSrcSet(img.getAttribute('data-srcset'))
      ].filter(Boolean) as string[];

      for (const src of possibleSources) {
        const abs = UrlUtils.toAbsoluteUrl(src);
        if (abs && UrlUtils.isValidImageUrl(abs)) return abs;
      }
    }

    // style background-image 처리
    const style = (imgElement as HTMLElement).getAttribute?.('style') || '';
    const bgMatch = style.match(/background(?:-image)?:\s*url\((['\"]?)(.*?)\1\)/i);
    if (bgMatch && bgMatch[2]) {
      const abs = UrlUtils.toAbsoluteUrl(bgMatch[2]);
      if (UrlUtils.isValidImageUrl(abs)) return abs;
    }

    return '';
  }

  /**
   * 링크 URL 추출 및 정규화
   */
  protected extractLinkUrl(linkElement: Element | null): string {
    if (!linkElement) return '';

    const href = this.extractAttribute(linkElement, 'href');
    return href ? UrlUtils.toAbsoluteUrl(href) : '';
  }

  /**
   * 정규식으로 텍스트에서 패턴 추출
   */
  protected extractByPattern(text: string, pattern: RegExp): string {
    if (!text) return '';

    const match = text.match(pattern);
    return match?.[1] || '';
  }

  /**
   * 여러 패턴으로 텍스트에서 값 추출 시도
   */
  protected extractByPatterns(text: string, patterns: RegExp[]): string {
    for (const pattern of patterns) {
      const result = this.extractByPattern(text, pattern);
      if (result) return result;
    }
    return '';
  }

  /**
   * 요소들에서 텍스트 목록 추출
   */
  protected extractTextArray(elements: Element[]): string[] {
    return elements
      .map(element => this.extractText(element))
      .filter(text => text.length > 0);
  }

  /**
   * 요소가 특정 조건을 만족하는지 확인
   */
  protected matchesCondition(
    element: Element,
    condition: {
      className?: string;
      tagName?: string;
      textContent?: string;
      attribute?: { name: string; value: string };
    }
  ): boolean {
    if (condition.className && !element.className.includes(condition.className)) {
      return false;
    }

    if (condition.tagName && element.tagName.toLowerCase() !== condition.tagName.toLowerCase()) {
      return false;
    }

    if (condition.textContent && !element.textContent?.includes(condition.textContent)) {
      return false;
    }

    if (condition.attribute) {
      const attrValue = element.getAttribute(condition.attribute.name);
      if (attrValue !== condition.attribute.value) {
        return false;
      }
    }

    return true;
  }

  /**
   * 요소의 조상 요소들 중에서 조건에 맞는 것 찾기
   */
  protected findAncestor(
    element: Element,
    condition: (el: Element) => boolean,
    maxDepth = 10
  ): Element | null {
    let current = element.parentElement;
    let depth = 0;

    while (current && depth < maxDepth) {
      if (condition(current)) {
        return current;
      }
      current = current.parentElement;
      depth++;
    }

    return null;
  }

  /**
   * 요소의 후손 요소들 중에서 조건에 맞는 것들 찾기
   */
  protected findDescendants(
    element: Element,
    condition: (el: Element) => boolean,
    maxDepth = 5
  ): Element[] {
    const results: Element[] = [];
    const queue: { element: Element; depth: number }[] = [{ element, depth: 0 }];

    while (queue.length > 0) {
      const { element: current, depth } = queue.shift()!;

      if (depth < maxDepth) {
        for (const child of Array.from(current.children)) {
          if (condition(child)) {
            results.push(child);
          }
          queue.push({ element: child, depth: depth + 1 });
        }
      }
    }

    return results;
  }

  /**
   * 형제 요소들 중에서 조건에 맞는 것들 찾기
   */
  protected findSiblings(
    element: Element,
    condition: (el: Element) => boolean
  ): Element[] {
    if (!element.parentElement) return [];

    return Array.from(element.parentElement.children)
      .filter(sibling => sibling !== element && condition(sibling));
  }

  /**
   * 다음 형제 요소들 가져오기
   */
  protected getNextSiblings(element: Element, count?: number): Element[] {
    const siblings: Element[] = [];
    let current = element.nextElementSibling;

    while (current && (!count || siblings.length < count)) {
      siblings.push(current);
      current = current.nextElementSibling;
    }

    return siblings;
  }

  /**
   * HTML 전체에서 패턴 매칭으로 값 추출
   */
  protected extractFromFullText(patterns: RegExp[]): string {
    const fullText = this.document.body?.textContent || '';
    return this.extractByPatterns(fullText, patterns);
  }

  /**
   * 메타 태그에서 값 추출
   */
  protected extractFromMeta(property: string): string {
    const metaElement = this.querySelector(`meta[property="${property}"], meta[name="${property}"]`);
    return this.extractAttribute(metaElement, 'content');
  }

  /**
   * 요소의 가시성 확인 (숨겨진 요소 제외)
   */
  protected isVisible(element: Element): boolean {
    if (!(element instanceof HTMLElement)) return true;

    const style = element.style;
    return !(
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      style.opacity === '0' ||
      element.hidden
    );
  }

  /**
   * 텍스트 품질 평가 (파싱 결과 검증용)
   */
  protected assessTextQuality(text: string): {
    isValid: boolean;
    score: number;
    issues: string[];
  } {
    const issues: string[] = [];
    let score = 100;

    if (!text || text.trim() === '') {
      return { isValid: false, score: 0, issues: ['Empty text'] };
    }

    // 길이 검사
    if (text.length < 2) {
      issues.push('Too short');
      score -= 50;
    }

    if (text.length > 1000) {
      issues.push('Too long');
      score -= 20;
    }

    // 특수 문자 비율 검사
    const specialCharRatio = (text.match(/[^\w\s가-힣]/g) || []).length / text.length;
    if (specialCharRatio > 0.3) {
      issues.push('Too many special characters');
      score -= 30;
    }

    // 반복 패턴 검사
    if (/(.)\1{5,}/.test(text)) {
      issues.push('Repeated characters');
      score -= 20;
    }

    // HTML 잔여물 검사
    if (/<[^>]+>/.test(text)) {
      issues.push('Contains HTML tags');
      score -= 40;
    }

    return {
      isValid: score >= 50,
      score: Math.max(0, score),
      issues
    };
  }

  /**
   * 파싱 통계 정보 반환
   */
  protected getParsingStats(): {
    totalElements: number;
    textElements: number;
    linkElements: number;
    imageElements: number;
    htmlLength: number;
  } {
    return {
      totalElements: this.document.querySelectorAll('*').length,
      textElements: this.document.querySelectorAll('p, div, span, h1, h2, h3, h4, h5, h6').length,
      linkElements: this.document.querySelectorAll('a[href]').length,
      imageElements: this.document.querySelectorAll('img[src]').length,
      htmlLength: this.htmlContent.length
    };
  }
}
