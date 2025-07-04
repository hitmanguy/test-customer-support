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
  text: string;
  category: string;
  source: string;
  score?: number;
}

interface KnowledgeBaseSearchProps {
  companyId: string;
  onArticleSelect?: (article: KnowledgeBaseArticle) => void;
  initialQuery?: string;
}


const KnowledgeBaseSearch: React.FC<KnowledgeBaseSearchProps> = ({
  companyId,
  onArticleSelect,
  initialQuery = ''
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  
  
  const debouncedSearch = useRef(
    debounce((searchQuery: string) => {
      setDebouncedQuery(searchQuery);
    }, 300)
  ).current;
  
  
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);
    debouncedSearch(newQuery);
  }, [debouncedSearch]);  
  const { data, isLoading, isError, error } = trpc.companyDashboard.searchKnowledgeBase.useQuery(
    {
      query: debouncedQuery,
      companyId,
      topK: 10
    },
    {
      enabled: debouncedQuery.length > 2,
      staleTime: 30000 
    }
  );
  
  
  const handleArticleClick = useCallback((article: KnowledgeBaseArticle) => {
    if (onArticleSelect) {
      onArticleSelect(article);
    }
  }, [onArticleSelect]);
    
  const sortedResults = useMemo(() => {
    if (!data?.results) return [];
    
    
    return [...data.results].sort((a, b) => {
      const articleA = a as KnowledgeBaseArticle;
      const articleB = b as KnowledgeBaseArticle;
      if (articleA.score !== undefined && articleB.score !== undefined) {
        return articleB.score - articleA.score;
      }
      return articleA.title.localeCompare(articleB.title);
    });
  }, [data]);
  
  
  const categories = useMemo(() => {
    if (!data?.results) return [];
    
    const uniqueCategories = new Set<string>();
    data.results.forEach((article: KnowledgeBaseArticle) => {
      if (article.category) {
        uniqueCategories.add(article.category);
      }
    });
    
    return Array.from(uniqueCategories);
  }, [data]);
  
  return (
    <ErrorBoundary>
      <div className="space-y-4">
        {}
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
        
        {}
        {isError && (
          <div className="p-3 bg-red-50 text-red-700 rounded-md">
            Error searching knowledge base: {error?.message || 'Unknown error'}
          </div>
        )}
        
        {}
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
        
        {}
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
                    >                      <div className="space-y-2">
                        <h3 className="font-medium text-blue-700">{typedArticle.title}</h3>
                        <p className="text-sm text-gray-600 line-clamp-2">
                          {typedArticle.text.substring(0, 150)}...
                        </p>
                        <div className="flex justify-between items-center text-xs text-gray-500">
                          <span className="bg-gray-100 px-2 py-1 rounded">{typedArticle.category || 'Uncategorized'}</span>
                          <span>Source: {typedArticle.source}</span>
                          {typedArticle.score && (
                            <span className="bg-blue-100 px-2 py-1 rounded text-blue-800">
                              {Math.round(typedArticle.score * 100)}% match
                            </span>
                          )}
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


export default React.memo(KnowledgeBaseSearch);
