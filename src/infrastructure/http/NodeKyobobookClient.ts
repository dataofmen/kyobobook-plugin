
import * as https from 'https';
import { HttpClient } from '../../application/services/BookService';
import { Logger } from '../../shared/utils/Logger';
import { NetworkError } from '../../domain/models/Errors';

export class NodeKyobobookClient implements HttpClient {
    private readonly logger: Logger;

    constructor(logger: Logger) {
        this.logger = logger;
    }

    async get(url: string, options: { timeout?: number } = {}): Promise<string> {
        this.logger.debug('NodeKyobobookClient', `GET request to ${url}`);
        return new Promise((resolve, reject) => {
            const request = https.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                },
                timeout: options.timeout,
            }, (res) => {
                // Follow redirects
                if (res.statusCode === 301 || res.statusCode === 302) {
                    if (res.headers.location) {
                        this.get(res.headers.location, options).then(resolve, reject);
                        return;
                    }
                }

                let data = '';
                res.setEncoding('utf8');
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
                        reject(new NetworkError(`HTTP error! status: ${res.statusCode}`, res.statusCode));
                    } else {
                        resolve(data);
                    }
                });
            });

            request.on('error', (e) => {
                this.logger.error('NodeKyobobookClient', 'Request failed', { error: e });
                reject(new NetworkError('Request failed', undefined, undefined, e));
            });

            request.on('timeout', () => {
                request.destroy();
                reject(new NetworkError('Request timed out'));
            });
        });
    }

    async getDataUrl(url: string, options: { timeout?: number } = {}): Promise<string> {
        this.logger.debug('NodeKyobobookClient', `getDataUrl for ${url}`);
        return new Promise((resolve, reject) => {
            const request = https.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                },
                timeout: options.timeout,
            }, (res) => {
                // Follow redirects
                if (res.statusCode === 301 || res.statusCode === 302) {
                    if (res.headers.location) {
                        this.getDataUrl(res.headers.location, options).then(resolve, reject);
                        return;
                    }
                }

                const chunks: Buffer[] = [];
                res.on('data', (chunk) => {
                    chunks.push(chunk as Buffer);
                });
                res.on('end', () => {
                    if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
                        reject(new NetworkError(`HTTP error! status: ${res.statusCode}`, res.statusCode));
                    } else {
                        const buffer = Buffer.concat(chunks);
                        const contentType = res.headers['content-type'] || 'image/jpeg';
                        resolve(`data:${contentType};base64,${buffer.toString('base64')}`);
                    }
                });
            });

            request.on('error', (e) => {
                this.logger.error('NodeKyobobookClient', 'getDataUrl failed', { error: e });
                reject(new NetworkError('getDataUrl failed', undefined, undefined, e));
            });

            request.on('timeout', () => {
                request.destroy();
                reject(new NetworkError('Request timed out'));
            });
        });
    }
}
