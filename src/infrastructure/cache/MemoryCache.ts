// LRU 메모리 캐시 구현

import { Book } from '../../domain/models/Book';
import { BookCache } from '../../application/services/BookService';
import { Logger } from '../../shared/utils/Logger';

/**
 * 캐시 엔트리 인터페이스
 */
interface CacheEntry<T> {
  value: T;
  timestamp: number;
  lastAccess: number;
  accessCount: number;
}

/**
 * 캐시 통계 정보
 */
export interface CacheStats {
  size: number;
  maxSize: number;
  hitCount: number;
  missCount: number;
  hitRate: number;
  evictionCount: number;
  oldestEntry: number;
  newestEntry: number;
}

/**
 * LRU (Least Recently Used) 메모리 캐시
 *
 * 특징:
 * - 크기 제한 기반 자동 정리
 * - TTL (Time To Live) 지원
 * - 접근 빈도 기반 우선순위
 * - 통계 정보 제공
 * - 타입 안전성
 */
export class MemoryCache<T = any> {
  private readonly cache = new Map<string, CacheEntry<T>>();
  private readonly maxSize: number;
  private readonly ttl: number; // milliseconds
  private readonly logger?: Logger;

  // 통계
  private hitCount = 0;
  private missCount = 0;
  private evictionCount = 0;

  constructor(
    maxSize = 100,
    ttl = 30 * 60 * 1000, // 30분
    logger?: Logger
  ) {
    this.maxSize = maxSize;
    this.ttl = ttl;
    this.logger = logger;

    // 주기적 정리 (5분마다)
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * 값 가져오기
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      this.missCount++;
      this.logger?.debug('MemoryCache', `캐시 미스: ${key}`);
      return undefined;
    }

    // TTL 확인
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.missCount++;
      this.logger?.debug('MemoryCache', `캐시 만료: ${key}`);
      return undefined;
    }

    // 접근 정보 업데이트
    entry.lastAccess = Date.now();
    entry.accessCount++;

    this.hitCount++;
    this.logger?.debug('MemoryCache', `캐시 히트: ${key}`);
    return entry.value;
  }

  /**
   * 값 저장
   */
  set(key: string, value: T): void {
    const now = Date.now();

    // 기존 엔트리 업데이트
    if (this.cache.has(key)) {
      const entry = this.cache.get(key)!;
      entry.value = value;
      entry.timestamp = now;
      entry.lastAccess = now;
      this.logger?.debug('MemoryCache', `캐시 업데이트: ${key}`);
      return;
    }

    // 크기 제한 확인 및 정리
    if (this.cache.size >= this.maxSize) {
      this.evictLeastRecentlyUsed();
    }

    // 새 엔트리 추가
    const entry: CacheEntry<T> = {
      value,
      timestamp: now,
      lastAccess: now,
      accessCount: 1
    };

    this.cache.set(key, entry);
    this.logger?.debug('MemoryCache', `캐시 저장: ${key}`);
  }

  /**
   * 값 존재 확인
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * 값 삭제
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.logger?.debug('MemoryCache', `캐시 삭제: ${key}`);
    }
    return deleted;
  }

  /**
   * 모든 값 삭제
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.resetStats();
    this.logger?.info('MemoryCache', `캐시 전체 삭제 (${size}개 항목)`);
  }

  /**
   * 캐시 크기
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * 모든 키 반환
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * 모든 값 반환
   */
  values(): T[] {
    return Array.from(this.cache.values()).map(entry => entry.value);
  }

  /**
   * 통계 정보 반환
   */
  getStats(): CacheStats {
    const entries = Array.from(this.cache.values());
    const timestamps = entries.map(e => e.timestamp);

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRate: this.hitCount + this.missCount > 0
        ? this.hitCount / (this.hitCount + this.missCount)
        : 0,
      evictionCount: this.evictionCount,
      oldestEntry: timestamps.length > 0 ? Math.min(...timestamps) : 0,
      newestEntry: timestamps.length > 0 ? Math.max(...timestamps) : 0
    };
  }

  /**
   * 만료된 엔트리 정리
   */
  cleanup(): void {
    const before = this.cache.size;
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        this.cache.delete(key);
      }
    }

    const removed = before - this.cache.size;
    if (removed > 0) {
      this.logger?.debug('MemoryCache', `정기 정리: ${removed}개 항목 제거`);
    }
  }

  // === Private Methods ===

  /**
   * 엔트리 만료 확인
   */
  private isExpired(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.timestamp > this.ttl;
  }

  /**
   * LRU 알고리즘으로 엔트리 제거
   */
  private evictLeastRecentlyUsed(): void {
    let lruKey = '';
    let lruTime = Date.now();

    // 가장 적게 최근에 접근된 항목 찾기
    for (const [key, entry] of this.cache.entries()) {
      const score = this.calculateEvictionScore(entry);
      if (score < lruTime) {
        lruTime = score;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
      this.evictionCount++;
      this.logger?.debug('MemoryCache', `LRU 제거: ${lruKey}`);
    }
  }

  /**
   * 제거 우선순위 계산
   * (최근 접근 시간과 접근 빈도를 고려)
   */
  private calculateEvictionScore(entry: CacheEntry<T>): number {
    const now = Date.now();
    const timeSinceLastAccess = now - entry.lastAccess;
    const accessFrequency = entry.accessCount;

    // 시간 가중치 70%, 빈도 가중치 30%
    return (timeSinceLastAccess * 0.7) - (accessFrequency * 1000 * 0.3);
  }

  /**
   * 통계 초기화
   */
  private resetStats(): void {
    this.hitCount = 0;
    this.missCount = 0;
    this.evictionCount = 0;
  }
}

/**
 * Book 전용 캐시 (BookCache 인터페이스 구현)
 */
export class BookMemoryCache extends MemoryCache<Book> implements BookCache {
  constructor(
    maxSize = 200,
    ttl = 60 * 60 * 1000, // 1시간
    logger?: Logger
  ) {
    super(maxSize, ttl, logger);
  }

  /**
   * Book ID로 검색 결과 캐시 키 생성
   */
  static buildSearchCacheKey(
    query: string,
    maxResults: number,
    enableDetailFetch: boolean
  ): string {
    const key = {
      query: query.trim().toLowerCase(),
      maxResults,
      enableDetailFetch
    };
    return `search:${Buffer.from(JSON.stringify(key)).toString('base64')}`;
  }

  /**
   * Book ID로 상세 정보 캐시 키 생성
   */
  static buildDetailCacheKey(bookId: string): string {
    return `detail:${bookId}`;
  }

  /**
   * 검색 결과 캐시
   */
  cacheSearchResult(
    query: string,
    maxResults: number,
    enableDetailFetch: boolean,
    books: Book[]
  ): void {
    const cacheKey = BookMemoryCache.buildSearchCacheKey(query, maxResults, enableDetailFetch);

    // 검색 결과 자체는 별도로 저장하지 않고, 개별 Book 들만 저장
    // (BookService에서 검색 결과 전체 캐싱은 복잡하므로 단순화)
    books.forEach(book => {
      const detailKey = BookMemoryCache.buildDetailCacheKey(book.id);
      this.set(detailKey, book);
    });
  }

  /**
   * 상세 정보 캐시
   */
  cacheBookDetail(bookId: string, book: Book): void {
    const cacheKey = BookMemoryCache.buildDetailCacheKey(bookId);
    this.set(cacheKey, book);
  }

  /**
   * 상세 정보 조회
   */
  getBookDetail(bookId: string): Book | undefined {
    const cacheKey = BookMemoryCache.buildDetailCacheKey(bookId);
    return this.get(cacheKey);
  }

  /**
   * 관련 캐시 항목들 삭제
   */
  invalidateBook(bookId: string): void {
    const detailKey = BookMemoryCache.buildDetailCacheKey(bookId);
    this.delete(detailKey);

    // 검색 결과에서도 제거하려면 모든 검색 캐시를 순회해야 하지만
    // 복잡성을 피하기 위해 TTL로 자연 만료되도록 함
  }
}