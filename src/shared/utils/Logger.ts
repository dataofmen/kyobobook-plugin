// 통합 로깅 시스템

/**
 * 로그 레벨 열거형
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4
}

/**
 * 로그 엔트리 인터페이스
 */
export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  component: string;
  message: string;
  data?: any;
  error?: Error;
}

/**
 * 로그 출력 인터페이스
 */
export interface LogOutput {
  write(entry: LogEntry): void;
  flush?(): void;
}

/**
 * 콘솔 출력 구현
 */
export class ConsoleOutput implements LogOutput {
  write(entry: LogEntry): void {
    const timestamp = new Date(entry.timestamp).toISOString();
    const levelName = LogLevel[entry.level];
    const prefix = `[${timestamp}] [${levelName}] [${entry.component}]`;

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(prefix, entry.message, entry.data || '');
        break;
      case LogLevel.INFO:
        console.info(prefix, entry.message, entry.data || '');
        break;
      case LogLevel.WARN:
        console.warn(prefix, entry.message, entry.data || '', entry.error || '');
        break;
      case LogLevel.ERROR:
        console.error(prefix, entry.message, entry.data || '', entry.error || '');
        break;
    }
  }
}

/**
 * 메모리 버퍼 출력 구현
 */
export class MemoryOutput implements LogOutput {
  private entries: LogEntry[] = [];
  private readonly maxEntries: number;

  constructor(maxEntries = 1000) {
    this.maxEntries = maxEntries;
  }

  write(entry: LogEntry): void {
    this.entries.push(entry);

    // 크기 제한
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }
  }

  getEntries(): LogEntry[] {
    return [...this.entries];
  }

  getEntriesByLevel(level: LogLevel): LogEntry[] {
    return this.entries.filter(entry => entry.level === level);
  }

  getEntriesByComponent(component: string): LogEntry[] {
    return this.entries.filter(entry => entry.component === component);
  }

  clear(): void {
    this.entries = [];
  }

  flush(): void {
    this.clear();
  }
}

/**
 * 통합 로거 클래스
 *
 * 특징:
 * - 의존성 주입 패턴으로 출력 방식 설정 가능
 * - 컴포넌트별 로그 레벨 설정
 * - 메모리 버퍼링 및 필터링 지원
 * - 디버그 모드와 프로덕션 모드 구분
 */
export class Logger {
  private readonly outputs: LogOutput[] = [];
  private globalLogLevel: LogLevel = LogLevel.INFO;
  private componentLogLevels: Map<string, LogLevel> = new Map();

  constructor(outputs: LogOutput[] = [new ConsoleOutput()]) {
    this.outputs = outputs;
  }

  /**
   * 글로벌 로그 레벨 설정
   */
  setLogLevel(level: LogLevel): void {
    this.globalLogLevel = level;
  }

  /**
   * 컴포넌트별 로그 레벨 설정
   */
  setComponentLogLevel(component: string, level: LogLevel): void {
    this.componentLogLevels.set(component, level);
  }

  /**
   * 출력 추가
   */
  addOutput(output: LogOutput): void {
    this.outputs.push(output);
  }

  /**
   * 모든 출력 제거
   */
  clearOutputs(): void {
    this.outputs.forEach(output => output.flush?.());
    this.outputs.length = 0;
  }

  /**
   * DEBUG 레벨 로그
   */
  debug(component: string, message: string, data?: any): void {
    this.log(LogLevel.DEBUG, component, message, data);
  }

  /**
   * INFO 레벨 로그
   */
  info(component: string, message: string, data?: any): void {
    this.log(LogLevel.INFO, component, message, data);
  }

  /**
   * WARN 레벨 로그
   */
  warn(component: string, message: string, data?: any, error?: Error): void {
    this.log(LogLevel.WARN, component, message, data, error);
  }

  /**
   * ERROR 레벨 로그
   */
  error(component: string, message: string, data?: any, error?: Error): void {
    this.log(LogLevel.ERROR, component, message, data, error);
  }

  /**
   * 조건부 로그 (디버그 모드에서만)
   */
  debugIf(condition: boolean, component: string, message: string, data?: any): void {
    if (condition) {
      this.debug(component, message, data);
    }
  }

  /**
   * 성능 측정 시작
   */
  startTimer(component: string, operation: string): () => void {
    const startTime = Date.now();
    this.debug(component, `${operation} 시작`);

    return () => {
      const duration = Date.now() - startTime;
      this.debug(component, `${operation} 완료 (${duration}ms)`);
    };
  }

  /**
   * 그룹 로그 시작
   */
  group(component: string, title: string): LogGroup {
    this.info(component, `=== ${title} ===`);
    return new LogGroup(this, component, title);
  }

  // === Private Methods ===

  /**
   * 실제 로그 출력
   */
  private log(
    level: LogLevel,
    component: string,
    message: string,
    data?: any,
    error?: Error
  ): void {
    // 로그 레벨 확인
    const effectiveLevel = this.componentLogLevels.get(component) || this.globalLogLevel;
    if (level < effectiveLevel) {
      return;
    }

    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      component,
      message,
      data,
      error
    };

    // 모든 출력에 기록
    this.outputs.forEach(output => {
      try {
        output.write(entry);
      } catch (outputError) {
        // 출력 오류는 무시 (무한 루프 방지)
        console.error('Logger output error:', outputError);
      }
    });
  }
}

/**
 * 로그 그룹 클래스 (중첩된 로그를 위한 헬퍼)
 */
export class LogGroup {
  private readonly logger: Logger;
  private readonly component: string;
  private readonly title: string;
  private readonly startTime: number;

  constructor(logger: Logger, component: string, title: string) {
    this.logger = logger;
    this.component = component;
    this.title = title;
    this.startTime = Date.now();
  }

  debug(message: string, data?: any): void {
    this.logger.debug(this.component, `  ${message}`, data);
  }

  info(message: string, data?: any): void {
    this.logger.info(this.component, `  ${message}`, data);
  }

  warn(message: string, data?: any, error?: Error): void {
    this.logger.warn(this.component, `  ${message}`, data, error);
  }

  error(message: string, data?: any, error?: Error): void {
    this.logger.error(this.component, `  ${message}`, data, error);
  }

  end(): void {
    const duration = Date.now() - this.startTime;
    this.logger.info(this.component, `=== ${this.title} 완료 (${duration}ms) ===`);
  }
}

/**
 * 기본 로거 인스턴스 (싱글톤 패턴)
 */
let defaultLogger: Logger | undefined;

/**
 * 기본 로거 가져오기
 */
export function getDefaultLogger(): Logger {
  if (!defaultLogger) {
    defaultLogger = new Logger([
      new ConsoleOutput(),
      new MemoryOutput(500)
    ]);
  }
  return defaultLogger;
}

/**
 * 기본 로거 설정
 */
export function setDefaultLogger(logger: Logger): void {
  defaultLogger = logger;
}

/**
 * 개발 모드 로거 설정
 */
export function createDevelopmentLogger(): Logger {
  const logger = new Logger([
    new ConsoleOutput(),
    new MemoryOutput(1000)
  ]);

  logger.setLogLevel(LogLevel.DEBUG);
  logger.setComponentLogLevel('BookService', LogLevel.DEBUG);
  logger.setComponentLogLevel('SearchResultParser', LogLevel.DEBUG);
  logger.setComponentLogLevel('BookDetailParser', LogLevel.DEBUG);

  return logger;
}

/**
 * 프로덕션 모드 로거 설정
 */
export function createProductionLogger(): Logger {
  const logger = new Logger([
    new ConsoleOutput(),
    new MemoryOutput(100)
  ]);

  logger.setLogLevel(LogLevel.WARN);

  return logger;
}