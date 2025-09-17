// 디버그 유틸리티
import { Notice } from 'obsidian';

export class DebugLogger {
  private static isDebugMode = false;

  static setDebugMode(enabled: boolean) {
    this.isDebugMode = enabled;
  }

  static log(category: string, message: string, data?: unknown) {
    if (!this.isDebugMode) return;

    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${category}] ${message}`;

    console.log(logMessage);
    if (data) {
      console.log(data);
    }
  }

  static error(category: string, message: string, error?: unknown) {
    const timestamp = new Date().toISOString();
    const errorMessage = `[${timestamp}] [ERROR:${category}] ${message}`;

    console.error(errorMessage);
    if (error) {
      console.error(error);
    }
  }

  static warn(category: string, message: string, data?: unknown) {
    const timestamp = new Date().toISOString();
    const warnMessage = `[${timestamp}] [WARN:${category}] ${message}`;

    console.warn(warnMessage);
    if (data) {
      console.warn(data);
    }
  }

  static saveHtmlToFile(html: string, filename: string) {
    if (!this.isDebugMode) return;

    try {
      // 브라우저 환경에서는 다운로드로 저장
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}-${Date.now()}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.log('DEBUG', `HTML 파일 저장: ${filename}`);
    } catch (error) {
      this.error('DEBUG', 'HTML 파일 저장 실패', error);
    }
  }

  static showDebugNotice(message: string) {
    if (!this.isDebugMode) return;
    new Notice(`[DEBUG] ${message}`, 3000);
  }

  static analyzeHtmlStructure(html: string, title: string) {
    if (!this.isDebugMode) return;

    this.log('HTML_ANALYSIS', `=== ${title} HTML 구조 분석 시작 ===`);

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // 페이지 제목
    const pageTitle = doc.querySelector('title')?.textContent;
    this.log('HTML_ANALYSIS', `페이지 제목: ${pageTitle}`);

    // 전체 HTML 길이
    this.log('HTML_ANALYSIS', `HTML 길이: ${html.length}자`);

    // 주요 검색 관련 요소들 분석
    const searchTerms = ['search', 'result', 'list', 'prod', 'book', 'item'];

    searchTerms.forEach(term => {
      const elementsWithClass = doc.querySelectorAll(`[class*="${term}"]`);
      if (elementsWithClass.length > 0) {
        this.log('HTML_ANALYSIS', `"${term}" 클래스 요소: ${elementsWithClass.length}개`);
      }
    });

    // 상세 페이지 링크 분석
    const detailLinks = doc.querySelectorAll('a[href*="detail"], a[href*="product"]');
    this.log('HTML_ANALYSIS', `상세 페이지 링크: ${detailLinks.length}개`);

    // 일반적인 리스트 요소들
    const listElements = doc.querySelectorAll('ul, ol, div[class*="list"], section[class*="list"]');
    this.log('HTML_ANALYSIS', `리스트 요소들: ${listElements.length}개`);

    this.log('HTML_ANALYSIS', '=== HTML 구조 분석 완료 ===');
  }
}