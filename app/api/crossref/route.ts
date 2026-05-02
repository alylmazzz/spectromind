import { NextRequest, NextResponse } from 'next/server';

/**
 * Crossref API Route
 *
 * Searches academic literature for publications related to molecules and NMR spectroscopy
 * Uses Crossref REST API to find DOIs and publication metadata
 *
 * Query Parameters:
 * - query: Molecule name or search term (required)
 * - rows: Number of results to return (default: 10, max: 20)
 */

interface CrossrefPublication {
  doi: string;
  title: string;
  authors?: string[];
  published?: string;
  journal?: string;
  abstract?: string;
  url: string;
}

interface CrossrefResponse {
  success: boolean;
  query: string;
  publications: CrossrefPublication[];
  totalResults: number;
  source: string;
  message?: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query');
  const rows = Math.min(parseInt(searchParams.get('rows') || '10'), 20); // Max 20 results

  console.log('\n📚 Crossref API Request:');
  console.log(`  Query: ${query}`);
  console.log(`  Results: ${rows}`);

  if (!query) {
    return NextResponse.json({
      success: false,
      query: '',
      publications: [],
      totalResults: 0,
      source: 'Crossref',
      message: 'Query parameter is required'
    }, { status: 400 });
  }

  try {
    // Build Crossref API URL
    // Search strategy (multi-strategy for better coverage):
    //
    // Problem: Many papers mention NMR in methods/abstract but NOT in title
    // Solution: Try multiple search strategies and merge results
    //
    // Strategy 1: "{molecule} NMR" - Direct NMR papers
    // Strategy 2: "{molecule} spectroscopy" - Broader search
    // Strategy 3: Just "{molecule}" - Get all papers, filter later
    //
    // For now, using broadest search (Strategy 1 + 2 combined)
    const searchQuery = `${query} (NMR OR spectroscopy OR characterization)`;
    const encodedQuery = encodeURIComponent(searchQuery);

    // ✅ Use general 'query' parameter (searches all fields: title, abstract, full-text)
    // ❌ NOT 'query.title' (only searches title - misses 80%+ of papers!)
    //
    // Filter by journal articles only (excludes books, proceedings, etc.)
    const url = `https://api.crossref.org/works?query=${encodedQuery}&filter=type:journal-article&rows=${rows}&select=DOI,title,author,published,container-title,abstract`;

    console.log(`🌐 Crossref URL: ${url}`);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'NMR-MIND-App/1.0 (mailto:support@spectromind.com)'
      }
    });

    if (!response.ok) {
      console.error(`❌ Crossref API error: HTTP ${response.status}`);
      return NextResponse.json({
        success: false,
        query,
        publications: [],
        totalResults: 0,
        source: 'Crossref',
        message: `Crossref API returned error: ${response.status}`
      }, { status: response.status });
    }

    const data = await response.json();
    const items = data.message?.items || [];
    const totalResults = data.message?.['total-results'] || 0;

    console.log(`📊 Found ${totalResults} total results, returning ${items.length}`);

    // Parse publications
    const publications: CrossrefPublication[] = items.map((item: any) => {
      // Extract authors
      const authors = item.author?.slice(0, 3).map((author: any) =>
        `${author.given || ''} ${author.family || ''}`.trim()
      ) || [];

      // Extract publication date
      let published: string | undefined;
      if (item.published?.['date-parts']?.[0]) {
        const dateParts = item.published['date-parts'][0];
        published = dateParts.join('-');
      }

      // Extract title (can be array)
      const title = Array.isArray(item.title) ? item.title[0] : item.title;

      // Extract journal name
      const journal = Array.isArray(item['container-title'])
        ? item['container-title'][0]
        : item['container-title'];

      return {
        doi: item.DOI,
        title: title || 'Untitled',
        authors: authors.length > 0 ? authors : undefined,
        published,
        journal,
        abstract: item.abstract,
        url: `https://doi.org/${item.DOI}`
      };
    });

    // Log publications
    publications.forEach((pub, index) => {
      console.log(`  ${index + 1}. ${pub.title}`);
      console.log(`     DOI: ${pub.doi}`);
      console.log(`     Published: ${pub.published || 'N/A'}`);
      if (pub.authors) {
        console.log(`     Authors: ${pub.authors.join(', ')}`);
      }
    });

    return NextResponse.json({
      success: publications.length > 0,
      query: searchQuery,
      publications,
      totalResults,
      source: 'Crossref',
      message: publications.length === 0 ? `No publications found for "${query} NMR"` : undefined
    });

  } catch (error) {
    console.error('❌ Error fetching from Crossref:', error);
    return NextResponse.json({
      success: false,
      query,
      publications: [],
      totalResults: 0,
      source: 'Crossref',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}
