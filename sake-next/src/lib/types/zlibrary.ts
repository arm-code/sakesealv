export interface ZBook {
  _isUserSavedBook: boolean;
  active: number;
  author: string;
  content_type: string;
  cover: string;
  deleted: number;
  description: string;
  dl: string;
  edition: string | null;
  extension: string;
  filesize: number;
  filesizeString: string;
  hash: string;
  href: string;
  id: number;
  identifier: string;
  interestScore: string;
  kindleAvailable: boolean;
  language: string;
  md5: string;
  pages: number;
  publisher: string;
  qualityScore: string;
  readOnlineAvailable: boolean;
  readOnlineUrl: string;
  sendToEmailAvailable: boolean;
  series: string;
  sha256: string;
  terms_hash: string;
  title: string;
  volume: string;
  year: number;
}

export interface ZSearchBookResponse {
  success: number;
  books: ZBook[];
}

export interface ZBookFileResponse {
  success: number;
  file: {
    downloadLink: string;
    description: string;
    author?: string;
    extension: string;
    allowDownload: boolean;
  };
}

export interface ZLibUser {
  id: number;
  email: string;
  name: string;
  kindle_email: string;
  remix_userkey: string;
  donations_active: string | null;
  donations_expire: string | null;
  downloads_today: number;
  downloads_limit: number;
  confirmed: 0 | 1;
  isPremium: 0 | 1;
}

export interface ZLoginResponse {
  success: 1 | 0;
  user: ZLibUser;
}

export interface ZLoginRequest {
  email: string;
  password: string;
}

export interface ZTokenLoginRequest {
  userId: string;
  userKey: string;
}
