// 통합된 도서 모델
export interface Book {
  // 기본 식별 정보 (필수)
  readonly id: string;          // 통합된 고유 ID (pid 또는 bid)
  readonly title: string;       // 도서 제목

  // 저자 및 출판 정보 (필수)
  readonly authors: readonly string[];  // 저자 목록
  readonly publisher: string;           // 출판사

  // 선택적 기본 정보
  readonly subtitle?: string;           // 부제목
  readonly publishDate?: string;        // 출판일 (YYYY-MM-DD 형식)
  readonly isbn?: string;              // ISBN
  readonly pages?: number;             // 페이지 수
  readonly language?: string;          // 언어 (기본값: 'ko')

  // 콘텐츠 정보
  readonly description?: string;        // 책 설명
  readonly tableOfContents?: string;    // 목차
  readonly categories?: readonly string[]; // 카테고리 목록

  // 평가 및 미디어
  readonly rating?: number;            // 평점 (0-10)
  readonly coverImageUrl?: string;     // 표지 이미지 URL
  readonly detailPageUrl?: string;     // 상세 페이지 URL

  // 메타데이터
  readonly tags?: readonly string[];   // 태그 목록
  readonly createdAt?: Date;          // 생성일시
  readonly updatedAt?: Date;          // 수정일시
}

// 도서 생성을 위한 입력 타입 (필수 필드만)
export interface CreateBookInput {
  id: string;
  title: string;
  authors: string[];
  publisher: string;
  subtitle?: string;
  publishDate?: string;
  isbn?: string;
  pages?: number;
  language?: string;
  description?: string;
  tableOfContents?: string;
  categories?: string[];
  rating?: number;
  coverImageUrl?: string;
  detailPageUrl?: string;
  tags?: string[];
}

// 도서 업데이트를 위한 입력 타입 (id 제외 모든 필드 선택적)
export interface UpdateBookInput {
  title?: string;
  authors?: string[];
  publisher?: string;
  subtitle?: string;
  publishDate?: string;
  isbn?: string;
  pages?: number;
  language?: string;
  description?: string;
  tableOfContents?: string;
  categories?: string[];
  rating?: number;
  coverImageUrl?: string;
  detailPageUrl?: string;
  tags?: string[];
}

// 도서 검색 결과
export interface BookSearchResult {
  readonly books: readonly Book[];
  readonly totalCount: number;
  readonly hasMore: boolean;
  readonly nextCursor?: string;
}

// 도서 검색 파라미터
export interface BookSearchParams {
  readonly query: string;
  readonly maxResults?: number;
  readonly offset?: number;
  readonly category?: string;
  readonly sortBy?: 'relevance' | 'title' | 'author' | 'publishDate' | 'rating';
  readonly sortOrder?: 'asc' | 'desc';
}

// 도서 필터
export interface BookFilter {
  readonly authors?: readonly string[];
  readonly publishers?: readonly string[];
  readonly categories?: readonly string[];
  readonly minRating?: number;
  readonly maxRating?: number;
  readonly publishDateFrom?: string;
  readonly publishDateTo?: string;
  readonly language?: string;
}

// 도서 팩토리 클래스
export class BookFactory {
  /**
   * CreateBookInput으로부터 Book 객체 생성
   */
  static create(input: CreateBookInput): Book {
    const now = new Date();

    return {
      id: input.id,
      title: input.title.trim(),
      authors: input.authors.map(author => author.trim()).filter(Boolean),
      publisher: input.publisher.trim(),
      subtitle: input.subtitle?.trim(),
      publishDate: input.publishDate,
      isbn: input.isbn?.trim(),
      pages: input.pages && input.pages > 0 ? input.pages : undefined,
      language: input.language || 'ko',
      description: input.description?.trim(),
      tableOfContents: input.tableOfContents?.trim(),
      categories: input.categories?.map(cat => cat.trim()).filter(Boolean),
      rating: input.rating && input.rating >= 0 && input.rating <= 10 ? input.rating : undefined,
      coverImageUrl: input.coverImageUrl?.trim(),
      detailPageUrl: input.detailPageUrl?.trim(),
      tags: input.tags?.map(tag => tag.trim()).filter(Boolean),
      createdAt: now,
      updatedAt: now
    };
  }

  /**
   * 기존 Book 객체를 UpdateBookInput으로 업데이트
   */
  static update(existing: Book, updates: UpdateBookInput): Book {
    return {
      ...existing,
      ...(updates.title !== undefined && { title: updates.title.trim() }),
      ...(updates.authors !== undefined && {
        authors: updates.authors.map(author => author.trim()).filter(Boolean)
      }),
      ...(updates.publisher !== undefined && { publisher: updates.publisher.trim() }),
      ...(updates.subtitle !== undefined && { subtitle: updates.subtitle?.trim() }),
      ...(updates.publishDate !== undefined && { publishDate: updates.publishDate }),
      ...(updates.isbn !== undefined && { isbn: updates.isbn?.trim() }),
      ...(updates.pages !== undefined && {
        pages: updates.pages && updates.pages > 0 ? updates.pages : undefined
      }),
      ...(updates.language !== undefined && { language: updates.language }),
      ...(updates.description !== undefined && { description: updates.description?.trim() }),
      ...(updates.tableOfContents !== undefined && { tableOfContents: updates.tableOfContents?.trim() }),
      ...(updates.categories !== undefined && {
        categories: updates.categories?.map(cat => cat.trim()).filter(Boolean)
      }),
      ...(updates.rating !== undefined && {
        rating: updates.rating && updates.rating >= 0 && updates.rating <= 10 ? updates.rating : undefined
      }),
      ...(updates.coverImageUrl !== undefined && { coverImageUrl: updates.coverImageUrl?.trim() }),
      ...(updates.detailPageUrl !== undefined && { detailPageUrl: updates.detailPageUrl?.trim() }),
      ...(updates.tags !== undefined && {
        tags: updates.tags?.map(tag => tag.trim()).filter(Boolean)
      }),
      updatedAt: new Date()
    };
  }

  /**
   * Book 유효성 검증
   */
  static validate(book: Book): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!book.id || book.id.trim() === '') {
      errors.push('ID는 필수입니다.');
    }

    if (!book.title || book.title.trim() === '') {
      errors.push('제목은 필수입니다.');
    }

    if (!book.authors || book.authors.length === 0) {
      errors.push('저자는 최소 1명 이상 필요합니다.');
    }

    if (!book.publisher || book.publisher.trim() === '') {
      errors.push('출판사는 필수입니다.');
    }

    if (book.rating !== undefined && (book.rating < 0 || book.rating > 10)) {
      errors.push('평점은 0-10 사이여야 합니다.');
    }

    if (book.pages !== undefined && book.pages <= 0) {
      errors.push('페이지 수는 0보다 커야 합니다.');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// 유틸리티 타입들
export type BookId = Book['id'];
export type BookTitle = Book['title'];
export type BookAuthors = Book['authors'];
export type BookPublisher = Book['publisher'];