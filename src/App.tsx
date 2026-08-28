/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { ChatTutor } from './components/ChatTutor';
import { FlashcardsView } from './components/FlashcardsView';
import { VocabularyDuelView } from './components/VocabularyDuelView';
import { GraphMemoryView } from './components/GraphMemoryView';
import { CalendarPlanning } from './components/CalendarPlanning';
import { MaterialsView } from './components/MaterialsView';
import { WeeklyDashboard } from './components/WeeklyDashboard';
import { AchievementsView } from './components/AchievementsView';
import { LanguageThemeSelector } from './components/LanguageThemeSelector';
import { ScreenCaptureModal } from './components/ScreenCaptureModal';
import { Pricing } from './components/ui/single-pricing-card-1';
import { GridBackground } from './components/ui/grid-background';
import { CornerPlus } from './components/ui/corner-plus';
import { BorderTrailWrapper } from './components/ui/border-trail-card';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { UserStats, LanguageThemeId } from './types';
import { StorageService } from './services/storage';
import { getLanguageTheme, detectLanguageTheme } from './services/languageThemes';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('chat');
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
    const themeId = detectLanguageTheme(topic);
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
      className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-foreground selection:text-background transition-colors duration-500"
    >
      {/* Barra de Navegação Superior */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        stats={stats}
        currentTopic={currentTopic}
        onTopicClick={() => setShowTopicModal(true)}
        onResetData={handleResetData}
        onOpenScreenshotModal={() => setShowScreenshotModal(true)}
      />

      {/* Conteúdo Principal */}
      <div className="flex-1 flex flex-col bg-white">
        <main className="flex-1 p-2 sm:p-4 lg:p-6 max-w-7xl w-full mx-auto">
          <div
            id="main-app-content"
            className="rounded-[25px] border border-[#171719]/10 bg-white shadow-sm min-h-[calc(100vh-7.5rem)] flex flex-col transition-all duration-300"
          >
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

            {activeTab === 'graph' && <GraphMemoryView />}

            {activeTab === 'calendar' && <CalendarPlanning />}

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

            {activeTab === 'pricing' && <Pricing />}
          </div>
        </main>
      </div>

      {/* Modal para Alteração de Tópico de Estudos & Paleta Temática */}
      {showTopicModal && (
        <div className="fixed inset-0 z-50 bg-[#171719]/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative bg-white border border-[#171719]/15 rounded-[25px] max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-2xl text-[#171719] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#171719]/10 pb-4">
              <div className="space-y-1">
                <div className="inline-flex items-center rounded-full border border-[#171719]/15 bg-[#1ff98c] px-2.5 py-0.5 font-mono text-[10px] font-bold tracking-wider text-[#171719] uppercase">
                  IMMERSIVE SETUP
                </div>
                <h3 className="text-lg sm:text-xl font-extrabold tracking-tight text-[#171719] flex items-center gap-2">
                  <span>Alterar Idioma & Foco Temático</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full border border-[#171719]/20 bg-[#ededed] font-bold">
                    {activeLanguageTheme.bandeira} {activeLanguageTheme.nome}
                  </span>
                </h3>
              </div>
              <button
                onClick={() => setShowTopicModal(false)}
                className="text-[#71717a] hover:text-[#171719] text-sm font-semibold p-2 rounded-[9px] hover:bg-[#ededed] transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Seletor Visual de Idioma e Tema Dinâmico */}
            <LanguageThemeSelector
              currentLanguage={stats.idioma_ativo || currentTopic}
              onSelectLanguage={(langName, themeId) => {
                handleLanguageChange(langName, themeId);
              }}
            />

            {/* Trilhas Sugeridas de Tópicos */}
            <div className="space-y-3 pt-3 border-t border-[#171719]/10">
              <span className="text-[#171719] font-bold text-xs uppercase tracking-wider block">
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
                      className={`p-3 rounded-[9px] border text-left font-semibold transition text-xs flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? 'bg-[#171719] text-white border-[#171719] shadow-xs'
                          : 'bg-[#ededed] border-transparent text-[#171719] hover:bg-[#e2e2e2]'
                      }`}
                    >
                      <span className="truncate">{t}</span>
                      {isSelected && (
                        <span className="px-2 py-0.5 rounded-full bg-[#1ff98c] text-[#171719] font-extrabold text-[9px] shrink-0 ml-1">
                          ATIVO
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Tópico Personalizado */}
              <form onSubmit={handleSaveCustomTopic} className="pt-4 border-t border-[#171719]/10 space-y-2">
                <label className="text-[#171719] font-bold text-xs block">
                  Ou defina um tema de foco livre:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customTopicInput}
                    onChange={(e) => setCustomTopicInput(e.target.value)}
                    placeholder="Ex: Espanhol para Negócios, Francês A2, Entrevistas em Inglês..."
                    className="flex-1 bg-white border border-[#171719]/20 rounded-[9px] px-3.5 py-2 text-xs text-[#171719] placeholder:text-[#71717a] focus:outline-none focus:ring-2 focus:ring-[#1ff98c]"
                  />
                  <Button type="submit" size="sm" variant="default">
                    Definir Foco
                  </Button>
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



