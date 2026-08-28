import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { HomeOverview } from './components/HomeOverview';
import { ChatTutor } from './components/ChatTutor';
import { FlashcardsView } from './components/FlashcardsView';
import { VocabularyDuelView } from './components/VocabularyDuelView';
import { GraphMemoryView } from './components/GraphMemoryView';
import { MaterialsView } from './components/MaterialsView';
import { MisconceptionsDictionary } from './components/MisconceptionsDictionary';
import { WeeklyDashboard } from './components/WeeklyDashboard';
import { AchievementsView } from './components/AchievementsView';
import { LanguageThemeSelector } from './components/LanguageThemeSelector';
import { ScreenCaptureModal } from './components/ScreenCaptureModal';
import { UserStats, LanguageThemeId } from './types';
import { StorageService } from './services/storage';
import { getLanguageTheme, detectLanguageTheme } from './services/languageThemes';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('home');
  const [currentTopic, setCurrentTopic] = useState<string>('Inglês: Connected Speech & Pronúncia Natural');
  const [stats, setStats] = useState<UserStats>(StorageService.getStats());
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [showScreenshotModal, setShowScreenshotModal] = useState(false);
  const [customTopicInput, setCustomTopicInput] = useState('');

  // Identificação do Tema do Idioma Ativo
  const activeLanguageTheme = getLanguageTheme(stats.idioma_ativo || currentTopic);

  useEffect(() => {
    // Sincroniza dados iniciais
    setStats(StorageService.getStats());
  }, []);

  const handleUpdateStats = (newStats: UserStats) => {
    setStats(newStats);
  };

  const handleResetData = () => {
    if (
      window.confirm(
        'Tem certeza de que deseja restaurar todos os dados para o padrão inicial do MVP? Isto resetará o chat, grafo e materiais de teste.'
      )
    ) {
      StorageService.resetToDefaults();
      setStats(StorageService.getStats());
      window.location.reload();
    }
  };

  const handleSelectTopic = (topic: string) => {
    setCurrentTopic(topic);
    const langConfig = getLanguageTheme(topic);
    const updatedStats = { ...stats, idioma_ativo: langConfig.nome };
    StorageService.saveStats(updatedStats);
    setStats(updatedStats);
    setActiveTab('chat');
  };

  const handleLanguageChange = (langName: string, themeId: LanguageThemeId) => {
    let defaultTopicForLang = `${langName}: Conversação Cotidiana & Vocabulário Essencial`;
    if (langName === 'Inglês') defaultTopicForLang = 'Inglês: Connected Speech & Pronúncia Natural';
    if (langName === 'Espanhol') defaultTopicForLang = 'Espanhol: Conversação Cotidiana & Diferenças Culturais';
    if (langName === 'Francês') defaultTopicForLang = 'Francês: Pronúncia & Vocabulário para Viagens';
    if (langName === 'Alemão') defaultTopicForLang = 'Alemão: Estrutura de Frases & Artigos';
    if (langName === 'Italiano') defaultTopicForLang = 'Italiano: Pronúncia Melódica & Expressões Diárias';
    if (langName === 'Japonês') defaultTopicForLang = 'Japonês: Hiragana, Katakana & Saudações Contextuais';

    setCurrentTopic(defaultTopicForLang);
    const updatedStats = { ...stats, idioma_ativo: langName };
    StorageService.saveStats(updatedStats);
    setStats(updatedStats);
  };

  const handleSaveCustomTopic = (e: React.FormEvent) => {
    e.preventDefault();
    if (customTopicInput.trim()) {
      handleSelectTopic(customTopicInput.trim());
      setCustomTopicInput('');
      setShowTopicModal(false);
    }
  };

  const presetTopics = [
    'Inglês: Connected Speech & Pronúncia Natural',
    'Inglês: Falsos Amigos & Vícios de Tradução',
    'Inglês: Phrasal Verbs Essenciais no Trabalho',
    'Espanhol: Conversação Cotidiana & Diferenças Culturais',
    'Espanhol: Falsos Amigos & Verbos Reflexivos',
    'Francês: Pronúncia & Vocabulário para Viagens',
    'Alemão: Estrutura de Frases & Artigos',
    'Italiano: Expressões Idiomáticas & Pronúncia Melódica',
    'Japonês: Frases Essenciais & Estrutura Contextual',
  ];

  return (
    <div
      data-lang-theme={activeLanguageTheme.id}
      className="min-h-screen flex flex-col font-sans transition-colors duration-500 relative"
    >
      {/* Background Animated Blobs */}
      <div className="blobs" aria-hidden="true">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
      </div>

      {/* Floating Pill Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        stats={stats}
        currentTopic={currentTopic}
        onTopicClick={() => setShowTopicModal(true)}
        onResetData={handleResetData}
        onOpenScreenshotModal={() => setShowScreenshotModal(true)}
      />

      {/* Main View Container */}
      <div className="flex-1 flex flex-col max-w-6xl w-full mx-auto px-4 sm:px-6 py-6">
        <main className="flex-1 flex flex-col">
          <div id="main-app-content" className="w-full flex-1 flex flex-col">
            {activeTab === 'home' && (
              <HomeOverview
                stats={stats}
                currentTopic={currentTopic}
                onNavigate={(tab) => setActiveTab(tab)}
              />
            )}

            {activeTab === 'chat' && (
              <ChatTutor
                currentTopic={currentTopic}
                stats={stats}
                onUpdateStats={handleUpdateStats}
                onSelectTopic={handleSelectTopic}
              />
            )}

            {activeTab === 'flashcards' && (
              <FlashcardsView
                currentTopic={currentTopic}
                stats={stats}
                onUpdateStats={handleUpdateStats}
                onNavigateToGraph={() => setActiveTab('graph')}
                onPracticeInChat={(topic) => {
                  setCurrentTopic(topic);
                  setActiveTab('chat');
                }}
              />
            )}

            {activeTab === 'duel' && (
              <VocabularyDuelView
                currentTopic={currentTopic}
                stats={stats}
                onUpdateStats={handleUpdateStats}
                onNavigateToGraph={() => setActiveTab('graph')}
                onPracticeInChat={(topic) => {
                  setCurrentTopic(topic);
                  setActiveTab('chat');
                }}
              />
            )}

            {activeTab === 'materials' && (
              <MaterialsView
                onPracticeInChat={(topic, language) => {
                  setCurrentTopic(`${language}: ${topic}`);
                  setActiveTab('chat');
                }}
              />
            )}

            {activeTab === 'misconceptions' && (
              <MisconceptionsDictionary
                onPracticeTopic={(topic) => {
                  setCurrentTopic(topic);
                  setActiveTab('chat');
                }}
              />
            )}

            {activeTab === 'graph' && <GraphMemoryView />}

            {activeTab === 'dashboard' && (
              <WeeklyDashboard
                onStartReview={(topic) => {
                  setCurrentTopic(topic);
                  setActiveTab('chat');
                }}
              />
            )}

            {activeTab === 'achievements' && (
              <AchievementsView
                stats={stats}
                onUpdateStats={handleUpdateStats}
                onResetData={handleResetData}
              />
            )}
          </div>
        </main>
      </div>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto w-full px-6 py-6 text-xs sm:text-sm text-[var(--muted)] flex items-center justify-between gap-4 flex-wrap border-t border-[var(--border)] mt-auto">
        <span>
          <strong className="font-display text-[var(--fg)]">Lingo</strong> · tutor de idiomas com memória relacional em grafo
        </span>
        <button
          onClick={handleResetData}
          className="text-[var(--accent-deep)] hover:underline font-extrabold cursor-pointer"
        >
          Restaurar dados padrão
        </button>
      </footer>

      {/* Modal para Alteração de Tópico & Idioma */}
      {showTopicModal && (
        <div className="fixed inset-0 z-50 bg-[oklch(0.32_0.07_285_/_0.42)] backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r-lg)] max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-[var(--shadow)] text-[var(--fg)] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
              <div className="space-y-1">
                <div className="inline-flex items-center rounded-full bg-[var(--sunny)] px-2.5 py-0.5 text-[11px] font-extrabold text-[var(--fg)]">
                  IDIOMA & FOCO
                </div>
                <h3 className="text-xl font-bold font-display text-[var(--fg)] flex items-center gap-2">
                  <span>Alterar Idioma & Tópico</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full border border-[var(--border)] bg-[oklch(0.965_0.01_84)] font-bold">
                    {activeLanguageTheme.bandeira} {activeLanguageTheme.nome}
                  </span>
                </h3>
              </div>
              <button
                onClick={() => setShowTopicModal(false)}
                className="text-[var(--muted)] hover:text-[var(--fg)] p-2 rounded-full hover:bg-[oklch(0.955_0.012_84)] transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Seletor Visual de Idioma */}
            <LanguageThemeSelector
              currentLanguage={stats.idioma_ativo || currentTopic}
              onSelectLanguage={(langName, themeId) => {
                handleLanguageChange(langName, themeId);
              }}
            />

            {/* Trilhas Sugeridas de Tópicos */}
            <div className="space-y-3 pt-3 border-t border-[var(--border)] text-left">
              <span className="text-[var(--fg)] font-bold text-xs uppercase tracking-wider block">
                Trilhas Recomendadas:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {presetTopics.map((t, idx) => {
                  const isSelected = currentTopic === t;
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        handleSelectTopic(t);
                        setShowTopicModal(false);
                      }}
                      className={`p-3 rounded-xl border text-left font-bold transition text-xs flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? 'bg-[var(--fg)] text-[oklch(0.97_0.01_84)] border-[var(--fg)] shadow-xs'
                          : 'bg-[oklch(0.965_0.01_84)] border-transparent text-[var(--fg)] hover:bg-[oklch(0.94_0.02_84)]'
                      }`}
                    >
                      <span className="truncate">{t}</span>
                      {isSelected && (
                        <span className="px-2 py-0.5 rounded-full bg-[var(--accent)] text-[var(--fg)] font-extrabold text-[9px] shrink-0 ml-1">
                          ATIVO
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Tópico Personalizado */}
              <form onSubmit={handleSaveCustomTopic} className="pt-4 border-t border-[var(--border)] space-y-2">
                <label className="text-[var(--fg)] font-bold text-xs block">
                  Ou defina um tema de foco livre:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customTopicInput}
                    onChange={(e) => setCustomTopicInput(e.target.value)}
                    placeholder="Ex: Espanhol para Negócios, Francês para Viagens, Entrevistas em Inglês..."
                    className="flex-1 bg-[var(--surface)] border-2 border-[var(--border)] rounded-full px-4 py-2 text-xs sm:text-sm text-[var(--fg)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)]"
                  />
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-full font-extrabold text-xs bg-[var(--accent)] text-[var(--fg)] hover:bg-[var(--accent-deep)] transition shadow-xs cursor-pointer"
                  >
                    Definir Foco
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Captura de Telas em PNG */}
      <ScreenCaptureModal
        isOpen={showScreenshotModal}
        onClose={() => setShowScreenshotModal(false)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />
    </div>
  );
}
