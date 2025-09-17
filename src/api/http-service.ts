// HTTP 요청 서비스 계층
import { requestUrl, RequestUrlParam } from 'obsidian';
import { KyobobookError, APIResponse } from '../types';
import { HTTP_HEADERS, ERROR_MESSAGES, SEARCH_LIMITS } from '../utils/constants';
import { DebugLogger } from '../utils/debug';

export class HttpService {
  private static readonly DEFAULT_TIMEOUT = SEARCH_LIMITS.REQUEST_TIMEOUT;
  private static readonly MAX_RETRIES = SEARCH_LIMITS.RETRY_ATTEMPTS;

  private static async makeRequest(url: string, options: Partial<Omit<RequestUrlParam, 'url'>> = {}): Promise<APIResponse<string>> {
    DebugLogger.log('HTTP', `요청 시작: ${url}`);

    try {
      const requestOptions: RequestUrlParam = {
        ...options,
        url,
        method: 'GET',
        headers: {
          'User-Agent': HTTP_HEADERS.USER_AGENT,
          'Accept': HTTP_HEADERS.ACCEPT,
          'Accept-Language': HTTP_HEADERS.ACCEPT_LANGUAGE,
          'Accept-Encoding': HTTP_HEADERS.ACCEPT_ENCODING,
          'Cache-Control': HTTP_HEADERS.CACHE_CONTROL,
          'Pragma': HTTP_HEADERS.PRAGMA,
          ...options.headers
        }
      };

      DebugLogger.log('HTTP', '요청 헤더', requestOptions.headers);

      const startTime = Date.now();
      const response = await requestUrl(requestOptions);
      const endTime = Date.now();

      DebugLogger.log('HTTP', `응답 받음 (${endTime - startTime}ms): ${response.status}`);
      DebugLogger.log('HTTP', '응답 헤더', response.headers);
      DebugLogger.log('HTTP', `응답 크기: ${response.text.length}자`);

      if (response.status >= 400) {
        const error = this.createError(
          `HTTP ${response.status}`,
          'HTTP_ERROR',
          response.status,
          { url, status: response.status, headers: response.headers }
        );
        DebugLogger.error('HTTP', `HTTP 에러 ${response.status}`, error);
        throw error;
      }

      DebugLogger.log('HTTP', '요청 성공 완료');
      return {
        success: true,
        data: response.text
      };
    } catch (error) {
      DebugLogger.error('HTTP', 'HTTP 요청 실패', error);

      if (error instanceof Error) {
        const errorResponse = {
          success: false,
          error: this.createError(
            error.message.includes('network') || error.message.includes('timeout')
              ? ERROR_MESSAGES.NETWORK_ERROR
              : ERROR_MESSAGES.SEARCH_FAILED,
            'REQUEST_FAILED',
            undefined,
            { originalError: error.message, url }
          )
        };

        DebugLogger.error('HTTP', '에러 응답 생성', errorResponse.error);
        return errorResponse;
      }

      const unknownError = {
        success: false,
        error: this.createError(ERROR_MESSAGES.NETWORK_ERROR, 'UNKNOWN_ERROR')
      };

      DebugLogger.error('HTTP', '알 수 없는 에러', unknownError.error);
      return unknownError;
    }
  }

  static async get(url: string, options: Partial<Omit<RequestUrlParam, 'url'>> = {}): Promise<APIResponse<string>> {
    return this.makeRequestWithRetry(url, { ...options, method: 'GET' });
  }

  private static async makeRequestWithRetry(url: string, options: Partial<Omit<RequestUrlParam, 'url'>> = {}): Promise<APIResponse<string>> {
    let lastError: KyobobookError | null = null;

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        DebugLogger.log('HTTP', `시도 ${attempt}/${this.MAX_RETRIES}: ${url}`);

        const result = await this.makeRequestWithTimeout(url, options);

        if (result.success) {
          if (attempt > 1) {
            DebugLogger.log('HTTP', `재시도 성공 (${attempt}번째 시도)`);
          }
          return result;
        }

        lastError = result.error!;

        // HTTP 4xx 에러는 재시도하지 않음
        if (lastError.statusCode && lastError.statusCode >= 400 && lastError.statusCode < 500) {
          DebugLogger.warn('HTTP', `클라이언트 에러 (${lastError.statusCode}), 재시도 중단`);
          break;
        }

        if (attempt < this.MAX_RETRIES) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // 지수 백오프, 최대 5초
          DebugLogger.log('HTTP', `재시도 대기: ${delay}ms`);
          await this.sleep(delay);
        }
      } catch (error) {
        lastError = error as KyobobookError;
        if (attempt < this.MAX_RETRIES) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          DebugLogger.warn('HTTP', `시도 ${attempt} 실패, ${delay}ms 후 재시도`);
          await this.sleep(delay);
        }
      }
    }

    DebugLogger.error('HTTP', `모든 재시도 실패 (${this.MAX_RETRIES}회 시도)`);
    return {
      success: false,
      error: lastError || this.createError(ERROR_MESSAGES.NETWORK_ERROR, 'ALL_RETRIES_FAILED')
    };
  }

  private static async makeRequestWithTimeout(url: string, options: Partial<Omit<RequestUrlParam, 'url'>> = {}): Promise<APIResponse<string>> {
    const timeout = this.DEFAULT_TIMEOUT;

    return Promise.race([
      this.makeRequest(url, options),
      this.timeoutPromise(timeout)
    ]);
  }

  private static timeoutPromise(ms: number): Promise<APIResponse<string>> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(this.createError(ERROR_MESSAGES.TIMEOUT_ERROR, 'TIMEOUT', undefined, { timeout: ms }));
      }, ms);
    });
  }

  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private static createError(
    message: string,
    code: string,
    statusCode?: number,
    details?: unknown
  ): KyobobookError {
    const error = new Error(message) as KyobobookError;
    error.code = code;
    error.statusCode = statusCode;
    error.details = details;
    return error;
  }
}