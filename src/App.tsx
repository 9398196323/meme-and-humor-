import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar.tsx';
import { MemeStudio } from './components/MemeStudio.tsx';
import { CaptionGenerator } from './components/CaptionGenerator.tsx';
import { JokeVault } from './components/JokeVault.tsx';
import { FavoritesView } from './components/FavoritesView.tsx';
import { HistoryView } from './components/HistoryView.tsx';
import { Toast } from './components/Toast.tsx';
import { GenerateResponse, MemeIdea, FavoriteRecord, HistoryRecord, HealthStatus } from './types.ts';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('memes');
  const [currentResults, setCurrentResults] = useState<GenerateResponse | null>(null);
  const [favorites, setFavorites] = useState<FavoriteRecord[]>([]);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Set of saved idea titles for quick lookup
  const savedIdeaTitles = new Set(favorites.map((f) => f.content?.title).filter(Boolean));

  useEffect(() => {
    fetchHealth();
    fetchFavorites();
    fetchHistory();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  const fetchHealth = async () => {
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      setHealth(data);
    } catch {
      setHealth({
        status: 'offline',
        service: 'Meme Generator',
        ai_configured: false,
        provider: 'Offline Fallback Engine',
        database: 'Local Store'
      });
    }
  };

  const fetchFavorites = async () => {
    try {
      const res = await fetch('/api/favorites');
      const data = await res.json();
      if (data.favorites) {
        setFavorites(data.favorites);
      }
    } catch (err) {
      console.error('Error fetching favorites:', err);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/history');
      const data = await res.json();
      if (data.history) {
        setHistory(data.history);
      }
    } catch (err) {
      console.error('Error fetching history:', err);
    }
  };

  const handleGenerate = async (params: {
    topic: string;
    category: string;
    style: string;
    intensity: string;
    language: string;
    count: number;
  }) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      const data = await res.json();
      if (res.ok) {
        setCurrentResults(data);
        fetchHistory();
        showToast('Generated 5 ideas');
      } else {
        showToast(data.error || 'Generation failed');
      }
    } catch (err) {
      showToast('Network error during generation');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefine = async (idea: MemeIdea, instruction: string, index: number) => {
    try {
      const res = await fetch('/api/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idea,
          instruction,
          language: currentResults?.language || 'English',
        }),
      });

      const data = await res.json();
      if (res.ok && data.refined_idea && currentResults) {
        const updatedIdeas = [...currentResults.ideas];
        updatedIdeas[index] = data.refined_idea;
        setCurrentResults({
          ...currentResults,
          ideas: updatedIdeas,
        });
      }
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const handleSaveFavorite = async (
    idea: MemeIdea,
    topic: string,
    category: string,
    language: string
  ): Promise<boolean> => {
    try {
      const res = await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic || idea.title,
          category,
          language,
          content: idea,
        }),
      });

      if (res.ok) {
        await fetchFavorites();
        showToast('Saved to Favorites!');
        return true;
      }
      return false;
    } catch {
      showToast('Error saving favorite');
      return false;
    }
  };

  const handleDeleteFavorite = async (id: number) => {
    try {
      const res = await fetch(`/api/favorites/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchFavorites();
        showToast('Favorite removed');
      }
    } catch {
      showToast('Failed to delete favorite');
    }
  };

  const handleReopenHistory = (record: HistoryRecord) => {
    if (record.result) {
      setCurrentResults(record.result);
      setActiveTab('memes');
      showToast(`Reopened previous prompt: "${record.topic}"`);
    }
  };

  const handleClearHistory = async () => {
    try {
      const res = await fetch('/api/history', { method: 'DELETE' });
      if (res.ok) {
        setHistory([]);
        showToast('History cleared');
      }
    } catch {
      showToast('Failed to clear history');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        favoritesCount={favorites.length}
        health={health}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {activeTab === 'memes' && (
          <MemeStudio
            currentResults={currentResults}
            onGenerate={handleGenerate}
            onRefine={handleRefine}
            onSaveFavorite={handleSaveFavorite}
            savedIdeaTitles={savedIdeaTitles}
            isLoading={isLoading}
            onShowToast={showToast}
          />
        )}

        {activeTab === 'captions' && (
          <CaptionGenerator onShowToast={showToast} />
        )}

        {activeTab === 'jokes' && (
          <JokeVault onShowToast={showToast} />
        )}

        {activeTab === 'favorites' && (
          <FavoritesView
            favorites={favorites}
            onDeleteFavorite={handleDeleteFavorite}
            onShowToast={showToast}
            onNavigateToStudio={() => setActiveTab('memes')}
          />
        )}

        {activeTab === 'history' && (
          <HistoryView
            history={history}
            onReopen={handleReopenHistory}
            onClearHistory={handleClearHistory}
            onShowToast={showToast}
          />
        )}
      </main>


      {/* Floating Toast Notification */}
      <Toast message={toastMessage} />
    </div>
  );
}
