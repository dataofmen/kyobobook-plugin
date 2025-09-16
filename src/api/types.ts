// API 관련 타입 정의

export interface KyobobookSearchParams {
  keyword: string;
  target?: string;
  gbCode?: string;
  len?: number;
}

export interface ParsedBookData {
  title: string;
  authors: string;
  publisher: string;
  publishDate: string;
  pid: string;
  bid: string;
  url: string;
  coverImage: string;
}

export interface BookDetailData {
  isbn?: string;
  pages?: string;
  description?: string;
  toc?: string;
  categories?: string[];
  rating?: string;
}