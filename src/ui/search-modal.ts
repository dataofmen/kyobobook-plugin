import { App, SuggestModal, Notice, TFile } from 'obsidian';
import { BookInfo } from '../types';
import { KyobobookAPI } from '../api/kyobobook-api';
import { createNoteFromTemplate } from '../utils/template';
import KyobobookPlugin from '../main';

export class KyobobookSearchModal extends SuggestModal<BookInfo> {
  plugin: KyobobookPlugin;
  books: BookInfo[] = [];
  isLoading = false;

  constructor(app: App, plugin: KyobobookPlugin) {
    super(app);
    this.plugin = plugin;
    this.setPlaceholder('도서명이나 저자명을 입력하세요...');

    // 모달에 CSS 클래스 추가
    this.modalEl.addClass('kyobobook-search-modal');
  }

  getSuggestions(query: string): BookInfo[] | Promise<BookInfo[]> {
    if (!query || query.length < 2) {
      return [];
    }

    // 기존 검색 결과에서 필터링
    if (this.books.length > 0) {
      return this.books.filter((book) =>
        book.title.toLowerCase().includes(query.toLowerCase()) ||
        book.authors.toLowerCase().includes(query.toLowerCase()) ||
        book.publisher.toLowerCase().includes(query.toLowerCase())
      );
    }

    // 새로운 검색 수행
    return this.searchBooks(query);
  }

  private async searchBooks(query: string): Promise<BookInfo[]> {
    if (this.isLoading) {
      return this.books;
    }

    this.isLoading = true;

    try {
      const result = await KyobobookAPI.searchBooks(query, this.plugin.settings.maxSearchResults);
      this.books = result.books;
      return this.books;
    } catch (error) {
      new Notice(`검색 오류: ${(error as Error).message}`);
      console.error('검색 오류:', error);
      return [];
    } finally {
      this.isLoading = false;
    }
  }

  renderSuggestion(book: BookInfo, el: HTMLElement) {
    el.empty();
    el.addClass('kyobobook-suggestion-item');

    // 표지 이미지
    const coverImg = el.createEl('img', {
      cls: 'book-cover'
    });

    if (book.coverImage) {
      coverImg.src = book.coverImage;
      coverImg.alt = book.title;

      // 이미지 로드 실패 시 기본 이미지 표시
      coverImg.onerror = () => {
        coverImg.style.display = 'none';
      };
    } else {
      coverImg.style.display = 'none';
    }

    // 도서 정보 컨테이너
    const bookInfo = el.createDiv('book-info');

    // 제목
    const titleEl = bookInfo.createDiv('book-title');
    titleEl.textContent = book.title;

    // 저자
    if (book.authors) {
      const authorEl = bookInfo.createDiv('book-author');
      authorEl.textContent = `저자: ${book.authors}`;
    }

    // 출판사
    if (book.publisher) {
      const publisherEl = bookInfo.createDiv('book-publisher');
      publisherEl.textContent = `출판사: ${book.publisher}`;
    }

    // 출판일
    if (book.publishDate) {
      const dateEl = bookInfo.createDiv('book-date');
      dateEl.textContent = `출판일: ${book.publishDate}`;
    }

    // 상세 페이지 링크
    if (book.url) {
      const linkEl = bookInfo.createEl('a', {
        cls: 'book-link',
        href: book.url,
        text: '교보문고에서 보기'
      });
      linkEl.setAttribute('target', '_blank');
      linkEl.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }
  }

  async onChooseSuggestion(book: BookInfo, evt: MouseEvent | KeyboardEvent) {
    new Notice(`"${book.title}" 선택됨. 상세 정보를 가져오는 중...`);

    try {
      // 상세 정보 가져오기
      const detailedBook = await KyobobookAPI.getBookDetail(book);

      // 노트 생성
      const noteFile = await this.createBookNote(detailedBook);

      if (noteFile) {
        // 생성된 노트 열기
        await this.app.workspace.getLeaf().openFile(noteFile);
        new Notice(`"${book.title}" 노트가 생성되었습니다.`);
      }
    } catch (error) {
      new Notice(`노트 생성 중 오류가 발생했습니다: ${(error as Error).message}`);
      console.error('노트 생성 오류:', error);
    }
  }

  private async createBookNote(book: BookInfo): Promise<TFile | null> {
    try {
      const noteContent = createNoteFromTemplate(book, this.plugin.settings);
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
      console.error('노트 생성 중 오류:', error);
      throw error;
    }
  }

  private generateFileName(book: BookInfo): string {
    let template = this.plugin.settings.filenameTemplate;

    // 템플릿 변수 치환
    template = template.replace(/{{title}}/g, book.title || '제목없음');
    template = template.replace(/{{authors}}/g, book.authors || '저자미상');
    template = template.replace(/{{publisher}}/g, book.publisher || '');
    template = template.replace(/{{publishDate}}/g, book.publishDate || '');

    // 파일명에 사용할 수 없는 문자 제거
    return template.replace(/[\\/:*?"<>|]/g, '_').trim();
  }

  onClose() {
    this.books = [];
    this.isLoading = false;
  }
}