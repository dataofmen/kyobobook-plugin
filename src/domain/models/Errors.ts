// 플러그인 에러 계층 구조

/**
 * 기본 플러그인 에러 클래스
 */
export abstract class PluginError extends Error {
  abstract readonly code: string;
  abstract readonly category: string;
  readonly timestamp: Date;
  readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    context?: Record<string, unknown>,
    cause?: Error
  ) {
    super(message, { cause });
    this.name = this.constructor.name;
    this.timestamp = new Date();
    this.context = context;

    // Error 객체의 스택 트레이스 설정
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * 사용자 친화적인 에러 메시지 반환
   */
  abstract getUserMessage(): string;

  /**
   * 에러의 심각도 수준 반환
   */
  abstract getSeverity(): ErrorSeverity;

  /**
   * 에러를 JSON 형태로 직렬화
   */
  toJSON(): ErrorInfo {
    return {
      name: this.name,
      code: this.code,
      category: this.category,
      message: this.message,
      userMessage: this.getUserMessage(),
      severity: this.getSeverity(),
      timestamp: this.timestamp,
      context: this.context,
      stack: this.stack
    };
  }
}

/**
 * 네트워크 관련 에러
 */
export class NetworkError extends PluginError {
  readonly code = 'NETWORK_ERROR';
  readonly category = 'NETWORK';

  constructor(
    message: string,
    public readonly statusCode?: number,
    context?: Record<string, unknown>,
    cause?: Error
  ) {
    super(message, { ...context, statusCode }, cause);
  }

  getUserMessage(): string {
    if (this.statusCode) {
      switch (this.statusCode) {
        case 404:
          return '요청한 페이지를 찾을 수 없습니다.';
        case 429:
          return '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.';
        case 500:
        case 502:
        case 503:
          return '교보문고 서버에 일시적인 문제가 있습니다. 잠시 후 다시 시도해주세요.';
        default:
          return '네트워크 연결에 문제가 있습니다. 인터넷 연결을 확인해주세요.';
      }
    }
    return '네트워크 오류가 발생했습니다.';
  }

  getSeverity(): ErrorSeverity {
    if (this.statusCode && this.statusCode >= 500) {
      return ErrorSeverity.HIGH;
    }
    return ErrorSeverity.MEDIUM;
  }
}

/**
 * 파싱 관련 에러
 */
export class ParseError extends PluginError {
  readonly code = 'PARSE_ERROR';
  readonly category = 'PARSING';

  constructor(
    message: string,
    public readonly source?: string,
    context?: Record<string, unknown>,
    cause?: Error
  ) {
    super(message, { ...context, source }, cause);
  }

  getUserMessage(): string {
    return '데이터를 처리하는 중에 오류가 발생했습니다. 교보문고 페이지 구조가 변경되었을 수 있습니다.';
  }

  getSeverity(): ErrorSeverity {
    return ErrorSeverity.MEDIUM;
  }
}

/**
 * 검색 관련 에러
 */
export class SearchError extends PluginError {
  readonly code = 'SEARCH_ERROR';
  readonly category = 'SEARCH';

  constructor(
    message: string,
    public readonly query?: string,
    context?: Record<string, unknown>,
    cause?: Error
  ) {
    super(message, { ...context, query }, cause);
  }

  getUserMessage(): string {
    return '검색 중에 오류가 발생했습니다. 검색어를 확인하고 다시 시도해주세요.';
  }

  getSeverity(): ErrorSeverity {
    return ErrorSeverity.LOW;
  }
}

/**
 * 유효성 검증 에러
 */
export class ValidationError extends PluginError {
  readonly code = 'VALIDATION_ERROR';
  readonly category = 'VALIDATION';

  constructor(
    message: string,
    public readonly field?: string,
    public readonly value?: unknown,
    context?: Record<string, unknown>
  ) {
    super(message, { ...context, field, value });
  }

  getUserMessage(): string {
    if (this.field) {
      return `${this.field} 값이 올바르지 않습니다: ${this.message}`;
    }
    return `입력값이 올바르지 않습니다: ${this.message}`;
  }

  getSeverity(): ErrorSeverity {
    return ErrorSeverity.LOW;
  }
}

/**
 * 캐시 관련 에러
 */
export class CacheError extends PluginError {
  readonly code = 'CACHE_ERROR';
  readonly category = 'CACHE';

  constructor(
    message: string,
    public readonly operation?: 'GET' | 'SET' | 'DELETE' | 'CLEAR',
    context?: Record<string, unknown>,
    cause?: Error
  ) {
    super(message, { ...context, operation }, cause);
  }

  getUserMessage(): string {
    return '임시 저장소에 문제가 있지만, 기능은 정상적으로 작동합니다.';
  }

  getSeverity(): ErrorSeverity {
    return ErrorSeverity.LOW;
  }
}

/**
 * 파일 시스템 관련 에러
 */
export class FileSystemError extends PluginError {
  readonly code = 'FILESYSTEM_ERROR';
  readonly category = 'FILESYSTEM';

  constructor(
    message: string,
    public readonly filePath?: string,
    public readonly operation?: 'READ' | 'write' | 'create' | 'delete',
    context?: Record<string, unknown>,
    cause?: Error
  ) {
    super(message, { ...context, filePath, operation }, cause);
  }

  getUserMessage(): string {
    switch (this.operation) {
      case 'create':
        return '노트를 생성할 수 없습니다. 폴더 권한을 확인해주세요.';
      case 'write':
        return '노트를 저장할 수 없습니다. 파일이 사용 중이거나 권한이 없을 수 있습니다.';
      case 'read':
        return '파일을 읽을 수 없습니다.';
      case 'delete':
        return '파일을 삭제할 수 없습니다.';
      default:
        return '파일 작업 중 오류가 발생했습니다.';
    }
  }

  getSeverity(): ErrorSeverity {
    return ErrorSeverity.MEDIUM;
  }
}

/**
 * 설정 관련 에러
 */
export class ConfigurationError extends PluginError {
  readonly code = 'CONFIGURATION_ERROR';
  readonly category = 'CONFIGURATION';

  constructor(
    message: string,
    public readonly setting?: string,
    context?: Record<string, unknown>
  ) {
    super(message, { ...context, setting });
  }

  getUserMessage(): string {
    if (this.setting) {
      return `플러그인 설정 '${this.setting}'에 문제가 있습니다. 설정을 확인해주세요.`;
    }
    return '플러그인 설정에 문제가 있습니다. 설정을 확인해주세요.';
  }

  getSeverity(): ErrorSeverity {
    return ErrorSeverity.MEDIUM;
  }
}

/**
 * 에러 심각도 수준
 */
export enum ErrorSeverity {
  LOW = 'low',       // 기능에 영향 없음
  MEDIUM = 'medium', // 일부 기능 제한
  HIGH = 'high',     // 주요 기능 불가
  CRITICAL = 'critical' // 플러그인 사용 불가
}

/**
 * 에러 정보 인터페이스
 */
export interface ErrorInfo {
  name: string;
  code: string;
  category: string;
  message: string;
  userMessage: string;
  severity: ErrorSeverity;
  timestamp: Date;
  context?: Record<string, unknown>;
  stack?: string;
}

/**
 * 에러 팩토리 유틸리티
 */
export class ErrorFactory {
  /**
   * HTTP 상태 코드에 따른 NetworkError 생성
   */
  static createNetworkError(
    statusCode: number,
    url?: string,
    cause?: Error
  ): NetworkError {
    const context = url ? { url } : undefined;

    switch (statusCode) {
      case 404:
        return new NetworkError('페이지를 찾을 수 없습니다', statusCode, context, cause);
      case 429:
        return new NetworkError('요청 제한에 걸렸습니다', statusCode, context, cause);
      case 500:
        return new NetworkError('서버 내부 오류입니다', statusCode, context, cause);
      case 502:
        return new NetworkError('게이트웨이 오류입니다', statusCode, context, cause);
      case 503:
        return new NetworkError('서비스를 사용할 수 없습니다', statusCode, context, cause);
      default:
        return new NetworkError(`HTTP ${statusCode} 오류`, statusCode, context, cause);
    }
  }

  /**
   * 검색 쿼리 유효성 검증 에러 생성
   */
  static createSearchValidationError(query: string): ValidationError {
    if (!query || query.trim() === '') {
      return new ValidationError('검색어가 비어있습니다', 'query', query);
    }
    if (query.length < 2) {
      return new ValidationError('검색어는 2글자 이상이어야 합니다', 'query', query);
    }
    if (query.length > 100) {
      return new ValidationError('검색어는 100글자를 초과할 수 없습니다', 'query', query);
    }
    return new ValidationError('검색어가 올바르지 않습니다', 'query', query);
  }

  /**
   * 파싱 실패 에러 생성
   */
  static createParseError(
    source: string,
    element?: string,
    cause?: Error
  ): ParseError {
    const message = element
      ? `${source}에서 ${element} 요소를 파싱할 수 없습니다`
      : `${source}를 파싱할 수 없습니다`;

    return new ParseError(message, source, { element }, cause);
  }
}