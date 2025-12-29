# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a Korean Kyobobook plugin for Obsidian that allows users to search books from Kyobobook bookstore and automatically create structured notes with book information.

## Development Commands

```bash
# Install dependencies
npm install

# Development mode with file watching and auto-rebuild
npm run dev

# Production build with type checking
npm run build

# Type checking only
tsc -noEmit -skipLibCheck

# Version bump (updates manifest.json and versions.json)
npm run version
```

## Architecture Overview

### Core Plugin Architecture
- **Entry Point**: `src/main.ts` - KyobobookPlugin class manages plugin lifecycle, command registration, and settings
- **API Layer**: `src/api/kyobobook-api.ts` - Handles web scraping of Kyobobook search results and book details
- **UI Components**:
  - `src/ui/search-modal.ts` - Modal for book search interface
  - `src/ui/settings-tab.ts` - Plugin settings configuration tab
- **Template System**: `src/utils/template.ts` - Handlebars-based note generation from book data
- **Data Parsing**: `src/utils/parser.ts` - HTML parsing utilities for extracting book details

### Key Data Flow
1. User triggers search command → Opens search modal
2. Search modal calls KyobobookAPI.searchBooks() → Scrapes Kyobobook search page
3. User selects book → Calls KyobobookAPI.getBookDetail() → Scrapes detailed book page
4. Template system processes book data → Creates structured Obsidian note
5. Note saved to configured folder with customizable filename format

### API Strategy
- **Web Scraping**: Uses Obsidian's requestUrl() to fetch Kyobobook pages
- **Robust Parsing**: Multiple fallback selectors to handle HTML structure changes
- **Error Handling**: Graceful degradation when detailed information unavailable
- **Rate Limiting**: Single request per user action to respect Kyobobook servers

### Settings System
- **Template Customization**: Users can modify note templates with Handlebars variables
- **Folder Organization**: Configurable save location and filename patterns
- **Tag Management**: Automatic tag generation from book categories
- **Search Limits**: Configurable maximum search results

## Build System

- **Bundler**: esbuild configured to bundle TypeScript to single `main.js`
- **Target**: ES2018 for Obsidian compatibility
- **Externals**: Obsidian API and CodeMirror modules excluded from bundle
- **Output**: Production build creates `main.js` at project root for Obsidian plugin installation

## Plugin Installation

Copy these files to `.obsidian/plugins/kyobobook-plugin/`:
- `main.js` (generated from build)
- `manifest.json`
- `styles.css`

## Template Variables

Available in note templates:
- `{{title}}`, `{{authors}}`, `{{publisher}}`, `{{publishDate}}`
- `{{isbn}}`, `{{pages}}`, `{{description}}`, `{{toc}}`
- `{{categories}}`, `{{tags}}`, `{{rating}}`, `{{url}}`
- `{{coverImage}}`, `{{created}}`

## Korean Language Support

- All UI text and default templates in Korean
- Handles Korean book metadata and encoding
- Template placeholders support Korean book information structure
- Default folder and file naming conventions follow Korean book organization patterns

## Network Dependencies

- Requires internet connection for Kyobobook API access
- Uses web scraping (no official API available)
- Respects Kyobobook's robots.txt and implements reasonable rate limiting
- Handles network failures gracefully with fallback to cached/partial data

## Development Lessons Learned

### 🎯 Critical Success Factors

#### 1. **Architecture-First Approach**
- **교훈**: 처음부터 도메인 주도 설계(DDD) 패턴 적용이 핵심
- **구조**: `domain/` → `application/` → `infrastructure/` → `ui/` 계층화
- **장점**: 비즈니스 로직과 기술 구현의 명확한 분리, 테스트 가능한 코드
- **팁**: Obsidian 플러그인도 복잡한 소프트웨어이므로 처음부터 견고한 아키텍처 필요

#### 2. **점진적 개발 & 지속적 개선**
- **패턴**: MVP → 핵심 기능 → 품질 개선 → 사용자 경험 최적화
- **성과**: 기본 검색 → 상세 정보 → 포맷 개선 → 메타데이터 필터링
- **교훈**: 한 번에 완벽을 추구하지 말고, 단계별로 개선하며 사용자 피드백 반영

#### 3. **웹 스크래핑의 현실적 접근**
- **핵심**: 여러 fallback 선택자 + 패턴 매칭 + 에러 핸들링
- **필수**: HTML 구조 변경에 대한 복원력 (resilience)
- **실용적 해결책**: 완벽한 파싱보다는 80% 성공률 + 우아한 실패

### 🔧 Technical Deep Dive

#### 1. **HTML-to-Markdown 변환의 복잡성**
```typescript
// ❌ 초기 접근: 단순 태그 제거
content.replace(/<[^>]+>/g, '')

// ✅ 최종 해결: 구조화된 변환 + 후처리
private convertHtmlToMarkdown(html: string): string {
  // 1단계: 태그별 의미있는 변환
  // 2단계: 텍스트 정리 (cleanupMarkdownFormatting)
  // 3단계: 메타데이터 필터링 (removeMetadataBlocks)
}
```

**핵심 교훈**:
- 단순 정규식으로는 한계가 있음
- 컨텍스트를 고려한 다단계 처리 필요
- 사용자 요구사항(깔끔한 포맷)에 맞춘 후처리가 핵심

#### 2. **TypeScript + Obsidian API 통합**
```typescript
// ✅ 성공 패턴: 타입 안전성 + 런타임 검사
const requestUrl = (globalThis as any).requestUrl || (window as any).requestUrl;
if (!requestUrl) {
  throw new NetworkError('Obsidian API not available');
}
```

**교훈**:
- Obsidian API는 타입 정의가 완벽하지 않음
- 런타임 검사 + 타입 캐스팅 조합 필요
- 개발 환경과 실제 Obsidian 환경의 차이 고려

#### 3. **에러 처리의 계층화**
```typescript
// ✅ 도메인별 에러 클래스
export class NetworkError extends PluginError {
  readonly category = 'NETWORK';
  constructor(message: string, statusCode?: number, context?: Record<string, unknown>, cause?: Error)
}

export class ParseError extends PluginError {
  readonly category = 'PARSING';
  constructor(message: string, source: string, context?: Record<string, unknown>, cause?: Error)
}
```

**성과**:
- 디버깅 시 에러 원인 즉시 파악 가능
- 사용자에게 적절한 에러 메시지 제공
- 로깅과 모니터링 용이

### 🎨 User Experience Insights

#### 1. **검색 UX의 핵심**
- **실시간 피드백**: 검색 중 로딩 상태 표시
- **키보드 네비게이션**: 마우스 없이도 완전한 조작 가능
- **결과 미리보기**: 선택 전에 충분한 정보 제공

#### 2. **노트 생성 품질의 중요성**
- **80% 시간 투자**: 파싱 정확도보다 포맷 품질이 사용자 만족도에 더 큰 영향
- **메타데이터 노이즈**: 수상내역, 미디어 추천 등은 사용자에게 불필요한 정보
- **일관성**: 모든 책에서 동일한 포맷 유지가 핵심

#### 3. **한국어 처리의 특수성**
- **인코딩**: UTF-8 처리 + 한글 텍스트 정규화
- **날짜 포맷**: "2025년 06월 02일" → "2025-06-02" 변환
- **출판사명**: "㈜포레스트북스" → "포레스트북스" 정리

### 🚀 Development Workflow Optimization

#### 1. **빠른 피드백 루프**
```bash
# 개발 시 핵심 명령어
npm run dev    # 실시간 빌드
npm run build  # 프로덕션 빌드
cp main.js manifest.json styles.css [obsidian-path]  # 즉시 배포
```

#### 2. **디버깅 전략**
- **로깅 시스템**: 개발 모드에서 상세 로그, 프로덕션에서 최소 로그
- **HTML 덤프**: 파싱 실패 시 HTML 내용을 파일로 저장해서 분석
- **단위 테스트**: 파서 로직은 독립적으로 테스트 가능하게 설계

#### 3. **사용자 피드백 통합**
- **실제 사용**: 개발자가 직접 사용하면서 불편함 발견
- **즉시 개선**: 피드백을 받으면 24시간 내 수정 배포
- **점진적 완성도**: 완벽함보다는 지속적 개선

### ⚠️ Common Pitfalls & Solutions

#### 1. **웹 스크래핑 함정들**
- **문제**: 교보문고 HTML 구조 변경
- **해결**: 다중 선택자 + 패턴 매칭 + 의미론적 분석
- **예방**: 정기적인 파싱 성공률 모니터링

#### 2. **TypeScript 타입 시스템**
- **문제**: `any` 타입 남용으로 런타임 에러
- **해결**: 점진적 타입 강화 + 런타임 검증
- **팁**: Obsidian API는 타입 정의 불완전하므로 방어적 프로그래밍

#### 3. **성능 최적화 과조기**
- **실수**: 처음부터 과도한 최적화 시도
- **교훈**: 사용자 경험이 먼저, 성능은 필요시에만
- **실제**: 교보문고 응답속도가 병목, 클라이언트 최적화는 미미한 효과

### 🎯 Next Plugin Development Guidelines

#### 1. **시작할 때**
- DDD 아키텍처로 폴더 구조 설계
- 에러 처리 클래스 먼저 정의
- MVP 범위 명확히 설정

#### 2. **개발 중**
- 사용자 피드백을 최우선으로 반영
- 완벽한 파싱보다 80% 성공 + 우아한 실패
- 로깅과 디버깅 도구에 투자

#### 3. **배포 전**
- 실제 환경에서 충분한 테스트
- 에러 케이스 시나리오 검증
- 사용자 문서화 (README, 설정 가이드)

#### 4. **유지보수**
- 정기적인 파싱 성공률 체크
- 사용자 피드백 모니터링
- 점진적 기능 개선

### 💡 Key Takeaways

1. **아키텍처가 90%**: 좋은 구조가 모든 문제를 쉽게 만든다
2. **사용자 중심**: 기술적 완벽함보다 사용자 경험이 우선
3. **점진적 개선**: 한 번에 완벽하게 만들려 하지 말고 지속적으로 개선
4. **방어적 프로그래밍**: 웹 스크래핑은 항상 실패할 수 있다고 가정
5. **피드백 루프**: 빠른 개발-테스트-배포 사이클 구축이 핵심

이 경험들을 바탕으로 다음 플러그인 개발 시 더 효율적이고 견고한 결과물을 만들 수 있을 것입니다.