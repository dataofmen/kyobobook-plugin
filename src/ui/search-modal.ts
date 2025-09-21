import { App, SuggestModal, Notice, TFile } from 'obsidian';
import { Book } from '../domain/models/Book';
import { SearchError, NetworkError } from '../domain/models/Errors';
import { BookService, SearchResult } from '../application/services/BookService';
import { createNoteFromTemplate } from '../utils/template';
import { CSS_CLASSES } from '../shared/constants/selectors';
import { Logger } from '../shared/utils/Logger';
import KyobobookPlugin from '../main';
import { BookInfo } from '../types'; // 레거시 호환성용
import { UrlUtils } from '../shared/utils/UrlUtils';

export class KyobobookSearchModal extends SuggestModal<Book> {
  plugin: KyobobookPlugin;
  bookService: BookService;
  logger: Logger;
  books: Book[] = [];
  isLoading = false;
  searchInput!: HTMLInputElement;
  searchButton!: HTMLButtonElement;
  lastSearchResult?: SearchResult;

  constructor(
    app: App,
    plugin: KyobobookPlugin,
    bookService: BookService,
    logger: Logger
  ) {
    super(app);
    this.plugin = plugin;
    this.bookService = bookService;
    this.logger = logger;
    this.setPlaceholder('도서명이나 저자명을 입력하세요...');

    // 모달에 CSS 클래스 추가
    this.modalEl.addClass('kyobobook-search-modal');

    // 모달 제목 설정
    this.setInstructions([
      { command: '', purpose: '교보문고 도서 검색' }
    ]);

    // 커스텀 검색 UI 추가
    this.addCustomSearchUI();
  }

  private addCustomSearchUI() {
    // 기존 입력 필드 가져오기
    this.searchInput = this.inputEl;

    // 검색 버튼 컨테이너 생성
    const searchContainer = createDiv(CSS_CLASSES.SEARCH_CONTAINER);

    // 검색 버튼 생성
    this.searchButton = searchContainer.createEl('button', {
      cls: CSS_CLASSES.SEARCH_BUTTON,
      text: '검색'
    });

    // Enter 키와 검색 버튼 이벤트 연결
    this.searchButton.addEventListener('click', () => {
      this.performSearch();
    });

    this.searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && this.searchInput.value.trim().length >= 2) {
        e.preventDefault();
        this.performSearch();
      } else if (e.key === 'Escape') {
        // Escape 키로 모달 닫기 허용
        this.close();
      }
    });

    // 입력 필드 다음에 버튼 추가
    this.inputEl.parentElement?.appendChild(searchContainer);
  }

  private async performSearch() {
    const query = this.searchInput.value.trim();

    this.logger.debug('SearchModal', `검색 시작: "${query}"`);

    if (this.isLoading) {
      const message = '이미 검색 중입니다...';
      new Notice(message);
      this.logger.warn('SearchModal', message);
      return;
    }

    // 버튼 상태 변경
    this.setLoadingState(true);

    try {
      this.books = [];
      this.lastSearchResult = undefined;

      // BookService를 통한 검색
      const searchResult = await this.bookService.searchBooks(query, {
        maxResults: this.plugin.settings.maxSearchResults,
        enableDetailFetch: false, // 검색 단계에서는 기본 정보만
        cacheResults: true,
        timeout: 15000
      });

      this.lastSearchResult = searchResult;
      this.books = searchResult.books;

      // 엄격 모드: 상단 N개 상세 선조회로 썸네일/기본정보 보강
      if (this.plugin.settings.strictDetailPrefetch && !this.plugin.settings.disablePrefetch) {
        const n = Math.min(this.plugin.settings.prefetchCount ?? 8, this.books.length);
        if (n > 0) {
          await this.prefetchDetails(this.books.slice(0, n));
        }
      }

      if (this.books.length === 0) {
        const message = '검색 결과가 없습니다.';
        new Notice(message);
        this.logger.warn('SearchModal', message);

        // 디버그 모드일 때 추가 안내
        if (this.plugin.settings.debugMode) {
          new Notice('디버그 모드: 콘솔 로그를 확인하세요.', 5000);
        }
      } else {
        const message = `${this.books.length}개의 도서를 찾았습니다 (${searchResult.searchTime}ms)`;
        new Notice(message);
        this.logger.info('SearchModal', message, {
          query,
          resultCount: this.books.length,
          searchTime: searchResult.searchTime
        });
      }

      // 검색 결과 강제 업데이트
      this.updateSearchResults();

    } catch (error) {
      this.handleSearchError(error as Error);
    } finally {
      this.setLoadingState(false);
    }
  }

  getSuggestions(_query: string): Book[] | Promise<Book[]> {
    // 검색 결과가 있으면 모든 결과 반환 (필터링하지 않음)
    if (this.books.length > 0) {
      return this.books;
    }

    // 검색 결과가 없으면 빈 배열 반환 (수동 검색 유도)
    return [];
  }

  private handleSearchError(error: Error): void {
    let userMessage: string;
    let logLevel: 'warn' | 'error' = 'error';

    if (error instanceof SearchError) {
      userMessage = error.getUserMessage();
      logLevel = 'warn';
    } else if (error instanceof NetworkError) {
      userMessage = '네트워크 연결을 확인해주세요.';
    } else {
      userMessage = `검색 중 오류가 발생했습니다: ${error.message}`;
    }

    new Notice(userMessage);
    this.logger[logLevel]('SearchModal', '검색 오류', { error });

    // 디버그 모드일 때 상세 에러 정보 표시
    if (this.plugin.settings.debugMode) {
      new Notice('디버그 모드: 개발자 도구 콘솔에서 상세 에러 정보를 확인하세요.', 5000);
    }
  }

  private setLoadingState(loading: boolean): void {
    this.isLoading = loading;
    this.searchButton.disabled = loading;
    this.searchButton.textContent = loading ? '검색 중...' : '검색';
  }

  private updateSearchResults(): void {
    // 검색 결과 강제 업데이트 - 입력 이벤트 직접 발생
    const inputEvent = new InputEvent('input', {
      bubbles: true,
      cancelable: true,
    });
    this.inputEl.dispatchEvent(inputEvent);
  }

  renderSuggestion(book: Book, el: HTMLElement) {
    el.empty();
    el.addClass(CSS_CLASSES.SUGGESTION_ITEM);

    this.logger.debug('SearchModal', `검색 결과 렌더링: "${book.title}"`);

    // 표지 이미지
    const coverImg = el.createEl('img', { cls: CSS_CLASSES.BOOK_COVER });
    const chooseCoverUrl = (): string | undefined => {
      const barcode = (book.isbn || '').replace(/[^0-9]/g, '');
      const hasBarcode = /^\d{12,13}$/.test(barcode);
      const numericId = book.id.replace(/^S/, '');
      const staticUrl = hasBarcode
        ? UrlUtils.buildCoverImageUrl(barcode, 'medium')
        : (/\d{6,}/.test(numericId) ? UrlUtils.buildCoverImageUrl(book.id, 'medium') : undefined);
      if (this.plugin.settings.enforceStaticCover) return staticUrl;
      return book.coverImageUrl || staticUrl;
    };
    const tryLoadCover = (url?: string) => {
      if (!url) {
        this.showImagePlaceholder(el, coverImg);
        return;
      }
      coverImg.src = url;
      coverImg.alt = book.title;
    };
    let attemptedDetailFetch = false;
    coverImg.onload = () => {
      this.logger.debug('SearchModal', `커버 이미지 로드 성공: ${book.title}`);
    };
    coverImg.onerror = async () => {
      this.logger.warn('SearchModal', `커버 이미지 로드 실패: ${coverImg.src}`);
      if (!attemptedDetailFetch) {
        attemptedDetailFetch = true;
        try {
          const detail = await this.bookService.getBookDetail(book.id, 8000, { tocApiFirst: this.plugin.settings.tocApiFirst });
          if (detail.book.coverImageUrl && detail.book.coverImageUrl !== coverImg.src) {
            this.logger.debug('SearchModal', '상세정보 기반 커버 재시도');
            tryLoadCover(detail.book.coverImageUrl);
            return;
          }
        } catch (e) {
          this.logger.warn('SearchModal', '상세정보 기반 커버 보강 실패', { error: e });
        }
      }
      this.showImagePlaceholder(el, coverImg);
    };
    const initialCover = chooseCoverUrl();
    if (initialCover) {
      tryLoadCover(initialCover);
    } else {
      // 초기에 썸네일이 없으면 상세 정보로 보강 시도
      (async () => {
        try {
          const detail = await this.bookService.getBookDetail(book.id, 8000, { tocApiFirst: this.plugin.settings.tocApiFirst });
          tryLoadCover(detail.book.coverImageUrl || initialCover);
        } catch {
          this.showImagePlaceholder(el, coverImg);
        }
      })();
    }

    // 도서 정보 컨테이너
    const bookInfo = el.createDiv(CSS_CLASSES.BOOK_INFO);

    // 제목 (필수)
    const titleEl = bookInfo.createDiv(CSS_CLASSES.BOOK_TITLE);
    titleEl.textContent = book.title;

    // 저자
    if (book.authors && book.authors.length > 0) {
      const authorEl = bookInfo.createDiv(CSS_CLASSES.BOOK_AUTHOR);
      authorEl.textContent = `저자: ${book.authors.join(', ')}`;
    }

    // 출판사 정보는 검색 목록에서 노출하지 않음

    // 출판일
    if (book.publishDate) {
      const dateEl = bookInfo.createDiv(CSS_CLASSES.BOOK_DATE);
      dateEl.textContent = `출간: ${book.publishDate}`;
    }

    // 디버그 정보 (디버그 모드일 때만)
    if (this.plugin.settings.debugMode) {
      const debugEl = bookInfo.createDiv(CSS_CLASSES.BOOK_DEBUG);
      debugEl.style.fontSize = '10px';
      debugEl.style.color = '#888';
      debugEl.textContent = `ID: ${book.id}`;
    }

    // 상세 페이지 링크
    if (book.detailPageUrl) {
      const linkEl = bookInfo.createEl('a', {
        cls: CSS_CLASSES.BOOK_LINK,
        href: book.detailPageUrl,
        text: '교보문고에서 보기'
      });
      linkEl.setAttribute('target', '_blank');
      linkEl.addEventListener('click', (e) => {
        e.stopPropagation();
        this.logger.debug('SearchModal', `외부 링크 클릭: ${book.detailPageUrl}`);
      });
    }

    this.logger.debug('SearchModal', `검색 결과 렌더링 완료: "${book.title}"`);
  }

  private showImagePlaceholder(el: HTMLElement, coverImg: HTMLImageElement): void {
    coverImg.style.display = 'none';
    const placeholder = el.createDiv(CSS_CLASSES.BOOK_COVER_PLACEHOLDER);
    placeholder.textContent = '📖';
    placeholder.title = '표지 이미지 없음';
    el.insertBefore(placeholder, el.firstChild);
  }

  async onChooseSuggestion(book: Book) {
    new Notice(`"${book.title}" 선택됨. 상세 정보를 가져오는 중...`);

    try {
      // BookService를 통한 상세 정보 가져오기
      const detailResult = await this.bookService.enrichBook(book, 15000, { tocApiFirst: this.plugin.settings.tocApiFirst });
      const enrichedBook = detailResult.book;

      this.logger.info('SearchModal',
        `상세 정보 조회 완료: ${enrichedBook.title} (${detailResult.fetchTime}ms)`);

      // 노트 생성
      const noteFile = await this.createBookNote(enrichedBook);

      if (noteFile) {
        // 생성된 노트 열기
        await this.app.workspace.getLeaf().openFile(noteFile);
        new Notice(`"${enrichedBook.title}" 노트가 생성되었습니다.`);

        this.logger.info('SearchModal', `노트 생성 완료: ${noteFile.path}`);
      }
    } catch (error) {
      this.handleNoteCreationError(error as Error, book.title);
    }
  }

  private handleNoteCreationError(error: Error, bookTitle: string): void {
    let userMessage: string;

    if (error instanceof NetworkError) {
      userMessage = '네트워크 연결을 확인하고 다시 시도해주세요.';
    } else {
      userMessage = `노트 생성 중 오류가 발생했습니다: ${error.message}`;
    }

    new Notice(userMessage);
    this.logger.error('SearchModal', '노트 생성 오류', { bookTitle, error });
  }

  private async createBookNote(book: Book): Promise<TFile | null> {
    try {
      const barcode = (book.isbn || '').replace(/[^0-9]/g, '');
      const hasBarcode = /^\d{12,13}$/.test(barcode);
      const numericId = book.id.replace(/^S/, '');
      let coverForNote = this.plugin.settings.enforceStaticCover
        ? (hasBarcode ? UrlUtils.buildCoverImageUrl(barcode, 'large') : (/\d{6,}/.test(numericId) ? UrlUtils.buildCoverImageUrl(book.id, 'large') : (book.coverImageUrl || '')))
        : (book.coverImageUrl || (hasBarcode ? UrlUtils.buildCoverImageUrl(barcode, 'large') : (/\d{6,}/.test(numericId) ? UrlUtils.buildCoverImageUrl(book.id, 'large') : '')));
      if (this.plugin.settings.embedCoverInNote && coverForNote) {
        try {
          const dataUrl = await this.bookService.fetchImageAsDataUrl(coverForNote);
          if (dataUrl) coverForNote = dataUrl;
        } catch {}
      }
      // Book 객체를 레거시 BookInfo 형식으로 변환 (템플릿 호환성용)
      const legacyBook: BookInfo = {
        title: book.title,
        authors: book.authors.join(', '),
        publisher: book.publisher,
        publishDate: book.publishDate || '',
        isbn: book.isbn || '',
        pages: book.pages?.toString() || '',
        description: book.description || '',
        toc: book.tableOfContents || '',
        categories: Array.from(book.categories || []),
        rating: book.rating?.toString() || '',
        coverImage: coverForNote || '',
        url: book.detailPageUrl || '',
        pid: book.id,
        bid: book.id
      };

      const noteContent = createNoteFromTemplate(legacyBook, this.plugin.settings);
      const fileName = this.generateFileName(book);
      const folderPath = this.plugin.settings.saveFolder;

      // 폴더가 존재하지 않으면 생성
      if (folderPath && !this.app.vault.getAbstractFileByPath(folderPath)) {
        await this.app.vault.createFolder(folderPath);
      }

      const filePath = folderPath ? `${folderPath}/${fileName}.md` : `${fileName}.md`;

      // 같은 이름의 파일이 있는지 확인
      let finalPath = filePath;
      let counter = 1;
      while (this.app.vault.getAbstractFileByPath(finalPath)) {
        const name = fileName + ` (${counter})`;
        finalPath = folderPath ? `${folderPath}/${name}.md` : `${name}.md`;
        counter++;
      }

      return await this.app.vault.create(finalPath, noteContent);
    } catch (error) {
      this.logger.error('SearchModal', '노트 생성 중 오류', { error });
      throw error;
    }
  }

  // 상세 선조회(엄격 모드): 병렬 제한 없이 순차로 n개 보강 (과한 트래픽 방지)
  private async prefetchDetails(items: Book[]): Promise<void> {
    const concurrency = 2;
    let index = 0;
    const worker = async () => {
      while (index < items.length) {
        const i = index++;
        const b = items[i];
        try {
          const detail = await this.bookService.getBookDetail(b.id, 12000, { tocApiFirst: this.plugin.settings.tocApiFirst });
          items[i] = detail.book;
          const idx = this.books.findIndex(x => x.id === b.id);
          if (idx >= 0) this.books[idx] = detail.book;
        } catch (e) {
          this.logger.warn('SearchModal', '선조회 실패', { id: b.id, error: e });
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  }

  private generateFileName(book: Book): string {
    // 요청에 따라 파일명은 항상 도서명만 사용
    return book.title.replace(/[\\/:*?"<>|]/g, '_').trim();
  }

  onClose() {
    this.books = [];
    this.lastSearchResult = undefined;
    this.isLoading = false;
    this.logger.debug('SearchModal', '검색 모달 닫힘');
  }
}
