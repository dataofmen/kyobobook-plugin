// 노트 템플릿 생성 유틸리티

import { BookInfo, KyobobookPluginSettings } from '../types';

export function createNoteFromTemplate(book: BookInfo, settings: KyobobookPluginSettings): string {
  let template = settings.noteTemplate;

  // 현재 날짜 생성
  const now = new Date();
  const created = now.toISOString().split('T')[0]; // YYYY-MM-DD 형식

  // 카테고리와 태그 처리
  const categories = formatArrayForYAML(book.categories || []);
  const tags = generateTags(book, settings);

  // 템플릿 변수 치환
  const replacements: Record<string, string> = {
    '{{title}}': escapeYAMLValue(book.title || '제목없음'),
    '{{authors}}': escapeYAMLValue(book.authors || '저자미상'),
    '{{publisher}}': escapeYAMLValue(book.publisher || ''),
    '{{publishDate}}': escapeYAMLValue(book.publishDate || ''),
    '{{isbn}}': escapeYAMLValue(book.isbn || ''),
    '{{pages}}': escapeYAMLValue(book.pages || ''),
    '{{description}}': formatDescription(book.description || ''),
    '{{toc}}': formatTableOfContents(book.toc || ''),
    '{{categories}}': categories,
    '{{tags}}': tags,
    '{{rating}}': escapeYAMLValue(book.rating || ''),
    '{{url}}': book.url || '',
    '{{coverImage}}': book.coverImage || '',
    '{{created}}': created
  };

  // 모든 템플릿 변수 치환
  for (const [placeholder, value] of Object.entries(replacements)) {
    template = template.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
  }

  return template;
}

function escapeYAMLValue(value: string): string {
  // YAML에서 특수 문자 처리
  if (!value) return '';

  // 따옴표나 특수 문자가 포함된 경우 따옴표로 감싸기
  if (value.includes('"') || value.includes("'") || value.includes(':') || value.includes('\n')) {
    return `"${value.replace(/"/g, '\\"')}"`;
  }

  return value;
}

function formatArrayForYAML(items: string[]): string {
  if (!items || items.length === 0) {
    return '[]';
  }

  // 짧은 배열은 한 줄로
  if (items.length <= 3 && items.every(item => item.length < 20)) {
    const formattedItems = items.map(item => `"${item}"`).join(', ');
    return `[${formattedItems}]`;
  }

  // 긴 배열은 여러 줄로
  const formattedItems = items.map(item => `  - "${item}"`).join('\n');
  return `\n${formattedItems}`;
}

function generateTags(book: BookInfo, settings: KyobobookPluginSettings): string {
  const tags: Set<string> = new Set();

  // 기본 태그 추가
  tags.add('도서');

  // 카테고리에서 태그 생성 (설정에 따라)
  if (settings.autoCreateTags && book.categories) {
    for (const category of book.categories) {
      // 카테고리를 태그 형식으로 변환
      const tag = category.replace(/\s+/g, '-').toLowerCase();
      tags.add(tag);
    }
  }

  // 출판사 태그 (선택적)
  if (book.publisher) {
    const publisherTag = book.publisher.replace(/\s+/g, '-').toLowerCase();
    tags.add(`출판사/${publisherTag}`);
  }

  return formatArrayForYAML(Array.from(tags));
}

function formatDescription(description: string): string {
  if (!description) return '';

  // 이미 줄바꿈이 잘 포함되어 있다면 그대로 사용
  if (/\n/.test(description)) {
    return description;
  }

  // 긴 설명의 경우 문단 구분을 위해 적절히 줄바꿈 처리
  if (description.length > 200) {
    return description.replace(/\.\s+/g, '.\n\n');
  }

  return description;
}

function formatTableOfContents(toc: string): string {
  if (!toc) return '';
  // 요구사항: 모든 <br>를 줄바꿈으로 보존한 상태로 그대로 삽입한다.
  // 여기서는 전달된 toc 문자열의 개행을 보존하고, 양끝 공백만 정리한다.
  return toc.replace(/\r\n?/g, '\n').replace(/\s+$/,'');
}

export function sanitizeFileName(fileName: string): string {
  // 파일명에 사용할 수 없는 문자 제거
  return fileName
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 100); // 파일명 길이 제한
}
