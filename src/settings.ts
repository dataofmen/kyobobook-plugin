import { KyobobookPluginSettings } from './types';

export const DEFAULT_SETTINGS: KyobobookPluginSettings = {
  saveFolder: '도서',
  noteTemplate: `---
title: "{{title}}"
authors: "{{authors}}"
publisher: "{{publisher}}"
publishDate: "{{publishDate}}"
isbn: "{{isbn}}"
pages: "{{pages}}"
categories: {{categories}}
tags: {{tags}}
rating: "{{rating}}"
coverImage: "{{coverImage}}"
created: "{{created}}"
---

# {{title}}

## 표지
![{{title}}]({{coverImage}})

## 도서 정보
- 저자: {{authors}}
- 출판사: {{publisher}}
- 출판일: {{publishDate}}
- ISBN: {{isbn}}
- 페이지: {{pages}}

## 책 소개
{{description}}

## 목차
{{toc}}

## 메모


## 링크
[교보문고 바로가기]({{url}})`,
  filenameTemplate: '{{title}}',
  maxSearchResults: 20,
  autoCreateTags: true,
  debugMode: false,
  strictDetailPrefetch: false,
  enforceStaticCover: false,
  prefetchCount: 8,
  embedCoverInNote: false
};
