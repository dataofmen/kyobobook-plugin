import type { LogEntry, LogOutput } from '../../shared/utils/Logger';
import type { Plugin } from 'obsidian';

/**
 * Obsidian Vault 파일에 로그를 배치 기록하는 출력기
 * - flushInterval(ms)마다 버퍼를 파일에 append
 * - 파일 없으면 생성
 */
export class ObsidianFileOutput implements LogOutput {
  private plugin: Plugin;
  private filePath: string; // vault 상대 경로
  private buffer: string[] = [];
  private timer: number | null = null;
  private readonly flushInterval: number;
  private readonly maxBuffer: number;

  constructor(
    plugin: Plugin,
    filePath: string,
    options: { flushInterval?: number; maxBuffer?: number } = {}
  ) {
    this.plugin = plugin;
    this.filePath = filePath;
    this.flushInterval = options.flushInterval ?? 2000;
    this.maxBuffer = options.maxBuffer ?? 200;
    this.ensureTimer();
  }

  write(entry: LogEntry): void {
    const ts = new Date(entry.timestamp).toISOString();
    const level = entry.level;
    const line = `${ts}\t${level}\t${entry.component}\t${entry.message}` + (entry.data ? `\t${safeString(entry.data)}` : '') + (entry.error ? `\t${safeString(entry.error.message)}` : '');
    this.buffer.push(line);
    if (this.buffer.length >= this.maxBuffer) {
      void this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    const chunk = this.buffer.join('\n') + '\n';
    this.buffer.length = 0;
    const adapter = this.plugin.app.vault.adapter;
    try {
      // 파일이 존재하는지 확인
      const exists = await adapter.exists(this.filePath);
      if (!exists) {
        const folder = this.filePath.split('/').slice(0, -1).join('/');
        if (folder && !(await adapter.exists(folder))) {
          await adapter.mkdir(folder);
        }
        await adapter.write(this.filePath, chunk);
      } else {
        // append: 읽어서 이어쓰기 (append API가 없으므로 간단 append 구현)
        const prev = await adapter.read(this.filePath);
        await adapter.write(this.filePath, prev + chunk);
      }
    } catch (e) {
      // 파일 실패는 조용히 무시 (콘솔은 기존 ConsoleOutput로 커버)
      // eslint-disable-next-line no-console
      console.warn('ObsidianFileOutput flush failed', e);
    }
  }

  flushSync(): void {
    void this.flush();
  }

  clear(): void {
    this.buffer.length = 0;
  }

  flushTimer(): void {
    if (this.timer) {
      // @ts-ignore
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  private ensureTimer() {
    if (this.timer) return;
    // @ts-ignore
    this.timer = window.setInterval(() => {
      void this.flush();
    }, this.flushInterval);
  }
}

function safeString(v: any): string {
  try {
    if (typeof v === 'string') return v;
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

