
import { BookService } from './src/application/services/BookService';
import { NodeKyobobookClient } from './src/infrastructure/http/NodeKyobobookClient';
import { BookMemoryCache } from './src/infrastructure/cache/MemoryCache';
import { createDevelopmentLogger } from './src/shared/utils/Logger';
import { createNoteFromTemplate } from './src/utils/template';
import { DEFAULT_SETTINGS } from './src/settings';
import { BookInfo } from './src/types';

async function testNoteCreation() {
    const logger = createDevelopmentLogger();
    const cache = new BookMemoryCache(200, 60 * 60 * 1000, logger);
    const httpClient = new NodeKyobobookClient(logger);
    const bookService = new BookService(httpClient, logger, cache);

    const query = '생각 망치';
    console.log(`Searching for "${query}"...`);

    try {
        const searchResult = await bookService.searchBooks(query, { maxResults: 5 });

        if (searchResult.books.length === 0) {
            console.log('No books found.');
            return;
        }

        const firstBook = searchResult.books[0];
        console.log(`Found book: ${firstBook.title}`);

        console.log('Enriching book details...');
        const { book: enrichedBook } = await bookService.enrichBook(firstBook);

        console.log('Creating note...');
        
        const legacyBook: BookInfo = {
            title: enrichedBook.title,
            authors: enrichedBook.authors.join(', '),
            publisher: enrichedBook.publisher,
            publishDate: enrichedBook.publishDate || '',
            isbn: enrichedBook.isbn || '',
            pages: enrichedBook.pages?.toString() || '',
            description: enrichedBook.description || '',
            toc: enrichedBook.tableOfContents || '',
            categories: Array.from(enrichedBook.categories || []),
            rating: enrichedBook.rating?.toString() || '',
            coverImage: enrichedBook.coverImageUrl || '',
            url: enrichedBook.detailPageUrl || '',
            pid: enrichedBook.id,
            bid: enrichedBook.id
        };

        const noteContent = createNoteFromTemplate(legacyBook, DEFAULT_SETTINGS);

        console.log('\n--- Generated Note Content ---\n');
        console.log(noteContent);
        console.log('\n--- End of Note Content ---\n');

    } catch (error) {
        console.error('An error occurred during the test:', error);
    }
}

testNoteCreation();
