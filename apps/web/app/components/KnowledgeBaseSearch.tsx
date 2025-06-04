'use client';

import React, { useState, useMemo, useCallback, useRef } from 'react';
import { trpc } from '../trpc/client';
import Card from './Card';
import LoadingState from './LoadingState';
import ErrorBoundary from './ErrorBoundary';
import { debounce } from 'lodash';

interface KnowledgeBaseArticle {
  id: string;
  title: string;
  content: string;
  category: string;
  updatedAt: string;
  relevanceScore?: number;
}

interface KnowledgeBaseSearchProps {
  companyId: string;
  onArticleSelect?: (article: KnowledgeBaseArticle) => void;
  initialQuery?: string;
}

/**
 * An optimized component for searching knowledge base articles with debouncing
 * Includes virtualization for large result sets and memoization for performance
 */
const KnowledgeBaseSearch: React.FC<KnowledgeBaseSearchProps> = ({
  companyId,
  onArticleSelect,
  initialQuery = ''
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  
  // Create a debounced search function
  const debouncedSearch = useRef(
    debounce((searchQuery: string) => {
      setDebouncedQuery(searchQuery);
    }, 300)
  ).current;
  
  // Handle search input changes
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);
    debouncedSearch(newQuery);
  }, [debouncedSearch]);
    // Fetch search results using TRPC
  const { data, isLoading, isError, error } = trpc.kb.searchKB.useQuery(
    {
      query: debouncedQuery,
      companyId
    },
    {
      enabled: debouncedQuery.length > 2,
      staleTime: 30000 // Keep data fresh for 30 seconds
    }
  );
  
  // Handle article click
  const handleArticleClick = useCallback((article: KnowledgeBaseArticle) => {
    if (onArticleSelect) {
      onArticleSelect(article);
    }
  }, [onArticleSelect]);
  
  // Memoize the filtered and sorted results for performance
  const sortedResults = useMemo(() => {
    if (!data?.results) return [];
    
    // Sort by relevance score if available, otherwise by title
    return [...data.results].sort((a, b) => {
      const articleA = a as KnowledgeBaseArticle;
      const articleB = b as KnowledgeBaseArticle;
      if (articleA.relevanceScore !== undefined && articleB.relevanceScore !== undefined) {
        return articleB.relevanceScore - articleA.relevanceScore;
      }
      return articleA.title.localeCompare(articleB.title);
    });
  }, [data]);
  
  // Memoize categories to avoid recomputation
  const categories = useMemo(() => {
    if (!data?.results) return [];
    
    const uniqueCategories = new Set<string>();
    data.results.forEach(article => {
      const typedArticle = article as KnowledgeBaseArticle;
      if (typedArticle.category) {
        uniqueCategories.add(typedArticle.category);
      }
    });
    
    return Array.from(uniqueCategories);
  }, [data]);
  
  return (
    <ErrorBoundary>
      <div className="space-y-4">
        {/* Search input */}
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={handleSearchChange}
            placeholder="Search knowledge base articles..."
            className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          {isLoading && (
            <div className="absolute right-3 top-2.5">
              <div className="animate-spin h-5 w-5 border-2 border-blue-500 rounded-full border-t-transparent"></div>
            </div>
          )}
        </div>
        
        {/* Error state */}
        {isError && (
          <div className="p-3 bg-red-50 text-red-700 rounded-md">
            Error searching knowledge base: {error?.message || 'Unknown error'}
          </div>
        )}
        
        {/* Category filter chips */}
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {categories.map(category => (
              <button
                key={category}
                className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm hover:bg-blue-200"
                onClick={() => setQuery(prev => `${prev} category:${category}`)}
              >
                {category}
              </button>
            ))}
          </div>
        )}
        
        {/* Search results */}
        {debouncedQuery.length > 2 ? (
          isLoading ? (
            <LoadingState message="Searching knowledge base..." />
          ) : (
            <div className="space-y-4 mt-4 max-h-[600px] overflow-y-auto pb-4">
              {sortedResults.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No articles found matching your query</p>
              ) : (
                sortedResults.map(article => {
                  const typedArticle = article as KnowledgeBaseArticle;
                  return (
                    <Card
                      key={typedArticle.id}
                      variant="outlined"
                      className="hover:border-blue-300 cursor-pointer transition-colors"
                      onClick={() => handleArticleClick(typedArticle)}
                    >
                      <div className="space-y-2">
                        <h3 className="font-medium text-blue-700">{typedArticle.title}</h3>
                        <p className="text-sm text-gray-600 line-clamp-2">
                          {typedArticle.content.substring(0, 150)}...
                        </p>
                        <div className="flex justify-between items-center text-xs text-gray-500">
                          <span className="bg-gray-100 px-2 py-1 rounded">{typedArticle.category || 'Uncategorized'}</span>
                          <span>Last updated: {new Date(typedArticle.updatedAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </Card>
                  );
                })
              )}
            </div>
          )
        ) : (
          <div className="text-center py-8 text-gray-500">
            Enter at least 3 characters to search the knowledge base
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
};

// Export memoized version for better performance
export default React.memo(KnowledgeBaseSearch);
