# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a Korean Kyobobook plugin for Obsidian that allows users to search books from Kyobobook bookstore and automatically create structured notes with book information.

## Development Commands

```bash
# Install dependencies
npm install

# Development mode with file watching and auto-rebuild
npm run dev

# Production build with type checking
npm run build

# Type checking only
tsc -noEmit -skipLibCheck

# Version bump (updates manifest.json and versions.json)
npm run version
```

## Architecture Overview

### Core Plugin Architecture
- **Entry Point**: `src/main.ts` - KyobobookPlugin class manages plugin lifecycle, command registration, and settings
- **API Layer**: `src/api/kyobobook-api.ts` - Handles web scraping of Kyobobook search results and book details
- **UI Components**:
  - `src/ui/search-modal.ts` - Modal for book search interface
  - `src/ui/settings-tab.ts` - Plugin settings configuration tab
- **Template System**: `src/utils/template.ts` - Handlebars-based note generation from book data
- **Data Parsing**: `src/utils/parser.ts` - HTML parsing utilities for extracting book details

### Key Data Flow
1. User triggers search command → Opens search modal
2. Search modal calls KyobobookAPI.searchBooks() → Scrapes Kyobobook search page
3. User selects book → Calls KyobobookAPI.getBookDetail() → Scrapes detailed book page
4. Template system processes book data → Creates structured Obsidian note
5. Note saved to configured folder with customizable filename format

### API Strategy
- **Web Scraping**: Uses Obsidian's requestUrl() to fetch Kyobobook pages
- **Robust Parsing**: Multiple fallback selectors to handle HTML structure changes
- **Error Handling**: Graceful degradation when detailed information unavailable
- **Rate Limiting**: Single request per user action to respect Kyobobook servers

### Settings System
- **Template Customization**: Users can modify note templates with Handlebars variables
- **Folder Organization**: Configurable save location and filename patterns
- **Tag Management**: Automatic tag generation from book categories
- **Search Limits**: Configurable maximum search results

## Build System

- **Bundler**: esbuild configured to bundle TypeScript to single `main.js`
- **Target**: ES2018 for Obsidian compatibility
- **Externals**: Obsidian API and CodeMirror modules excluded from bundle
- **Output**: Production build creates `main.js` at project root for Obsidian plugin installation

## Plugin Installation

Copy these files to `.obsidian/plugins/kyobobook-plugin/`:
- `main.js` (generated from build)
- `manifest.json`
- `styles.css`

## Template Variables

Available in note templates:
- `{{title}}`, `{{authors}}`, `{{publisher}}`, `{{publishDate}}`
- `{{isbn}}`, `{{pages}}`, `{{description}}`, `{{toc}}`
- `{{categories}}`, `{{tags}}`, `{{rating}}`, `{{url}}`
- `{{coverImage}}`, `{{created}}`

## Korean Language Support

- All UI text and default templates in Korean
- Handles Korean book metadata and encoding
- Template placeholders support Korean book information structure
- Default folder and file naming conventions follow Korean book organization patterns

## Network Dependencies

- Requires internet connection for Kyobobook API access
- Uses web scraping (no official API available)
- Respects Kyobobook's robots.txt and implements reasonable rate limiting
- Handles network failures gracefully with fallback to cached/partial data