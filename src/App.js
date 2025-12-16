import React, { useState, useEffect, useCallback, useRef } from 'react';
import Map from './components/Map';
import axios from 'axios';
import 'mapbox-gl/dist/mapbox-gl.css';

axios.defaults.withCredentials = true;

function App() {
  const [articles, setArticles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const isUpdatingRef = useRef(false);
  const articlesRef = useRef([]);

  const fetchArticles = useCallback(async () => {
    if (isUpdatingRef.current) {
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await axios.get('/DC.json');
      if (Array.isArray(response.data)) {
        setArticles(response.data);
        articlesRef.current = response.data;
      } else {
        throw new Error('Received data is not an array');
      }
    } catch (error) {
      setError(error.message || 'An error occurred while fetching articles');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  const handleArticleUpdate = useCallback((updatedArticle) => {
    if (updatedArticle === null) {
      return;
    }
    if (!updatedArticle || !updatedArticle.location) {
      return;
    }
    isUpdatingRef.current = true;
    setArticles(prevArticles => {
      const newArticles = prevArticles.map(article => 
        article.location.address === updatedArticle.location.address ? updatedArticle : article
      );
      articlesRef.current = newArticles;
      return newArticles;
    });
    setTimeout(() => {
      isUpdatingRef.current = false;
    }, 0);
  }, []);

  return (
    <div>
      {isLoading ? (
        <p>Loading...</p>
      ) : (
        <Map articles={articlesRef.current} onArticleUpdate={handleArticleUpdate} />
      )}
      {error && <p>Error: {error}</p>}
    </div>
  );
}

export default App;
