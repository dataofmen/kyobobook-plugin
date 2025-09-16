// 교보문고 플러그인 타입 정의

export interface BookInfo {
  title: string;
  authors: string;
  publisher: string;
  publishDate: string;
  pid: string;
  bid?: string;
  url?: string;
  isbn?: string;
  pages?: string;
  description?: string;
  toc?: string;
  categories?: string[];
  tags?: string[];
  rating?: string;
  coverImage?: string;
}

export interface BookDetail extends BookInfo {
  isbn: string;
  pages: string;
  description: string;
  toc: string;
  categories: string[];
  tags: string[];
  rating: string;
}

export interface KyobobookPluginSettings {
  saveFolder: string;
  noteTemplate: string;
  filenameTemplate: string;
  maxSearchResults: number;
  autoCreateTags: boolean;
}

export interface SearchResult {
  books: BookInfo[];
  totalCount: number;
}